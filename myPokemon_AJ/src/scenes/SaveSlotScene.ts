import Phaser from "phaser";
import { playSfx, playMe, preloadCommonAudio, SFX } from "../game/sfx";
import {
  SlotInfo, SlotId, listSlots, loadGame, saveGame, lastSlot, playTimeText, slotLabel,
} from "../systems/save";
import { josa } from "../data/josa";
import { bindActions } from "../systems/input";

// 세이브 슬롯 화면 — 이어하기(불러오기)와 인게임 저장이 같은 화면을 쓴다.
//
// 왜 이 화면이 생겼나:
//   원본(Another Red)은 `Auto Multi Save` 플러그인으로 **자동 3칸 + 수동 8칸**을 쓴다.
//   우리는 localStorage 키 하나뿐이라 "이어하기 = 무조건 마지막 저장 하나"였다 → 원본과 맞췄다.
//
// 원본 로드 화면(UI_Load.rb)이 슬롯마다 보여주는 것: **이름 · 배지 수 · 플레이 시간**.
//   우리도 같은 세 가지 + 저장한 날짜를 적는다.
//
// 조작: ↑↓ 이동 · Enter 선택 · ESC 취소 (마우스 클릭도 됨)

export interface SaveSlotInit {
  mode: "load" | "save";
  /** 저장 모드에서 끝난 뒤 돌아갈 씬(멈춰 둔 씬을 다시 깨운다). */
  from?: string;
}

const ROW_H = 46;          // 한 줄 높이(기준 720p, 화면 크기에 맞춰 조정)
const PANEL_PAD = 14;

