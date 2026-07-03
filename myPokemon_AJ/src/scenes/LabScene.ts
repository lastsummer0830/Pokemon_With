import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createPokemon, Pokemon } from "../data/Pokemon";
import { frontPath, makeAnimatedFront } from "../game/pokemonSprite";

// 포켓몬 연구소 — 오박사에게서 첫 포켓몬(스타팅)을 고르는 이벤트 씬.
//  흐름: 오박사 인사 → 네모 인사 → 스타팅 3마리 중 선택(←→ 이동, Z/Enter 결정) → 예/아니오 확인
//        → 파티에 추가(registry "playerParty") → 마무리 대사 → 마을(WorldScene)로 복귀.
//  에셋: 오박사 trainer_PROFESSOR, 네모 trainer_NEMONA(오버월드 시트 첫 프레임),
//        스타팅 Front 애니(SPRIGATITO/CHARMANDER/SOBBLE).

interface StarterDef { key: string; name: string; type: string; id: number; desc: string; }
const STARTERS: StarterDef[] = [
  { key: "SPRIGATITO", name: "냐오하", type: "풀",   id: 906, desc: "풀 고양이 포켓몬. 변덕스럽지만 영리하다." },
  { key: "CHARMANDER", name: "파이리", type: "불꽃", id: 4,   desc: "불꽃 도마뱀 포켓몬. 꼬리의 불꽃이 마음을 나타낸다." },
  { key: "SOBBLE",     name: "개구마르", type: "물",  id: 816, desc: "물 도마뱀 포켓몬. 겁이 많고 눈물이 많다." },
];

type Dir = "down" | "left" | "right" | "up";

export default class LabScene extends Phaser.Scene {
  private readonly FONT = "Galmuri11";
  // 대화창
  private boxG!: Phaser.GameObjects.Graphics;
  private boxText!: Phaser.GameObjects.Text;
  private namePlate!: Phaser.GameObjects.Graphics;
  private nameTag!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private boxRect = { x: 0, y: 0, w: 0, h: 0, pad: 0, font: 18 };

  private oak!: Phaser.GameObjects.Sprite;
  private nemona!: Phaser.GameObjects.Sprite;
  private busy = false;

