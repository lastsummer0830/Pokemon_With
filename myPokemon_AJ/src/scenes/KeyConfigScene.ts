import Phaser from "phaser";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";
import {
  Action, ACTIONS, ACTION_LABEL, ACTION_DESC, PresetName, PRESET_LABEL,
  keysLabel, keyLabel, isBindable, rebind, resetKeys, usePreset, matchedPreset, bindActions,
} from "../systems/input";

// 키 설정 화면 — 원본(Another Red)의 **F1 커스터마이즈**에 해당한다.
//  원본은 mkxp 엔진이 띄우는 창이라 그림을 가져올 수 없어, 우리 옵션 화면과 같은 모양으로 만들었다.
//  (원본 기본 배치와 근거는 systems/input.ts 머리말 참고 — 물리 Z는 '가방'이 아니라 '메뉴 열기'다.)
//
// 조작: ↑↓ 항목 · ←→ 프리셋 전환(맨 윗줄) · 확인키 = 그 액션의 키 다시 잡기 · R 기본값 · 취소키 닫기
//   키를 다시 잡는 중엔 아무 키나 누르면 그 키가 들어간다(ESC = 취소).

const PRESET_ORDER: PresetName[] = ["original", "legacy"];

export interface KeyConfigInit {
  /** 돌아갈 씬(멈춰 둔 씬을 다시 깨운다). 없으면 옵션 화면으로. */
  from?: string;
}

export default class KeyConfigScene extends Phaser.Scene {
  private readonly FONT = '"Galmuri11", sans-serif';
  private from: string | null = null;
  private idx = 0;                       // 0 = 프리셋 줄, 1~ = 액션 줄
  private capturing: Action | null = null;
  private rows: { bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; val: Phaser.GameObjects.Text }[] = [];
  private desc?: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;
  private note?: Phaser.GameObjects.Text;

  constructor() { super("KeyConfigScene"); }

  init(data: KeyConfigInit): void {
    // ⚠️ Phaser는 씬 인스턴스를 재사용한다 → 상태를 여기서 되돌린다(안 하면 지난번 '키 잡는 중'이 남는다).
    this.from = data?.from ?? null;
    this.idx = 0;
    this.capturing = null;
    this.rows = [];
  }

  preload(): void {
    this.load.image("menu_dither", "assets/title/menu_dither.png");
    preloadCommonAudio(this);
  }

  /** 화면 줄 = 프리셋 1줄 + 액션 5줄. */
  private get lines(): number { return 1 + ACTIONS.length; }

  create(): void {
    if (this.textures.exists("menu_dither"))
      this.textures.get("menu_dither").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, "menu_dither").setOrigin(0.5).setName("bg").setDepth(0);

    this.add.text(0, 0, "키 설정", { fontFamily: this.FONT, color: "#12408f" })
      .setOrigin(0.5, 0).setDepth(2).setName("title");

