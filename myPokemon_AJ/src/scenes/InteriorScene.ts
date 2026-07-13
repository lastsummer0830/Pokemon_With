import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon } from "../data/Pokemon";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import { FURNITURE, FurnitureDef } from "../data/furniture";
import { HouseLayout, canPlace, furnitureAt } from "../data/HouseLayout";
import { conditionCap, emptyHouse, sleepAtHome, furnitureHint, CONDITION_MAX } from "../systems/homeBonus";

// ⚠️ 검증용 임시 오버레이 — 충돌(빨강)·워프(초록) 칸을 화면에 그린다. 확인 끝나면 false로.
const DEBUG_COLLISION = false;

// 시작 집 내부 — 어나더레드 맵을 추출한 2층 방(red_room_2f) + 1층 거실(red_living_1f_stairs:
//   1f 거실에 154 계단을 좌우반전해 좌측 상단에 구워넣고 빨간 카펫을 얹은 이미지).
// 핵심 규칙(사용자 요청):
//  - 칸(격자) 단위로만 움직이고, 방 그래픽(바닥) 밖으로는 절대 못 나간다. (rooms.json의 blocked 사용)
//  - 2층 방 계단 → 1층 거실, 1층 거실 계단 → 2층 방 으로 장면이 바뀐다(계단 전환).
//  - 1층 거실 아래쪽 "문"으로 가면 마을(WorldScene)로 나간다.
//  - 계단/문을 탈 때 door.ogg 효과음을 재생한다.
//  - 픽셀이 또렷하도록 NEAREST 필터 + roundPixels.
//  - 처음 방에 들어오면 인트로 컷신: 기상 → 엄마 → 라이벌 네모 등장(???→네모) → 예/아니오 → 네모 퇴장.
//
// 이름창 규칙: 본인이 이름을 밝히기 전엔 "???", 밝힌 뒤부터 실제 이름.
//  배틀 안 하는 NPC(엄마 등)는 처음부터 이름 그대로.

// dir = 그 방향으로 "들어설 때만" 워프 발동(계단 옆을 가로질러 지나가도 안 켜짐).
// face = 워프 후 도착해서 바라보는 방향.
// climb = 계단을 밟았을 때 전환 전 "올라서는" 이동칸 오프셋 [dx,dy]. (거실 계단은 오른쪽→왼쪽 위로 = [-1,-1] 식)
// climb = 워프 칸 기준 오르는 경로. 한 칸이면 [dx,dy], 여러 칸이면 [[dx,dy],[dx,dy],...] (계단 발판을 따라).
// climbFace = 계단을 오르는 동안 바라보는 방향(기본 "up" = 계단을 정면으로 바라봄).
interface Warp { x: number; y: number; to: string; ax?: number; ay?: number; kind?: string; dir?: Dir; face?: Dir; climb?: number[] | number[][]; climbFace?: Dir }
// bed = 침대 사각형 [x, y, w, h] — 앞에서 Space를 누르면 잠자기(컨디션 회복). 침실에만 있다.
interface RoomDef { img: string; cols: number; rows: number; blocked: number[][]; start: [number, number]; warps: Warp[]; bed?: number[] }
type Rooms = Record<string, RoomDef>;
type Dir = "down" | "left" | "right" | "up";

export default class InteriorScene extends Phaser.Scene {
  private rooms!: Rooms;
  private roomKey = "bedroom";          // 시작은 2층 방
  private def!: RoomDef;

  private player!: Phaser.GameObjects.Sprite;
  private roomImg!: Phaser.GameObjects.Image;
  private stairsDeco!: Phaser.GameObjects.Image;   // 거실(1F)에 깔아주는 2층식 계단 그림
  private dbg?: Phaser.GameObjects.Graphics;       // 검증용 충돌/워프 오버레이
  private nemona?: Phaser.GameObjects.Sprite;      // 컷신용 라이벌 네모
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "down";

  // 화면상 방 배치(리사이즈 때 재계산)
  private origin = { x: 0, y: 0 };
  private tile = 32;                     // 화면상 한 칸 픽셀(스케일 반영)
  private zoom = 1;                      // 방 이미지 확대율(주의: Phaser의 this.scale=ScaleManager와 다름)

  // 현재 칸 좌표(타일 단위)
  private tx = 0;
  private ty = 0;
  private moving = false;                // 칸 사이 이동(트윈) 중인지
  private busy = false;                  // 워프/컷신 중 입력 잠금
  private lastBump = 0;                  // 벽 부딪힘 효과음 연타 방지

  // ── 대화창(IntroScene과 같은 HGSS 감성) ──
  private readonly FONT = "Galmuri11";
  private boxG!: Phaser.GameObjects.Graphics;
  private boxText!: Phaser.GameObjects.Text;
  private namePlate!: Phaser.GameObjects.Graphics;
  private nameTag!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private speaker: string | null = null;
  private boxRect = { x: 0, y: 0, w: 0, h: 0, pad: 0, font: 18 };

  // 시작 방/인트로 스킵 (디버그에서 거실로 바로 진입할 때 사용)
  private startRoom = "bedroom";
  private skipIntro = false;

