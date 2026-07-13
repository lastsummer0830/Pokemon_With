import Phaser from "phaser";
import { dexCounts, dexEntries, DexEntry } from "../data/Pokedex";
import { frontPath, makeStillFront } from "../game/pokemonSprite";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";

// 도감 화면 (오버레이). 메뉴 → "도감" 또는 디버그에서 연다. 목록 ↔ 상세 두 뷰.
//
// ★ 레이아웃은 Another Red 원본 UI 스크립트(UI_Pokedex_Main / UI_Pokedex_Entry)의 실제 좌표 그대로다
//   (.claude/rules/game-ui.md — 지어내기 금지). 원본 화면 512x384 가상좌표에 그린 뒤 통째로 확대(contain).
//
//   목록(bg_list): 10줄 · 줄높이 32 · 커서(222, 46+j*32) · seen/own 아이콘(232, 54+j*32)
//                  번호(274, 56+j*32) · 이름(322, ...) · 왼쪽 스프라이트 중심(112,196)
//                  본 수(42,312 / 우측 182) · 잡은 수(42,348 / 우측 182)
//   상세(bg_info): 스프라이트 중심(104,136) · "번호 이름"(246,48) · 분류(246,80) · 소유아이콘(212,44)
//                  타입아이콘 96x32 → (296,120)·(396,120) · 신장(314,164 / 값 470 우측)
//                  체중(314,196 / 값 482 우측) · 설명문(40,246 폭 432)
const FONT = "Galmuri11";
const VW = 512, VH = 384;
const ROWS = 10;         // 목록 한 화면 줄 수 (원본: (364-32)/32)
const ROW_H = 32;

// look — 그림은 셋 다 AR 원본(구조·프레임·격자 그대로), 색만 다르다(tools/ui-pastel.py 리컬러).
//   "ar" = 원본 색 / "pastel" = 채도↓·밝기↑(로즈) / "sky" = 타이틀 톤(연하늘 + 커서 연분홍)
export type DexLook = "ar" | "pastel" | "sky" | "cream";
interface DexInit { from?: string; look?: DexLook }

export default class PokedexScene extends Phaser.Scene {
  private from = "MenuScene";
  private look: DexLook = "ar";
  private entries: DexEntry[] = [];
  private idx = 0;
  private top = 0;
  private detail = false;
  private layer!: Phaser.GameObjects.Container;
  private s = 1; private offX = 0; private offY = 0;

  constructor() { super("PokedexScene"); }

  init(data: DexInit): void {
    this.from = data?.from ?? "MenuScene";
    this.look = data?.look ?? ((this.registry.get("uiLook") as DexLook) ?? "ar");
    this.idx = 0; this.top = 0; this.detail = false;
  }

  preload(): void {
    preloadCommonAudio(this);
    this.entries = dexEntries(this.registry);
    // 색이 바뀌는 것(배경·커서·슬라이더)은 look 폴더에서, 아이콘류(seen/own/타입)는 원본 그대로.
    //  ⚠️ 텍스처 키에 look을 넣는다 — 안 넣으면 다른 look을 열 때 앞서 캐시된 그림이 나온다.
    const P = "assets/ui/pokedex/";
    const dir = this.look === "ar" ? P : `${P}${this.look}/`;
    for (const f of ["bg_list", "bg_info", "cursor_list", "icon_slider"])
      if (!this.textures.exists(`dex_${this.look}_${f}`)) this.load.image(`dex_${this.look}_${f}`, dir + f + ".png?v=1");
    for (const f of ["icon_seen", "icon_own", "icon_types"])
      if (!this.textures.exists("dex_" + f)) this.load.image("dex_" + f, P + f + ".png?v=1");
    // 본 적 있는 포켓몬의 스프라이트·발자국만 미리 로드(151마리 전부 받으면 무겁다).
    for (const e of this.entries) {
      if (!e.seen) continue;
      if (!this.textures.exists("dexfront_" + e.speciesId))
        this.load.image("dexfront_" + e.speciesId, frontPath(e.speciesId));
      if (!this.textures.exists("dexfoot_" + e.speciesId))
        this.load.image("dexfoot_" + e.speciesId, `assets/pokemon/footprints/${e.speciesId}.png`);
    }
  }