    for (let i = 0; i < this.lines; i++) {
      const bg = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0.86).setOrigin(0, 0).setDepth(1)
        .setStrokeStyle(2, 0x2f7bf0).setInteractive({ useHandCursor: true });
      const label = i === 0 ? "배치 고르기" : ACTION_LABEL[ACTIONS[i - 1]];
      const name = this.add.text(0, 0, label, { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0, 0.5).setDepth(2);
      const val = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#12408f" }).setOrigin(1, 0.5).setDepth(2);
      bg.on("pointerover", () => { if (!this.capturing) { this.idx = i; this.paint(); } });
      bg.on("pointerdown", () => { if (!this.capturing) { this.idx = i; this.confirm(); } });
      this.rows.push({ bg, name, val });
    }
    this.desc = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#3c5580" }).setOrigin(0.5, 0).setDepth(2);
    this.hint = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0.5, 0).setDepth(2);
    // 원본 실측을 화면에도 적어 둔다 — "왜 Z가 메뉴지?"를 그 자리에서 알 수 있게.
    this.note = this.add.text(0, 0, "원본 기본: 확인 C · 취소 X · 메뉴 Z · 스페셜 D · 배속 Q",
      { fontFamily: this.FONT, color: "#7a8db0" }).setOrigin(0.5, 0).setDepth(2);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-LEFT", () => this.bumpPreset(-1));
    kb.on("keydown-RIGHT", () => this.bumpPreset(1));
    kb.on("keydown-R", () => this.resetAll());
    bindActions(this, { USE: () => this.confirm(), BACK: () => this.close() });
  }

  private layout = (): void => {
    const { width, height } = this.scale;
    const bg = this.children.getByName("bg") as Phaser.GameObjects.Image | null;
    if (bg) {
      bg.setPosition(width / 2, height / 2);
      const t = this.textures.get("menu_dither").getSourceImage();
      bg.setScale(Math.max(width / t.width, height / t.height));
    }
    const rowH = Math.min(58 * (height / 720), (height * 0.60) / this.lines);
    const panelW = Math.min(width * 0.66, 640 * (height / 720));
    const left = (width - panelW) / 2;
    const top = height * 0.17;
    const fs = Math.max(13, Math.round(rowH * 0.34));

    const title = this.children.getByName("title") as Phaser.GameObjects.Text | null;
    title?.setPosition(width / 2, height * 0.07).setFontSize(Math.round(fs * 1.4));

    this.rows.forEach((r, i) => {
      const y = top + i * rowH;
      r.bg.setPosition(left, y).setSize(panelW, rowH - 8);
      r.name.setPosition(left + 16, y + (rowH - 8) / 2).setFontSize(fs);
      r.val.setPosition(left + panelW - 16, y + (rowH - 8) / 2).setFontSize(fs);
    });
    const below = top + this.lines * rowH + 10;
    this.desc?.setPosition(width / 2, below).setFontSize(Math.round(fs * 0.92));
    this.hint?.setPosition(width / 2, below + fs * 2).setFontSize(Math.round(fs * 0.86));
    this.note?.setPosition(width / 2, below + fs * 3.6).setFontSize(Math.round(fs * 0.8));
    this.paint();
  };

  private presetText(): string {
    const p = matchedPreset();
    return p ? PRESET_LABEL[p] : "사용자 지정";
  }

  private paint(): void {
    this.rows.forEach((r, i) => {
      const on = i === this.idx;
      r.bg.setFillStyle(on ? 0xdfeaff : 0xffffff, 0.86);
      r.bg.setStrokeStyle(on ? 3 : 2, on ? 0x1c4fa8 : 0x9dbdf0);
      r.name.setColor(on ? "#12408f" : "#2f6fd0");
      if (i === 0) { r.val.setText(this.presetText()).setColor("#12408f"); return; }
      const act = ACTIONS[i - 1];
      const capturing = this.capturing === act;
      r.val.setText(capturing ? "새 키를 누르세요…" : keysLabel(act)).setColor(capturing ? "#c02020" : "#12408f");
    });
    this.desc?.setText(
      this.capturing ? "누른 키가 그 자리에 들어간다. (ESC = 그만두기)"
        : this.idx === 0 ? "원본식 = 원본 그대로 · 기존식 = 0802까지 쓰던 배치. ←→로 바꾼다."
          : ACTION_DESC[ACTIONS[this.idx - 1]]);
    this.hint?.setText(this.capturing ? "" : "↑↓ 항목  ·  확인키로 다시 잡기  ·  R 기본값  ·  취소키 닫기");
  }

  private move(d: number): void {
    if (this.capturing) return;
    this.idx = (this.idx + d + this.lines) % this.lines;
    playSfx(this, SFX.cursor, 0.4);
    this.paint();
  }

  /** 맨 윗줄에서 ←→ = 프리셋 통째로 갈아끼우기. */
  private bumpPreset(d: number): void {
    if (this.capturing || this.idx !== 0) return;
    const cur = matchedPreset();
    const at = cur ? PRESET_ORDER.indexOf(cur) : -1;
    // '사용자 지정' 상태에서 누르면 방향에 따라 첫/마지막 프리셋으로 들어간다.
    const next = at < 0 ? (d > 0 ? 0 : PRESET_ORDER.length - 1) : (at + d + PRESET_ORDER.length) % PRESET_ORDER.length;
    usePreset(PRESET_ORDER[next]);
    playSfx(this, SFX.decision, 0.5);
    this.paint();
  }

  private confirm(): void {
    if (this.capturing) return;
    if (this.idx === 0) { this.bumpPreset(1); return; }
    // 키 다시 잡기 시작.
    this.capturing = ACTIONS[this.idx - 1];
    playSfx(this, SFX.decision, 0.5);
    this.paint();
    // ⚠️ 지금 이 키(확인키)의 keydown이 그대로 '새 키'로 잡히지 않게 한 프레임 뒤에 귀를 연다.
    this.time.delayedCall(1, () => {
      if (!this.capturing) return;
      this.input.keyboard!.once("keydown", this.onCapture, this);
    });
  }

  private onCapture(event: KeyboardEvent): void {
    const act = this.capturing;
    if (!act) return;
    event.preventDefault();
    this.capturing = null;
    if (event.code === "Escape") { playSfx(this, SFX.cancel, 0.4); this.paint(); return; }   // 그만두기
    if (!isBindable(event.code)) {
      // 방향키·F키처럼 못 쓰는 키. 이유를 알려주고 그대로 둔다.
      playSfx(this, SFX.cancel, 0.4);
      this.paint();
      this.desc?.setText(`${keyLabel(event.code)} 키는 쓸 수 없다(방향키·F1~F12는 고정).`);
      return;
    }
    const ok = rebind(act, event.code);
    playSfx(this, ok ? SFX.decision : SFX.cancel, 0.5);
    this.paint();
    if (!ok) this.desc?.setText(`${keyLabel(event.code)} 키는 다른 조작의 마지막 키라 뺏을 수 없다.`);
  }

  private resetAll(): void {
    if (this.capturing) return;
    resetKeys();
    playSfx(this, SFX.cancel, 0.5);
    this.paint();
  }

  private close(): void {
    if (this.capturing) return;
    playSfx(this, SFX.cancel, 0.4);
    if (this.from) { this.scene.stop(); this.scene.resume(this.from); }
    else this.scene.start("OptionsScene");
  }
}
