import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createPokemon, Pokemon } from "../data/Pokemon";
import { frontPath, makeAnimatedFront } from "../game/pokemonSprite";
import DialogBox from "../ui/DialogBox";

// 포켓몬 연구소(오박사 랩) — 어나더레드 실제 내부맵(Map157) 추출본.
//  실제 포켓몬 게임 스타팅 방식(FRLG/SV): 탁자 위에 3마리를 올려두고, 걸어가서 살펴본 뒤
//  이름·타입 확인 → "이 포켓몬으로 하겠니? 예/아니오". (도감 설명·오박사 낭독 없음)
type Dir = "down" | "left" | "right" | "up";
interface LabMap { img: string; cols: number; rows: number; blocked: number[][]; spawn: [number, number]; exit: { x: number; y: number; toTown: [number, number] }; }

interface StarterDef { key: string; name: string; type: string; id: number; }
const STARTERS: StarterDef[] = [
  { key: "SPRIGATITO", name: "나오하",  type: "풀",   id: 906 },
  { key: "CHARMANDER", name: "파이리",  type: "불꽃", id: 4 },
  { key: "FROAKIE",    name: "개구마르", type: "물",   id: 656 },
];
const TYPE_COLOR: Record<string, number> = { "풀": 0x5fb85a, "불꽃": 0xe6743a, "물": 0x4f9bd8 };

const OAK_TILE: [number, number] = [8, 3];      // 스타팅 탁자 바로 뒤
const NEMONA_TILE: [number, number] = [11, 3];
const TABLE_TILES: [number, number][] = [[8, 4], [9, 4]];   // 초록 탁자(막힌 칸) — 여기 위에 3마리를 올림
// 탁자 위 3마리 배치(타일 소수좌표): 탁자 폭(8~9.5) 중앙에 나란히
const MON_TX = [8.1, 8.75, 9.4];
const MON_TY = 4.35;                             // 탁자 상판 높이(발 위치)

export default class LabScene extends Phaser.Scene {
  private map!: LabMap;
  private mapImg!: Phaser.GameObjects.Image;
  private oak!: Phaser.GameObjects.Sprite;
  private nemona!: Phaser.GameObjects.Sprite;
  private starters: { sp: Phaser.GameObjects.Sprite; scale: number }[] = [];

  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero_lab";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "up";
  private tx = 6; private ty = 12;
  private moving = false; private busy = false;
  private chosen = false;

  private zoom = 1; private origin = { x: 0, y: 0 }; private tile = 32;
  private tableTopY = 0; private starterTargetH = 32;   // 탁자 위 포켓몬 발선/내용높이(커서·이름표용)
  private dlg!: DialogBox;
  private hint!: Phaser.GameObjects.Text;
  // 탁자 위 선택 커서
  private selecting = false; private selIndex = 1;
  private selCur!: Phaser.GameObjects.Text;
  private tagG!: Phaser.GameObjects.Graphics;
  private tagType!: Phaser.GameObjects.Text;
  private tagName!: Phaser.GameObjects.Text;

  constructor() { super("LabScene"); }
  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    const v = "?v=" + Date.now();
    this.load.image("lab_map", "assets/world/oak_lab.png" + v);
    this.load.json("lab_col", "assets/world/oak_lab.json" + v);
    this.load.spritesheet("oak", "assets/characters/trainer_PROFESSOR.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    this.load.audio("sfx_door", "assets/audio/door.ogg");
    for (const s of STARTERS) this.load.image(s.key, frontPath(s.key));
  }