  constructor() { super("LabScene"); }

  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  preload(): void {
    this.load.spritesheet("oak", "assets/characters/trainer_PROFESSOR.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
    this.load.audio("sfx_select", "assets/audio/door.ogg");
    for (const s of STARTERS) this.load.image(s.key, frontPath(s.key));
  }

  create(): void {
    for (const k of ["oak", "nemona_ow", ...STARTERS.map(s => s.key)]) {
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.cameras.main.setBackgroundColor("#e9e2cf"); // 연구소 밝은 바닥 느낌

    this.buildLab();
    this.buildDialogUi();
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.runIntro();
  }

  // 연구소 배경 소품(간단): 바닥 띠 + 오박사 + 네모 + 가운데 탁자
  private buildLab(): void {
    this.floor = this.add.rectangle(0, 0, 10, 10, 0xd8cba7).setOrigin(0, 0).setDepth(0);
    this.wall = this.add.rectangle(0, 0, 10, 10, 0xb9a77f).setOrigin(0, 0).setDepth(0);
    this.table = this.add.rectangle(0, 0, 10, 10, 0x7c5a3a).setOrigin(0.5, 0.5).setDepth(1);
    this.oak = this.add.sprite(0, 0, "oak", 0).setDepth(3);
    this.nemona = this.add.sprite(0, 0, "nemona_ow", 0).setDepth(3);
  }
  private floor!: Phaser.GameObjects.Rectangle;
  private wall!: Phaser.GameObjects.Rectangle;
  private table!: Phaser.GameObjects.Rectangle;

  private layout(): void {
    const { width: W, height: H } = this.scale;
    this.wall.setPosition(0, 0).setSize(W, H * 0.28);
    this.floor.setPosition(0, H * 0.28).setSize(W, H * 0.72);
    // 탁자(가운데)
    const tw = Math.min(W * 0.5, 520), th = H * 0.14;
    this.table.setPosition(W / 2, H * 0.5).setSize(tw, th);
    // 오박사(탁자 뒤 위쪽), 네모(오른쪽)
    const sc = Math.max(2, Math.round((H / 480) * 2.4));
    this.oak.setScale(sc).setPosition(W / 2, H * 0.30);
    this.nemona.setScale(sc).setPosition(W * 0.72, H * 0.34);
    this.layoutStarters();
    this.layoutDialog();
  }

  // ─────────────────── 인트로 → 선택 → 마무리 ───────────────────
  private async runIntro(): Promise<void> {
    this.busy = true;
    const name = this.playerName();
    await this.wait(500);
    await this.say(`오, ${name}! 잘 왔다.`, "오박사");
    await this.say("오늘은 네가 인생의 파트너가 될 첫 포켓몬을 정하는 날이지.", "오박사");
    await this.say(`${name}! 나도 완전 두근두근해! 잘 골라봐!`, "네모");
    await this.say("자, 이 세 마리 중에서 마음에 드는 녀석을 골라보렴.", "오박사");

    const idx = await this.chooseStarter();
    const pick = STARTERS[idx];
    await this.say(`${pick.name}… ${pick.desc}`, "오박사");
    const yes = await this.askYesNo(`${pick.name}(으)로 정하겠니?`);
    if (!yes) { await this.say("천천히 골라도 괜찮단다.", "오박사"); this.busy = false; return this.runIntro2(); }

    // 파티에 추가
    const mon: Pokemon = createPokemon(pick.name, pick.type);
    mon.id = pick.id;
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    party.push(mon);
    this.registry.set("playerParty", party);
    this.registry.set("starterChosen", pick.key);

    await this.say(`좋은 선택이야! ${pick.name}을(를) 잘 부탁한다.`, "오박사");
    await this.say(`좋았어! ${name}, 나중에 꼭 나랑 배틀하자! 약속이야!`, "네모");
    await this.say("마을로 나가서 모험을 시작해 보렴!", "오박사");

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.start("WorldScene", { spawn: [28, 15], face: "down" }));
  }
  // 다시 고르기(아니오 선택 시)
  private async runIntro2(): Promise<void> {
    const idx = await this.chooseStarter();
    const pick = STARTERS[idx];
    const yes = await this.askYesNo(`${pick.name}(으)로 정하겠니?`);
    if (!yes) return this.runIntro2();
    const mon: Pokemon = createPokemon(pick.name, pick.type); mon.id = pick.id;
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    party.push(mon); this.registry.set("playerParty", party); this.registry.set("starterChosen", pick.key);
    await this.say(`좋은 선택이야! ${pick.name}을(를) 잘 부탁한다.`, "오박사");
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.start("WorldScene", { spawn: [28, 15], face: "down" }));
  }

  // ─────────────────── 스타팅 선택 UI ───────────────────
  private starterSprites: Phaser.GameObjects.Sprite[] = [];
  private cursorG!: Phaser.GameObjects.Graphics;
  private starterLabel!: Phaser.GameObjects.Text;
  private selIndex = 0;

