import Phaser from "phaser";
import { playSfx, SFX } from "../game/sfx";

// 공용 HGSS 감성 대화창 — 집(InteriorScene)/인트로/연구소가 같은 박스를 쓰도록 뽑아낸 컴포넌트.
//  스타일 기준: 크림 테두리(0xf6efd8) + 남색 본문(0x21314f) + 파란 내부선, 타자기 출력, 이름창, 예/아니오.
//  사용법:
//    const dlg = new DialogBox(scene);
//    await dlg.say("안녕", "오박사");
//    const yes = await dlg.askYesNo();
//  화면 리사이즈 시 dlg.layout() 호출.
export default class DialogBox {
  private readonly FONT = "Galmuri11";
  private boxG: Phaser.GameObjects.Graphics;
  private namePlate: Phaser.GameObjects.Graphics;
  private boxText: Phaser.GameObjects.Text;
  private nameTag: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private rect = { x: 0, y: 0, w: 0, h: 0, pad: 0, font: 18 };
  private speaker: string | null = null;

  constructor(private scene: Phaser.Scene) {
    this.boxG = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.namePlate = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    this.boxText = scene.add.text(0, 0, "", { fontFamily: this.FONT, fontSize: "18px", color: "#ffffff", lineSpacing: 8 })
      .setOrigin(0, 0).setScrollFactor(0).setDepth(1001);
    this.nameTag = scene.add.text(0, 0, "", { fontFamily: this.FONT, fontSize: "18px", color: "#ffe27a" })
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);
    this.arrow = scene.add.text(0, 0, "▼", { fontFamily: this.FONT, fontSize: "18px", color: "#ffffff" })
      .setOrigin(1, 1).setScrollFactor(0).setDepth(1002).setVisible(false);
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.setVisible(false);
    this.layout();
  }

  get visible(): boolean { return this.boxG.visible; }

  layout(): void {
    const { width, height } = this.scene.scale;
    const w = Math.min(width * 0.92, 1100);
    const h = Math.max(height * 0.22, 130);
    const x = (width - w) / 2;
    const y = height - h - Math.max(height * 0.04, 18);
    const pad = Math.round(h * 0.18);
    const font = Math.max(18, Math.round(h * 0.17));
    this.rect = { x, y, w, h, pad, font };
    this.drawBox();
    this.boxText.setPosition(x + pad, y + pad).setFontSize(font).setWordWrapWidth(w - pad * 2);
    this.nameTag.setFontSize(font);
    this.arrow.setPosition(x + w - pad, y + h - pad * 0.4).setFontSize(font);
    this.applySpeaker();
  }

  private drawBox(): void {
    const { x, y, w, h } = this.rect;
    const g = this.boxG;
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 4, y + 6, w, h, 18);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(x, y, w, h, 18);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 14);
    g.lineStyle(2, 0x4a6aa5, 0.8); g.strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, 11);
  }

  private applySpeaker(): void {
    const show = this.boxG.visible && !!this.speaker;
    if (!show) { this.namePlate.clear().setVisible(false); this.nameTag.setVisible(false); return; }
    const { x, y, font } = this.rect;
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

  private setVisible(v: boolean): void {
    this.boxG.setVisible(v);
    this.boxText.setVisible(v);
    if (v) this.applySpeaker();
    else { this.namePlate.setVisible(false); this.nameTag.setVisible(false); this.arrow.setVisible(false); }
  }

  hide(): void { this.setVisible(false); }

  // 대사 출력(타자기). speaker=null이면 나레이션(이름창 없음).
  say(text: string, speaker: string | null = null): Promise<void> {
    this.setVisible(true);
    this.speaker = speaker; this.applySpeaker();
    return new Promise((resolve) => {
      const kb = this.scene.input.keyboard!;
      this.arrow.setVisible(false);
      this.boxText.setText("");
      let i = 0; let typing = true;
      const cleanup = () => {
        kb.off("keydown-SPACE", onAdvance); kb.off("keydown-ENTER", onAdvance); kb.off("keydown-Z", onAdvance);
        this.scene.input.off("pointerdown", onAdvance);
      };
      const finishTyping = () => { timer.remove(); this.boxText.setText(text); typing = false; this.arrow.setVisible(true); };
      const timer = this.scene.time.addEvent({
        delay: 38, loop: true, callback: () => { i++; this.boxText.setText(text.slice(0, i)); if (i >= text.length) finishTyping(); },
      });
      const onAdvance = () => { if (typing) finishTyping(); else { playSfx(this.scene, SFX.decision, 0.4); cleanup(); resolve(); } };
      kb.on("keydown-SPACE", onAdvance); kb.on("keydown-ENTER", onAdvance); kb.on("keydown-Z", onAdvance);
      this.scene.input.on("pointerdown", onAdvance);
    });
  }

  // 예/아니오 선택 — 대화박스 위 오른쪽 작은 메뉴. ↑↓ + Enter/Z.
  askYesNo(): Promise<boolean> {
    const font = this.rect.font;
    const rowH = Math.round(font * 1.9);
    const boxW = Math.max(Math.round(font * 5), 140);
    const boxH = rowH * 2 + Math.round(font * 0.8);
    const bx = this.rect.x + this.rect.w - boxW;
    const by = this.rect.y - boxH - 12;
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(1003);
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(bx + 3, by + 5, boxW, boxH, 12);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(bx, by, boxW, boxH, 12);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(bx + 5, by + 5, boxW - 10, boxH - 10, 8);
    const opts = ["예", "아니오"];
    const labelX = bx + Math.round(font * 1.6);
    const rows = opts.map((t, i) =>
      this.scene.add.text(labelX, by + Math.round(font * 0.6) + i * rowH, t, { fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffffff" })
        .setOrigin(0, 0).setScrollFactor(0).setDepth(1004));
    const cursor = this.scene.add.text(0, 0, "▶", { fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffe27a" })
      .setOrigin(0, 0).setScrollFactor(0).setDepth(1004);
    let idx = 0;
    const place = () => cursor.setPosition(bx + Math.round(font * 0.5), rows[idx].y);
    place();
    return new Promise((resolve) => {
      const kb = this.scene.input.keyboard!;
      const move = (d: number) => { idx = (idx + d + opts.length) % opts.length; place(); playSfx(this.scene, SFX.cursor, 0.4); };
      const up = () => move(-1); const down = () => move(1);
      const confirm = () => {
        playSfx(this.scene, SFX.decision, 0.4);
        kb.off("keydown-UP", up); kb.off("keydown-DOWN", down);
        kb.off("keydown-ENTER", confirm); kb.off("keydown-Z", confirm); kb.off("keydown-SPACE", confirm);
        g.destroy(); rows.forEach((r) => r.destroy()); cursor.destroy();
        resolve(idx === 0);
      };
      kb.on("keydown-UP", up); kb.on("keydown-DOWN", down);
      kb.on("keydown-ENTER", confirm); kb.on("keydown-Z", confirm); kb.on("keydown-SPACE", confirm);
    });
  }

  destroy(): void {
    this.boxG.destroy(); this.namePlate.destroy(); this.boxText.destroy(); this.nameTag.destroy(); this.arrow.destroy();
  }
}
