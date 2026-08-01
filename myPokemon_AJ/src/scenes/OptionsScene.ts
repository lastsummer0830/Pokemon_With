import Phaser from "phaser";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";
import {
  Settings, settings, setSetting, DEFAULTS,
  TEXT_SPEED_LABEL, BATTLE_STYLE_LABEL, MOVE_STYLE_LABEL,
} from "../systems/settings";
import { bindActions, keysLabel } from "../systems/input";

// 옵션 화면 — 타이틀의 '옵션'과 인게임 메뉴의 '설정'이 같은 화면을 쓴다.
//
// 항목은 원본(Another Red) `UI_Options.rb`에서 **우리 게임에 실제로 붙일 데가 있는 것만** 가져왔다.
//   음악 볼륨 / 효과음 볼륨 / 텍스트 속도 / 배틀 이펙트 / 배틀 스타일 / 기본 이동
// (원본의 박스 자동전송·별명 주기·창 스킨을 왜 뺐는지는 systems/settings.ts 머리말 참고.)
//
// 조작: ↑↓ 항목 이동 · ←→ 값 바꾸기 · Enter도 값 넘기기 · ESC 닫기
//   원본 옵션 화면도 좌우로 값을 넘긴다.

export interface OptionsInit {
  /** 인게임에서 열었으면 돌아갈 씬(멈춰 둔 씬을 다시 깨운다). 없으면 타이틀로 돌아간다. */
  from?: string;
}

type Row =
  | { key: "musicVolume" | "seVolume"; label: string; kind: "range"; desc: string }
  | { key: "textSpeed" | "battleStyle" | "moveStyle"; label: string; kind: "choice"; values: string[]; desc: string }
  | { key: "battleEffects"; label: string; kind: "bool"; desc: string }
  | { key: "keys"; label: string; kind: "screen"; desc: string };

const ROWS: Row[] = [
  { key: "musicVolume", label: "음악 볼륨", kind: "range", desc: "배경 음악의 크기를 조절한다." },
  { key: "seVolume", label: "효과음 볼륨", kind: "range", desc: "효과음의 크기를 조절한다." },
  { key: "textSpeed", label: "텍스트 속도", kind: "choice", values: ["slow", "mid", "fast"], desc: "대사가 찍히는 속도를 고른다." },
  { key: "battleEffects", label: "배틀 이펙트", kind: "bool", desc: "배틀에서 기술 애니메이션을 볼지 고른다." },
  { key: "battleStyle", label: "배틀 스타일", kind: "choice", values: ["switch", "set"], desc: "상대가 쓰러졌을 때 포켓몬을 바꿀지 물어볼지 고른다." },
  { key: "moveStyle", label: "기본 이동", kind: "choice", values: ["walk", "run"], desc: "기본 이동 속도. 이동 중 취소키를 누르면 반대 속도가 된다." },
  // 원본은 이 자리에 없고 F1(엔진 창)으로 열지만, 우리는 옵션 안에도 넣는다(F1도 그대로 된다).
  { key: "keys", label: "키 설정", kind: "screen", desc: "확인·취소·메뉴·가방·배속 키를 바꾼다. (F1로도 열린다)" },
];

export default class OptionsScene extends Phaser.Scene {
  private readonly FONT = '"Galmuri11", sans-serif';
  private from: string | null = null;
  private idx = 0;
  private rows: { bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; val: Phaser.GameObjects.Text }[] = [];
  private desc?: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;

  constructor() { super("OptionsScene"); }

  init(data: OptionsInit): void {
    // ⚠️ Phaser는 씬 인스턴스를 재사용한다 → 상태를 여기서 되돌린다.
    this.from = data?.from ?? null;
    this.idx = 0;
    this.rows = [];
  }

  preload(): void {
    this.load.image("menu_dither", "assets/title/menu_dither.png");
    preloadCommonAudio(this);
  }

  create(): void {
    if (this.textures.exists("menu_dither"))
      this.textures.get("menu_dither").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, "menu_dither").setOrigin(0.5).setName("bg").setDepth(0);

