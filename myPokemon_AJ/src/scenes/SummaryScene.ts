import Phaser from "phaser";
import { Pokemon, MoveSlot, displayName, caughtBallOf } from "../data/Pokemon";
import { frontPath, makeStillFront } from "../game/pokemonSprite";
import { getMove } from "../data/ar";
import { bondHearts, bondLabel, BOND_HEARTS } from "../systems/bond";
import { expForLevel } from "../systems/exp";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";

// 포켓몬 상세정보(Summary) 화면 — 파티에서 포켓몬을 고르면 열리는 오버레이.
//
// ★ 레이아웃은 Another Red 원본 UI(Graphics/UI/Summary/bg_*.png)를 그대로 얹은 것이다
//   (.claude/rules/game-ui.md — 지어내기 금지). 원본 화면 512x384 가상좌표에 그린 뒤 통째로 확대(contain).
//   ← → 로 페이지(정보/능력치/기술) 전환, ↑ ↓ 로 파티 내 다른 포켓몬 전환, X/ESC 로 닫기.
//
//   좌측 공통(모든 페이지): 초상 패널(x8..218,y44..258) + "Lv." + 잡은볼 상자(x8..78,y284..344) + 이름 바.
//   info(파랑): 우측 정보 행 5개 + 하단 EXP 바.  skills(초록): HP 바 + 스탯 5행 + 유대.  moves(빨강): 기술 4칸.
const FONT = "Galmuri11";
const VW = 512, VH = 384;
const DIR = "assets/ui/summary";

// 타입 → types.png 시트의 행 번호 (AR types.dat icon_position — PokedexScene과 동일값).
const TYPE_POS: Record<string, number> = {
  NORMAL: 0, FIGHTING: 1, FLYING: 2, POISON: 3, GROUND: 4, ROCK: 5, BUG: 6, GHOST: 7, STEEL: 8, QMARKS: 9,
  FIRE: 10, WATER: 11, GRASS: 12, ELECTRIC: 13, PSYCHIC: 14, ICE: 15, DRAGON: 16, DARK: 17, FAIRY: 18, STELLAR: 19,
};
const TYPE_W = 64, TYPE_H = 28;
// 기술 분류 → category.png 행(위에서부터 물리/특수/변화, 각 64x28).
const CAT_POS: Record<string, number> = { Physical: 0, Special: 1, Status: 2 };
const CAT_W = 64, CAT_H = 28;

// 잡은 볼 id → 한글 이름(items.json과 동일). 표에 없으면 id 그대로.
const BALL_KR: Record<string, string> = {
  POKEBALL: "몬스터볼", GREATBALL: "슈퍼볼", ULTRABALL: "하이퍼볼", MASTERBALL: "마스터볼",
};
const BALL_KEYS = ["POKEBALL", "GREATBALL", "ULTRABALL", "MASTERBALL"];

const PAGES = ["info", "skills", "moves"] as const;
type Page = typeof PAGES[number];
const PAGE_TITLE: Record<Page, string> = { info: "정보", skills: "능력치", moves: "기술" };

interface SummaryInit { party?: Pokemon[]; index?: number; from?: string }

export default class SummaryScene extends Phaser.Scene {
  private from = "MenuScene";
  private party: Pokemon[] = [];
  private idx = 0;          // 파티에서 보고 있는 포켓몬
  private page = 0;         // PAGES 인덱스
  private layer!: Phaser.GameObjects.Container;
  private s = 1; private offX = 0; private offY = 0;

  constructor() { super("SummaryScene"); }

  init(data: SummaryInit): void {
    this.from = data?.from ?? "MenuScene";
    this.party = data?.party ?? (this.registry.get("playerParty") as Pokemon[]) ?? [];
    this.idx = Math.max(0, Math.min((this.party.length || 1) - 1, data?.index ?? 0));
    this.page = 0;
  }

  preload(): void {
    preloadCommonAudio(this);
    for (const f of ["bg_info", "bg_skills", "bg_moves", "overlay_hp", "overlay_exp", "category"])
      if (!this.textures.exists("sum_" + f)) this.load.image("sum_" + f, `${DIR}/${f}.png?v=1`);
    if (!this.textures.exists("sum_types")) this.load.image("sum_types", "assets/ui/types.png?v=1");
    for (const b of BALL_KEYS)
      if (!this.textures.exists("sum_ball_" + b)) this.load.image("sum_ball_" + b, `${DIR}/icon_ball_${b}.png?v=1`);
    // 파티 전 포켓몬의 초상(Front 첫 프레임). ↑↓로 넘겨도 끊기지 않게 미리 다 로드.
    for (const p of this.party)
      if (!this.textures.exists("sumfront_" + p.speciesId)) this.load.image("sumfront_" + p.speciesId, frontPath(p.speciesId));
  }

