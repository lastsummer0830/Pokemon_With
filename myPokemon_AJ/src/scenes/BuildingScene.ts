import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon } from "../data/Pokemon";
import DialogBox from "../ui/DialogBox";
import { playBgm } from "../game/bgm";
import { playSfx, playMe, preloadCommonAudio, SFX, BGM } from "../game/sfx";

// 상록시티 실내 건물 — 포켓몬 센터(회복+PC)와 프렌들리 숍(마트)을 한 씬으로 겸한다.
//
// 원본이 어떻게 생겼나(추측 아님 — AR Data/Map158·159.rxdata 이벤트를 직접 판독):
//   · 센터 = AR Map158. 상록시티 문 (26,25) → 내부 도착 (7,8). 간호순('NPC 16') @(7,2),
//     보조 간호순('NPC_PikeMaid') @(8,2), 회복볼 @(5,2), PC(보관) @(11,1), 출구 @(7,8~9).
//   · 마트 = AR Map159. 상록시티 문 (35,25) → 내부 도착 (4,7). 점원('NPC 19') @(2,3), 출구 @(4,7~8).
//   · BGM: 센터=Poke Center.mid, 마트=Poke Mart.mid → AR soundfont로 렌더(tools/ar-audio/render-mid.py).
//
// ⚠️ 이번 단계에서 일부러 안 넣은 것(다음 블록):
//   · 마트 상점(구매/판매) — AR의 가방식 UI를 조사해 제대로 만들 예정(지금은 점원 인사만).
//     AR 판매목록(Map159)은 우리 items.json과 교집합 = 몬스터볼/슈퍼볼/상처약/좋은상처약/해독제/
//     마비치료제/잠깨는약/화상치료제/얼음치료제/기력의조각.
//   · PC 보관함(BoxScene) — 6×5 박스 그리드 UI라 AR Storage UI 조사 후 별도 구현.
//   · 원본 잡담 NPC(RICHBOY·LADY·AROMALADY 등) — 대사 소스를 아직 안 뽑아 생략.
type Dir = "down" | "left" | "right" | "up";
type Building = "pc" | "mart";

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
  bgmKey: string; bgmFile: string;
  content: [number, number];     // 실제 방이 차지하는 픽셀 크기(검은 패딩 제외) — 화면 중앙정렬 기준
  spawn: [number, number];       // 도어매트(진입 도착 = 출구 칸)
  toCity: [number, number];      // 나갈 때 상록시티 도착 칸(문 한 칸 아래)
  npcs: NpcDef[];
  attendant: number;             // 카운터 담당 NPC 인덱스(말 걸면 플레이어를 바라보게 돌림)
  counterTiles: [number, number][]; // 위를 보고 A → 상호작용되는 카운터 칸들
  kind: "heal" | "shop";
}
interface MapData { cols: number; rows: number; blocked: number[][]; }
interface BuildInit { building?: Building; testParty?: boolean; }

const STEP_MS = 150; // 한 칸 걷는 시간 — 다른 씬(월드·연구소·체육관)과 같게

