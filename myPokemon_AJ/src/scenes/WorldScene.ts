import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon, createFromSpecies } from "../data/Pokemon";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import DialogBox from "../ui/DialogBox";
import { REGION_MAPS, REGION_COLS, REGION_ROWS, mapAtGlobal, toGlobal, toLocal, assertRegionMatches, RegionMap } from "../data/region";
import { getEncounters, getMapTrainers, loadArDb } from "../data/ar";
import type { TrainerPlacement } from "../data/ar";
import { encounterTriggered, chooseWildPokemon, resetEncounterSteps } from "../systems/encounter";

// 야외 = 어나더레드에서 그대로 추출한 맵 3장을 **하나로 이어붙인 리전**(52×100칸).
//  - 위에서부터 상록시티(0~39) · 1번도로(40~79) · 태초마을(80~99). 배치 근거는 src/data/region.ts 주석 참고
//    (AR map_connections.dat에서 셋 다 오프셋 0으로 수직 연결인 걸 확인함).
//  - 맵 경계에 암전·로딩이 없다. 그냥 걸어서 넘어간다(HGSS 감성).
//  - 격자(칸) 단위 이동 + 카메라가 주인공을 따라감.
//
// ⚠️ 이 씬 안의 좌표(this.tx/ty, warps, walkable)는 전부 **리전 글로벌**이다.
//    다른 씬이 "태초마을의 (28,14)"처럼 맵 기준으로 말할 땐 map 이름을 같이 넘긴다(init 참고).
type Dir = "down" | "left" | "right" | "up";
interface Warp { x: number; y: number; to: string; dir?: Dir; room?: string }

const SCALE = 2;                              // 화면 확대(타일 32→64px)
const START_MAP = "pallet";
const START_LOCAL = { x: 17, y: 8 };          // 태초마을 기준 우리집 문 앞

// 첫 라이벌 배틀 — 네모는 연구소에서 **먼저 나가**(LabScene의 퇴장 컷신) 밖에서 기다리고 있다.
//  기다리는 자리는 고정좌표가 아니라 **플레이어가 서 있는 줄의 옆 칸들**로 잡는다(RIVAL_GAP칸 떨어져 대기 → 걸어옴).
//  ⚠️ 고정좌표로 박으면 안 된다: 라이벌전에서 지면 집으로 보내지고 예약은 남아 있어(이겼을 때만 소비) 집 앞에서 재대결이
//     걸리는데, 그때 네모가 연구소 앞 좌표에 서 있으면 화면 밖에서 혼자 걷고 플레이어만 얼어붙는다.
const RIVAL_GAP = 4;   // 처음 서서 기다리는 거리(칸)

// 방향 → 한 칸 벡터. 트레이너 시야가 어느 쪽으로 뻗는지 계산하는 데 쓴다.
const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

// 맵 위에 서 있는 트레이너 한 명(AR 맵 이벤트에서 그대로 가져온 것).
interface TrainerNpc {
  spot: TrainerPlacement;
  gx: number; gy: number;      // 리전 글로벌 좌표(spot.x/y는 맵 로컬이다)
  sheet: string;               // 오버월드 스프라이트시트 키
  sprite: Phaser.GameObjects.Sprite;
  defeated: boolean;           // 이미 이긴 상대 → 시야에 안 걸린다
}