  create(): void {
    for (const k of this.textures.getTextureKeys())
      if (k.startsWith("dex_") || k.startsWith("dexfront_"))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-LEFT", () => this.move(-ROWS));
    kb.on("keydown-RIGHT", () => this.move(ROWS));
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-Z", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-X", () => this.cancel());
    kb.on("keydown-ESC", () => this.cancel());

    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.render, this));
    this.render();
  }

  private move(d: number): void {
    const n = this.entries.length;
    if (!n) return;
    this.idx = Math.max(0, Math.min(n - 1, this.idx + d));
    if (this.idx < this.top) this.top = this.idx;
    if (this.idx >= this.top + ROWS) this.top = this.idx - ROWS + 1;
    this.top = Math.max(0, Math.min(this.top, Math.max(0, n - ROWS)));
    playSfx(this, SFX.cursor, 0.4);
    this.render();
  }

  private confirm(): void {
    const e = this.entries[this.idx];
    if (this.detail || !e?.seen) return;    // 못 본 포켓몬은 상세가 없다
    playSfx(this, SFX.decision, 0.4);
    this.detail = true;
    this.render();
  }

  private cancel(): void {
    playSfx(this, SFX.cancel, 0.4);
    if (this.detail) { this.detail = false; this.render(); return; }
    this.scene.stop();
    if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
    else if (!this.scene.isActive(this.from)) this.scene.start(this.from);
  }

  // ── 그리기 ────────────────────────────────────────────
  private X(vx: number): number { return this.offX + vx * this.s; }
  private Y(vy: number): number { return this.offY + vy * this.s; }

  private img(key: string, vx: number, vy: number, crop?: Phaser.Geom.Rectangle): void {
    if (!this.textures.exists(key)) return;
    const im = this.add.image(this.X(vx), this.Y(vy), key).setOrigin(0).setScale(this.s);
    if (crop) im.setCrop(crop).setPosition(this.X(vx) - crop.x * this.s, this.Y(vy) - crop.y * this.s);
    this.layer.add(im);
  }

  private txt(vx: number, vy: number, s: string, size: number, color: string, shadow: string, align: "left" | "center" | "right" = "left"): void {
    const ox = align === "left" ? 0 : align === "center" ? 0.5 : 1;
    const t = this.add.text(this.X(vx), this.Y(vy), s, {
      fontFamily: FONT, fontSize: `${Math.round(size * this.s)}px`, color,
    }).setOrigin(ox, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), shadow, 0, false, true);
    this.layer.add(t);
  }

  // 패널 위 글자색 — 원본은 회색 계열. 크림 룩은 패널이 아이보리라 회색 글씨가 탁해 보인다 → 따뜻한 갈색조로.
  private get colors(): [string, string] {
    return this.look === "cream" ? ["#6b5a44", "#fff3da"] : ["#585850", "#a8b8b8"];
  }
  // 컬러 띠(도감 상단 헤더) 위 글자색 — 띠가 진한 색(원본 빨강·크림안의 벽돌빨강)이면 흰 글씨,
  //  연한 색(파스텔·하늘)으로 리컬러됐으면 짙은 글씨라야 읽힌다.
  private get onHeader(): [string, string] {
    return this.look === "ar" || this.look === "cream" ? ["#f8f8f8", "#000000"] : ["#4a4a55", "#ffffff"];
  }

  // 포켓몬 스프라이트(AR Front 시트의 첫 프레임)를 원하는 높이(가상px)에 맞춰 놓는다.
  //  AR Front는 종족마다 프레임 크기가 달라(38~96px) 고정 배율을 쓰면 크기가 들쭉날쭉해진다.
  private drawMon(speciesId: string, vx: number, vy: number, targetH: number): void {
    const key = "dexfront_" + speciesId;
    if (!this.textures.exists(key)) return;
    const fh = (this.textures.get(key).getSourceImage() as HTMLImageElement).height;  // 프레임 = 정사각(높이)
    const scale = this.s * Math.min(4, targetH / Math.max(1, fh));
    this.layer.add(makeStillFront(this, key, this.X(vx), this.Y(vy), scale));
  }

  private render(): void {
    if (this.layer) this.layer.destroy();
    this.layer = this.add.container(0, 0).setDepth(10);
    const { width, height } = this.scale;
    this.s = Math.min(width / VW, height / VH);
    this.offX = Math.round((width - VW * this.s) / 2);
    this.offY = Math.round((height - VH * this.s) / 2);
    this.layer.add(this.add.rectangle(0, 0, width, height, 0x0b0f18).setOrigin(0));

    if (this.detail) this.renderDetail();
    else this.renderList();
  }

  // ── 목록 ──────────────────────────────────────────────
  private renderList(): void {
    const [base, shadow] = this.colors;
    this.img(`dex_${this.look}_bg_list`, 0, 0);

    // 상단 타이틀(원본 (256,12) 중앙) — 빨간 띠 위
    const [hb, hs] = this.onHeader;
    this.txt(256, 8, "칸토도감", 20, hb, hs, "center");

    // 목록 10줄
    for (let j = 0; j < ROWS; j++) {
      const e = this.entries[this.top + j];
      if (!e) break;
      const selected = this.top + j === this.idx;
      if (selected) this.drawCursor(j);
      if (e.own) this.img("dex_icon_own", 232, 54 + j * ROW_H);
      else if (e.seen) this.img("dex_icon_seen", 232, 54 + j * ROW_H);
      this.txt(274, 56 + j * ROW_H, String(e.no).padStart(3, "0"), 18, base, shadow);
      this.txt(322, 56 + j * ROW_H, e.seen ? (e.species?.name ?? e.speciesId) : "----------", 18, base, shadow);
    }

    // 왼쪽: 선택한 포켓몬(본 적 있을 때만) — 원본 중심 (112,196), 이름은 위쪽 흰 칸(112,60)
    const cur = this.entries[this.idx];
    if (cur?.seen) {
      this.drawMon(cur.speciesId, 112, 196, 130);
      this.txt(112, 60, cur.species?.name ?? cur.speciesId, 20, base, shadow, "center");
    }

    // 본 수 / 잡은 수 (원본 좌표 — 왼쪽 아래 흰 칸)
    const c = dexCounts(this.registry);
    this.txt(42, 312, "본 포켓몬", 18, base, shadow);
    this.txt(182, 316, String(c.seen), 18, base, shadow, "right");
    this.txt(42, 348, "잡은 포켓몬", 18, base, shadow);
    this.txt(182, 348, String(c.own), 18, base, shadow, "right");

    this.drawSlider();
  }

  private drawCursor(j: number): void {
    this.img(`dex_${this.look}_cursor_list`, 222, 46 + j * ROW_H);
  }

  // 원본 슬라이더 계산식 그대로 (x=468 고정, 트랙 78~346)
  private drawSlider(): void {
    const rowMax = this.entries.length;
    if (rowMax <= ROWS) return;
    const K = `dex_${this.look}_icon_slider`;
    if (this.top > 0) this.img(K, 468, 48, new Phaser.Geom.Rectangle(0, 0, 40, 30));
    if (this.top + ROWS < rowMax) this.img(K, 468, 346, new Phaser.Geom.Rectangle(0, 30, 40, 30));
    const trackH = 268;
    let boxH = Math.floor(trackH * ROWS / rowMax);
    boxH += Math.min(Math.floor((trackH - boxH) / 2), Math.floor(trackH / 6));
    boxH = Math.max(boxH, 40);
    const y = 78 + Math.floor((trackH - boxH) * this.top / (rowMax - ROWS));
    this.img(K, 468, y, new Phaser.Geom.Rectangle(40, 0, 40, 8));
    for (let i = 0; i * 16 < boxH - 8 - 16; i++) {
      const h = Math.min(boxH - 8 - 16 - i * 16, 16);
      this.img(K, 468, y + 8 + i * 16, new Phaser.Geom.Rectangle(40, 8, 40, h));
    }
    this.img(K, 468, y + boxH - 16, new Phaser.Geom.Rectangle(40, 24, 40, 16));
  }

  // ── 상세 ──────────────────────────────────────────────
  private renderDetail(): void {
    const e = this.entries[this.idx];
    const [base, shadow] = this.colors;
    this.img(`dex_${this.look}_bg_info`, 0, 0);

    // 스프라이트 (중심 104,136)
    this.drawMon(e.speciesId, 104, 136, 140);
    // 발자국 (226,138) — 원본과 같은 자리. 잡은 포켓몬만.
    if (e.own) this.img("dexfoot_" + e.speciesId, 226, 138);

    // 소유 아이콘 + 번호/이름(빨간 띠 위) + 분류(흰 칸 위)
    if (e.own) this.img("dex_icon_own", 212, 44);
    const [hb, hs] = this.onHeader;
    this.txt(246, 48, `${String(e.no).padStart(3, "0")} ${e.species?.name ?? e.speciesId}`, 22, hb, hs);
    this.txt(246, 80, `${e.species?.kind ?? "?????"} 포켓몬`, 18, base, shadow);

    // 타입 아이콘 (시트 96x640 = 96x32 프레임 20종, 행 번호 = AR types.dat 의 icon_position).
    //  ※ AR 아이콘에 한글 타입명이 이미 그려져 있다 — 따로 텍스트를 얹지 않는다.
    (e.species?.types ?? []).forEach((t, i) => {
      const pos = TYPE_ICON_POS[t];
      if (pos === undefined) return;
      this.img("dex_icon_types", 296 + 100 * i, 120, new Phaser.Geom.Rectangle(0, pos * 32, 96, 32));
    });

    // 신장 / 체중 (원본은 Height/Weight — 한글로)
    const sp = e.species;
    this.txt(314, 164, "신장", 18, base, shadow);
    this.txt(470, 164, sp ? `${sp.height.toFixed(1)} m` : "????", 18, base, shadow, "right");
    this.txt(314, 196, "체중", 18, base, shadow);
    this.txt(482, 196, sp ? `${sp.weight.toFixed(1)} kg` : "????", 18, base, shadow, "right");

    // 도감 설명문 (40,246 · 폭 432 · 4줄)
    const t = this.add.text(this.X(40), this.Y(246), e.own ? (sp?.dexEntry ?? "") : "아직 잡지 못했다. 잡으면 설명이 기록된다.", {
      fontFamily: FONT, fontSize: `${Math.round(18 * this.s)}px`, color: base,
      wordWrap: { width: 432 * this.s },
      lineSpacing: Math.round(10 * this.s),
    }).setOrigin(0, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), shadow, 0, false, true);
    this.layer.add(t);
  }
}

// 타입 → icon_types.png 시트의 행 번호 (AR types.dat 의 icon_position 그대로)
const TYPE_ICON_POS: Record<string, number> = {
  NORMAL: 0, FIGHTING: 1, FLYING: 2, POISON: 3, GROUND: 4, ROCK: 5, BUG: 6, GHOST: 7, STEEL: 8, QMARKS: 9,
  FIRE: 10, WATER: 11, GRASS: 12, ELECTRIC: 13, PSYCHIC: 14, ICE: 15, DRAGON: 16, DARK: 17, FAIRY: 18, STELLAR: 19,
};