  create(): void {
    this.map = this.cache.json.get("lab_col") as LabMap;
    this.tx = this.map.spawn[0]; this.ty = this.map.spawn[1]; this.facing = "up";

    for (const k of ["lab_map", "oak", "nemona_ow", this.texKey, ...STARTERS.map(s => s.key)])
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    this.mapImg = this.add.image(0, 0, "lab_map").setOrigin(0, 0).setDepth(0);
    const mk = (key: string, frames: number[]) =>
      this.anims.create({ key: `lab-${key}`, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mk("down", [0, 1, 2, 3]); mk("left", [4, 5, 6, 7]); mk("right", [8, 9, 10, 11]); mk("up", [12, 13, 14, 15]);

    this.oak = this.add.sprite(0, 0, "oak", 0).setOrigin(0.5, 1).setDepth(4);
    this.nemona = this.add.sprite(0, 0, "nemona_ow", 0).setOrigin(0.5, 1).setDepth(4);
    // 탁자 위 3마리(작게, 발을 탁자 상판에 정렬)
    this.starters = STARTERS.map((s) => {
      const sp = makeAnimatedFront(this, s.key, 0, 0, 1).setOrigin(0.5, 1).setDepth(5);
      return { sp, scale: 1 };
    });
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1).setDepth(7);

    // 선택 커서 + 이름/타입 태그
    this.selCur = this.add.text(0, 0, "▼", { fontFamily: "Galmuri11", fontSize: "20px", color: "#ffd24a" }).setOrigin(0.5, 1).setDepth(9).setVisible(false);
    this.tagG = this.add.graphics().setDepth(9).setVisible(false);
    this.tagType = this.add.text(0, 0, "", { fontFamily: "Galmuri11", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5).setDepth(10).setVisible(false);
    this.tagName = this.add.text(0, 0, "", { fontFamily: "Galmuri11", fontSize: "16px", color: "#ffffff" }).setOrigin(0, 0.5).setDepth(10).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);
    this.hint = this.add.text(12, 12, "", {
      fontFamily: "Galmuri11, sans-serif", fontSize: "15px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100).setVisible(false);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.layout, this); this.dlg.destroy(); });

    this.input.keyboard!.on("keydown-SPACE", this.onKey, this);
    this.input.keyboard!.on("keydown-ENTER", this.onKey, this);
    this.input.keyboard!.on("keydown-Z", this.onKey, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.runIntro();
  }

  // 포켓몬 Front 스프라이트 실제 내용 세로경계 측정(크기/발높이 정규화)
  private frontMetrics(key: string): { frameH: number; top: number; bottom: number } {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const cvs = document.createElement("canvas"); cvs.width = src.width; cvs.height = src.height;
    const ctx = cvs.getContext("2d")!; ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, src.width, src.height).data;
    let top = src.height, bottom = 0;
    for (let y = 0; y < src.height; y++) {
      let op = false;
      for (let x = 0; x < src.width; x += 2) if (d[(y * src.width + x) * 4 + 3] > 20) { op = true; break; }
      if (op) { if (y < top) top = y; if (y > bottom) bottom = y; }
    }
    if (bottom < top) { top = 0; bottom = src.height - 1; }
    return { frameH: src.height, top, bottom };
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    const src = this.textures.get("lab_map").getSourceImage();
    this.zoom = Math.min((W * 0.98) / src.width, (H * 0.92) / src.height);
    const w = src.width * this.zoom, h = src.height * this.zoom;
    this.origin = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
    this.tile = 32 * this.zoom;
    this.mapImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    this.oak.setPosition(this.cx(OAK_TILE[0]), this.cy(OAK_TILE[1])).setScale(this.zoom * 0.92);
    this.nemona.setPosition(this.cx(NEMONA_TILE[0]), this.cy(NEMONA_TILE[1])).setScale(this.zoom * 0.92);
    // 탁자 위 3마리: 내용높이 통일 + 발(내용 하단)을 상판선(MON_TY)에 정확히 정렬
    const targetH = this.tile * 1.1;
    const footLineY = this.origin.y + MON_TY * this.tile;
    this.tableTopY = footLineY; this.starterTargetH = targetH;
    this.starters.forEach((o, i) => {
      const m = this.frontMetrics(STARTERS[i].key);
      const sc = targetH / Math.max(1, m.bottom - m.top);
      o.scale = sc;
      o.sp.setScale(sc)
        .setPosition(this.fx(MON_TX[i]), footLineY + (m.frameH - m.bottom) * sc)
        .setDepth(5 + i * 0.01);
    });
    this.player.setPosition(this.cx(this.tx), this.cy(this.ty)).setScale(this.zoom * 0.92);
    this.dlg.layout();
    if (this.selecting) this.drawCursor();
  }

  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }
  private fx(txf: number): number { return this.origin.x + (txf + 0.5) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.cols || ty >= this.map.rows) return false;
    if (this.map.blocked[ty][tx] !== 0) return false;
    if (tx === OAK_TILE[0] && ty === OAK_TILE[1]) return false;
    if (tx === NEMONA_TILE[0] && ty === NEMONA_TILE[1]) return false;
    return true;
  }

  update(): void {
    if (this.busy || this.moving || this.selecting) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    if (this.ty === this.map.spawn[1] && this.tx === this.map.spawn[0] && this.facing === "down") { this.tryExit(); return; }
    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    this.moving = true;
    this.player.play(`lab-${this.facing}`, true);
    this.tweens.add({ targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: 150, onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; } });
  }