export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "down";

  // 리전 전체 격자(맵 3장을 이어붙인 것). 좌표는 전부 글로벌.
  private cols = REGION_COLS; private rows = REGION_ROWS;
  private blocked: number[][] = [];
  private grass: number[][] = [];   // 1 = 풀숲(야생 조우 판정 칸). 풀숲 없는 맵은 전부 0으로 남는다.
  private tile = 32 * SCALE;
  private tx = 0; private ty = 0;
  private moving = false; private busy = false;
  private lastBump = 0;   // 벽 부딪힘 효과음 연타 방지용
  private curMap?: RegionMap;   // 지금 서 있는 맵(배틀 배경·저장·위치표시에 쓴다)

  // 워프는 "어느 맵의 어느 칸"으로 적는다(로컬 좌표 — 원본 맵 기준이라 읽기 쉽다).
  // create()에서 글로벌로 바꿔 this.warps에 넣는다.
  private warpDefs: (Warp & { map: string })[] = [
    { map: "pallet", x: 28, y: 14, to: "lab", dir: "up" },                    // 포켓몬 연구소
    { map: "pallet", x: 17, y: 7, to: "house", room: "living", dir: "up" },   // 우리집(거실로)
    // 상록체육관 — 문 칸·도착 좌표 전부 AR 원본 Map56 이벤트(Home door)의 transfer 값이다(눈대중 아님).
    { map: "viridian_city", x: 35, y: 9, to: "gym", dir: "up" },
    // 상록 포켓몬센터(AR Map158)·프렌들리 숍(AR Map159) — 문 칸도 Map56 transfer 값 그대로.
    { map: "viridian_city", x: 26, y: 25, to: "pc", dir: "up" },
    { map: "viridian_city", x: 35, y: 25, to: "mart", dir: "up" },
  ];
  private warps: Warp[] = [];   // create()에서 글로벌로 변환된 것

  private spawn = { x: 0, y: 0, face: "down" as Dir };
  private autoMenu = false;   // 디버그 '인게임 메뉴' 바로가기: 마을 위에 메뉴를 바로 연다
  private trainers: TrainerNpc[] = [];          // 맵에 서 있는 트레이너들(1번도로 반바지꼬마·짧은치마)
  private setupRun = 0;                         // setupTrainers 실행 번호(씬 재시작 시 옛 실행을 무시하려고)
  private nemona?: Phaser.GameObjects.Sprite;   // 첫 배틀 때 밖에서 기다리는 네모(그 외엔 없음)
  private rival?: { path: [number, number][]; from: "left" | "right" };   // 네모가 걸어올 길(플레이어 기준으로 잡음)
  private dlg!: DialogBox;
  private onResize = (): void => this.dlg.layout();

  constructor() { super("WorldScene"); }

  // spawn 좌표의 의미가 두 가지다 — 안 지키면 엉뚱한 맵에 떨어진다:
  //   · map을 같이 주면  → spawn은 **그 맵 기준 로컬** (예: LabScene이 "태초마을 (28,15)"로 내보냄)
  //   · map이 없으면     → spawn은 **리전 글로벌** (예: BattleScene이 돌려주는 returnPos = 배틀 걸린 그 자리)
  init(data: { spawn?: [number, number]; map?: string; face?: Dir; openMenu?: boolean }): void {
    // ⚠️ Phaser는 씬을 다시 시작해도 **같은 인스턴스**를 쓴다 → 클래스 필드(= 위의 `busy = false`)는 다시 초기화되지 않는다.
    //    배틀·워프로 나갈 때 켜둔 busy를 여기서 안 되돌리면 돌아왔을 때 켜진 채로 남아 **플레이어가 영영 얼어붙는다**
    //    (update()가 busy면 입력을 통째로 무시한다). init은 scene.start마다 도는 유일한 자리다.
    this.busy = false;
    this.moving = false;
    const face = data?.face ?? "down";
    if (data?.spawn) {
      const [gx, gy] = data.map ? toGlobal(data.map, data.spawn[0], data.spawn[1]) : data.spawn;
      this.spawn = { x: gx, y: gy, face };
    } else {
      const [gx, gy] = toGlobal(START_MAP, START_LOCAL.x, START_LOCAL.y);
      this.spawn = { x: gx, y: gy, face: "down" };
    }
    this.autoMenu = !!data?.openMenu;
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    // 맵 3장을 각각 불러온다(큰 PNG를 새로 굽지 않는다 — region.ts 주석 참고).
    // ⚠️ 캐시에 남은 옛 격자를 먼저 지운다 — 안 지우면 맵 JSON을 고치고 씬을 다시 들어와도
    //    "고쳤는데 똑같다"가 된다(.claude/rules/maps-collision.md 5번).
    for (const m of REGION_MAPS) {
      this.cache.json.remove(`${m.name}_col`);
      this.load.image(m.name, `${m.img}?v=` + Date.now());
      this.load.json(`${m.name}_col`, `${m.data}?v=` + Date.now());
    }
    preloadCommonAudio(this);
    const file = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
    // 라이벌(네모) 오버월드 스프라이트 — 스타터 선택 직후 첫 배틀 연출용.
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    // 리전 격자를 "전부 막힘"으로 깔고, 맵 3장의 blocked를 각자 오프셋 위치에 찍어 넣는다.
    //  (맵이 안 덮는 칸은 막힌 채로 남아 밖으로 못 나간다 — 리전 가장자리 보호막 역할)
    this.blocked = Array.from({ length: REGION_ROWS }, () => new Array<number>(REGION_COLS).fill(1));
    // 풀숲은 반대로 "전부 아님(0)"으로 깔고 맵이 준 칸만 켠다(맵 밖은 풀숲이 아니다).
    this.grass = Array.from({ length: REGION_ROWS }, () => new Array<number>(REGION_COLS).fill(0));
    for (const m of REGION_MAPS) {
      // grass는 풀숲이 있는 맵(1번도로)에만 있다 — 없는 맵은 extract-map.py가 키를 아예 안 넣는다.
      const col = this.cache.json.get(`${m.name}_col`) as { cols: number; rows: number; blocked: number[][]; grass?: number[][] };
      assertRegionMatches(m.name, col.cols, col.rows);   // 크기가 어긋나면 조용히 깨지지 말고 여기서 죽어라
      for (let y = 0; y < col.rows; y++)
        for (let x = 0; x < col.cols; x++) {
          this.blocked[y + m.oy][x + m.ox] = col.blocked[y][x];
          if (col.grass) this.grass[y + m.oy][x + m.ox] = col.grass[y][x];
        }
      this.textures.get(m.name).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.add.image(m.ox * this.tile, m.oy * this.tile, m.name).setOrigin(0, 0).setScale(SCALE).setDepth(0);
    }
    // 워프(로컬로 적어둔 것)를 글로벌로 바꾼다.
    this.warps = this.warpDefs.map(w => {
      const [gx, gy] = toGlobal(w.map, w.x, w.y);
      return { x: gx, y: gy, to: w.to, dir: w.dir, room: w.room };
    });

    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const mkWalk = (key: string, frames: number[]) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mkWalk("walk-down", [0, 1, 2, 3]); mkWalk("walk-left", [4, 5, 6, 7]);
    mkWalk("walk-right", [8, 9, 10, 11]); mkWalk("walk-up", [12, 13, 14, 15]);
    // 네모 걷기 애니(주인공과 같은 시트 배치). 애니는 게임 전역이라 재입장 시 이미 있을 수 있다.
    const mkNem = (key: string, frames: number[]) => {
      if (!this.anims.exists(`nem-${key}`))
        this.anims.create({ key: `nem-${key}`, frames: this.anims.generateFrameNumbers("nemona_ow", { frames }), frameRate: 8, repeat: -1 });
    };
    mkNem("down", [0, 1, 2, 3]); mkNem("left", [4, 5, 6, 7]); mkNem("right", [8, 9, 10, 11]); mkNem("up", [12, 13, 14, 15]);

    this.tx = this.spawn.x; this.ty = this.spawn.y; this.facing = this.spawn.face;
    this.curMap = mapAtGlobal(this.tx, this.ty);   // 시작 시점의 맵(이름 배너는 안 띄운다 — 들어온 게 아니라 원래 거기다)
    this.player = this.add.sprite(this.cx(this.tx), this.cy(this.ty), this.texKey, this.idleFrame[this.facing])
      .setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);
    // ⚠️ this.scale은 씬이 아니라 게임 전역 이벤트원이다 → off("resize")를 콜백 없이 부르면 '다른 씬 리스너까지' 다 지운다.
    this.scale.on("resize", this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.onResize); this.dlg.destroy(); });

    // 첫 라이벌 배틀이 예약돼 있으면 = 네모는 연구소를 먼저 나와 **밖에서 이미 기다리고 있다**.
    //  (플레이어가 문에서 나오는 순간 뒤에서 따라 내려오면 "안에 있다 따라나온" 꼴이라 흐름이 어긋난다.)
    if (this.registry.get("rivalBattlePending")) {
      this.rival = this.rivalApproach();
      if (this.rival) {
        const [wx, wy] = this.rival.path[0];   // 처음 서 있는 자리(가장 먼 칸)
        this.textures.get("nemona_ow").setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.nemona = this.add.sprite(this.cx(wx), this.cy(wy), "nemona_ow",
          this.rival.from === "left" ? this.idleFrame.right : this.idleFrame.left)   // 플레이어 쪽을 보고 선다
          .setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
        this.busy = true;   // 컷신이 시작될 때까지 플레이어가 움직여 좌표가 어긋나지 않게 미리 잠근다
      }
    }

    // 카메라: 맵 경계 설정 + 주인공 추적, 픽셀 또렷하게
    this.cameras.main.setBounds(0, 0, this.cols * this.tile, this.rows * this.tile);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    playBgm(this, this.curMap?.bgm ?? BGM.town, 0.35);   // 시작한 맵의 BGM(태초=KM_Pallet, 1번도로=KM_Route1 …)

    // HUD(화면 고정)
    const name = (this.registry.get("playerName") as string) ?? "";
    // 조작 안내는 맵과 무관한 것만 적는다 — 리전이 3장이 되면서 "연구소 문으로" 안내가 1번도로·상록시티에서도 떠서 틀렸다.
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  Enter: 메뉴`, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);
    // Enter/X = 인게임 메뉴(포켓몬/가방/저장) 오버레이 열기.
    this.input.keyboard!.on("keydown-ENTER", () => this.openMenu());
    this.input.keyboard!.on("keydown-X", () => this.openMenu());
    // 메뉴 닫혀 이 씬이 재개되면 입력을 다시 켠다.
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.input.enabled = true; });

    // 디버그 '인게임 메뉴' 바로가기로 진입 시: 마을을 먼저 그린 뒤 그 위에 메뉴 오버레이를 연다
    //  (예전엔 MenuScene을 단독 start해 뒤에 아무것도 없어 '검은 배경 위 메뉴'로 보였다).
    if (this.autoMenu) this.time.delayedCall(80, () => this.openMenu());

    // 연구소에서 스타터를 고르고 나왔다면: 밖에서 기다리던 네모가 다가와 첫 라이벌 배틀을 건다.
    this.time.delayedCall(450, () => this.maybeStartRivalBattle());

    // 트레이너 배치는 AR DB(비동기 fetch)가 있어야 알 수 있다 → 따로 띄운다.
    this.setupTrainers().catch((e) => console.error("[WorldScene] 트레이너 배치 실패:", e));
  }

  // ── 트레이너 ────────────────────────────────────────────
  // AR 맵 이벤트에 적힌 그대로 트레이너를 세운다(좌표·방향·시야·대사 전부 trainers.json에서 온다).
  private async setupTrainers(): Promise<void> {
    // ⚠️ Phaser는 씬을 다시 시작해도 **같은 인스턴스**를 쓴다 → 지난번 목록을 비우지 않으면
    //    이미 파괴된 스프라이트가 남아 걷게 하려는 순간 죽는다(배틀에서 돌아올 때마다 재시작된다).
    this.trainers = [];
    // 같은 이유로 `scene.isActive()`만으로는 '이전 실행'을 못 거른다(재시작해도 계속 active다).
    //  → 실행마다 번호를 매겨, await 사이에 씬이 다시 시작됐으면 옛 실행은 조용히 물러난다.
    const run = ++this.setupRun;
    await loadArDb();
    if (run !== this.setupRun || !this.scene.isActive()) return;
    const done = (this.registry.get("trainersDefeated") as string[]) ?? [];

    for (const m of REGION_MAPS) {
      if (m.arMapId === undefined) continue;
      const spots = getMapTrainers(m.arMapId);
      if (!spots) continue;                       // 트레이너가 없는 맵은 키 자체가 없다
      for (const spot of spots) {
        const sheet = `ow_${spot.overworld}`;
        await this.ensureSheet(sheet, `assets/characters/${spot.overworld}.png`);
        if (run !== this.setupRun || !this.scene.isActive()) return;
        const [gx, gy] = toGlobal(m.name, spot.x, spot.y);
        this.textures.get(sheet).setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.mkTrainerAnims(sheet);
        const sprite = this.add.sprite(this.cx(gx), this.cy(gy), sheet, this.idleFrame[spot.dir])
          .setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
        // 트레이너가 선 칸은 막는다(원본 이벤트도 통과 못 한다).
        this.blocked[gy][gx] = 1;
        this.trainers.push({ spot, gx, gy, sheet, sprite, defeated: done.includes(spot.id) });
      }
    }
  }

  // 스프라이트시트를 지금 받는다(어떤 트레이너가 있는지는 AR DB를 읽어야 알 수 있어 preload에선 못 한다).
  private ensureSheet(key: string, path: string): Promise<void> {
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise((resolve) => {
      this.load.spritesheet(key, path, { frameWidth: 32, frameHeight: 48 });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  // 걷기 애니(주인공과 같은 시트 배치). 애니는 게임 전역이라 재입장 시 이미 있을 수 있다.
  private mkTrainerAnims(sheet: string): void {
    const rows: [Dir, number[]][] = [
      ["down", [0, 1, 2, 3]], ["left", [4, 5, 6, 7]], ["right", [8, 9, 10, 11]], ["up", [12, 13, 14, 15]],
    ];
    for (const [dir, frames] of rows) {
      const key = `${sheet}-${dir}`;
      if (!this.anims.exists(key))
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { frames }), frameRate: 8, repeat: -1 });
    }
  }

  /** 나를 본 트레이너가 있으면 승부를 건다(한 보마다). */
  private checkTrainerSight(): void {
    if (this.busy) return;
    for (const t of this.trainers) {
      if (t.defeated) continue;
      const path = this.sightPath(t);
      if (!path) continue;
      this.startTrainerEncounter(t, path).catch((e) => console.error("[WorldScene] 트레이너 컷신 오류:", e));
      return;   // 한 번에 한 명만
    }
  }

  /**
   * 트레이너가 나를 볼 수 있는가 — 원본 `pbEventCanReachPlayer?` 그대로:
   *  ① 보는 방향 일직선 위에 내가 있고 ② 거리가 시야 이내이며 ③ 사이 칸이 전부 통행 가능해야 한다.
   *  (중간이 막혀 있으면 시야가 차단된다 — 벽 너머로는 못 본다.)
   * 반환 = 트레이너가 나에게 걸어올 칸들(바로 옆이면 빈 배열). 못 보면 null.
   */
  private sightPath(t: TrainerNpc): [number, number][] | null {
    const d = DIR_VEC[t.spot.dir];
    // 보는 축이 아닌 쪽 좌표가 다르면 = 일직선 위가 아니다
    if (d.dx !== 0 && this.ty !== t.gy) return null;
    if (d.dy !== 0 && this.tx !== t.gx) return null;
    // 보는 방향 기준 거리(뒤쪽이면 음수 → 안 보인다)
    const dist = d.dx !== 0 ? (this.tx - t.gx) * d.dx : (this.ty - t.gy) * d.dy;
    if (dist < 1 || dist > t.spot.sight) return null;

    const path: [number, number][] = [];
    for (let i = 1; i < dist; i++) {   // 트레이너와 나 '사이'의 칸들 = 걸어올 길
      const x = t.gx + d.dx * i, y = t.gy + d.dy * i;
      if (!this.walkable(x, y)) return null;   // 막혔다 = 안 보인다
      path.push([x, y]);
    }
    return path;
  }

  // 발견 "!" → 걸어와서 → 원본 대사 → 배틀. (라이벌 컷신과 같은 박자: 150ms/칸)
  private async startTrainerEncounter(t: TrainerNpc, path: [number, number][]): Promise<void> {
    this.busy = true;
    const dir = t.spot.dir;
    playSfx(this, SFX.exclaim, 0.5);
    await new Promise<void>((r) => this.time.delayedCall(420, r));

    if (path.length) {
      t.sprite.play(`${t.sheet}-${dir}`, true);
      for (const [nx, ny] of path) {
        await new Promise<void>((r) => this.tweens.add({
          targets: t.sprite, x: this.cx(nx), y: this.cy(ny), duration: 150, onComplete: () => r(),
        }));
      }
      t.sprite.stop();
    }
    t.sprite.setFrame(this.idleFrame[dir]);
    // 나는 트레이너 쪽을 돌아본다
    this.facing = OPPOSITE[dir];
    this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]);

    await this.dlg.say(t.spot.introText, t.spot.speaker);
    this.dlg.hide();
    this.startTrainerBattle(t);
  }

  // 트레이너 배틀 시작 — 팀·대사·상금·그림은 BattleScene이 trainerId로 AR 정의에서 가져간다.
  private startTrainerBattle(t: TrainerNpc): void {
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () =>
      this.scene.start("BattleScene", {
        ally, trainerId: t.spot.id,
        backdrop: this.curMap?.battleBg ?? "town",
        returnPos: [this.tx, this.ty], returnFacing: this.facing,
      }));
  }

  private cx(tx: number): number { return (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return (ty + 1) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.blocked[ty][tx] === 0;
  }
  private warpAt(tx: number, ty: number): Warp | undefined {
    return this.warps.find((w) => w.x === tx && w.y === ty);
  }

  /** 한 칸 움직일 때마다 호출. 맵이 바뀌면 이름을 띄우고 BGM을 갈아준다(암전·로딩 없음). */
  private onEnterTile(): void {
    const m = mapAtGlobal(this.tx, this.ty);
    if (m && m !== this.curMap) {
      const prev = this.curMap;
      this.curMap = m;
      this.showMapName(m.label);
      // BGM은 곡이 실제로 바뀔 때만 갈아준다(태초마을↔집처럼 같은 곡이면 끊지 않는다).
      if (prev?.bgm !== m.bgm) playBgm(this, m.bgm, 0.35);
    }
    // 트레이너가 먼저다 — 눈이 마주쳤으면 풀숲 조우는 안 걸린다(busy가 되어 아래에서 걸러진다).
    this.checkTrainerSight();
    this.maybeWildEncounter();
  }

  /** 풀숲을 밟았으면 조우 판정(원본 pbBattleOnStepTaken과 같은 자리 = 한 보 걸을 때마다). */
  private maybeWildEncounter(): void {
    if (this.busy) return;                                   // 컷신·워프 중엔 안 걸린다
    if (this.grass[this.ty]?.[this.tx] !== 1) return;         // 풀숲이 아니면 끝
    const arMapId = this.curMap?.arMapId;
    if (arMapId === undefined) return;                        // 조우표가 없는 맵
    // 원본: $player.able_pokemon_count == 0 이면 조우 안 함(싸울 포켓몬이 없으면 배틀이 성립 안 된다)
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    if (!party?.some((p) => p.currentHp > 0)) return;

    const table = getEncounters(arMapId);
    if (!table) return;
    if (!encounterTriggered(table.stepChance)) return;
    const pick = chooseWildPokemon(table);
    if (!pick) return;

    resetEncounterSteps();   // 원본처럼 조우 직후엔 걸음수·누산기를 리셋(다음 몇 보는 유예)
    this.startWildBattle(pick.speciesId, pick.level);
  }

  /** 새 맵에 들어왔을 때 왼쪽 위에 이름을 잠깐 띄운다. */
  private showMapName(label: string): void {
    const t = this.add.text(16, 52, label, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "20px", color: "#ffffff",
      backgroundColor: "#000000aa", padding: { x: 12, y: 6 },
    }).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.time.delayedCall(1800, () =>
      this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }));
  }

  update(): void {
    if (this.busy || this.moving) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) {
      this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]);
      if (this.time.now - this.lastBump > 300) { playSfx(this, SFX.bump, 0.4); this.lastBump = this.time.now; } // 벽 부딪힘(연타 방지)
      return;
    }

    this.moving = true;
    this.player.play(`walk-${this.facing}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: 150,
      onComplete: () => {
        this.tx = ntx; this.ty = nty; this.moving = false;
        this.onEnterTile();   // 맵 경계를 넘었는지 확인(암전 없이 그냥 넘어간다) + 풀숲 조우 판정
        // 조우가 걸렸으면(busy) 워프는 건너뛴다 — 지금은 풀숲과 워프 칸이 겹치지 않지만,
        //  겹치는 순간 배틀과 문 진입이 동시에 scene.start 되어 화면이 뒤엉킨다.
        if (!this.busy) this.handleWarp();
      },
    });
  }

  // 인게임 메뉴 열기: 이 씬을 멈추고 입력을 끈 뒤 MenuScene을 오버레이로 띄운다.
  private openMenu(): void {
    if (this.busy || this.moving) return;
    // 저장 위치 기록(메뉴 '저장'이 이 값을 직렬화한다). 월드는 정확한 타일·방향까지 저장.
    // ⚠️ 저장은 **맵 이름 + 그 맵 기준 로컬 좌표**로 남긴다(글로벌로 남기면 나중에 맵을 끼워넣을 때 옛 세이브가 전부 어긋난다).
    const at = toLocal(this.tx, this.ty);
    this.registry.set("saveLoc", { scene: "WorldScene", map: at.map, tx: at.x, ty: at.y, facing: this.facing });
    this.input.enabled = false;
    this.cameras.main.resetFX();  // 진행 중이던 fadeIn(400ms)이 pause로 얼어 월드가 어둑하게 멈추는 것 방지
    this.scene.pause();
    this.scene.launch("MenuScene", { from: "WorldScene" });
  }

  // 야생 배틀 시작: 조우표가 뽑은 종족·레벨로 상대를 만들고, 내 파티 선두를 아군으로 넘긴다.
  private startWildBattle(speciesId: string, level: number): void {
    this.busy = true;   // 배틀로 넘어가는 동안 한 칸 더 걸어 좌표가 어긋나는 것 방지
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    const enemy = createFromSpecies(speciesId, level);
    // 배경 = 지금 서 있는 맵이 정한다(AR map_metadata의 battle_background 그대로: 마을=town, 1번도로=route).
    const backdrop = this.curMap?.battleBg ?? "town";
    playSfx(this, SFX.exclaim, 0.5);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () =>
      this.scene.start("BattleScene", {
        ally, enemy, wild: true, backdrop, returnPos: [this.tx, this.ty], returnFacing: this.facing,
      }));
  }

  // 스타터 선택 후 연구소에서 나오면: **이미 문 앞에서 기다리던** 네모가 다가와 말을 걸고 라이벌 배틀이 시작된다.
  //  (LabScene이 registry에 rivalBattlePending/rivalEnemySpecies를 예약하고, 네모는 그 씬에서 먼저 걸어 나갔다.)
  //  ⚠️ 입력을 통째로 끄면(this.input.enabled=false) 대사를 넘기는 키까지 죽는다 → busy 플래그만 쓴다(이동·메뉴는 busy로 막힘).
  private async maybeStartRivalBattle(): Promise<void> {
    if (!this.registry.get("rivalBattlePending")) return;
    // 양옆이 다 막혀 다가올 길이 없으면(거의 없음) 컷신을 건너뛰고 배틀만 시작한다 — 배틀이 통째로 사라지면 안 된다.
    if (!this.nemona || !this.rival) { this.startRivalBattle(); return; }
    // (F1) 예약은 여기서 소비하지 않는다 — 배틀에서 '이겼을 때만' BattleScene이 소비한다(지면 재대결).
    this.busy = true;
    const nem = this.nemona;
    const { path, from } = this.rival;
    // 네모는 플레이어 쪽을 보고 걷고(왼쪽에서 오면 오른쪽 보기), 플레이어는 그 반대쪽을 돌아본다.
    const nemDir: Dir = from === "left" ? "right" : "left";
    const youDir: Dir = from === "left" ? "left" : "right";

    // 나를 발견("!") → 기다리던 자리에서 옆 칸까지 한 칸씩 걸어온다(플레이어와 같은 150ms/칸).
    playSfx(this, SFX.exclaim, 0.5);
    await new Promise<void>((r) => this.time.delayedCall(420, r));
    nem.play(`nem-${nemDir}`, true);
    for (const [nx, ny] of path.slice(1)) {   // path[0] = 이미 서 있는 자리
      await new Promise<void>((r) => this.tweens.add({
        targets: nem, x: this.cx(nx), y: this.cy(ny), duration: 150, onComplete: () => r(),
      }));
    }
    nem.stop(); nem.setFrame(this.idleFrame[nemDir]);
    this.facing = youDir; this.player.stop(); this.player.setFrame(this.idleFrame[youDir]);

    // 대사 = SV 네모 공식 대사 기반(창작 아님).
    //  1줄: Bulbapedia 영문 정본 "we should battle right now—you and me!" / "see how great..." 를 옮김(한국어 공식판 미확인).
    //  2줄: SV 한국어판 verbatim(첫 배틀 개시 대사) — 확인됨.
    const you = (this.registry.get("playerName") as string) ?? "";
    await this.dlg.say(`${you}! 지금 당장 나랑 한판 하자. 네 파트너가 얼마나 굉장한지 보고 싶어!`, "네모");
    await this.dlg.say("처음 하는 포켓몬 승부니까 즐기면서 하자!", "네모");
    this.dlg.hide();
    this.startRivalBattle();
  }

  // 네모가 기다렸다 걸어올 길을 **플레이어 위치 기준**으로 잡는다(고정좌표 금지 — 재대결은 집 앞에서도 걸린다).
  //  플레이어와 같은 줄에서 옆으로 RIVAL_GAP칸까지 걸을 수 있는 데까지 잡고, 왼쪽이 막혔으면 오른쪽으로 뒤집는다.
  //  path[0] = 처음 서서 기다리는 자리(가장 먼 칸), 마지막 = 플레이어 바로 옆 칸(여기서 말을 건다).
  private rivalApproach(): { path: [number, number][]; from: "left" | "right" } | undefined {
    for (const from of ["left", "right"] as const) {
      const sign = from === "left" ? -1 : 1;
      const beside: [number, number][] = [];
      for (let d = 1; d <= RIVAL_GAP; d++) {
        const x = this.tx + sign * d;
        if (!this.walkable(x, this.ty)) break;
        beside.push([x, this.ty]);
      }
      if (beside.length >= 2) return { path: beside.reverse(), from };   // 먼 칸 → … → 플레이어 옆
    }
    return undefined;   // 양옆이 다 막힘(거의 없음) → 컷신 없이 바로 배틀
  }

  // 라이벌 트레이너 배틀 시작: 상대 = 예약된 카운터 스타터(Lv.5), wild:false(도망 불가·트레이너 인트로).
  private startRivalBattle(): void {
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    const enemyKey = (this.registry.get("rivalEnemySpecies") as string) ?? "CHARMANDER";
    const enemy = createFromSpecies(enemyKey, 5);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () =>
      this.scene.start("BattleScene", {
        // 배경은 서 있는 맵이 정한다(야생전과 같은 규칙 — 하드코딩하면 나중에 도로/시티 트레이너전에서 틀린 배경이 뜬다).
        //  네모는 AR에 트레이너 정의가 없다(원본엔 스타터 직후 라이벌전 자체가 없음) → 이름·그림만 직접 넘긴다.
        ally, enemy, wild: false, trainer: "네모", trainerSprite: "NEMONA",
        backdrop: this.curMap?.battleBg ?? "town",
        returnPos: [this.tx, this.ty], returnFacing: this.facing,
      }));
  }

  private handleWarp(): void {
    const w = this.warpAt(this.tx, this.ty);
    if (!w) return;
    if (w.dir && this.facing !== w.dir) return;
    this.busy = true;
    this.player.stop();
    playSfx(this, SFX.doorIn, 0.5);
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.time.delayedCall(340, () => {
      if (w.to === "lab") this.scene.start("LabScene");
      else if (w.to === "gym") this.scene.start("GymScene");
      else if (w.to === "pc") this.scene.start("BuildingScene", { building: "pc" });
      else if (w.to === "mart") this.scene.start("BuildingScene", { building: "mart" });
      else if (w.to === "house") this.scene.start("InteriorScene", { room: w.room ?? "living", skipIntro: true });
      else {
        // 모르는 to = 워프를 추가하며 분기를 안 넣은 것. 그냥 두면 **암전된 채 얼어붙는다**
        //  (busy=true + 페이드아웃까지 해놓고 씬을 안 켠다) → 원위치로 되돌려 최소한 계속 놀 수 있게.
        console.error(`[WorldScene] 모르는 워프 대상 "${w.to}" — 분기를 안 넣었다.`);
        this.cameras.main.fadeIn(320, 0, 0, 0);
        this.busy = false;
      }
    });
  }
}
