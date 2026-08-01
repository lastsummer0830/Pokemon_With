import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon } from "../data/Pokemon";
import DialogBox from "../ui/DialogBox";
import { onAction } from "../systems/input";
import { playBgm } from "../game/bgm";
import { playSfx, playMe, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import { activePage, talkablePage, visibleGraphic, faceDirToward } from "../systems/mapEvents";
import type { MapEvent, MapEventFile } from "../systems/mapEvents";
import { applyEventSprite, loadEventSheet, preloadEventAudio, runEventPage } from "../systems/fieldEventRunner";

// 상록시티 실내 건물 — 포켓몬 센터·프렌들리 숍·**민가 4채**를 한 씬으로 겸한다.
//
// 원본이 어떻게 생겼나(추측 아님 — AR Data/Map158·159·160~163.rxdata 이벤트를 직접 판독):
//   · 센터 = AR Map158. 상록시티 문 (26,25) → 내부 도착 (7,8). 간호순('NPC 16') @(7,2),
//     보조 간호순('NPC_PikeMaid') @(8,2), 회복볼 @(5,2), PC(보관) @(11,1), 출구 @(7,8~9).
//   · 마트 = AR Map159. 상록시티 문 (35,25) → 내부 도착 (4,7). 점원('NPC 19') @(2,3), 출구 @(4,7~8).
//   · 민가 4채 = AR Map160·161·162·163. 문 (26,18)·(35,18)·(26,11)·(8,27) → 넷 다 내부 도착 (9,11).
//     ⭐ 네 집은 **방 그림·충돌이 원본에서 완전히 같은 한 장**이다(맵데이터 md5 동일) → PNG 하나를 넷이 같이 쓴다.
//        다른 것은 그 안의 이벤트뿐이라, 사람·대사는 원본 이벤트 JSON(<이름>_events.json)이 통째로 들고 있다.
//   · BGM: 센터=Poke Center.mid, 마트=Poke Mart.mid → AR soundfont로 렌더(tools/ar-audio/render-mid.py).
//     민가는 원본이 `autoplay_bgm = false`라 **밖에서 나오던 상록시티 곡이 그대로 이어진다** → 우리도 안 바꾼다.
//
// ⚠️ 이번 단계에서 일부러 안 넣은 것(다음 블록):
//   · 상점(구매/판매) — 마트 점원도, 민가4의 젬 상점 아주머니(원본 pbPokemonMart)도 아직 안내만 한다.
//   · PC 보관함(BoxScene) — 6×5 박스 그리드 UI라 AR Storage UI 조사 후 별도 구현.
type Dir = "down" | "left" | "right" | "up";
type Building = "pc" | "mart" | "house1" | "house2" | "house3" | "house4";

interface NpcDef {
  key: string;              // 텍스처 키
  file: string;             // 에셋 경로(AR characters)
  tile: [number, number];   // 서 있는 칸
  face: Dir;                // 바라보는 방향
}
interface BuildingDef {
  label: string;
  img: string; json: string;     // png·충돌json 경로
  over: string;                  // 전경(priority) png — 카운터 앞면 등 캐릭터 위에 그릴 타일
  imgKey: string; jsonKey: string; overKey: string;
  bgm?: { key: string; file: string };  // 없으면 **밖에서 나오던 곡을 그대로 둔다**(원본 autoplay_bgm=false)
  content: [number, number, number, number];  // 실제 방이 차지하는 픽셀 사각형 [x,y,너비,높이] — 중앙정렬 기준
  spawn: [number, number];       // 도어매트(진입 도착 = 출구 칸)
  toCity: [number, number];      // 나갈 때 상록시티 도착 칸(문 한 칸 아래)
  npcs: NpcDef[];                // 손으로 세운 NPC(센터·마트 전용). 민가는 원본 이벤트가 대신한다.
  attendant: number;             // 카운터 담당 NPC 인덱스(말 걸면 플레이어를 바라보게 돌림)
  counterTiles: [number, number][]; // 위를 보고 A → 상호작용되는 카운터 칸들
  kind: "heal" | "shop" | "house";
  // 원본 맵 이벤트 JSON(tools/ar-map/extract-events.py). 있으면 그 안의 사람·물건·팻말을 그대로 세운다.
  eventsName?: string;
}
interface MapData { cols: number; rows: number; blocked: number[][]; }
interface BuildInit { building?: Building; testParty?: boolean; }

// 실내에 세워진 원본 이벤트 하나 — 어디에 섰고 어떤 스프라이트인가.
// faceDir = 말을 건 뒤 향한 방향. 원본은 대화가 끝나도 원래 방향으로 안 돌아간다(mapEvents.faceDirToward).
interface RoomEvent { ev: MapEvent; sprite?: Phaser.GameObjects.Sprite; faceDir?: number }

const STEP_MS = 150; // 한 칸 걷는 시간 — 다른 씬(월드·연구소·체육관)과 같게
// y-정렬 기준 depth. 맵=0, 대화창=1000+ 사이. 캐릭터 depth = BASE+발위치행, 전경 스트립 depth = BASE+행+0.5.
//  → 같은 행/뒤(위)에 선 캐릭터는 그 행 전경(카운터 앞면)에 가려지고, 앞(아래) 캐릭터는 전경 위로 그려진다.
const CHAR_DEPTH_BASE = 10;

/**
 * 민가 한 채의 정의를 만든다 — 네 집이 그림·충돌·도착칸까지 전부 같고 **다른 건 이벤트와 나가는 문**뿐이다.
 * @param n        1~4 (AR Map160~163)
 * @param toCity   나갈 때 상록시티에서 서게 될 칸 = 원본 EV001의 이동 좌표 그대로
 * @param label    무슨 집인지 알아보기 쉬우라고 적는 이름(화면에는 안 나온다)
 */
function house(n: 1 | 2 | 3 | 4, toCity: [number, number], label: string): BuildingDef {
  return {
    label,
    img: "assets/world/viridian_house.png", json: "assets/world/viridian_house.json",
    over: "assets/world/viridian_house_over.png",
    imgKey: "bld_house_map", jsonKey: "bld_house_col", overKey: "bld_house_over",
    // 방은 PNG 왼쪽 위가 아니라 (96,32)에서 시작한다(그 바깥은 검은 패딩) → 사각형으로 적어야 중앙정렬이 맞다.
    content: [96, 32, 448, 352],
    spawn: [9, 11], toCity,      // 넷 다 도착칸은 (9,11) 도어매트 — 원본 transfer 값 그대로
    npcs: [], attendant: 0, counterTiles: [],
    kind: "house",
    eventsName: `viridian_house${n}`,
  };
}

// 건물별 정의 — 좌표는 전부 AR Map158/159/160~163 이벤트에서 뽑은 소스 값(눈대중 아님).
const BUILDINGS: Record<Building, BuildingDef> = {
  pc: {
    label: "포켓몬 센터",
    img: "assets/world/viridian_pc.png", json: "assets/world/viridian_pc.json",
    over: "assets/world/viridian_pc_over.png",
    imgKey: "bld_pc_map", jsonKey: "bld_pc_col", overKey: "bld_pc_over",
    bgm: { key: BGM.center, file: "assets/audio/bgm_pc.ogg" },
    content: [0, 0, 480, 296],   // 실제 방 = 좌상단 480×296(나머지는 검은 패딩) — viridian_pc.png bbox
    spawn: [7, 8], toCity: [26, 26],
    npcs: [
      // AR Map158: 회복 간호순(EV2)@(7,2) 아래보기, 별명서비스 간호순(EV5)@(8,2) 아래보기.
      { key: "npc_nurse", file: "assets/characters/NPC 16.png", tile: [7, 2], face: "down" },
      { key: "npc_maid", file: "assets/characters/NPC_PikeMaid.png", tile: [8, 2], face: "down" },
    ],
    attendant: 0, // 회복 간호순
    // 카운터(막힌 칸) 앞줄 = 플레이어가 row4에서 위를 보면 마주치는 row3 칸들.
    counterTiles: [[5, 3], [6, 3], [7, 3], [8, 3], [9, 3]],
    kind: "heal",
  },
  mart: {
    label: "프렌들리 숍",
    img: "assets/world/viridian_mart.png", json: "assets/world/viridian_mart.json",
    over: "assets/world/viridian_mart_over.png",
    imgKey: "bld_mart_map", jsonKey: "bld_mart_col", overKey: "bld_mart_over",
    bgm: { key: BGM.mart, file: "assets/audio/bgm_mart.ogg" },
    content: [0, 0, 352, 264],   // 실제 방 = 좌상단 352×264 — viridian_mart.png bbox
    spawn: [4, 7], toCity: [35, 26],
    npcs: [
      // AR Map159: 점원(EV2)@(2,3) 오른쪽보기(원본 방향 그대로). 말 걸면 아래(플레이어)로 돌아본다.
      { key: "npc_clerk", file: "assets/characters/NPC 19.png", tile: [2, 3], face: "right" },
    ],
    attendant: 0, // 점원
    // 점원 카운터 앞칸 = 플레이어가 row5에서 위를 보면 마주치는 row4의 계산대 칸들.
    counterTiles: [[0, 4], [1, 4], [2, 4], [3, 4]],
    kind: "shop",
  },
  // 민가 4채 — 나가는 칸은 원본 EV001의 이동 좌표(상록시티 문 바로 아래) 그대로다.
  house1: house(1, [26, 19], "원예사의 집"),
  house2: house(2, [35, 19], "아이의 집"),
  house3: house(3, [26, 12], "피카츄가 있는 집"),
  house4: house(4, [8, 28], "젬 상점 집"),
};

export default class BuildingScene extends Phaser.Scene {
  private def!: BuildingDef;
  private map!: MapData;
  private mapImg!: Phaser.GameObjects.Image;
  private overStrips: Phaser.GameObjects.Image[] = []; // 전경(카운터 앞면 등)을 행별로 쪼갠 스트립 — per-캐릭터 y정렬용
  private npcSprites: Phaser.GameObjects.Sprite[] = [];

  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero_bld";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "up";
  private tx = 0; private ty = 0;
  private moving = false; private busy = false;

  private zoom = 1; private origin = { x: 0, y: 0 }; private tile = 32;
  private dlg!: DialogBox;
  private initData: BuildInit = {};
  // 원본 맵 이벤트로 세운 사람·물건(민가). 야외(WorldScene)와 같은 데이터·같은 실행기를 쓴다.
  private roomEvents: RoomEvent[] = [];
  private setupRun = 0;   // 이벤트 세우기 실행 번호(씬을 다시 시작하면 옛 실행은 물러난다)

  constructor() { super("BuildingScene"); }

  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  // ⚠️ Phaser는 scene.start로 다시 시작해도 같은 인스턴스를 재사용한다 → 상태 필드는 반드시 여기서 되돌린다.
  //    (안 하면 busy=true가 남아 입력이 통째로 먹통 — 이 리포 최대 함정. GymScene 주석 참고.)
  init(data: BuildInit): void {
    this.initData = data ?? {};
    this.def = BUILDINGS[this.initData.building ?? "pc"];
    this.busy = false; this.moving = false;
    this.facing = "up";
    this.npcSprites = [];
    this.roomEvents = [];
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    const d = this.def;
    const v = "?v=" + Date.now();
    // 맵/격자를 고쳐도 반영되게 캐시를 먼저 비운다(안 그러면 Phaser가 옛 것을 그대로 쓴다).
    this.cache.json.remove(d.jsonKey);
    if (d.eventsName) this.cache.json.remove(this.eventsKey());
    if (this.textures.exists(d.imgKey)) this.textures.remove(d.imgKey);
    if (this.textures.exists(d.overKey)) this.textures.remove(d.overKey);
    this.load.image(d.imgKey, d.img + v);
    this.load.image(d.overKey, d.over + v);
    this.load.json(d.jsonKey, d.json + v);
    // 원본 맵 이벤트(민가의 사람·TV·바닥 볼) — tools/ar-map/extract-events.py가 뽑은 것.
    if (d.eventsName) this.load.json(this.eventsKey(), `assets/world/${d.eventsName}_events.json` + v);
    for (const npc of d.npcs)
      this.load.spritesheet(npc.key, npc.file, { frameWidth: 32, frameHeight: 48 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    preloadCommonAudio(this);
    preloadEventAudio(this);   // 원본 이벤트가 내는 소리(피카츄 울음 등)
    if (d.bgm) this.load.audio(d.bgm.key, d.bgm.file);
  }

  /** 이 건물의 이벤트 JSON 캐시 키. 민가 4채가 그림은 같고 이벤트만 다르므로 집마다 달라야 한다. */
  private eventsKey(): string { return `bld_${this.def.eventsName}_events`; }

  create(): void {
    const d = this.def;
    this.map = this.cache.json.get(d.jsonKey) as MapData;
    this.tx = d.spawn[0]; this.ty = d.spawn[1]; this.facing = "up";

    const texKeys = [d.imgKey, d.overKey, this.texKey, ...d.npcs.map((n) => n.key)];
    for (const k of texKeys)
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    // 민가는 원본이 autoplay_bgm=false다 → **밖에서 나오던 상록시티 곡을 그대로 둔다**(끊지 않는다).
    if (d.bgm) playBgm(this, d.bgm.key, 0.4);
    this.mapImg = this.add.image(0, 0, d.imgKey).setOrigin(0, 0).setDepth(0);
    // 전경(카운터 앞면 등 priority 타일)을 '행별 스트립'으로 쪼갠다. 각 행 depth = BASE+행+0.5.
    //  단일 고정 depth로는 위 카운터(checkout)와 아래 카운터(delivery)를 동시에 못 맞춘다
    //  (플레이어가 아래카운터엔 뒤·위카운터엔 앞이어야 함) → 행별 y정렬만이 둘 다 옳게 그린다.
    this.overStrips = [];
    if (this.textures.exists(d.overKey)) {
      const ow = this.textures.get(d.overKey).getSourceImage().width; // 전경 텍스처 폭(크롭 기준)
      for (let r = 0; r < this.map.rows; r++) {
        const strip = this.add.image(0, 0, d.overKey).setOrigin(0, 0)
          .setCrop(0, r * 32, ow, 32)            // 그 행(32px 밴드)만 보이게 크롭
          .setDepth(CHAR_DEPTH_BASE + r + 0.5);  // 같은 행 캐릭터(BASE+r)보다 살짝 위 → 카운터가 캐릭터를 가림
        this.overStrips.push(strip);
      }
    }

    // 걷기 애니 — 게임 전역에 등록돼 재입장 시 이미 있을 수 있다 → exists로 중복 등록 경고를 막는다.
    const mk = (prefix: string, tex: string, key: string, frames: number[]) => {
      if (!this.anims.exists(`${prefix}-${key}`))
        this.anims.create({ key: `${prefix}-${key}`, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: 8, repeat: -1 });
    };
    mk("bld", this.texKey, "down", [0, 1, 2, 3]); mk("bld", this.texKey, "left", [4, 5, 6, 7]);
    mk("bld", this.texKey, "right", [8, 9, 10, 11]); mk("bld", this.texKey, "up", [12, 13, 14, 15]);

    // NPC는 서서 한 방향만 본다(정지 프레임). 애니는 안 돌린다. depth는 layout()에서 행 기준으로 설정.
    this.npcSprites = d.npcs.map((npc) =>
      this.add.sprite(0, 0, npc.key, this.idleFrame[npc.face]).setOrigin(0.5, 1));
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);
    this.setupEvents();     // 민가의 원본 이벤트(사람·TV·바닥 볼)를 세운다

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.layout, this); this.dlg.destroy(); });

    // 확인키(기본 C·Enter·Space) — 실제 키는 옵션의 키 설정을 따른다.
    onAction(this, "USE", () => this.onKey());

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    // ⚠️ 중앙정렬은 '실제 방 크기(content)' 기준으로 한다. PNG(640×480)엔 검은 패딩이 있어
    //    전체를 중앙정렬하면 방이 좌상단으로 쏠려 보인다(방 콘텐츠는 좌상단 content 영역뿐).
    const [cxPx, cyPx, cw, ch] = this.def.content;
    this.zoom = Math.min((W * 0.98) / cw, (H * 0.92) / ch);
    const w = cw * this.zoom, h = ch * this.zoom;
    // ⚠️ 민가는 방이 PNG (96,32)에서 시작한다(센터·마트는 (0,0)) → 그 시작점만큼 왼쪽 위로 당겨야
    //    '방'이 화면 한가운데 온다. origin은 어디까지나 **PNG 왼쪽 위**가 놓일 자리다.
    this.origin = {
      x: Math.round((W - w) / 2 - cxPx * this.zoom),
      y: Math.round((H - h) / 2 - cyPx * this.zoom),
    };
    this.tile = 32 * this.zoom;
    this.mapImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    for (const strip of this.overStrips) strip.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    this.npcSprites.forEach((spr, i) => {
      const [nx, ny] = this.def.npcs[i].tile;
      spr.setPosition(this.cx(nx), this.cy(ny)).setScale(this.zoom * 0.92).setDepth(this.charDepth(ny));
    });
    for (const e of this.roomEvents)
      e.sprite?.setPosition(this.cx(e.ev.x), this.cy(e.ev.y)).setScale(this.zoom * 0.92).setDepth(this.charDepth(e.ev.y));
    this.player.setPosition(this.cx(this.tx), this.cy(this.ty)).setScale(this.zoom * 0.92).setDepth(this.charDepth(this.ty));
    this.dlg.layout();
  }

  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }
  // 발이 놓인 행(row) 기준 depth. 아래 행일수록(=화면 앞) 크다 → 전경 스트립과 올바르게 앞뒤정렬.
  private charDepth(row: number): number { return CHAR_DEPTH_BASE + row; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.cols || ty >= this.map.rows) return false;
    if (this.map.blocked[ty][tx] !== 0) return false;
    // NPC가 서 있는 칸은 못 지나간다.
    for (const npc of this.def.npcs)
      if (npc.tile[0] === tx && npc.tile[1] === ty) return false;
    // 원본 이벤트로 세운 사람·물건도 마찬가지다(그림이 있는 것만 — 팻말·TV는 이미 벽 타일 위다).
    for (const e of this.roomEvents)
      if (e.sprite && e.ev.x === tx && e.ev.y === ty) return false;
    return true;
  }

  update(): void {
    if (this.busy || this.moving) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    // 도어매트에서 아래를 누르면 나간다(진입 도착칸 = 출구칸, 체육관과 같은 방식).
    if (this.tx === this.def.spawn[0] && this.ty === this.def.spawn[1] && this.facing === "down") { this.tryExit(); return; }
    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    this.moving = true;
    this.player.play(`bld-${this.facing}`, true);
    this.player.setDepth(this.charDepth(nty)); // 이동 방향으로 즉시 y정렬(위로=뒤로 들어감, 아래로=앞으로 나옴)
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: STEP_MS,
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; },
    });
  }

  // ── 원본 맵 이벤트(민가) ────────────────────────────────────
  //  야외(WorldScene)와 **완전히 같은 데이터·같은 실행기**를 쓴다 — 다른 건 좌표를 화면에 놓는 방법뿐이다.
  //  (systems/mapEvents.ts = 페이지 규칙 · systems/fieldEventRunner.ts = 대사·아이템 실행)
  private setupEvents(): void {
    this.roomEvents = [];
    const run = ++this.setupRun;
    if (!this.def.eventsName) return;
    const file = this.cache.json.get(this.eventsKey()) as MapEventFile | undefined;
    if (!file?.events) return;
    const map = this.def.eventsName;
    for (const ev of file.events) {
      const page = activePage(this.registry, map, ev);
      if (!page) continue;                       // 지금 조건에 맞는 페이지가 없다
      // 그림도 없고 말도 못 거는 페이지 = 지금은 없는 셈(원본이 사람을 숨기는 방법).
      if (!page.graphic && !talkablePage(this.registry, map, ev)) continue;
      const entry: RoomEvent = { ev };
      this.roomEvents.push(entry);
      if (!page.graphic) continue;               // TV·팻말 — 이미 벽인 타일 위에 얹힌 것이라 그릴 게 없다
      void loadEventSheet(this, page.graphic).then((sheet) => {
        if (!sheet || run !== this.setupRun || !this.scene.isActive()) return;
        entry.sprite = this.add.sprite(this.cx(ev.x), this.cy(ev.y), sheet)
          .setOrigin(0.5, 1).setScale(this.zoom * 0.92).setDepth(this.charDepth(ev.y));
        applyEventSprite(this, entry.sprite, sheet, page, entry.faceDir);
      });
    }
  }

  /** 셀프스위치가 바뀐 뒤 모습을 다시 정한다(주운 볼은 사라지고, 그 칸도 다시 지나갈 수 있게 된다). */
  private refreshEvent(entry: RoomEvent): void {
    const map = this.def.eventsName!;
    const gfx = visibleGraphic(this.registry, map, entry.ev);
    if (!gfx) {                                  // 더는 보이는 페이지가 없다 → 지운다
      entry.sprite?.destroy();
      entry.sprite = undefined;
      this.roomEvents = this.roomEvents.filter((e) => e !== entry);
      return;
    }
    // 아직 보이지만 **다른 페이지의 다른 그림**일 수 있다(아이가 우는 페이지 등) → 모습을 다시 맞춘다.
    const page = activePage(this.registry, map, entry.ev);
    if (entry.sprite && page) applyEventSprite(this, entry.sprite, `ev_${page.graphic}`, page, entry.faceDir);
  }

  // 앞칸 상호작용 — 카운터를 마주보고 A: 센터=회복, 마트=점원. 민가는 앞칸의 원본 이벤트에 말 걸기.
  private onKey(): void {
    if (this.busy) return;
    const d: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const fx = this.tx + d[this.facing][0], fy = this.ty + d[this.facing][1];

    const entry = this.roomEvents.find((e) => e.ev.x === fx && e.ev.y === fy);
    if (entry) {
      const map = this.def.eventsName!;
      const page = talkablePage(this.registry, map, entry.ev);
      if (!page) return;
      // 원본처럼 말을 걸면 이쪽을 돌아본다(대화가 끝나도 그대로 본다 — 원본 `lock`이 그렇다).
      if (entry.sprite && !page.fixed && page.graphic) {
        entry.faceDir = faceDirToward(this.facing);
        applyEventSprite(this, entry.sprite, `ev_${page.graphic}`, page, entry.faceDir);
      }
      this.busy = true;
      runEventPage(this, this.dlg, map, entry.ev, page)
        .then((changed) => { if (changed) this.refreshEvent(entry); })
        .catch((e) => console.error("[BuildingScene] 이벤트 오류:", e))
        .finally(() => { this.dlg.hide(); this.busy = false; });
      return;
    }

    const atCounter = this.def.counterTiles.some(([cxv, cyv]) => cxv === fx && cyv === fy);
    if (!atCounter) return;
    // 말을 걸면 카운터 담당(간호순/점원)이 플레이어 쪽(아래)으로 돌아본다 — 원본 정지방향과 무관하게 응대.
    const att = this.npcSprites[this.def.attendant];
    att?.setFrame(this.idleFrame.down);
    if (this.def.kind === "heal") void this.healParty();
    else void this.clerkGreet();
  }

  // ── 포켓몬 센터 회복(간호순) ─────────────────────────────────
  //  대사는 AR Map158 EV2(회복 간호순) 원문 그대로. 지어내지 않는다.
  private async healParty(): Promise<void> {
    this.busy = true;
    await this.dlg.say("안녕하세요, 포켓몬 센터입니다.", "간호순");
    await this.dlg.say("여기선 포켓몬을 치료해드리고 있습니다.", "간호순");
    await this.dlg.say("포켓몬을 치료해드릴까요?", "간호순");
    const yes = await this.dlg.askYesNo();
    if (!yes) {
      await this.dlg.say("안녕히 가세요.", "간호순");
      this.dlg.hide(); this.busy = false; return;
    }
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    if (!party.length) {
      await this.dlg.say("어라...? 포켓몬을 가지고 계시지 않네요.", "간호순");
      this.dlg.hide(); this.busy = false; return;
    }
    await this.dlg.say("그럼, 잠시 포켓몬을 맡아 드리겠습니다.", "간호순");
    this.dlg.hide();

    // 회복 연출 — 화면을 잠깐 어둡게 하고 포켓몬센터 회복 징글(AR "Pkmn healing").
    await this.fade(true);
    playMe(this, SFX.pkmnHeal, 0.5); // 회복 징글(ME) — BGM 잠깐 멈췄다 되살림(겹침 방지)
    for (const p of party) {
      p.currentHp = p.maxHp;
      p.status = null;
      for (const mv of p.moves) mv.pp = mv.maxPp;
    }
    this.registry.set("playerParty", [...party]); // 파티 갱신 알림(다른 화면이 다시 읽게)
    await this.wait(1400);
    await this.fade(false);

    await this.dlg.say("기다려주셔서 감사합니다.", "간호순");
    await this.dlg.say("맡겨두신 포켓몬이 전부 건강해졌습니다.", "간호순");
    await this.dlg.say("안녕히 가세요.", "간호순");
    this.dlg.hide(); this.busy = false;
  }

  // ── 마트 점원(이번 블록은 인사만 — 상점은 다음 블록) ────────────
  //  AR Map159 EV2 점원은 Essentials 상점 시스템을 열 뿐(전용 대사 없음),
  //  그 인사말 원문 = "Welcome! How may I help you?"(AR 스크립트, 미번역 영어)를 한국어로 옮겼다.
  private async clerkGreet(): Promise<void> {
    this.busy = true;
    await this.dlg.say("어서 오세요! 무엇을 도와드릴까요?", "점원");
    await this.dlg.say("(상점은 아직 준비 중이다.)");
    this.dlg.hide(); this.busy = false;
  }

  private fade(out: boolean): Promise<void> {
    return new Promise((done) => {
      const cam = this.cameras.main;
      cam.once(out ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => done());
      if (out) cam.fadeOut(200, 0, 0, 0); else cam.fadeIn(200, 0, 0, 0);
    });
  }

  private tryExit(): void {
    this.busy = true; this.player.stop();
    playSfx(this, SFX.doorOut, 0.5);
    this.cameras.main.fadeOut(340, 0, 0, 0);
    const [tx, ty] = this.def.toCity;
    // ⚠️ toCity는 상록시티 기준 로컬 좌표 → map을 같이 넘겨야 한다(리전 3장 이어붙임이라 안 주면 글로벌로 읽힘).
    this.time.delayedCall(360, () => this.scene.start("WorldScene", { spawn: [tx, ty], map: "viridian_city", face: "down" }));
  }

  private wait(ms: number): Promise<void> { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