    for (let i = 0; i < ROWS.length; i++) {
      const bg = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0.86).setOrigin(0, 0).setDepth(1)
        .setStrokeStyle(2, 0x2f7bf0).setInteractive({ useHandCursor: true });
      const name = this.add.text(0, 0, ROWS[i].label, { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0, 0.5).setDepth(2);
      const val = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#12408f" }).setOrigin(1, 0.5).setDepth(2);
      bg.on("pointerover", () => { this.idx = i; this.paint(); });
      bg.on("pointerdown", () => this.bump(1));
      this.rows.push({ bg, name, val });
    }
    this.desc = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#3c5580" }).setOrigin(0.5, 0).setDepth(2);
    this.hint = this.add.text(0, 0, "↑↓ 항목  ·  ←→ 값 바꾸기  ·  취소키 닫기  ·  R 기본값으로",
      { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0.5, 0).setDepth(2);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));
    // 키 설정 화면에서 돌아오면 '키 설정' 줄에 보이는 키 이름을 새로 그린다.
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.paint());

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-LEFT", () => this.bump(-1));
    kb.on("keydown-RIGHT", () => this.bump(1));
    kb.on("keydown-R", () => this.resetAll());
    bindActions(this, { USE: () => this.bump(1), BACK: () => this.close() });
  }

  private layout = (): void => {
    const { width, height } = this.scale;
    const bg = this.children.getByName("bg") as Phaser.GameObjects.Image | null;
    if (bg) {
      bg.setPosition(width / 2, height / 2);
      const t = this.textures.get("menu_dither").getSourceImage();
      bg.setScale(Math.max(width / t.width, height / t.height));
    }
    const rowH = Math.min(58 * (height / 720), (height * 0.62) / ROWS.length);
    const panelW = Math.min(width * 0.66, 640 * (height / 720));
    const left = (width - panelW) / 2;
    const top = height * 0.14;
    const fs = Math.max(13, Math.round(rowH * 0.34));

    this.rows.forEach((r, i) => {
      const y = top + i * rowH;
      r.bg.setPosition(left, y).setSize(panelW, rowH - 8);
      r.name.setPosition(left + 16, y + (rowH - 8) / 2).setFontSize(fs);
      r.val.setPosition(left + panelW - 16, y + (rowH - 8) / 2).setFontSize(fs);
    });
    this.desc?.setPosition(width / 2, top + ROWS.length * rowH + 10).setFontSize(Math.round(fs * 0.92));
    this.hint?.setPosition(width / 2, top + ROWS.length * rowH + 10 + fs * 2).setFontSize(Math.round(fs * 0.86));
    this.paint();
  };

  /** 지금 값의 표시 문자열. 볼륨은 원본처럼 눈금 막대로 보여준다. */
  private valueText(r: Row): string {
    const s: Settings = settings();
    if (r.kind === "screen") return `${keysLabel("USE")}  ▶`;   // 지금 확인키를 미리 보여준다
    if (r.kind === "range") {
      const v = s[r.key] as number;
      return `${"■".repeat(v)}${"□".repeat(10 - v)}  ${v * 10}%`;
    }
    if (r.kind === "bool") return s.battleEffects ? "켬" : "끔";
    if (r.key === "textSpeed") return TEXT_SPEED_LABEL[s.textSpeed];
    if (r.key === "battleStyle") return BATTLE_STYLE_LABEL[s.battleStyle];
    return MOVE_STYLE_LABEL[s.moveStyle];
  }

  private paint(): void {
    this.rows.forEach((r, i) => {
      const on = i === this.idx;
      r.bg.setFillStyle(on ? 0xdfeaff : 0xffffff, 0.86);
      r.bg.setStrokeStyle(on ? 3 : 2, on ? 0x1c4fa8 : 0x9dbdf0);
      r.name.setColor(on ? "#12408f" : "#2f6fd0");
      r.val.setText(this.valueText(ROWS[i]));
    });
    this.desc?.setText(ROWS[this.idx].desc);
  }

  private move(d: number): void {
    this.idx = (this.idx + d + ROWS.length) % ROWS.length;
    playSfx(this, SFX.cursor, 0.4);
    this.paint();
  }

  /** 지금 항목의 값을 d 방향으로 한 칸 옮긴다. */
  private bump(d: number): void {
    const r = ROWS[this.idx];
    const s = settings();
    if (r.kind === "screen") {
      // 키 설정은 값이 아니라 화면 — 이 화면을 멈추고 위에 띄운다(닫으면 여기로 돌아온다).
      playSfx(this, SFX.decision, 0.5);
      this.scene.pause();
      this.scene.launch("KeyConfigScene", { from: "OptionsScene" });
      return;
    }
    if (r.kind === "range") {
      const v = Phaser.Math.Clamp((s[r.key] as number) + d, 0, 10);
      setSetting(r.key, v);
    } else if (r.kind === "bool") {
      setSetting("battleEffects", !s.battleEffects);
    } else {
      const cur = s[r.key] as string;
      const i = r.values.indexOf(cur);
      const next = r.values[(i + d + r.values.length) % r.values.length];
      setSetting(r.key, next as never);
    }
    // 효과음 볼륨을 바꿀 땐 그 소리로 바로 들려준다(원본도 볼륨을 만지면 소리가 난다).
    playSfx(this, r.key === "musicVolume" ? SFX.cursor : SFX.decision, 0.5);
    this.paint();
  }

  private resetAll(): void {
    for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) setSetting(k, DEFAULTS[k] as never);
    playSfx(this, SFX.cancel, 0.5);
    this.paint();
  }

  private close(): void {
    playSfx(this, SFX.cancel, 0.4);
    if (this.from) { this.scene.stop(); this.scene.resume(this.from); }
    else this.scene.start("MainMenuScene");
  }
}
