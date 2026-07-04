import Phaser from "phaser";
import { Gender } from "../data/Player";

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
interface RoomDef { img: string; cols: number; rows: number; blocked: number[][]; start: [number, number]; warps: Warp[] }
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
    this.load.audio("sfx_door", "assets/audio/door.ogg");
    const file = this.gender === "girl"
      ? "assets/characters/trainer_DAWN.png"
      : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
    // 라이벌 네모(오버월드 걷기 시트, 32x48 4방향x4프레임)
    this.load.spritesheet("nemona", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    this.rooms = this.cache.json.get("rooms") as Rooms;

    // 도트는 또렷하게(픽셀 보존) — 화질 개선의 핵심
    for (const k of ["room_bedroom", "room_living", "stairs_living", "nemona", this.texKey]) {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.cameras.main.roundPixels = true;   // 소수점 좌표로 인한 흐릿함 방지

    // 걷기 애니메이션(행0=아래,1=왼쪽,2=오른쪽,3=위, 각 4프레임)
    this.makeWalkAnims(this.texKey, "walk");
    this.makeWalkAnims("nemona", "nemona");

    this.roomImg = this.add.image(0, 0, "room_bedroom").setOrigin(0, 0).setName("roomImg");
    // 거실 계단 그림 — 발판(아래끝)을 워프 칸 바닥에 맞춤. 바닥보다 위, 주인공보다 아래.
    this.stairsDeco = this.add.image(0, 0, "stairs_living").setOrigin(0, 1).setDepth(5).setVisible(false);
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.down).setOrigin(0.5, 1);
    // (가구 전경 오버레이 방식은 back wall/소품까지 캐릭터 머리를 가려 '대가리 잘림'이 생겨 폐기. 캐릭터를 그냥 앞에 그린다. AGENTS.md 참고.)
    this.cursors = this.input.keyboard!.createCursorKeys();

    if (DEBUG_COLLISION) {
      this.dbg = this.add.graphics().setDepth(50);
      this.add.text(12, 40, "", { fontFamily: "monospace", fontSize: "18px", color: "#00ff66", backgroundColor: "#000000aa", padding: { x: 6, y: 3 } })
        .setName("dbgpos").setScrollFactor(0).setDepth(200);
    }

    // 안내(컷신 동안엔 숨김)
    const name = this.playerName();
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  계단: 위로↑ 올라가기  |  문: 마을로`, {
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
    this.layout();
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
    if (this.busy || this.moving) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty, this.facing)) {
      this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return;
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
    this.sound.play("sfx_door", { volume: 0.6 });
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
    await this.say("터벅… 터벅…");

    // 네모가 계단(10,3)에서 방으로 올라온다
    this.nemona = this.add.sprite(this.cx(10), this.cy(3), "nemona", 0)
      .setOrigin(0.5, 1).setScale(this.zoom * 0.92).setDepth(10);
    await this.walkNemona([[10, 3], [11, 3], [11, 5], [9, 5]], "down");
    // 주인공이 네모를 바라봄(위쪽)
    this.facing = "up"; this.player.setFrame(this.idleFrame.up);
    await this.wait(150);

    await this.say(`${name}! 좋은 아침!`, "???");
    await this.say("너는…?", name);
    await this.say("응? 네모잖아! 잠이 덜 깼구나—!", "네모");
    await this.say(`${name}! 오늘 오박사님께 가기로 한 날이잖아! 잊은 거 아니지?`, "네모");

    const yes = await this.askYesNo();
    if (yes) {
      await this.say("좋아! 얼른 준비해서 나와! 먼저 연구소에 가서 기다릴게!", "네모");
    } else {
      await this.say("뭐!? 와보길 잘했네! 얼른 준비해서 나와! 먼저 연구소에 가서 기다릴게!", "네모");
    }

    // 네모가 다시 계단으로 내려간다 → 주인공이 지켜봄
    await this.walkNemona([[9, 5], [11, 5], [11, 3], [10, 3]], "up");
    this.sound.play("sfx_door", { volume: 0.5 });
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
