import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon, createFromSpecies } from "../data/Pokemon";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import DialogBox from "../ui/DialogBox";

// 첫 마을 = 어나더레드 '태초마을'(Map55)을 소스에서 그대로 추출한 실제 맵.
//  - 맵 이미지: assets/world/pallet_town.png (52x20칸, 32px 타일)
//  - 충돌격자: assets/world/pallet_town.json (blocked) — AR passages 데이터에서 추출
//  - 격자(칸) 단위 이동 + 카메라가 주인공을 따라감(맵이 화면보다 큼).
//  - 연구소 문(28,14)로 들어가면 LabScene(스타팅), 우리집 문(17,7)로 들어가면 집(InteriorScene).
type Dir = "down" | "left" | "right" | "up";
interface Warp { x: number; y: number; to: string; dir?: Dir; room?: string }

const SCALE = 2;                 // 화면 확대(타일 32→64px)
const START = { x: 17, y: 8 };   // 우리집 문 앞

// 첫 라이벌 배틀 — 네모는 연구소에서 **먼저 나가**(LabScene의 퇴장 컷신) 밖에서 기다리고 있다.
//  기다리는 자리는 고정좌표가 아니라 **플레이어가 서 있는 줄의 옆 칸들**로 잡는다(RIVAL_GAP칸 떨어져 대기 → 걸어옴).
//  ⚠️ 고정좌표로 박으면 안 된다: 라이벌전에서 지면 집으로 보내지고 예약은 남아 있어(이겼을 때만 소비) 집 앞에서 재대결이
//     걸리는데, 그때 네모가 연구소 앞 좌표에 서 있으면 화면 밖에서 혼자 걷고 플레이어만 얼어붙는다.
const RIVAL_GAP = 4;   // 처음 서서 기다리는 거리(칸)

export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "down";

  private cols = 0; private rows = 0;
  private blocked: number[][] = [];
  private tile = 32 * SCALE;
  private tx = START.x; private ty = START.y;
  private moving = false; private busy = false;
  private lastBump = 0;   // 벽 부딪힘 효과음 연타 방지용

  private warps: Warp[] = [
    { x: 28, y: 14, to: "lab", dir: "up" },                         // 포켓몬 연구소
    { x: 17, y: 7, to: "house", room: "living", dir: "up" },        // 우리집(거실로)
  ];

  private spawn = { ...START, face: "down" as Dir };
  private autoMenu = false;   // 디버그 '인게임 메뉴' 바로가기: 마을 위에 메뉴를 바로 연다
  private nemona?: Phaser.GameObjects.Sprite;   // 첫 배틀 때 밖에서 기다리는 네모(그 외엔 없음)
  private rival?: { path: [number, number][]; from: "left" | "right" };   // 네모가 걸어올 길(플레이어 기준으로 잡음)
  private dlg!: DialogBox;
  private onResize = (): void => this.dlg.layout();

  constructor() { super("WorldScene"); }

  init(data: { spawn?: [number, number]; face?: Dir; openMenu?: boolean }): void {
    if (data?.spawn) this.spawn = { x: data.spawn[0], y: data.spawn[1], face: data.face ?? "down" };
    else this.spawn = { ...START, face: "down" };
    this.autoMenu = !!data?.openMenu;
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    this.load.image("pallet", "assets/world/pallet_town.png?v=" + Date.now());
    this.load.json("pallet_col", "assets/world/pallet_town.json?v=" + Date.now());
    preloadCommonAudio(this);
    const file = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
    // 라이벌(네모) 오버월드 스프라이트 — 스타터 선택 직후 첫 배틀 연출용.
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    const col = this.cache.json.get("pallet_col") as { cols: number; rows: number; blocked: number[][] };
    this.cols = col.cols; this.rows = col.rows; this.blocked = col.blocked;

    this.textures.get("pallet").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const map = this.add.image(0, 0, "pallet").setOrigin(0, 0).setScale(SCALE).setDepth(0);

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

    playBgm(this, BGM.town, 0.35); // 마을 BGM(팰릿타운 테마)

    // HUD(화면 고정)
    const name = (this.registry.get("playerName") as string) ?? "";
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  연구소 문으로 들어가기`, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);
    // (임시 디버그) B키 = 야생 배틀. 내 파티 선두를 아군으로 넘긴다(없으면 BattleScene 데모 폴백).
    this.input.keyboard!.on("keydown-B", () => this.startWildBattle());
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
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; this.handleWarp(); },
    });
  }

  // 인게임 메뉴 열기: 이 씬을 멈추고 입력을 끈 뒤 MenuScene을 오버레이로 띄운다.
  private openMenu(): void {
    if (this.busy || this.moving) return;
    // 저장 위치 기록(메뉴 '저장'이 이 값을 직렬화한다). 월드는 정확한 타일·방향까지 저장.
    this.registry.set("saveLoc", { scene: "WorldScene", tx: this.tx, ty: this.ty, facing: this.facing });
    this.input.enabled = false;
    this.cameras.main.resetFX();  // 진행 중이던 fadeIn(400ms)이 pause로 얼어 월드가 어둑하게 멈추는 것 방지
    this.scene.pause();
    this.scene.launch("MenuScene", { from: "WorldScene" });
  }

  // 야생 배틀 시작: 내 파티 선두를 아군으로 넘긴다(없으면 BattleScene 데모 폴백).
  private startWildBattle(): void {
    if (this.busy || this.moving) return;
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    // 배경 = 지금 있는 맵(태초마을 = 도시 배경). 1번도로가 붙으면 그 맵은 route를 넘긴다.
    this.scene.start("BattleScene", { ally, wild: true, backdrop: "town", returnPos: [this.tx, this.ty], returnFacing: this.facing });
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
        ally, enemy, wild: false, trainer: "네모", backdrop: "town",   // 라이벌전은 태초마을에서
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
      else if (w.to === "house") this.scene.start("InteriorScene", { room: w.room ?? "living", skipIntro: true });
    });
  }
}
