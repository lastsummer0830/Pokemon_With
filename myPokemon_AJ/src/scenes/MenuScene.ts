import Phaser from "phaser";
import { Pokemon, MoveSlot, displayName } from "../data/Pokemon";
import { getMove } from "../data/ar";
import { iconPath, makePartyIcon } from "../game/pokemonSprite";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";

// 인게임 스타트 메뉴 (오버레이). 필드(WorldScene 등)에서 Enter/X로 연다.
//  상태: main(포켓몬/가방/저장/닫기) → party(파티 목록) → detail(한 마리 상세).
const FONT = "Galmuri11";

// UI 테마(사용자가 Pick에서 고른 뒤 registry 'uiTheme'로 고정). 기본 = navy(HGSS).
interface Theme { border: number; body: number; line: number; accent: string; text: string; sub: string }
const THEMES: Record<string, Theme> = {
  navy:  { border: 0xf6efd8, body: 0x21314f, line: 0x4a6aa5, accent: "#ffe27a", text: "#ffffff", sub: "#cfe0ff" }, // HGSS 남색+크림
  paper: { border: 0xc98a3c, body: 0xf3e4c8, line: 0xe0b878, accent: "#b5651d", text: "#3a2a14", sub: "#7a5a2c" }, // 따뜻한 종이질(밝은 패널·어두운 글씨)
  dark:  { border: 0x3a4560, body: 0x161b28, line: 0x5a6a8a, accent: "#7ec7ff", text: "#e8edf7", sub: "#9fb3d8" }, // 다크 슬레이트+시안
};

type MenuState = "main" | "party" | "detail";
interface MenuInit { from?: string }

export default class MenuScene extends Phaser.Scene {
  private from = "WorldScene";
  private party: Pokemon[] = [];
  private state: MenuState = "main";
  private idx = 0;
  private detailIdx = 0;
  private layer!: Phaser.GameObjects.Container;
  private dim?: Phaser.GameObjects.Rectangle;
  private t: Theme = THEMES.navy;

  private readonly MAIN_ITEMS = ["포켓몬", "가방", "저장", "닫기"];

  constructor() { super("MenuScene"); }

  init(data: MenuInit): void {
    this.from = data?.from ?? "WorldScene";
    this.state = "main";
    this.idx = 0;
  }

  preload(): void {
    preloadCommonAudio(this);
    this.party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    for (const p of this.party) {
      const key = "icon_" + p.speciesId;
      if (!this.textures.exists(key)) this.load.image(key, iconPath(p.speciesId));
    }
    // AR 파티 UI 원본 에셋을 그대로 합성한다(눈대중 재현 금지 — game-ui.md 3번).
    //  bg=512x384 배경(6칸 홈 구워짐), panel_*=256x98 컬러패널, overlay_*=HP바/Lv 태그, icon_ball=44x56.
    const P = "assets/ui/party/";
    //  선택 패널은 레퍼런스가 '파랑+빨강테'라 내가 만든 blue_sel을 쓴다(원본 _sel은 초록+빨강테).
    for (const f of ["bg",
      "panel_rect", "panel_round", "panel_rect_blue_sel", "panel_round_blue_sel",
      "panel_rect_faint", "panel_round_faint",
      "overlay_hp_back", "overlay_hp", "overlay_lv",
      "icon_ball", "icon_ball_sel"]) {
      const k = "pui_" + f;
      if (!this.textures.exists(k)) this.load.image(k, P + f + ".png");
    }
  }