  // 스페이스/엔터: 선택 중이면 커서조작·결정, 아니면 앞칸 상호작용
  private onKey(e: KeyboardEvent): void {
    if (this.busy) return;
    if (this.selecting) { this.confirmSelected(); return; }
    const d: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const fx = this.tx + d[this.facing][0], fy = this.ty + d[this.facing][1];
    if (!this.chosen && TABLE_TILES.some(t => t[0] === fx && t[1] === fy)) { this.beginSelect(); return; }
    if (fx === OAK_TILE[0] && fy === OAK_TILE[1]) {
      this.busy = true;
      const msg = this.chosen ? "좋은 파트너를 골랐구나. 아래 문으로 나가 모험을 시작하렴!" : "탁자 위 세 마리 중에서 마음에 드는 녀석을 골라보렴.";
      this.dlg.say(msg, "오박사").then(() => { this.dlg.hide(); this.busy = false; });
    }
  }

  // ── 탁자 위 3마리 커서 선택 ──
  private beginSelect(): void {
    this.selecting = true; this.selIndex = 1;
    this.hint.setText("◀ ▶ 살펴보기   Z/Enter 결정").setVisible(true);
    this.selCur.setVisible(true); this.tagG.setVisible(true); this.tagType.setVisible(true); this.tagName.setVisible(true);
    this.input.keyboard!.on("keydown-LEFT", this.selLeft, this);
    this.input.keyboard!.on("keydown-RIGHT", this.selRight, this);
    this.drawCursor();
  }
  private selLeft(): void { if (!this.selecting) return; this.selIndex = (this.selIndex + 2) % 3; this.sound.play("sfx_door", { volume: 0.2 }); this.drawCursor(); }
  private selRight(): void { if (!this.selecting) return; this.selIndex = (this.selIndex + 1) % 3; this.sound.play("sfx_door", { volume: 0.2 }); this.drawCursor(); }

  private drawCursor(): void {
    const i = this.selIndex; const s = STARTERS[i]; const gc = TYPE_COLOR[s.type];
    this.starters.forEach((o, k) => o.sp.setScale(o.scale * (k === i ? 1.16 : 1)).setAlpha(k === i ? 1 : 0.8));
    // 머리 위치는 투명여백 포함 getBounds가 아니라 실측 발선/내용높이로 계산
    const cx = this.fx(MON_TX[i]);
    const headY = this.tableTopY - this.starterTargetH * 1.16;
    // 이름/타입 태그(살펴보는 포켓몬 머리 위)
    const font = Math.max(13, Math.round(this.tile * 0.42));
    this.tagType.setFontSize(font - 2); this.tagName.setFontSize(font);
    this.tagName.setText(s.name); this.tagType.setText(s.type);
    const badgeW = this.tagType.width + 16, pad = 10, boxH = font + 12;
    const totalW = badgeW + 8 + this.tagName.width + pad * 2;
    const tx = cx - totalW / 2, ty = headY - boxH - 14;
    const g = this.tagG; g.clear();
    g.fillStyle(0x000000, 0.4); g.fillRoundedRect(tx + 2, ty + 3, totalW, boxH, 8);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(tx, ty, totalW, boxH, 8);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(tx + 3, ty + 3, totalW - 6, boxH - 6, 6);
    g.fillStyle(gc, 1); g.fillRoundedRect(tx + pad, ty + 6, badgeW, font, 5);
    this.tagType.setPosition(tx + pad + badgeW / 2, ty + 6 + font / 2);
    this.tagName.setPosition(tx + pad + badgeW + 8, ty + 6 + font / 2);
    this.selCur.setPosition(cx, headY - 6);
  }