  create(): void {
    for (const k of this.textures.getTextureKeys())
      if (k.startsWith("sum_") || k.startsWith("sumfront_"))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const kb = this.input.keyboard!;
    kb.on("keydown-LEFT", () => this.turnPage(-1));
    kb.on("keydown-RIGHT", () => this.turnPage(1));
    kb.on("keydown-UP", () => this.switchMon(-1));
    kb.on("keydown-DOWN", () => this.switchMon(1));
    kb.on("keydown-X", () => this.cancel());
    kb.on("keydown-ESC", () => this.cancel());

    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.render, this));
    this.render();
  }

  private turnPage(d: number): void {
    const n = this.page + d;
    if (n < 0 || n >= PAGES.length) return;
    this.page = n;
    playSfx(this, SFX.cursor, 0.4);
    this.render();
  }

  private switchMon(d: number): void {
    if (this.party.length <= 1) return;
    const next = Math.max(0, Math.min(this.party.length - 1, this.idx + d));
    if (next === this.idx) return;   // 경계(첫/마지막 칸)에서 헛움직임 방지
    this.idx = next;
    playSfx(this, SFX.cursor, 0.4);
    this.render();
  }

  private cancel(): void {
    playSfx(this, SFX.cancel, 0.4);
    this.scene.stop();
    if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
    else if (!this.scene.isActive(this.from)) this.scene.start(this.from);
  }

  // ── 좌표 변환·그리기 헬퍼 (PokedexScene과 동일 관용구) ─────────────
  private X(vx: number): number { return this.offX + vx * this.s; }
  private Y(vy: number): number { return this.offY + vy * this.s; }

  // 전체 이미지를 (vx,vy) 좌상단에 놓는다(가상→화면 배율 s).
  private img(key: string, vx: number, vy: number): void {
    if (!this.textures.exists(key)) return;
    this.layer.add(this.add.image(this.X(vx), this.Y(vy), key).setOrigin(0).setScale(this.s));
  }

  // 시트의 한 조각(cx,cy,cw,ch)을 (vx,vy)에 놓는다. drawScale = 가상px 대비 추가 배율(아이콘 축소용).
  private crop(key: string, vx: number, vy: number, cx: number, cy: number, cw: number, ch: number, drawScale = 1): void {
    if (!this.textures.exists(key)) return;
    const sc = this.s * drawScale;
    const im = this.add.image(this.X(vx), this.Y(vy), key).setOrigin(0).setScale(sc);
    im.setCrop(cx, cy, cw, ch).setPosition(this.X(vx) - cx * sc, this.Y(vy) - cy * sc);
    this.layer.add(im);
  }

  private txt(vx: number, vy: number, s: string, size: number, color: string, align: "left" | "center" | "right" = "left"): Phaser.GameObjects.Text {
    const ox = align === "left" ? 0 : align === "center" ? 0.5 : 1;
    const t = this.add.text(this.X(vx), this.Y(vy), s, {
      fontFamily: FONT, fontSize: `${Math.round(size * this.s)}px`, color,
    }).setOrigin(ox, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), "#ffffff", 0, false, true);
    this.layer.add(t);
    return t;
  }

  // 색이 채워진 막대(HP·EXP 등). vx..vx+w 영역을 ratio 만큼 채운다.
  private bar(vx: number, vy: number, w: number, h: number, ratio: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(this.X(vx), this.Y(vy), Math.max(0, Math.min(1, ratio)) * w * this.s, h * this.s);
    this.layer.add(g);
  }

  // 포켓몬 초상(Front 시트 첫 프레임)을 targetH(가상px)에 맞춰 중심(vx,vy)에 놓는다.
  private drawMon(speciesId: string, vx: number, vy: number, targetH: number): void {
    const key = "sumfront_" + speciesId;
    if (!this.textures.exists(key)) return;
    const fh = (this.textures.get(key).getSourceImage() as HTMLImageElement).height;
    const scale = this.s * Math.min(4, targetH / Math.max(1, fh));
    this.layer.add(makeStillFront(this, key, this.X(vx), this.Y(vy), scale));
  }

  // 유대 하트 칸(MenuScene과 동일 방식 — ♥ 글리프가 Galmuri11에 없어 graphics로 직접).
  private drawHearts(vx: number, vy: number, filled: number, total: number): void {
    const g = this.add.graphics();
    const r = 7 * this.s, gap = r * 2.4;
    const x = this.X(vx), cy = this.Y(vy);
    for (let i = 0; i < total; i++) {
      const cx = x + i * gap + r;
      if (i < filled) g.fillStyle(0xff5d7a, 1); else g.fillStyle(0xb9b0a0, 0.55);
      g.fillCircle(cx - r * 0.42, cy - r * 0.28, r * 0.5);
      g.fillCircle(cx + r * 0.42, cy - r * 0.28, r * 0.5);
      g.fillTriangle(cx - r * 0.88, cy - r * 0.02, cx + r * 0.88, cy - r * 0.02, cx, cy + r * 0.74);
    }
    this.layer.add(g);
  }

  // 타입 아이콘(들)을 (vx,vy)에 가로로 놓는다. 배지 높이 = 28*drawScale.
  private typeBadges(types: string[], vx: number, vy: number, drawScale: number): void {
    types.forEach((t, i) => {
      const row = TYPE_POS[t] ?? TYPE_POS.QMARKS;
      this.crop("sum_types", vx + i * (TYPE_W + 4) * drawScale, vy, 0, row * TYPE_H, TYPE_W, TYPE_H, drawScale);
    });
  }

  private render(): void {
    if (this.layer) this.layer.destroy();
    this.layer = this.add.container(0, 0).setDepth(10);
    const { width, height } = this.scale;
    this.s = Math.min(width / VW, height / VH);
    this.offX = Math.round((width - VW * this.s) / 2);
    this.offY = Math.round((height - VH * this.s) / 2);
    this.layer.add(this.add.rectangle(0, 0, width, height, 0x0b0f18).setOrigin(0));

    const page = PAGES[this.page];
    this.img("sum_bg_" + page, 0, 0);       // 페이지별 원본 배경(색·틀 포함)
    this.drawLeft();                         // 좌측 공통(초상·이름·잡은볼)
    if (page === "info") this.drawInfo();
    else if (page === "skills") this.drawSkills();
    else this.drawMoves();

    // 상단 바 페이지 제목 + 하단 조작 힌트
    this.txt(240, 7, PAGE_TITLE[page], 20, "#ffffff");
    this.txt(486, 8, `${this.page + 1}/${PAGES.length}`, 16, "#ffffff", "right");
    this.txt(12, 366, "← → 페이지  ·  ↑ ↓ 포켓몬  ·  X 닫기", 15, "#5b6470");
  }

  // 좌측 공통 패널 — 모든 페이지에서 같다.
  private drawLeft(): void {
    const p = this.party[this.idx];
    if (!p) return;
    // 이름 + 성별(상단). 성별 기호는 이름 텍스트의 실제 너비 뒤에 붙인다(겹침 방지).
    const nameT = this.txt(22, 50, displayName(p), 22, "#3a3a3a");
    if (p.gender === "male" || p.gender === "female") {
      const sym = p.gender === "male" ? "♂" : "♀";
      const g = this.add.text(nameT.x + nameT.width + 6 * this.s, this.Y(52), sym, {
        fontFamily: FONT, fontSize: `${Math.round(20 * this.s)}px`, color: p.gender === "male" ? "#3a7de0" : "#e0567a",
      }).setOrigin(0, 0);
      g.setShadow(Math.max(1, this.s), Math.max(1, this.s), "#ffffff", 0, false, true);
      this.layer.add(g);
    }
    // 레벨(원본 "Lv." 글자 오른쪽)
    this.txt(60, 94, String(p.level), 24, "#3a3a3a");
    // 초상
    this.drawMon(p.speciesId, 113, 185, 118);
    // 잡은 볼(좌하단 상자) + 볼 이름(옆 바)
    const ball = caughtBallOf(p);
    const bkey = "sum_ball_" + ball;
    if (this.textures.exists(bkey)) this.crop(bkey, 27, 298, 0, 0, 32, 32, 1.0);
    this.txt(88, 312, BALL_KR[ball] ?? ball, 18, "#3a3a3a");
  }

  // ── 정보 페이지(bg_info) ─────────────────────────────
  private drawInfo(): void {
    const p = this.party[this.idx];
    if (!p) return;
    const rowY = [76, 108, 140, 172, 204];
    const label = (i: number, s: string) => this.txt(244, rowY[i], s, 18, "#f4f4f4");
    const value = (i: number, s: string) => this.txt(492, rowY[i], s, 18, "#3a3a3a", "right");
    label(0, "종족명"); value(0, p.name);
    label(1, "도감번호"); value(1, p.id > 0 ? `No.${String(p.id).padStart(3, "0")}` : "———");
    label(2, "타입"); this.typeBadges(p.types, 380, rowY[2] - 2, 0.72);
    label(3, "지닌 도구"); value(3, p.heldItem ?? "없음");
    label(4, "성별"); value(4, p.gender === "male" ? "♂ 수컷" : p.gender === "female" ? "♀ 암컷" : "—");
    // 하단 넓은 행 2개 = 경험치. 레벨 100은 만렙이라 '다음 레벨' 개념이 없다.
    const maxed = p.level >= 100;
    this.txt(244, 268, "경험치", 18, "#f4f4f4"); this.txt(492, 268, String(p.exp), 18, "#3a3a3a", "right");
    const next = expForLevel(p.level + 1);
    this.txt(244, 302, "다음 레벨까지", 18, "#f4f4f4");
    this.txt(492, 302, maxed ? "최고 레벨" : String(Math.max(0, next - p.exp)), 18, "#3a3a3a", "right");
    // EXP 바(하단, 원본 "EXP" 라벨 오른쪽). L³ 곡선으로 현재 레벨 진행도(만렙이면 가득).
    const cur = expForLevel(p.level);
    const ratio = maxed ? 1 : next > cur ? (p.exp - cur) / (next - cur) : 0;
    this.bar(362, 372, 136, 6, ratio, 0x4fb0e0);
  }

  // ── 능력치 페이지(bg_skills) ─────────────────────────
  private drawSkills(): void {
    const p = this.party[this.idx];
    if (!p) return;
    // HP(상단, 바 + 수치). 색 = 잔량 비율.
    const hpR = p.maxHp > 0 ? p.currentHp / p.maxHp : 0;
    const hpColor = hpR > 0.5 ? 0x58c860 : hpR > 0.2 ? 0xe8c840 : 0xe05050;
    this.bar(374, 106, 84, 8, hpR, hpColor);
    this.txt(492, 72, `${p.currentHp}/${p.maxHp}`, 18, "#3a3a3a", "right");   // HP 바 위쪽(스탯 행과 겹치지 않게)
    // 스탯 5행
    const stats: [string, number][] = [
      ["공격", p.attack], ["방어", p.defense], ["특수공격", p.spAttack], ["특수방어", p.spDefense], ["스피드", p.speed],
    ];
    stats.forEach(([n, v], i) => {
      const y = 128 + i * 32;
      this.txt(244, y, n, 18, "#f4f4f4");
      this.txt(492, y, String(v), 18, "#3a3a3a", "right");
    });
    // 하단 = 유대(이 게임의 핵심 지표)
    this.txt(244, 292, "유대", 18, "#3a3a3a");
    this.drawHearts(300, 303, bondHearts(p), BOND_HEARTS);
    this.txt(300 + BOND_HEARTS * 18 + 12, 292, bondLabel(p), 16, "#c56a1a");
  }

  // ── 기술 페이지(bg_moves) ───────────────────────────
  private drawMoves(): void {
    const p = this.party[this.idx];
    if (!p) return;
    // 원본 bg_moves 슬롯 중심 = y≈142 + i·64 (좌측에 타입·분류 상자쌍 x248/x281).
    for (let i = 0; i < 4; i++) {
      const yc = 142 + i * 64;
      const slot: MoveSlot | undefined = p.moves[i];
      if (!slot) { this.txt(322, yc - 11, "———", 19, "#9aa0a8"); continue; }
      const md = getMove(slot.id);
      // 타입·분류 배지(원본 좌측 상자 위치에 얹는다)
      if (md) {
        const trow = TYPE_POS[md.type] ?? TYPE_POS.QMARKS;
        this.crop("sum_types", 248, yc - 6, 0, trow * TYPE_H, TYPE_W, TYPE_H, 0.5);
        const crow = CAT_POS[md.category] ?? 2;
        this.crop("sum_category", 281, yc - 6, 0, crow * CAT_H, CAT_W, CAT_H, 0.5);
      }
      // 기술명 + PP (한 줄, 구분선 안쪽)
      this.txt(322, yc - 11, md?.name ?? slot.id, 19, "#3a3a3a");
      const ppR = slot.maxPp > 0 ? slot.pp / slot.maxPp : 0;
      const ppColor = ppR > 0.5 ? "#3a3a3a" : ppR > 0.2 ? "#c56a1a" : "#d04040";
      this.txt(490, yc - 9, `PP ${slot.pp}/${slot.maxPp}`, 15, ppColor, "right");
    }
  }
}