// 건물별 정의 — 좌표는 전부 AR Map158/159 이벤트에서 뽑은 소스 값(눈대중 아님).
const BUILDINGS: Record<Building, BuildingDef> = {
  pc: {
    label: "포켓몬 센터",
    img: "assets/world/viridian_pc.png", json: "assets/world/viridian_pc.json",
    over: "assets/world/viridian_pc_over.png",
    imgKey: "bld_pc_map", jsonKey: "bld_pc_col", overKey: "bld_pc_over",
    bgmKey: BGM.center, bgmFile: "assets/audio/bgm_pc.ogg",
    content: [480, 296],   // 실제 방 = 좌상단 480×296(나머지는 검은 패딩) — viridian_pc.png bbox
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
    bgmKey: BGM.mart, bgmFile: "assets/audio/bgm_mart.ogg",
    content: [352, 264],   // 실제 방 = 좌상단 352×264 — viridian_mart.png bbox
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
};

export default class BuildingScene extends Phaser.Scene {
  private def!: BuildingDef;
  private map!: MapData;
  private mapImg!: Phaser.GameObjects.Image;
  private overImg?: Phaser.GameObjects.Image; // 전경(카운터 앞면 등) — NPC 위, 플레이어 아래에 그린다
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
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    const d = this.def;
    const v = "?v=" + Date.now();
    // 맵/격자를 고쳐도 반영되게 캐시를 먼저 비운다(안 그러면 Phaser가 옛 것을 그대로 쓴다).
    this.cache.json.remove(d.jsonKey);
    if (this.textures.exists(d.imgKey)) this.textures.remove(d.imgKey);
    if (this.textures.exists(d.overKey)) this.textures.remove(d.overKey);
    this.load.image(d.imgKey, d.img + v);
    this.load.image(d.overKey, d.over + v);
    this.load.json(d.jsonKey, d.json + v);
    for (const npc of d.npcs)
      this.load.spritesheet(npc.key, npc.file, { frameWidth: 32, frameHeight: 48 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    preloadCommonAudio(this);
    this.load.audio(d.bgmKey, d.bgmFile);
  }

  create(): void {
    const d = this.def;
    this.map = this.cache.json.get(d.jsonKey) as MapData;
    this.tx = d.spawn[0]; this.ty = d.spawn[1]; this.facing = "up";

    const texKeys = [d.imgKey, d.overKey, this.texKey, ...d.npcs.map((n) => n.key)];
    for (const k of texKeys)
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    playBgm(this, d.bgmKey, 0.4);
    this.mapImg = this.add.image(0, 0, d.imgKey).setOrigin(0, 0).setDepth(0);
    // 전경(카운터 앞면 등 priority 타일) — NPC(depth 4) 위, 플레이어(depth 7) 아래.
    //  이러면 카운터 뒤 NPC의 다리를 카운터가 가려 "뒤에 선" 것처럼 보이고(원본 동일),
    //  카운터 앞에 선 플레이어는 그 위로 그려져 머리 안 잘린다.
    if (this.textures.exists(d.overKey))
      this.overImg = this.add.image(0, 0, d.overKey).setOrigin(0, 0).setDepth(6);

    // 걷기 애니 — 게임 전역에 등록돼 재입장 시 이미 있을 수 있다 → exists로 중복 등록 경고를 막는다.
    const mk = (prefix: string, tex: string, key: string, frames: number[]) => {
      if (!this.anims.exists(`${prefix}-${key}`))
        this.anims.create({ key: `${prefix}-${key}`, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: 8, repeat: -1 });
    };
    mk("bld", this.texKey, "down", [0, 1, 2, 3]); mk("bld", this.texKey, "left", [4, 5, 6, 7]);
    mk("bld", this.texKey, "right", [8, 9, 10, 11]); mk("bld", this.texKey, "up", [12, 13, 14, 15]);

    // NPC는 서서 한 방향만 본다(정지 프레임). 애니는 안 돌린다.
    this.npcSprites = d.npcs.map((npc) =>
      this.add.sprite(0, 0, npc.key, this.idleFrame[npc.face]).setOrigin(0.5, 1).setDepth(4));
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1).setDepth(7);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.layout, this); this.dlg.destroy(); });

    this.input.keyboard!.on("keydown-SPACE", this.onKey, this);
    this.input.keyboard!.on("keydown-ENTER", this.onKey, this);
    this.input.keyboard!.on("keydown-Z", this.onKey, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    // ⚠️ 중앙정렬은 '실제 방 크기(content)' 기준으로 한다. PNG(640×480)엔 검은 패딩이 있어
    //    전체를 중앙정렬하면 방이 좌상단으로 쏠려 보인다(방 콘텐츠는 좌상단 content 영역뿐).
    const [cw, ch] = this.def.content;
    this.zoom = Math.min((W * 0.98) / cw, (H * 0.92) / ch);
    const w = cw * this.zoom, h = ch * this.zoom;
    // content가 (0,0)에서 시작하므로 origin = 화면 중앙에 content를 놓는 좌상단.
    this.origin = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
    this.tile = 32 * this.zoom;
    this.mapImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    this.overImg?.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    this.npcSprites.forEach((spr, i) => {
      const [nx, ny] = this.def.npcs[i].tile;
      spr.setPosition(this.cx(nx), this.cy(ny)).setScale(this.zoom * 0.92);
    });
    this.player.setPosition(this.cx(this.tx), this.cy(this.ty)).setScale(this.zoom * 0.92);
    this.dlg.layout();
  }

  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.cols || ty >= this.map.rows) return false;
    if (this.map.blocked[ty][tx] !== 0) return false;
    // NPC가 서 있는 칸은 못 지나간다.
    for (const npc of this.def.npcs)
      if (npc.tile[0] === tx && npc.tile[1] === ty) return false;
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
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: STEP_MS,
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; },
    });
  }

  // 앞칸 상호작용 — 카운터를 마주보고 A: 센터=회복, 마트=점원.
  private onKey(): void {
    if (this.busy) return;
    const d: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const fx = this.tx + d[this.facing][0], fy = this.ty + d[this.facing][1];
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