  private endSelectVisuals(): void {
    this.input.keyboard!.off("keydown-LEFT", this.selLeft, this);
    this.input.keyboard!.off("keydown-RIGHT", this.selRight, this);
    this.selCur.setVisible(false); this.tagG.setVisible(false); this.tagType.setVisible(false); this.tagName.setVisible(false);
    this.starters.forEach((o) => o.sp.setScale(o.scale).setAlpha(1));
  }

  private async confirmSelected(): Promise<void> {
    const i = this.selIndex; const pick = STARTERS[i];
    this.selecting = false; this.busy = true; this.endSelectVisuals(); this.hint.setVisible(false);
    await this.dlg.say(`${pick.name}! ${pick.type}타입 포켓몬이다.`, "오박사");
    const yes = await this.dlg.askYesNo();
    if (!yes) { this.dlg.hide(); this.busy = false; this.beginSelect(); return; }   // 다시 살펴보기
    const mon: Pokemon = createPokemon(pick.name, pick.type); mon.id = pick.id;
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    party.push(mon); this.registry.set("playerParty", party); this.registry.set("starterChosen", pick.key);
    this.chosen = true;
    // 고른 포켓몬은 플레이어에게, 나머지 둘은 탁자에 남김
    this.starters.forEach((o, k) => { if (k !== i) return; this.tweens.add({ targets: o.sp, alpha: 0, duration: 250, onComplete: () => o.sp.setVisible(false) }); });
    await this.dlg.say(`${pick.name}(와)과 함께 좋은 여행이 되길 바란다!`, "오박사");
    await this.dlg.say(`좋았어! ${this.playerName()}, 나중에 꼭 나랑 배틀하자! 약속이야!`, "네모");
    this.dlg.hide();
    this.hint.setText("아래 문으로 나가 마을로!").setVisible(true);
    this.busy = false;
  }

  private async runIntro(): Promise<void> {
    this.busy = true;
    const name = this.playerName();
    await this.wait(450);
    await this.dlg.say(`오, ${name}! 잘 왔다.`, "오박사");
    await this.dlg.say("탁자 위 세 마리가 네 첫 파트너 후보란다.", "오박사");
    await this.dlg.say(`${name}! 나도 완전 두근두근해! 잘 골라봐!`, "네모");
    await this.dlg.say("마음에 드는 녀석에게 다가가서 살펴보렴.", "오박사");
    this.dlg.hide();
    this.hint.setText("방향키: 이동  |  탁자 앞에서 Space: 살펴보기  |  아래 문: 나가기").setVisible(true);
    this.busy = false;
  }

  private tryExit(): void {
    if (!this.chosen) {
      this.busy = true;
      this.dlg.say("아직 파트너를 안 골랐잖니! 탁자 앞에서 골라보렴.", "오박사").then(() => { this.dlg.hide(); this.busy = false; });
      return;
    }
    this.busy = true; this.player.stop();
    this.sound.play("sfx_door", { volume: 0.5 });
    this.cameras.main.fadeOut(340, 0, 0, 0);
    const [tx, ty] = this.map.exit.toTown;
    this.time.delayedCall(360, () => this.scene.start("WorldScene", { spawn: [tx, ty], face: "down" }));
  }

  private wait(ms: number): Promise<void> { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