  // ── ★ 집 꾸미기(내 색) ──
  //  배치는 registry "houseLayout"에 산다(저장은 systems/save.ts가 함께 직렬화).
  //  놓인 가구 칸은 걸을 수 없고(walkable), 침대에서 자면 방 구성만큼 컨디션이 오른다(systems/homeBonus.ts).
  private house!: HouseLayout;
  private furnImgs: Phaser.GameObjects.Image[] = [];   // 화면에 그려둔 가구들
  private decorating = false;                          // 꾸미기 모드인가
  private selIdx = 0;                                  // 고른 가구(FURNITURE 인덱스)
  private curX = 0;                                    // 꾸미기 커서 칸
  private curY = 0;
  private ghost?: Phaser.GameObjects.Image;            // 놓기 미리보기(반투명)
  private cursorG?: Phaser.GameObjects.Graphics;       // 커서 사각형(초록=놓을 수 있음/빨강=불가)
  private decoText?: Phaser.GameObjects.Text;          // 꾸미기 안내/설명 바
  private keys!: Record<"space" | "f" | "r" | "q" | "e" | "esc", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("InteriorScene");
  }

  // scene.start("InteriorScene", { room: "living", skipIntro: true }) 로 특정 방부터 시작 가능
  init(data: { room?: string; skipIntro?: boolean }): void {
    this.startRoom = data?.room ?? "bedroom";
    this.skipIntro = !!data?.skipIntro || this.startRoom !== "bedroom";
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    // 방 데이터/이미지가 바뀌어도 옛 캐시를 물지 않도록 매번 새로 읽는다(개발 중 stale 방지).
    //  ⚠️ 브라우저 HTTP 캐시가 rooms.json/이미지를 물면 새 코드가 옛 맵을 읽어 "고쳐도 똑같음" 발생.
    //     → URL에 ?v=타임스탬프를 붙여 매 로드마다 무조건 새로 받는다.
    const v = "?v=" + Date.now();
    this.cache.json.remove("rooms");
    this.load.json("rooms", "assets/house/rooms.json" + v);
    this.load.image("room_bedroom", "assets/house/red_room_2f.png" + v);
    this.load.image("room_living", "assets/house/red_living_1f_stairs.png" + v);
    this.load.image("stairs_living", "assets/house/stairs_living.png");
    preloadCommonAudio(this);
    const file = this.gender === "girl"
      ? "assets/characters/trainer_DAWN.png"
      : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
    // 라이벌 네모(오버월드 걷기 시트, 32x48 4방향x4프레임)
    this.load.spritesheet("nemona", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
    // 집 꾸미기 가구 그림 (카탈로그의 id 그대로 파일명). 방 그림과 같은 이유로 캐시버스터를 붙인다
    // (가구 png를 교체했는데 브라우저가 옛 그림을 물어 "고쳐도 똑같다"가 되는 걸 막는다).
    for (const f of FURNITURE) this.load.image(f.sprite, `assets/house/furniture/${f.id}.png` + v);
  }

  create(): void {
    this.rooms = this.cache.json.get("rooms") as Rooms;

    // 도트는 또렷하게(픽셀 보존) — 화질 개선의 핵심
    for (const k of ["room_bedroom", "room_living", "stairs_living", "nemona", this.texKey, ...FURNITURE.map(f => f.sprite)]) {
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 집 배치 불러오기(저장에서 복원됐으면 그걸, 처음이면 빈 방)
    this.house = (this.registry.get("houseLayout") as HouseLayout) ?? emptyHouse();
    this.registry.set("houseLayout", this.house);
    this.cameras.main.roundPixels = true;   // 소수점 좌표로 인한 흐릿함 방지

    // 걷기 애니메이션(행0=아래,1=왼쪽,2=오른쪽,3=위, 각 4프레임)
    this.makeWalkAnims(this.texKey, "walk");
    this.makeWalkAnims("nemona", "nemona");

    playBgm(this, BGM.town, 0.35); // 집 BGM(마을 테마와 동일 — 젠1 정통)

    this.roomImg = this.add.image(0, 0, "room_bedroom").setOrigin(0, 0).setName("roomImg");
    // 거실 계단 그림 — 발판(아래끝)을 워프 칸 바닥에 맞춤. 바닥보다 위, 주인공보다 아래.
    this.stairsDeco = this.add.image(0, 0, "stairs_living").setOrigin(0, 1).setDepth(5).setVisible(false);
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.down).setOrigin(0.5, 1);
    // (가구 전경 오버레이 방식은 back wall/소품까지 캐릭터 머리를 가려 '대가리 잘림'이 생겨 폐기. 캐릭터를 그냥 앞에 그린다. AGENTS.md 참고.)
    this.cursors = this.input.keyboard!.createCursorKeys();
    // 꾸미기·잠자기용 키. (대사창은 keydown 이벤트를 쓰므로, 여기선 update에서 JustDown으로만 읽어 충돌을 피한다)
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      space: this.input.keyboard!.addKey(KC.SPACE),
      f: this.input.keyboard!.addKey(KC.F),
      r: this.input.keyboard!.addKey(KC.R),
      q: this.input.keyboard!.addKey(KC.Q),
      e: this.input.keyboard!.addKey(KC.E),
      esc: this.input.keyboard!.addKey(KC.ESC),
    };
    // 실내에서도 인게임 메뉴 열기(Enter/X). 대사·워프 중(busy)엔 열리지 않도록 openMenu가 가드.
    this.input.keyboard!.on("keydown-ENTER", () => this.openMenu());
    this.input.keyboard!.on("keydown-X", () => this.openMenu());
    // 메뉴가 닫혀 이 씬이 재개되면 openMenu에서 껐던 입력을 다시 켠다.
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.input.enabled = true; });

    if (DEBUG_COLLISION) {
      this.dbg = this.add.graphics().setDepth(50);
      this.add.text(12, 40, "", { fontFamily: "monospace", fontSize: "18px", color: "#00ff66", backgroundColor: "#000000aa", padding: { x: 6, y: 3 } })
        .setName("dbgpos").setScrollFactor(0).setDepth(200);
    }

    // 안내(컷신 동안엔 숨김)
    const name = this.playerName();
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  침대 앞 Space: 잠자기  |  F: 방 꾸미기  |  문: 마을로`, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff",
      backgroundColor: "#00000077", padding: { x: 8, y: 4 },
    }).setName("hud").setScrollFactor(0).setDepth(100);

    this.buildDialogUi();

    // 첫 방 진입(기본 침실, 디버그면 지정한 방)
    const sr = this.rooms[this.startRoom] ? this.startRoom : "bedroom";
    this.enterRoom(sr, ...this.rooms[sr].start);

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // 인트로 컷신은 침실에서 처음 시작할 때만(거실 바로가기 등은 스킵)
    if (sr === "bedroom" && !this.skipIntro && !this.registry.get("houseIntroDone")) {
      this.busy = true;
      this.runHouseIntro();
    }
  }

  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  // 인게임 메뉴 열기(오버레이) — WorldScene.openMenu와 동일 패턴. 이 씬을 멈추고 MenuScene을 띄운다.
  private openMenu(): void {
    if (this.busy || this.moving || this.decorating) return;   // 꾸미는 중엔 메뉴가 끼어들지 않는다
    // 저장 위치 기록 — 실내는 방(roomKey) 단위로 복원(정밀 타일 아님).
    this.registry.set("saveLoc", { scene: "InteriorScene", room: this.roomKey });
    this.input.enabled = false;
    this.cameras.main.resetFX();
    this.scene.pause();
    this.scene.launch("MenuScene", { from: "InteriorScene" });
  }

  private makeWalkAnims(tex: string, prefix: string): void {
    const mk = (dir: string, f: number[]) => {
      const key = `${prefix}-${dir}`;
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames: f }), frameRate: 8, repeat: -1 });
      }
    };
    mk("down", [0, 1, 2, 3]); mk("left", [4, 5, 6, 7]); mk("right", [8, 9, 10, 11]); mk("up", [12, 13, 14, 15]);
  }

  // 방을 바꾸거나 처음 들어갈 때: 텍스처/데이터 교체 후 위치 배치
  private enterRoom(key: string, tx: number, ty: number, face: Dir = "down"): void {
    this.roomKey = key;
    this.def = this.rooms[key];
    this.roomImg.setTexture(key === "bedroom" ? "room_bedroom" : "room_living");
    this.tx = tx; this.ty = ty;
    this.facing = face;
    this.player.stop();
    this.player.setFrame(this.idleFrame[face]);
    this.moving = false;
    if (this.decorating) this.exitDecorate();   // 방을 옮기면 꾸미기 모드는 닫는다
    this.renderFurniture();                     // 놓아둔 가구 다시 그리기(침실에서만 보인다)
    this.layout();
  }

  // ─────────────────────── ★ 집 꾸미기 (내 색) ───────────────────────
  // 놓인 가구를 화면에 그린다. 캐릭터(depth 10)보다 아래에 그려서 '머리 잘림'이 없다(AGENTS.md).
  //  가구 칸은 walkable()에서 막히므로 캐릭터가 가구 위에 겹칠 일도 없다.
  private renderFurniture(): void {
    this.furnImgs.forEach(i => i.destroy());
    this.furnImgs = [];
    if (this.roomKey !== "bedroom") return;     // 꾸미기는 내 방(2F)에서만
    for (const p of this.house.furniture) {
      const def = FURNITURE.find(f => f.id === p.itemId);
      if (!def || !this.textures.exists(def.sprite)) continue;
      // 러그(밟고 지나가는 것)는 바닥에 깔리고(depth 1), 덩치 가구는 그 위·주인공 아래(depth 5).
      const img = this.add.image(0, 0, def.sprite).setOrigin(0, 0).setDepth(def.walkable ? 1 : 5);
      img.setData("cell", { x: p.x, y: p.y, w: def.w, h: def.h });
      this.furnImgs.push(img);
    }
    this.layoutFurniture();
  }

  // 가구 그림을 칸 좌표에 맞춰 배치(리사이즈 때도 다시 호출).
  private layoutFurniture(): void {
    for (const img of this.furnImgs) {
      const c = img.getData("cell") as { x: number; y: number; w: number; h: number };
      // 가구 그림이 차지 칸(w×h)에 딱 맞도록 스케일(그림이 32의 배수가 아니어도 안전).
      img.setPosition(this.origin.x + c.x * this.tile, this.origin.y + c.y * this.tile);
      img.setDisplaySize(c.w * this.tile, c.h * this.tile);
    }
  }

  // (x,y)가 원래 방 바닥(가구를 놓을 수 있는 빈 칸)인가 — 벽·기존 가구·계단/문·주인공 발밑은 안 된다.
  private isFloor = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= this.def.cols || y >= this.def.rows) return false;
    if (this.def.blocked[y][x] === 1) return false;
    if (this.warpAt(x, y)) return false;
    // ⚠️ 계단/문 '앞칸'도 막는다 — 침실 계단은 진입로가 (11,3) 한 칸뿐이라, 거기 가구를 놓으면
    //    계단으로 영영 못 가서 방에 갇힌다.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.warpAt(x + dx, y + dy)) return false;
    }
    if (x === this.tx && y === this.ty) return false;   // 주인공이 선 칸에 놓으면 갇힌다
    return true;
  };

  private toggleDecorate(): void {
    if (this.decorating) { this.exitDecorate(); return; }
    if (this.roomKey !== "bedroom") return;   // 내 방에서만 꾸민다
    this.decorating = true;
    // 커서는 주인공 앞칸에서 시작(없으면 주인공 옆)
    const [dx, dy] = this.dirVec(this.facing);
    this.curX = Phaser.Math.Clamp(this.tx + dx, 0, this.def.cols - 1);
    this.curY = Phaser.Math.Clamp(this.ty + dy, 0, this.def.rows - 1);
    this.cursorG = this.add.graphics().setDepth(20);
    this.ghost = this.add.image(0, 0, FURNITURE[this.selIdx].sprite).setOrigin(0, 0).setDepth(19).setAlpha(0.6);
    this.decoText = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "16px", color: "#ffffff", align: "center",
      backgroundColor: "#000000cc", padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);
    playSfx(this, SFX.decision, 0.5);
    this.drawDecorate();
  }

  private exitDecorate(): void {
    this.decorating = false;
    this.cursorG?.destroy(); this.cursorG = undefined;
    this.ghost?.destroy(); this.ghost = undefined;
    this.decoText?.destroy(); this.decoText = undefined;
  }

  // 꾸미기 모드 입력 — 방향키: 커서, Q/E: 가구 바꾸기, Space: 놓기, R: 치우기, F/Esc: 끝내기
  private updateDecorate(justSpace: boolean): void {
    const JD = Phaser.Input.Keyboard.JustDown;
    let moved = false;
    if (JD(this.cursors.left)) { this.curX--; moved = true; }
    else if (JD(this.cursors.right)) { this.curX++; moved = true; }
    else if (JD(this.cursors.up)) { this.curY--; moved = true; }
    else if (JD(this.cursors.down)) { this.curY++; moved = true; }
    if (moved) {
      this.curX = Phaser.Math.Clamp(this.curX, 0, this.def.cols - 1);
      this.curY = Phaser.Math.Clamp(this.curY, 0, this.def.rows - 1);
    }
    if (JD(this.keys.q)) { this.selIdx = (this.selIdx - 1 + FURNITURE.length) % FURNITURE.length; playSfx(this, SFX.cursor, 0.4); }
    if (JD(this.keys.e)) { this.selIdx = (this.selIdx + 1) % FURNITURE.length; playSfx(this, SFX.cursor, 0.4); }
    if (justSpace) this.placeFurniture();
    if (JD(this.keys.r)) this.removeFurniture();
    this.drawDecorate();
  }

  // 이 가구를 놓아도 방이 막히지 않나 — 주인공이 계단(워프)과 침대 앞칸에 여전히 갈 수 있어야 한다.
  //  ⚠️ 이게 없으면 통로 한가운데 큰 가구를 놓아 방이 두 조각으로 갈라지고, 계단도 침대도 못 가서 갇힌다.
  //     (러그처럼 밟고 지나가는 가구는 길을 막지 않으므로 벽으로 치지 않는다.)
  private keepsRoomConnected(def: FurnitureDef, px: number, py: number): boolean {
    const solid = new Set<string>();
    for (const p of this.house.furniture) {
      const d = FURNITURE.find(f => f.id === p.itemId);
      if (!d || d.walkable) continue;
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) solid.add(`${p.x + dx},${p.y + dy}`);
    }
    if (!def.walkable) {
      for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) solid.add(`${px + dx},${py + dy}`);
    }

    // 주인공 위치에서 걸어서 갈 수 있는 칸을 전부 모은다(BFS).
    const seen = new Set<string>([`${this.tx},${this.ty}`]);
    const queue: Array<[number, number]> = [[this.tx, this.ty]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        if (nx < 0 || ny < 0 || nx >= this.def.cols || ny >= this.def.rows) continue;
        if (this.def.blocked[ny][nx] === 1 && !this.warpAt(nx, ny)) continue;
        if (solid.has(key)) continue;
        seen.add(key); queue.push([nx, ny]);
      }
    }

    // 계단/문은 전부 닿아야 한다.
    for (const w of this.def.warps) if (!seen.has(`${w.x},${w.y}`)) return false;
    // ⚠️ '지금 서 있는 자리'만 보면 안 된다 — 방에 다시 들어올 때 서는 자리(시작칸·계단 도착칸)가
    //    가구로 둘러싸이면, 놓을 땐 멀쩡했다가 재입장 순간 갇힌다. 그 자리들도 전부 닿아야 한다.
    const entries: Array<[number, number]> = [this.def.start];
    for (const w of this.def.warps) {
      const back = this.rooms[w.to];
      if (back) for (const bw of back.warps) {
        if (bw.to === this.roomKey && bw.ax !== undefined && bw.ay !== undefined) entries.push([bw.ax, bw.ay]);
      }
    }
    for (const [ex, ey] of entries) if (!seen.has(`${ex},${ey}`)) return false;
    // 침대도 최소 한 칸은 앞에서 마주볼 수 있어야 한다(잠자기가 막히면 안 되니까).
    const bed = this.def.bed;
    if (bed) {
      const [bx, by, bw, bh] = bed;
      const front: Array<[number, number]> = [];
      for (let x = bx; x < bx + bw; x++) { front.push([x, by - 1]); front.push([x, by + bh]); }
      for (let y = by; y < by + bh; y++) { front.push([bx - 1, y]); front.push([bx + bw, y]); }
      if (!front.some(([x, y]) => seen.has(`${x},${y}`))) return false;
    }
    return true;
  }

  // 벽면 가구(벽난로·책장)는 '위쪽이 벽'인 자리에만 놓을 수 있다.
  //  그림이 정면 각도라 벽에 등을 대지 않으면 공중에 뜬 것처럼 보이기 때문(사용자 지적).
  //  → 가구 윗줄의 모든 칸 바로 위가 방 격자에서 막힌 칸(벽/기물)이어야 한다.
  private againstWall(def: FurnitureDef, x: number, y: number): boolean {
    if (!def.wallOnly) return true;
    for (let dx = 0; dx < def.w; dx++) {
      const ax = x + dx, ay = y - 1;
      if (ay < 0) return false;
      if (this.def.blocked[ay][ax] !== 1) return false;   // 위가 뚫려 있으면 벽이 아니다
      if (this.warpAt(ax, ay)) return false;              // 계단/문은 벽이 아니다
    }
    return true;
  }

  private placeFurniture(): void {
    const def = FURNITURE[this.selIdx];
    if (!canPlace(this.house, def, this.curX, this.curY, this.isFloor)
      || !this.againstWall(def, this.curX, this.curY)
      || !this.keepsRoomConnected(def, this.curX, this.curY)) {
      playSfx(this, SFX.bump, 0.4);
      return;
    }
    this.house.furniture.push({ itemId: def.id, x: this.curX, y: this.curY });
    this.registry.set("houseLayout", this.house);
    playSfx(this, SFX.decision, 0.45);
    this.renderFurniture();
  }

  private removeFurniture(): void {
    const hit = furnitureAt(this.house, this.curX, this.curY);
    if (!hit) { playSfx(this, SFX.bump, 0.4); return; }
    this.house.furniture = this.house.furniture.filter(p => p !== hit);
    this.registry.set("houseLayout", this.house);
    playSfx(this, SFX.cancel, 0.5);
    this.renderFurniture();
  }

  // 커서 사각형(초록/빨강) + 미리보기 + 하단 설명 바
  private drawDecorate(): void {
    if (!this.decorating || !this.cursorG || !this.ghost || !this.decoText) return;
    const def = FURNITURE[this.selIdx];
    // 놓을 수 있나 = 빈 칸이고(canPlace) + 벽면 가구면 벽에 붙었고(againstWall) + 길이 막히지 않는다
    const ok = canPlace(this.house, def, this.curX, this.curY, this.isFloor)
      && this.againstWall(def, this.curX, this.curY)
      && this.keepsRoomConnected(def, this.curX, this.curY);
    const onFurn = !!furnitureAt(this.house, this.curX, this.curY);

    const x = this.origin.x + this.curX * this.tile;
    const y = this.origin.y + this.curY * this.tile;
    const w = def.w * this.tile;
    const h = def.h * this.tile;

    if (this.ghost.texture.key !== def.sprite && this.textures.exists(def.sprite)) this.ghost.setTexture(def.sprite);
    this.ghost.setPosition(x, y).setDisplaySize(w, h).setVisible(this.textures.exists(def.sprite) && !onFurn);

    const g = this.cursorG;
    g.clear();
    g.lineStyle(3, ok ? 0x53d769 : 0xff4d4d, 1);
    g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    // 이 가구가 지금 파티에 무슨 의미인지 + 방 전체가 만드는 컨디션 상한을 함께 보여준다.
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    const caps = party.map(p => `${p.name} ${conditionCap(p, this.house)}`).join(" / ");
    const capLine = party.length
      ? `이 방의 컨디션 상한 → ${caps}  (최대 ${CONDITION_MAX})`
      : "포켓몬이 생기면 이 방의 효과가 나타난다.";
    // 왜 못 놓는지 알려준다(빨간 커서만 보여주면 이유를 모른다).
    //  ※ 는 Galmuri11에 있는 글자. ⚠ 같은 이모지·기호는 이 폰트에 없어 깨진 네모(▮)로 나온다.
    const why = !ok && def.wallOnly && !this.againstWall(def, this.curX, this.curY)
      ? "  ※ 벽에 등을 붙여야 놓을 수 있다" : "";
    this.decoText
      .setText(`[방 꾸미기]  ${def.name} — ${furnitureHint(def, party)}${why}\n${capLine}\n←↑↓→ 이동  Q/E 가구바꾸기  Space 놓기  R 치우기  F 끝내기`)
      .setPosition(this.scale.width / 2, this.scale.height - 12);
  }

  // ─────────────────────── ★ 잠자기(컨디션 회복) ───────────────────────
  // 침대를 바라보고 Space → 파티 전원이 쉰다. 얼마나 오르는지는 '방을 어떻게 꾸몄나'가 정한다.
  private facingBed(): boolean {
    const bed = this.def.bed;
    if (!bed) return false;
    const [dx, dy] = this.dirVec(this.facing);
    const fx = this.tx + dx, fy = this.ty + dy;
    const [bx, by, bw, bh] = bed;
    return fx >= bx && fx < bx + bw && fy >= by && fy < by + bh;
  }

  private async sleepInBed(): Promise<void> {
    this.busy = true;
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    await this.say("포근한 침대다. 한숨 잘까?");
    const yes = await this.askYesNo();
    if (!yes) {
      this.setDialogVisible(false);
      this.endBusySoon();
      return;
    }

    // 화면을 어둡게 → 밝게(밤이 지나가는 연출)
    this.setDialogVisible(false);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    await this.wait(700);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    await this.wait(300);

    if (party.length === 0) {
      await this.say("푹 잤다! …하지만 아직 함께 잘 포켓몬이 없다.");
      this.setDialogVisible(false);
      this.endBusySoon();
      return;
    }

    const results = sleepAtHome(party, this.house);
    this.registry.set("playerParty", party);
    await this.say("푹 잤다! 포켓몬들도 기운을 되찾았다.");
    for (const r of results) {
      const p = r.pokemon;
      if (r.after > r.before) {
        await this.say(`${p.name}의 컨디션이 올랐다!  ${r.before} → ${r.after}  (이 방의 한계 ${r.cap})`);
      } else {
        await this.say(`${p.name}은(는) 이 방에서 낼 수 있는 최상의 컨디션이다.  ${r.after} / ${r.cap}`);
      }
    }
    // 방이 허전하면 힌트(집 꾸미기 → 배틀 고리를 플레이어가 알아채게)
    const bestCap = Math.max(...results.map(r => r.cap));
    if (bestCap < CONDITION_MAX) {
      await this.say("방을 더 꾸미면 포켓몬이 더 좋은 컨디션까지 갈 수 있을 것 같다. (F: 방 꾸미기)");
    }
    this.setDialogVisible(false);
    this.endBusySoon();
  }

  // 대사가 끝난 직후의 Space가 다시 잠자기를 부르지 않도록 잠깐 뒤에 입력을 푼다.
  private endBusySoon(): void {
    this.time.delayedCall(200, () => { this.busy = false; });
  }

  // 방 이미지를 화면 중앙에 비율 유지로 배치 + 칸 크기 계산 + 주인공 위치 갱신
  private layout(): void {
    const { width, height } = this.scale;
    const src = this.textures.get(this.roomImg.texture.key).getSourceImage();
    this.zoom = Math.min((width * 0.98) / src.width, (height * 0.92) / src.height);
    const w = src.width * this.zoom, h = src.height * this.zoom;
    this.origin = { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2) };
    this.tile = 32 * this.zoom;
    this.roomImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);

    this.player.setScale(this.zoom * 0.92);
    this.player.setDepth(10);
    this.snapPlayer();
    if (this.nemona) this.nemona.setScale(this.zoom * 0.92);
    this.updateStairsDeco();
    this.layoutFurniture();
    this.drawDecorate();
    this.drawDebug();
    this.layoutDialog();
  }

  // 검증용: 막힌 칸=빨강, 워프 칸=초록(+방향). 확인용일 뿐 게임 로직과 무관.
  private drawDebug(): void {
    if (!this.dbg) return;
    const g = this.dbg;
    g.clear();
    // 막힌 칸=빨간 외곽선(그림 비침), 워프=초록 반투명, 걷는 칸=옅은 흰 격자.
    for (let ty = 0; ty < this.def.rows; ty++) {
      for (let tx = 0; tx < this.def.cols; tx++) {
        const x = this.origin.x + tx * this.tile;
        const y = this.origin.y + ty * this.tile;
        const w = this.warpAt(tx, ty);
        if (w) { g.fillStyle(0x00ff00, 0.45); g.fillRect(x, y, this.tile, this.tile); }
        else if (this.def.blocked[ty][tx] === 1) {
          g.lineStyle(3, 0xff2222, 0.95); g.strokeRect(x + 1.5, y + 1.5, this.tile - 3, this.tile - 3);
        }
        g.lineStyle(1, 0xffffff, 0.28); g.strokeRect(x, y, this.tile, this.tile);
      }
    }
  }

  // 거실 계단은 154 원본 타일을 좌우반전해 red_living_1f_stairs.png에 직접 구워넣었다.
  // (좌측 상단 cols3-4, rows2-4 + 빨간 카펫 col5) → 별도 오버레이 불필요, 항상 숨김.
  private updateStairsDeco(): void {
    this.stairsDeco.setVisible(false);
  }

  // 칸 좌표 → 화면 픽셀(발 밑 기준)
  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }

  private snapPlayer(): void { this.player.setPosition(this.cx(this.tx), this.cy(this.ty)); }

  // 해당 칸이 dir 방향으로 들어갈 수 있는지 — 격자 밖/blocked는 불가.
  // 방향 지정 워프(계단/문)는 "그 방향으로 들어설 때만" 진입 가능 → 계단을 옆/아래에서 밟고 서 있는 일이 없다.
  private walkable(tx: number, ty: number, dir: Dir): boolean {
    if (tx < 0 || ty < 0 || tx >= this.def.cols || ty >= this.def.rows) return false;
    const w = this.warpAt(tx, ty);
    if (w) return w.dir ? w.dir === dir : true;
    // 내가 놓은 가구도 벽처럼 막는다 — 단 러그·카펫(walkable)은 밟고 지나간다.
    if (this.roomKey === "bedroom") {
      const p = furnitureAt(this.house, tx, ty);
      if (p) {
        const def = FURNITURE.find(f => f.id === p.itemId);
        if (!def?.walkable) return false;
      }
    }
    return this.def.blocked[ty][tx] === 0;
  }

  private warpAt(tx: number, ty: number): Warp | undefined {
    return this.def.warps.find((w) => w.x === tx && w.y === ty);
  }

  update(): void {
    if (this.dbg) {
      const t = this.children.getByName("dbgpos") as Phaser.GameObjects.Text | null;
      t?.setText(`room=${this.roomKey} tile=(${this.tx},${this.ty}) face=${this.facing}`);
    }
    // 키는 매 프레임 '눌린 순간'을 소비한다 — 대사창(keydown 이벤트)이 끝난 직후의 키가
    // 여기로 새어 들어와 잠자기/꾸미기가 또 발동하는 걸 막는다.
    const JD = Phaser.Input.Keyboard.JustDown;
    const justSpace = JD(this.keys.space);
    const justF = JD(this.keys.f);
    const justEsc = JD(this.keys.esc);

    if (this.busy || this.moving) return;

    // ★ 꾸미기 모드 — 방향키는 커서 이동으로 쓰이고, 주인공은 안 움직인다.
    if (this.decorating) {
      if (justF || justEsc) { this.exitDecorate(); return; }
      this.updateDecorate(justSpace);   // Space는 위에서 이미 소비했으므로 값으로 넘긴다
      return;
    }
    if (justF) { this.toggleDecorate(); return; }
    // ★ 침대를 바라보고 Space → 잠자기(파티 컨디션 회복)
    if (justSpace && this.facingBed()) { void this.sleepInBed(); return; }

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty, this.facing)) {
      this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]);
      if (this.time.now - this.lastBump > 300) { playSfx(this, SFX.bump, 0.4); this.lastBump = this.time.now; }
      return;
    }

    this.moving = true;
    this.player.play(`walk-${this.facing}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: 140,
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; this.handleWarp(); },
    });
  }

  // 현재 칸이 계단/문이면 전환
  private handleWarp(): void {
    const w = this.warpAt(this.tx, this.ty);
    if (!w) return;
    // 방향 지정 워프(계단/문)는 그 방향으로 "들어설 때"만 발동 → 옆으로 지나가다 발동하는 버그 방지.
    if (w.dir && this.facing !== w.dir) return;
    this.busy = true;
    playSfx(this, SFX.doorIn, 0.6);
    // 계단: climb 경로가 있으면 그 칸을 따라 올라선 뒤 전환. 없으면(정통 포켓몬식) 밟는 즉시 전환.
    //  → 방향 시비(직진/대각선)를 없애려면 climb를 빼서 '밟으면 바로 내려감'으로 둔다.
    if (w.kind === "stairs" && Array.isArray(w.climb) && w.climb.length) {
      const face = w.climbFace ?? "up";
      this.facing = face;
      this.player.setFrame(this.idleFrame[face]);
      this.climbAlong(this.climbCells(w), face, () => this.doWarpTransition(w));
    } else {
      this.player.stop();
      this.doWarpTransition(w);
    }
  }

  // 워프의 climb 정의를 "올라갈 절대 칸 목록"으로 편다.
  //  climb 없음 → 바라보는 방향으로 한 칸. [dx,dy] → 한 칸. [[dx,dy],...] → 여러 칸(계단 스텝 경로).
  private climbCells(w: Warp): Array<[number, number]> {
    const raw = w.climb;
    if (!raw || raw.length === 0) {
      const [dx, dy] = this.dirVec(this.facing);
      return [[w.x + dx, w.y + dy]];
    }
    const steps: number[][] = Array.isArray(raw[0]) ? (raw as number[][]) : [raw as number[]];
    return steps.map(([dx, dy]) => [w.x + dx, w.y + dy] as [number, number]);
  }

  // 계단 스텝을 한 칸씩 순서대로 걸어 올라간 뒤 done() 호출(마지막 칸에 다다르면 층 전환).
  private climbAlong(cells: Array<[number, number]>, face: Dir, done: () => void): void {
    if (cells.length === 0) { this.player.stop(); done(); return; }
    const [nx, ny] = cells[0];
    this.player.play(`walk-${face}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(nx), y: this.cy(ny), duration: 200,
      onComplete: () => { this.tx = nx; this.ty = ny; this.climbAlong(cells.slice(1), face, done); },
    });
  }

  private dirVec(d: Dir): [number, number] {
    return d === "left" ? [-1, 0] : d === "right" ? [1, 0] : d === "up" ? [0, -1] : [0, 1];
  }

  // 실제 화면 전환. ⚠️ 예전엔 카메라 "camerafadeoutcomplete" 이벤트에만 의존했는데, 그 이벤트가
  //    안 오면 busy=true로 영영 멈춰(입력잠금) "계단 밟았는데 안 넘어간다"가 된다 → 시간기반으로 확실하게.
  private doWarpTransition(w: Warp): void {
    this.player.stop();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      if (w.to === "world") { this.scene.start("WorldScene"); return; }
      this.enterRoom(w.to, w.ax ?? this.rooms[w.to].start[0], w.ay ?? this.rooms[w.to].start[1], w.face ?? "down");
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.busy = false;
    });
  }

  // ─────────────────────────── 인트로 컷신 ───────────────────────────
  private async runHouseIntro(): Promise<void> {
    const hud = this.children.getByName("hud") as Phaser.GameObjects.Text | null;
    hud?.setVisible(false);

    const name = this.playerName();
    this.player.setFrame(this.idleFrame.down);

    await this.wait(600);
    await this.say(`${name}은(는) 방에서 눈을 떴다.`);
    await this.say("띵— 동—");
    await this.say(`어머, 왔니? ${name}은(는) 2층에 있단다.`, "엄마");
    // 네모가 계단으로 올라온다 — 걷는 동안 "터벅 터벅" 발소리만 띄운다(별도 나레이션 없음)
    this.nemona = this.add.sprite(this.cx(10), this.cy(3), "nemona", 0)
      .setOrigin(0.5, 1).setScale(this.zoom * 0.92).setDepth(10);
    this.setDialogVisible(true); this.setSpeaker(null); this.arrow.setVisible(false);
    this.boxText.setText("터벅… 터벅…");
    // 계단(10,3)에서 오른쪽(11열)으로 빠져 내려온 뒤, 주인공(8,9) 바로 위 (8,8)까지 걸어와 마주 선다.
    //  → 멀리서 멈추지 않고 플레이어 앞에 와서, 아래(플레이어)를 바라본 채 대화한다.
    await this.walkNemona([[10, 3], [11, 3], [11, 8], [8, 8]], "down");
    // 주인공도 네모(바로 위)를 바라봄(위쪽) → 서로 정면으로 마주봄
    this.facing = "up"; this.player.setFrame(this.idleFrame.up);
    await this.wait(150);

    await this.say(`${name}—! 좋은 아침!! ……앗, 아직 잠이 덜 깬 얼굴인데?`, "???");
    await this.say("너는…?", name);
    await this.say("에이, 나야 나! 네모! 아침부터 그런 멍한 표정 짓지 말라고~", "네모");
    await this.say(`${name}, 오늘 드디어 오박사님한테 첫 파트너를 받는 날이잖아!`, "네모");
    await this.say("난 어젯밤부터 두근거려서 잠도 설쳤다니까!", "네모");
    await this.say("설마 잊은 건 아니지?", "네모");

    const yes = await this.askYesNo();
    if (yes) {
      await this.say(`역시 ${name}! 좋아, 난 먼저 연구소 가서 몸 풀고 있을게.`, "네모");
      await this.say("네가 파트너를 고르면 — 바로 나랑 첫 배틀이다! 얼른 와!", "네모");
    } else {
      await this.say("뭐어?! 이런 걸 잊으면 어떡해~", "네모");
      await this.say("얼른 준비하고 나와! 연구소에서 기다릴게. 배틀 생각에 벌써 근질근질하다고!", "네모");
    }

    // (8,8)에서 오른쪽(11열)으로 빠져 계단(10,3)으로 가 사라진다. 계단은 아래-왼쪽으로 내려가므로
    //  마지막 걸음(왼쪽=계단 방향) 그대로 "left"로 서서 계단을 바라본 채 사라진다(위=벽 보게 하지 않음).
    await this.walkNemona([[8, 8], [11, 8], [11, 3], [10, 3]], "left");
    playSfx(this, SFX.doorOut, 0.5);
    await this.fadeOutNemona();
    await this.wait(200);

    await this.say("네모를 따라 오박사님이 계시는 연구소로 가자!");
    this.setDialogVisible(false);   // 마지막 대사에서 엔터 → 대화상자 닫기(이동 화면과 통일)

    this.registry.set("houseIntroDone", true);
    hud?.setVisible(true);
    this.busy = false;   // 이동 가능
  }

  // 네모를 칸 경로(타일 좌표 배열)대로 걷게 한다. path[0]=현재 위치.
  private async walkNemona(path: Array<[number, number]>, endFacing: Dir): Promise<void> {
    const n = this.nemona!;
    for (let i = 1; i < path.length; i++) {
      const [px, py] = path[i - 1];
      const [tx, ty] = path[i];
      const dir: Dir = tx < px ? "left" : tx > px ? "right" : ty < py ? "up" : "down";
      const steps = Math.abs(tx - px) + Math.abs(ty - py);
      n.play(`nemona-${dir}`, true);
      await new Promise<void>((res) => {
        this.tweens.add({ targets: n, x: this.cx(tx), y: this.cy(ty), duration: 150 * steps, onComplete: () => res() });
      });
    }
    n.stop();
    n.setFrame(this.idleFrame[endFacing]);
  }

  private fadeOutNemona(): Promise<void> {
    const n = this.nemona!;
    return new Promise((res) => {
      this.tweens.add({
        targets: n, alpha: 0, duration: 300,
        onComplete: () => { n.destroy(); this.nemona = undefined; res(); },
      });
    });
  }

  // ─────────────────────────── 대화창 ───────────────────────────
  private buildDialogUi(): void {
    this.boxG = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.namePlate = this.add.graphics().setScrollFactor(0).setDepth(1001);
    this.boxText = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffffff", lineSpacing: 8,
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);
    this.nameTag = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffe27a",
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);
    this.arrow = this.add.text(0, 0, "▼", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffffff",
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(1002).setVisible(false);
    this.tweens.add({ targets: this.arrow, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.setDialogVisible(false);
    this.layoutDialog();
  }

  private layoutDialog(): void {
    const { width, height } = this.scale;
    const w = Math.min(width * 0.92, 1100);
    const h = Math.max(height * 0.22, 130);
    const x = (width - w) / 2;
    const y = height - h - Math.max(height * 0.04, 18);
    const pad = Math.round(h * 0.18);
    const font = Math.max(18, Math.round(h * 0.17));
    this.boxRect = { x, y, w, h, pad, font };
    this.drawBox();
    this.boxText.setPosition(x + pad, y + pad).setFontSize(font).setWordWrapWidth(w - pad * 2);
    this.nameTag.setFontSize(font);
    this.arrow.setPosition(x + w - pad, y + h - pad * 0.4).setFontSize(font);
    this.applySpeaker();
  }

  private drawBox(): void {
    const { x, y, w, h } = this.boxRect;
    const g = this.boxG;
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 4, y + 6, w, h, 18);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(x, y, w, h, 18);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 14);
    g.lineStyle(2, 0x4a6aa5, 0.8); g.strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, 11);
  }

  private setSpeaker(name: string | null): void { this.speaker = name; this.applySpeaker(); }

  private applySpeaker(): void {
    const show = this.boxG.visible && !!this.speaker;
    if (!show) { this.namePlate.clear().setVisible(false); this.nameTag.setVisible(false); return; }
    const { x, y, font } = this.boxRect;
    this.nameTag.setText(this.speaker!);
    const padX = Math.round(font * 0.7);
    const plateH = Math.round(font * 1.7);
    const plateW = Math.round(this.nameTag.width + padX * 2);
    const px = x + 18;
    const py = y - plateH + 8;
    const g = this.namePlate;
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(px + 3, py + 4, plateW, plateH, 10);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(px, py, plateW, plateH, 10);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(px + 4, py + 4, plateW - 8, plateH - 8, 7);
    g.setVisible(true);
    this.nameTag.setPosition(px + padX, py + plateH / 2).setVisible(true);
  }

  private setDialogVisible(v: boolean): void {
    this.boxG.setVisible(v);
    this.boxText.setVisible(v);
    if (v) this.applySpeaker();
    else { this.namePlate.setVisible(false); this.nameTag.setVisible(false); this.arrow.setVisible(false); }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // 대사 출력(타자기). speaker=null이면 나레이션(이름창 없음).
  private say(text: string, speaker: string | null = null): Promise<void> {
    this.setDialogVisible(true);
    this.setSpeaker(speaker);
    return new Promise((resolve) => {
      this.arrow.setVisible(false);
      this.boxText.setText("");
      let i = 0; let typing = true;
      const cleanup = () => {
        this.input.keyboard!.off("keydown-SPACE", onAdvance);
        this.input.keyboard!.off("keydown-ENTER", onAdvance);
        this.input.off("pointerdown", onAdvance);
      };
      const finishTyping = () => { timer.remove(); this.boxText.setText(text); typing = false; this.arrow.setVisible(true); };
      const timer = this.time.addEvent({
        delay: 38, loop: true, callback: () => {
          i++; this.boxText.setText(text.slice(0, i));
          if (i >= text.length) finishTyping();
        },
      });
      const onAdvance = () => {
        if (typing) finishTyping();
        else { cleanup(); resolve(); }
      };
      this.input.keyboard!.on("keydown-SPACE", onAdvance);
      this.input.keyboard!.on("keydown-ENTER", onAdvance);
      this.input.on("pointerdown", onAdvance);
    });
  }

  // 예/아니오 선택 — 대화박스 위 오른쪽 작은 메뉴. ↑↓/클릭 + Enter.
  private askYesNo(): Promise<boolean> {
    const font = this.boxRect.font;
    const rowH = Math.round(font * 1.9);
    const boxW = Math.max(Math.round(font * 5), 140);
    const boxH = rowH * 2 + Math.round(font * 0.8);
    const bx = this.boxRect.x + this.boxRect.w - boxW;
    const by = this.boxRect.y - boxH - 12;
    const g = this.add.graphics().setScrollFactor(0).setDepth(1003);
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(bx + 3, by + 5, boxW, boxH, 12);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(bx, by, boxW, boxH, 12);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(bx + 5, by + 5, boxW - 10, boxH - 10, 8);

    const opts = ["예", "아니오"];
    const labelX = bx + Math.round(font * 1.6);
    const rows = opts.map((t, i) =>
      this.add.text(labelX, by + Math.round(font * 0.6) + i * rowH, t, {
        fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffffff",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(1004)
    );
    const cursor = this.add.text(0, 0, "▶", {
      fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffe27a",
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(1004);
    let idx = 0;
    const place = () => cursor.setPosition(bx + Math.round(font * 0.5), rows[idx].y);
    place();

    return new Promise((resolve) => {
      const move = (d: number) => { idx = (idx + d + opts.length) % opts.length; place(); };
      const up = () => move(-1);
      const down = () => move(1);
      const confirm = () => {
        this.input.keyboard!.off("keydown-UP", up);
        this.input.keyboard!.off("keydown-DOWN", down);
        this.input.keyboard!.off("keydown-ENTER", confirm);
        g.destroy(); rows.forEach((r) => r.destroy()); cursor.destroy();
        resolve(idx === 0);
      };
      this.input.keyboard!.on("keydown-UP", up);
      this.input.keyboard!.on("keydown-DOWN", down);
      this.input.keyboard!.on("keydown-ENTER", confirm);
      rows.forEach((r, i) => {
        r.setInteractive({ useHandCursor: true });
        r.on("pointerover", () => { idx = i; place(); });
        r.on("pointerdown", () => { idx = i; place(); confirm(); });
      });
    });
  }
}