export default class SaveSlotScene extends Phaser.Scene {
  private readonly FONT = '"Galmuri11", sans-serif';
  private mode: "load" | "save" = "load";
  private from = "WorldScene";
  private slots: SlotInfo[] = [];
  private idx = 0;
  private rows: { bg: Phaser.GameObjects.Rectangle; title: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  private hint?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private busy = false;

  constructor() { super("SaveSlotScene"); }

  init(data: SaveSlotInit): void {
    // ⚠️ Phaser는 씬 인스턴스를 재사용한다 → 상태 필드는 반드시 여기서 되돌린다.
    this.mode = data?.mode ?? "load";
    this.from = data?.from ?? "WorldScene";
    this.busy = false;
    this.rows = [];
    this.slots = listSlots();
    // 커서 시작 위치: 마지막에 쓰던 슬롯(원본도 불러온 슬롯을 기본으로 잡아 준다).
    const last = lastSlot();
    const i = this.slots.findIndex(s => s.id === last);
    this.idx = i >= 0 ? i : 0;
    // 불러오기인데 비어 있는 칸에 커서가 있으면 첫 '내용 있는' 칸으로 옮긴다.
    if (this.mode === "load" && !this.slots[this.idx].data) {
      const j = this.slots.findIndex(s => !!s.data);
      if (j >= 0) this.idx = j;
    }
  }

  preload(): void {
    this.load.image("menu_dither", "assets/title/menu_dither.png");
    preloadCommonAudio(this);
  }

  create(): void {
    if (this.textures.exists("menu_dither"))
      this.textures.get("menu_dither").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, "menu_dither").setOrigin(0.5).setName("bg").setDepth(0);

    for (const s of this.slots) {
      const bg = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0.82).setOrigin(0, 0).setDepth(1)
        .setStrokeStyle(2, 0x2f7bf0).setInteractive({ useHandCursor: true });
      const title = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0, 0.5).setDepth(2);
      const sub = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#5b6b86" }).setOrigin(1, 0.5).setDepth(2);
      const i = this.rows.length;
      bg.on("pointerover", () => { this.idx = i; this.paint(); });
      bg.on("pointerdown", () => this.choose());
      this.rows.push({ bg, title, sub });
    }
    this.hint = this.add.text(0, 0, "", { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0.5, 0).setDepth(2);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    bindActions(this, { USE: () => this.choose(), BACK: () => this.cancel() });
  }

  private layout = (): void => {
    const { width, height } = this.scale;
    const bg = this.children.getByName("bg") as Phaser.GameObjects.Image | null;
    if (bg) {
      bg.setPosition(width / 2, height / 2);
      const t = this.textures.get("menu_dither").getSourceImage();
      bg.setScale(Math.max(width / t.width, height / t.height));
    }
    // 줄 높이는 화면에 11칸 + 안내문이 들어가게 맞춘다.
    const rowH = Math.min(ROW_H * (height / 720), (height * 0.86) / (this.slots.length + 1));
    const panelW = Math.min(width * 0.72, 720 * (height / 720));
    const left = (width - panelW) / 2;
    const top = height * 0.07;
    const fs = Math.max(12, Math.round(rowH * 0.36));

    this.rows.forEach((r, i) => {
      const y = top + i * rowH;
      r.bg.setPosition(left, y).setSize(panelW, rowH - 6);
      r.title.setPosition(left + PANEL_PAD, y + (rowH - 6) / 2).setFontSize(fs);
      r.sub.setPosition(left + panelW - PANEL_PAD, y + (rowH - 6) / 2).setFontSize(Math.round(fs * 0.86));
    });
    this.hint?.setPosition(width / 2, top + this.slots.length * rowH + 6).setFontSize(fs);
    this.paint();
  };

  /** 슬롯 한 칸에 적을 글 — 원본 로드화면과 같이 이름·배지·시간을 보여준다. */
  private describe(s: SlotInfo): string {
    if (!s.data) return this.mode === "save" ? "비어 있음 — 여기에 저장" : "비어 있음";
    const d = s.data;
    const when = new Date(d.savedAt);
    const date = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
    return `${d.name || "이름없음"}  ·  배지 ${(d.badges ?? []).length}개  ·  ${playTimeText(d.playSeconds ?? 0)}  ·  ${date}`;
  }

  private paint(): void {
    this.rows.forEach((r, i) => {
      const s = this.slots[i];
      const on = i === this.idx;
      const usable = this.mode === "save" || !!s.data;
      r.bg.setFillStyle(on ? 0xdfeaff : 0xffffff, usable ? 0.86 : 0.5);
      r.bg.setStrokeStyle(on ? 3 : 2, on ? 0x1c4fa8 : 0x9dbdf0);
      r.title.setText(`${s.auto ? "◆" : "▶"} ${s.label}`);
      r.title.setColor(usable ? (on ? "#12408f" : "#2f6fd0") : "#9aa7bd");
      r.sub.setText(this.describe(s));
      r.sub.setColor(usable ? "#5b6b86" : "#a8b3c6");
    });
    const s = this.slots[this.idx];
    this.hint?.setText(this.mode === "save"
      ? `Enter: ${slotLabel(s.id)}에 저장   ·   ESC: 취소`
      : `Enter: 불러오기   ·   ESC: 뒤로   (◆ 자동세이브는 이정표마다 자동으로 기록된다)`);
  }

  private move(d: number): void {
    if (this.busy) return;
    this.idx = (this.idx + d + this.slots.length) % this.slots.length;
    playSfx(this, SFX.cursor, 0.4);
    this.paint();
  }

  private cancel(): void {
    if (this.busy) return;
    playSfx(this, SFX.cancel, 0.4);
    if (this.mode === "save") { this.scene.stop(); this.scene.resume(this.from); }
    else this.scene.start("MainMenuScene");
  }

  private choose(): void {
    if (this.busy) return;
    const s = this.slots[this.idx];
    if (this.mode === "load") {
      if (!s.data) { playSfx(this, SFX.bump, 0.4); this.toast("비어 있는 칸이야"); return; }
      this.busy = true;
      playSfx(this, SFX.decision, 0.45);
      const data = loadGame(this.registry, s.id);
      if (!data) { this.busy = false; this.toast("불러오지 못했어"); return; }
      const loc = data.loc;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        // 저장의 tx/ty는 **그 맵 기준 로컬**이라 map을 같이 넘긴다(MainMenuScene과 같은 규칙).
        if (loc.scene === "InteriorScene") this.scene.start("InteriorScene", { room: loc.room ?? "living", skipIntro: true });
        else this.scene.start("WorldScene", { spawn: [loc.tx ?? 17, loc.ty ?? 8], map: loc.map ?? "pallet", face: loc.facing ?? "down" });
      });
      return;
    }
    // 저장 모드 — 내용이 있는 칸이면 한 번 더 물어본다(덮어쓰기는 되돌릴 수 없다).
    this.busy = true;
    playSfx(this, SFX.decision, 0.45);
    saveGame(this.registry, s.id as SlotId);
    playMe(this, SFX.save);
    const who = (this.registry.get("playerName") as string) || "플레이어";
    this.toast(`${who}${josa(who, "은는")} ${slotLabel(s.id)}에 게임을 저장했다!`);
    this.slots = listSlots();
    this.paint();
    this.time.delayedCall(1200, () => { this.scene.stop(); this.scene.resume(this.from); });
  }

  private toast(msg: string): void {
    const { width, height } = this.scale;
    this.toastText?.destroy();
    this.toastText = this.add.text(width / 2, height * 0.95, msg, {
      fontFamily: this.FONT, fontSize: `${Math.round(height * 0.03)}px`, color: "#ffffff",
      backgroundColor: "#1c3a6e", padding: { x: 14, y: 7 },
    }).setOrigin(0.5).setDepth(10);
    this.time.delayedCall(1400, () => { this.toastText?.destroy(); this.toastText = undefined; });
  }
}