  create(): void {
    this.party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    this.t = THEMES[(this.registry.get("uiTheme") as string) ?? "navy"] ?? THEMES.navy;
    const { width, height } = this.scale;
    this.dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setDepth(0);

    // 도트(픽셀) UI 텍스처는 NEAREST로 — 안 하면 확대 시 뭉개져서 테두리가 지저분해진다(스킬 지침).
    this.textures.getTextureKeys().forEach((k) => {
      if (k.startsWith("pui_") || k.startsWith("icon_")) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.nav("up"));
    kb.on("keydown-DOWN", () => this.nav("down"));
    kb.on("keydown-LEFT", () => this.nav("left"));
    kb.on("keydown-RIGHT", () => this.nav("right"));
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-Z", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-X", () => this.cancel());
    kb.on("keydown-ESC", () => this.cancel());

    // 창 크기 바뀌면 다시 그린다(전체화면 시 오른쪽이 검게 비는 것 방지).
    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.onResize, this));

    this.renderState();
  }

  private onResize(): void {
    if (this.dim) this.dim.setSize(this.scale.width, this.scale.height);
    if (this.layer) this.renderState();
  }

  private renderState(): void {
    if (this.layer) this.layer.destroy();
    this.layer = this.add.container(0, 0).setDepth(10);
    if (this.state === "main") this.renderMain();
    else if (this.state === "party") this.renderParty();
    else this.renderDetail();
  }

  private countFor(state: MenuState): number {
    if (state === "main") return this.MAIN_ITEMS.length;
    if (state === "party") return Math.max(1, this.party.length);
    return 1;
  }

  // 방향 이동. 파티는 2열 그리드(좌우=열 이동, 상하=행 이동), 메인/상세는 세로.
  private nav(dir: "up" | "down" | "left" | "right"): void {
    if (this.state === "detail") {
      if (this.party.length <= 1) return;
      if (dir === "up") this.detailIdx = (this.detailIdx - 1 + this.party.length) % this.party.length;
      else if (dir === "down") this.detailIdx = (this.detailIdx + 1) % this.party.length;
      else return;
      playSfx(this, SFX.cursor, 0.4); this.renderState(); return;
    }
    if (this.state === "main") {
      const n = this.MAIN_ITEMS.length;
      if (dir === "up") this.idx = (this.idx - 1 + n) % n;
      else if (dir === "down") this.idx = (this.idx + 1) % n;
      else return;
      playSfx(this, SFX.cursor, 0.4); this.renderState(); return;
    }
    // party: 2열 그리드. idx 짝수=왼열, 홀수=오른열. row=floor(idx/2).
    const n = this.party.length;
    const col = this.idx % 2, row = Math.floor(this.idx / 2);
    let next = this.idx;
    if (dir === "left" && col === 1) next = this.idx - 1;
    else if (dir === "right" && col === 0 && this.idx + 1 < n) next = this.idx + 1;
    else if (dir === "up" && row > 0) next = this.idx - 2;
    else if (dir === "down" && this.idx + 2 < n) next = this.idx + 2;
    if (next !== this.idx) { this.idx = next; playSfx(this, SFX.cursor, 0.4); this.renderState(); }
  }

  private confirm(): void {
    playSfx(this, SFX.decision, 0.4);
    if (this.state === "main") {
      const item = this.MAIN_ITEMS[this.idx];
      if (item === "포켓몬") { if (!this.party.length) { this.toast("아직 포켓몬이 없어."); return; } this.state = "party"; this.idx = 0; this.renderState(); }
      else if (item === "가방") { this.toast("가방은 준비 중이야."); }
      else if (item === "저장") { this.toast("저장은 준비 중이야."); }
      else if (item === "닫기") { this.close(); }
    } else if (this.state === "party") {
      if (!this.party.length) return;
      this.detailIdx = this.idx; this.state = "detail"; this.renderState();
    }
  }

  private cancel(): void {
    playSfx(this, SFX.cancel, 0.4);
    if (this.state === "main") { this.close(); }
    else if (this.state === "party") { this.state = "main"; this.idx = 0; this.renderState(); }
    else { this.state = "party"; this.idx = this.detailIdx; this.renderState(); }
  }

  private close(): void {
    this.scene.stop();
    if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
    else if (!this.scene.isActive(this.from)) this.scene.start(this.from);
  }

  // 크림/남색 대신 테마 색으로 패널을 그린다.
  private panel(x: number, y: number, w: number, h: number, r = 16): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(x + 4, y + 6, w, h, r);
    g.fillStyle(this.t.border, 1); g.fillRoundedRect(x, y, w, h, r);
    g.fillStyle(this.t.body, 1); g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, r - 3);
    g.lineStyle(2, this.t.line, 0.9); g.strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, r - 6);
    this.layer.add(g);
  }
  private txt(x: number, y: number, s: string, size: number, color?: string, origin = 0): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: color ?? this.t.text }).setOrigin(origin, 0);
    this.layer.add(t); return t;
  }

  private renderMain(): void {
    const { width, height } = this.scale;
    const w = Math.min(width * 0.28, 300);
    const x = width - w - Math.max(width * 0.03, 16);
    const rowH = Math.max(56, height * 0.09);
    const h = rowH * this.MAIN_ITEMS.length + 28;
    const y = Math.max(height * 0.06, 24);
    this.panel(x, y, w, h);
    const fs = Math.max(22, Math.round(rowH * 0.34));
    this.MAIN_ITEMS.forEach((label, i) => {
      const ty = y + 18 + i * rowH;
      const sel = i === this.idx;
      if (sel) this.txt(x + 22, ty, "▶", fs, this.t.accent);
      this.txt(x + 58, ty, label, fs, sel ? this.t.accent : this.t.text);
    });
  }

  // 외곽선 있는 흰 글씨(AR 파티창 폰트 느낌 — bold 아님 + 가는 검은 외곽선).
  private otext(x: number, y: number, s: string, size: number, color = "#ffffff", origin = 0): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${Math.round(size)}px`, color,
      stroke: "#173026", strokeThickness: Math.max(2, Math.round(size * 0.14)),
    }).setOrigin(origin, 0);
    this.layer.add(t); return t;
  }

  // AR 파티 화면 재현 — 원본 에셋(bg/패널/overlay/볼)을 원본 픽셀 좌표에 그대로 합성.
  //  DS 512x384 가상 레이아웃을 균일 스케일해 중앙 배치(늘리지 않음 → 와이드 화면에서도 비율 유지).
  private renderParty(): void {
    const { width, height } = this.scale;
    const VW = 512, VH = 384;
    const barH = Math.max(46, Math.round(height * 0.13));   // 하단 메시지바 높이
    const s = Math.min(width / VW, (height - barH) / VH);   // 가로/세로 중 작은 배율(contain)
    const offX = Math.round((width - VW * s) / 2), offY = 0;

    // 배경: 남는 여백은 청록으로 채우고, 그 위에 원본 bg(6칸 홈이 구워진 512x384)를 얹는다.
    this.layer.add(this.add.rectangle(0, 0, width, height, 0x49b4bc).setOrigin(0));
    if (this.textures.exists("pui_bg"))
      this.layer.add(this.add.image(offX, offY, "pui_bg").setOrigin(0).setScale(s));

    // 슬롯 좌상단 좌표(가상 512x384, 패널 256x98). bg 홈 위치에 1:1. 우열은 살짝 아래로 stagger.
    const slots: [number, number][] = [
      [2, 10], [256, 24],      // 0 선두(라운드) · 1
      [2, 104], [256, 118],    // 2 · 3
      [2, 198], [256, 212],    // 4 · 5
    ];
    for (let i = 0; i < 6; i++) {
      const p = this.party[i];
      if (!p) continue;
      const [vx, vy] = slots[i];
      this.drawPartySlot(offX + vx * s, offY + vy * s, s, p, i, i === this.idx);
    }

    // 하단 메시지바(전체 폭) + 취소 — DS식 남색 프레임.
    const dy = height - barH, m = Math.round(width * 0.015);
    const cbw = Math.min(Math.round(width * 0.16), 220), cbx = width - m - cbw;
    const boxW = cbx - m - Math.round(width * 0.012);
    const frame = (bx: number, by: number, bw: number, bh: number, fill: number) => {
      const g = this.add.graphics();
      g.fillStyle(0x101018, 1); g.fillRoundedRect(bx, by, bw, bh, 6);
      g.fillStyle(0xf2f4f8, 1); g.fillRoundedRect(bx + 2, by + 2, bw - 4, bh - 4, 5);
      g.fillStyle(fill, 1); g.fillRoundedRect(bx + 5, by + 5, bw - 10, bh - 10, 4);
      this.layer.add(g);
    };
    frame(m, dy + 4, boxW, barH - 8, 0x28304a);
    this.layer.add(this.add.text(m + barH * 0.4, dy + barH / 2, "포켓몬을 선택하세요.",
      { fontFamily: FONT, fontSize: `${Math.round(barH * 0.34)}px`, color: "#ffffff" }).setOrigin(0, 0.5));
    frame(cbx, dy + 4, cbw, barH - 8, 0x3a6ac0);
    this.layer.add(this.add.text(cbx + cbw / 2, dy + barH / 2, "취소",
      { fontFamily: FONT, fontSize: `${Math.round(barH * 0.4)}px`, color: "#ffffff" }).setOrigin(0.5));
  }

  // 파티 슬롯 한 칸 — 원본 패널(256x98) + 볼/아이콘 + overlay_hp_back(HP바) + Lv 태그 + 텍스트를
  //  전부 원본 로컬 픽셀 좌표(256x98)에 얹는다. s = 가상→화면 배율.
  private drawPartySlot(x: number, y: number, s: number, p: Pokemon, i: number, sel: boolean): void {
    const faint = p.currentHp <= 0;
    const lead = i === 0;                        // 선두만 라운드 패널
    const L = (lx: number, ly: number): [number, number] => [x + lx * s, y + ly * s];
    // 패널: 초록(기본) / 파랑+빨강테(선택, 레퍼런스 색) / 회색(기절). 선두=round, 나머지=rect.
    const key = faint ? (lead ? "pui_panel_round_faint" : "pui_panel_rect_faint")
      : sel ? (lead ? "pui_panel_round_blue_sel" : "pui_panel_rect_blue_sel")
        : (lead ? "pui_panel_round" : "pui_panel_rect");
    if (this.textures.exists(key)) this.layer.add(this.add.image(x, y, key).setOrigin(0).setScale(s));

    // 몬스터볼(44x56) — 원본 크기 그대로 좌측 홈에. 선택 시 열린 볼.
    const ballKey = sel ? "pui_icon_ball_sel" : "pui_icon_ball";
    if (this.textures.exists(ballKey)) {
      const [bx, by] = L(26, 50);
      this.layer.add(this.add.image(bx, by, ballKey).setOrigin(0.5).setScale(s));
    }
    // 포켓몬 아이콘 — 볼 위에.
    const ik = "icon_" + p.speciesId;
    if (this.textures.exists(ik)) {
      const [ix, iy] = L(29, 40);
      const ic = makePartyIcon(this, ik, ix, iy, s * 58 / 64); ic.setOrigin(0.5); this.layer.add(ic);
    }

    // 이름(좌상) + 성별(우상)
    this.otext(x + 74 * s, y + 6 * s, displayName(p), 26 * s);
    if (p.gender) {
      const gs = p.gender === "female" ? "♀" : "♂";
      const gc = p.gender === "female" ? "#f06898" : "#5aa8f0";
      this.otext(x + 244 * s, y + 8 * s, gs, 24 * s, gc, 1);
    }

    // HP바: 원본 overlay_hp_back(138x14) 프레임 + 안쪽 groove(로컬 x28~129, y4~10)에 색 채움.
    if (this.textures.exists("pui_overlay_hp_back")) {
      const [hx, hy] = L(72, 46);
      this.layer.add(this.add.image(hx, hy, "pui_overlay_hp_back").setOrigin(0).setScale(s));
      const ratio = Math.max(0, Math.min(1, p.currentHp / p.maxHp));
      const col = ratio > 0.5 ? 0x60f860 : ratio > 0.2 ? 0xf8d800 : 0xf85858; // 원본 overlay_hp 3색
      const [fx, fy] = L(72 + 28, 46 + 4);
      const g = this.add.graphics();
      g.fillStyle(col, 1); g.fillRect(fx, fy, 101 * s * ratio, 6 * s);
      this.layer.add(g);
    }
    // HP 수치(바 아래 우측)
    this.otext(x + 240 * s, y + 62 * s, `${Math.max(0, p.currentHp)} / ${p.maxHp}`, 22 * s, "#ffffff", 1);

    // Lv 태그 + 레벨 숫자(좌하)
    if (this.textures.exists("pui_overlay_lv")) {
      const [vx, vy] = L(6, 78);
      this.layer.add(this.add.image(vx, vy, "pui_overlay_lv").setOrigin(0).setScale(s));
    }
    this.otext(x + 33 * s, y + 77 * s, `${p.level}`, 17 * s);
  }

  private hpBar(x: number, y: number, w: number, p: Pokemon): void {
    const g = this.add.graphics();
    const barH = 12;
    g.fillStyle(0x101820, 1); g.fillRoundedRect(x - 2, y - 2, w + 4, barH + 4, 5);
    const ratio = Math.max(0, p.currentHp / p.maxHp);
    const col = ratio > 0.5 ? 0x6ede6a : ratio > 0.2 ? 0xf2d24b : 0xe85b4b;
    g.fillStyle(col, 1); g.fillRoundedRect(x, y, Math.max(0, w * ratio), barH, 4);
    this.layer.add(g);
    this.txt(x + w, y + barH + 4, `${p.currentHp}/${p.maxHp}`, 16, this.t.text, 1);
  }

  private renderDetail(): void {
    const { width, height } = this.scale;
    const p = this.party[this.detailIdx];
    const w = Math.min(width * 0.7, 820);
    const x = (width - w) / 2;
    const y = Math.max(height * 0.06, 24);
    const h = Math.min(height * 0.86, 620);
    this.panel(x, y, w, h);
    this.txt(x + 28, y + 20, `${displayName(p)}  Lv.${p.level}`, 30, this.t.accent);
    this.txt(x + 28, y + 60, `타입: ${p.types.join(" / ")}`, 24, this.t.sub);
    const key = "icon_" + p.speciesId;
    if (this.textures.exists(key)) { const ic = makePartyIcon(this, key, x + w - 80, y + 60, 1.2); ic.setOrigin(0.5); this.layer.add(ic); }
    const stats: [string, number][] = [
      ["HP", p.maxHp], ["공격", p.attack], ["방어", p.defense],
      ["특공", p.spAttack], ["특방", p.spDefense], ["스피드", p.speed],
    ];
    stats.forEach(([n, v], i) => {
      const sy = y + 110 + i * 34;
      this.txt(x + 36, sy, n, 24, this.t.text);
      this.txt(x + 160, sy, String(v), 24, this.t.accent);
    });
    this.txt(x + 36, y + 110 + 6 * 34 + 8, `컨디션: ${p.condition}`, 24, this.t.sub);
    this.txt(x + w / 2 + 20, y + 108, "기술", 24, this.t.accent);
    p.moves.forEach((m: MoveSlot, i) => {
      const my = y + 148 + i * 40;
      const md = getMove(m.id);
      this.txt(x + w / 2 + 20, my, `${md?.name ?? m.id}`, 24, this.t.text);
      this.txt(x + w - 40, my, `${m.pp}/${m.maxPp}`, 20, this.t.sub, 1);
    });
    this.txt(x + 28, y + h - 40, "↑↓ 다른 포켓몬  ·  X 뒤로", 18, this.t.sub);
  }

  private toast(msg: string): void {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height - 60, msg, {
      fontFamily: FONT, fontSize: "22px", color: "#ffffff",
      backgroundColor: "#000000cc", padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
  }
}