  private chooseStarter(): Promise<number> {
    return new Promise((resolve) => {
      this.selIndex = 0;
      this.hideDialog();
      // 3마리 애니 스프라이트 생성
      this.starterSprites = STARTERS.map((s) => makeAnimatedFront(this, s.key, 0, 0, 1).setDepth(5));
      this.cursorG = this.add.graphics().setDepth(4);
      this.starterLabel = this.add.text(0, 0, "", {
        fontFamily: this.FONT, fontSize: "20px", color: "#20304a", align: "center",
        backgroundColor: "#ffffffcc", padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(6);
      this.layoutStarters();
      this.drawCursor();

      const kb = this.input.keyboard!;
      const move = (d: number) => { this.selIndex = (this.selIndex + d + STARTERS.length) % STARTERS.length; this.drawCursor(); };
      const onLeft = () => move(-1);
      const onRight = () => move(1);
      const onPick = () => {
        kb.off("keydown-LEFT", onLeft); kb.off("keydown-RIGHT", onRight);
        kb.off("keydown-Z", onPick); kb.off("keydown-ENTER", onPick); kb.off("keydown-SPACE", onPick);
        this.sound.play("sfx_select", { volume: 0.5 });
        const idx = this.selIndex;
        this.starterSprites.forEach(s => s.destroy()); this.starterSprites = [];
        this.cursorG.destroy(); this.starterLabel.destroy();
        resolve(idx);
      };
      kb.on("keydown-LEFT", onLeft); kb.on("keydown-RIGHT", onRight);
      kb.on("keydown-Z", onPick); kb.on("keydown-ENTER", onPick); kb.on("keydown-SPACE", onPick);
    });
  }

  private layoutStarters(): void {
    if (!this.starterSprites.length) return;
    const { width: W, height: H } = this.scale;
    const y = H * 0.5;
    const gap = Math.min(W * 0.26, 300);
    const sc = Math.max(1.4, (H / 480) * 1.8);
    this.starterSprites.forEach((sp, i) => { sp.setScale(sc); sp.setPosition(W / 2 + (i - 1) * gap, y); });
    if (this.starterLabel) this.starterLabel.setPosition(W / 2, H * 0.7);
  }

  private drawCursor(): void {
    if (!this.starterSprites.length) return;
    const g = this.cursorG; g.clear();
    const sp = this.starterSprites[this.selIndex];
    const r = sp.getBounds();
    g.lineStyle(4, 0xffcc22, 1).strokeRoundedRect(r.x - 10, r.y - 10, r.width + 20, r.height + 20, 12);
    const s = STARTERS[this.selIndex];
    this.starterLabel.setText(`◀  ${s.name}  (${s.type})  ▶`);
  }

  // ─────────────────── 대화창(HGSS 감성) ───────────────────
  private buildDialogUi(): void {
    this.boxG = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.namePlate = this.add.graphics().setDepth(21).setScrollFactor(0);
    this.boxText = this.add.text(0, 0, "", { fontFamily: this.FONT, fontSize: "18px", color: "#20304a", wordWrap: { width: 10 } }).setDepth(22).setScrollFactor(0);
    this.nameTag = this.add.text(0, 0, "", { fontFamily: this.FONT, fontSize: "16px", color: "#ffffff" }).setDepth(22).setScrollFactor(0);
    this.arrow = this.add.text(0, 0, "▼", { fontFamily: this.FONT, fontSize: "18px", color: "#20304a" }).setDepth(22).setScrollFactor(0);
    this.hideDialog();
  }
  private hideDialog(): void {
    this.boxG.setVisible(false); this.namePlate.setVisible(false);
    this.boxText.setVisible(false); this.nameTag.setVisible(false); this.arrow.setVisible(false);
  }
  private layoutDialog(): void {
    const { width: W, height: H } = this.scale;
    const pad = Math.round(H * 0.02);
    const bw = W * 0.92, bh = Math.max(96, H * 0.20);
    const bx = (W - bw) / 2, by = H - bh - pad;
    this.boxRect = { x: bx, y: by, w: bw, h: bh, pad, font: Math.max(16, Math.round(H * 0.032)) };
    this.boxText.setFontSize(this.boxRect.font).setWordWrapWidth(bw - pad * 3);
    this.redrawBox();
  }
  private redrawBox(): void {
    const { x, y, w, h, pad } = this.boxRect;
    const g = this.boxG; g.clear();
    g.fillStyle(0x1a2740, 0.96).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(4, 0xffffff, 0.95).strokeRoundedRect(x, y, w, h, 14);
    g.fillStyle(0xf7f4ea, 1).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 10);
    this.boxText.setPosition(x + pad * 1.5, y + pad * 1.6);
    this.arrow.setPosition(x + w - pad * 2, y + h - pad * 1.6);
  }
  private applySpeaker(name: string | null): void {
    if (!name) { this.namePlate.setVisible(false); this.nameTag.setVisible(false); return; }
    const { x, y, font } = this.boxRect;
    this.nameTag.setText(name).setFontSize(font - 2).setPosition(x + 20, y - font - 6);
    const tw = this.nameTag.width, th = this.nameTag.height;
    const g = this.namePlate; g.clear();
    g.fillStyle(0x2a3550, 1).fillRoundedRect(x + 12, y - th - 12, tw + 16, th + 12, 8);
    g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(x + 12, y - th - 12, tw + 16, th + 12, 8);
    this.nameTag.setPosition(x + 20, y - th - 6);
    this.namePlate.setVisible(true); this.nameTag.setVisible(true);
  }

  private say(text: string, speaker: string | null = null): Promise<void> {
    return new Promise((resolve) => {
      this.boxG.setVisible(true); this.boxText.setVisible(true); this.arrow.setVisible(true);
      this.applySpeaker(speaker);
      this.boxText.setText(text);
      this.tweens.add({ targets: this.arrow, y: this.arrow.y + 5, duration: 500, yoyo: true, repeat: -1 });
      const kb = this.input.keyboard!;
      const done = () => {
        kb.off("keydown-Z", done); kb.off("keydown-ENTER", done); kb.off("keydown-SPACE", done);
        this.tweens.killTweensOf(this.arrow);
        resolve();
      };
      kb.once("keydown-Z", done); kb.once("keydown-ENTER", done); kb.once("keydown-SPACE", done);
    });
  }

  private askYesNo(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.boxG.setVisible(true); this.boxText.setVisible(true); this.applySpeaker(null);
      this.arrow.setVisible(false);
      let sel = 0; // 0=예, 1=아니오
      const { x, y, w, h } = this.boxRect;
      const menu = this.add.graphics().setDepth(23).setScrollFactor(0);
      const yes = this.add.text(0, 0, "예", { fontFamily: this.FONT, fontSize: `${this.boxRect.font}px`, color: "#20304a" }).setDepth(24);
      const no = this.add.text(0, 0, "아니오", { fontFamily: this.FONT, fontSize: `${this.boxRect.font}px`, color: "#20304a" }).setDepth(24);
      const mx = x + w - 150, my = y - 96;
      const draw = () => {
        menu.clear();
        menu.fillStyle(0xf7f4ea, 1).fillRoundedRect(mx, my, 130, 84, 10);
        menu.lineStyle(4, 0x1a2740, 1).strokeRoundedRect(mx, my, 130, 84, 10);
        yes.setPosition(mx + 40, my + 12); no.setPosition(mx + 40, my + 44);
        menu.fillStyle(0xffcc22, 1).fillTriangle(mx + 16, my + 20 + sel * 32, mx + 28, my + 26 + sel * 32, mx + 16, my + 32 + sel * 32);
      };
      this.boxText.setText(question);
      draw();
      const kb = this.input.keyboard!;
      const mv = (d: number) => { sel = (sel + d + 2) % 2; draw(); };
      const up = () => mv(-1), dn = () => mv(1);
      const pick = () => {
        kb.off("keydown-UP", up); kb.off("keydown-DOWN", dn);
        kb.off("keydown-Z", pick); kb.off("keydown-ENTER", pick); kb.off("keydown-SPACE", pick);
        menu.destroy(); yes.destroy(); no.destroy();
        resolve(sel === 0);
      };
      kb.on("keydown-UP", up); kb.on("keydown-DOWN", dn);
      kb.on("keydown-Z", pick); kb.on("keydown-ENTER", pick); kb.on("keydown-SPACE", pick);
    });
  }

  private wait(ms: number): Promise<void> { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
