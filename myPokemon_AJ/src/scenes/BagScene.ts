import Phaser from "phaser";
import { Pokemon, displayName } from "../data/Pokemon";
import { itemsByPocket, POCKETS, POCKET_NAME, removeItem } from "../data/Bag";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";

// 가방 화면 (오버레이). 메뉴 → "가방" 또는 디버그에서 연다.
//
// ★ 레이아웃은 지어낸 것이 아니라 Another Red 원본 UI 스크립트(UI_Bag)의 실제 좌표를 그대로 옮긴 것이다.
//    (.claude/rules/game-ui.md — UI 지어내기 금지) 원본은 512x384 화면 기준이라, 여기서도 그 가상좌표에
//    그린 뒤 화면 크기에 맞춰 통째로 확대(contain)한다. 파티창(MenuScene.renderParty)과 같은 방식.
//
//    원본 좌표 요지:
//      배경 bg_<포켓>(0,0) · 가방그림 bag_<포켓>(30,20) 128x128 · 포켓 이름(94,186 중앙)
//      선택 포켓 아이콘 28x28 → (2+(p-1)*22, 226)   [나머지 탭 그림은 bg에 이미 구워져 있음]
//      목록 7줄 · 줄높이 32 · 커서(184, 8+j*32) · 이름(200, 32+j*32) · 개수 우측정렬 x=450
//      선택 아이템 아이콘 중심(48,336) · 설명문 (88,311) 폭 384
//
// 색(look) = 버터 크림 + 빨강 포인트 — 사용자 확정. 그림(구조·프레임·질감)은 AR 원본 그대로이고
// 색만 tools/ui-pastel.py 가 리컬러한 것이다(에셋: assets/ui/bag/cream/).
const FONT = "Galmuri11";
const VW = 512, VH = 384;      // 원본 가상 해상도
const ROWS = 7;                // 한 화면 목록 줄 수 (원본 ITEMSVISIBLE)
const ROW_H = 32;
const DIR = "assets/ui/bag/cream";

interface BagInit { from?: string }

export default class BagScene extends Phaser.Scene {
  private from = "MenuScene";
  private pocketIdx = 0;        // POCKETS 배열 인덱스(회복약 → 볼 → 일반)
  private idx = 0;              // 현재 포켓 안에서 고른 줄
  private top = 0;              // 스크롤(맨 위에 보이는 줄)
  private choosing = false;     // 회복약을 쓸 포켓몬을 고르는 중
  private partyIdx = 0;
  private msg = "";             // 하단 설명문(아이템 설명 또는 안내문)
  private layer!: Phaser.GameObjects.Container;
  private s = 1; private offX = 0; private offY = 0;

  constructor() { super("BagScene"); }

  init(data: BagInit): void {
    this.from = data?.from ?? "MenuScene";
    this.pocketIdx = 0; this.idx = 0; this.top = 0;
    this.choosing = false; this.partyIdx = 0; this.msg = "";
  }

  preload(): void {
    preloadCommonAudio(this);
    // 색이 바뀌는 것(배경·커서·탭·슬라이더)은 크림 폴더에서, 색을 안 바꾼 것(가방 그림·화살표)은 원본에서 읽는다.
    for (const p of POCKETS) {
      this.loadImg(`bag_bg_${p}`, `${DIR}/bg_${p}.png`);
      // 가방 그림은 리컬러하지 않는다(원본 그대로) — 색을 바꾸면 배경에 묻히거나 탁해진다.
      this.loadImg(`bag_img_${p}`, `assets/ui/bag/bag_${p}.png`);
      this.loadImg(`bag_img_${p}_f`, `assets/ui/bag/bag_${p}_f.png`);
    }
    this.loadImg("bag_cursor", `${DIR}/cursor.png`);
    this.loadImg("bag_pocketicons", `${DIR}/icon_pocket.png`);
    this.loadImg("bag_slider", `${DIR}/icon_slider.png`);
    this.loadImg("ui_left_arrow", "assets/ui/left_arrow.png");
    this.loadImg("ui_right_arrow", "assets/ui/right_arrow.png");
    // 갖고 있는 아이템 아이콘
    for (const p of POCKETS)
      for (const { def } of itemsByPocket(this.registry, p))
        this.loadImg(`item_${def.id}`, `assets/items/${def.id}.png`);
  }

  private loadImg(key: string, path: string): void {
    if (!this.textures.exists(key)) this.load.image(key, path + "?v=1");   // ?v= : png 교체 시 캐시 방지
  }

  create(): void {
    // 도트 UI는 NEAREST(확대해도 또렷하게)
    for (const k of this.textures.getTextureKeys())
      if (k.startsWith("bag_") || k.startsWith("item_") || k.startsWith("ui_"))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-LEFT", () => this.switchPocket(-1));
    kb.on("keydown-RIGHT", () => this.switchPocket(1));
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-Z", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-X", () => this.cancel());
    kb.on("keydown-ESC", () => this.cancel());

    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.render, this));
    this.render();
  }

  // ── 상태 ──────────────────────────────────────────────
  private get pocket(): number { return POCKETS[this.pocketIdx]; }
  private get items(): ReturnType<typeof itemsByPocket> { return itemsByPocket(this.registry, this.pocket); }
  private get party(): Pokemon[] { return (this.registry.get("playerParty") as Pokemon[]) ?? []; }
  // 목록 줄 수 = 아이템 + 맨 아래 "닫는다" 한 줄(원본 CLOSE BAG)
  private get lines(): number { return this.items.length + 1; }

  private move(d: number): void {
    if (this.choosing) {
      const n = this.party.length;
      if (!n) return;
      this.partyIdx = (this.partyIdx + d + n) % n;
    } else {
      const n = this.lines;
      this.idx = (this.idx + d + n) % n;
      if (this.idx < this.top) this.top = this.idx;
      if (this.idx >= this.top + ROWS) this.top = this.idx - ROWS + 1;
      this.top = Math.max(0, Math.min(this.top, Math.max(0, n - ROWS)));
      this.msg = "";
    }
    playSfx(this, SFX.cursor, 0.4);
    this.render();
  }

  private switchPocket(d: number): void {
    if (this.choosing) return;
    this.pocketIdx = (this.pocketIdx + d + POCKETS.length) % POCKETS.length;
    this.idx = 0; this.top = 0; this.msg = "";
    playSfx(this, SFX.cursor, 0.4);
    this.render();
  }

  private confirm(): void {
    playSfx(this, SFX.decision, 0.4);
    if (this.choosing) { this.useOn(this.party[this.partyIdx]); return; }
    const list = this.items;
    if (this.idx >= list.length) { this.close(); return; }        // "닫는다" 줄
    const def = list[this.idx].def;
    // 필드에서 쓸 수 있는 건 회복약(포켓 2)뿐. 볼·일반 아이템은 여기서 쓸 수 없다.
    if (def.pocket !== 2) { this.msg = `${def.name}은(는) 지금 쓸 수 없다.`; this.render(); return; }
    if (!this.party.length) { this.msg = "포켓몬이 없다."; this.render(); return; }
    this.choosing = true; this.partyIdx = 0;
    this.msg = `${def.name}을(를) 누구에게 쓸까?`;
    this.render();
  }

  private cancel(): void {
    playSfx(this, SFX.cancel, 0.4);
    if (this.choosing) { this.choosing = false; this.msg = ""; this.render(); return; }
    this.close();
  }

  // 회복약 사용 — 실제 효과는 아이템 종류로 갈린다(HP회복 / 상태이상 치료 / 기력의조각).
  private useOn(p: Pokemon): void {
    const list = this.items;
    const def = list[this.idx]?.def;
    if (!p || !def) return;
    let ok = false, text = "";
    const heal = (n: number) => {
      const before = p.currentHp;
      p.currentHp = Math.min(p.maxHp, p.currentHp + n);
      return p.currentHp - before;
    };
    if (def.id === "POTION" || def.id === "SUPERPOTION") {
      const amount = def.id === "POTION" ? 20 : 60;
      if (p.currentHp <= 0) text = `${displayName(p)}은(는) 기절해 있다!`;
      else if (p.currentHp >= p.maxHp) text = `${displayName(p)}의 HP는 가득 차 있다.`;
      else { const g = heal(amount); ok = true; text = `${displayName(p)}의 HP가 ${g} 회복됐다!`; }
    } else if (def.id === "REVIVE") {
      if (p.currentHp > 0) text = `${displayName(p)}은(는) 기절하지 않았다.`;
      else { p.currentHp = Math.floor(p.maxHp / 2); p.status = null; ok = true; text = `${displayName(p)}이(가) 기운을 되찾았다!`; }
    } else {
      // 상태이상 치료제 — 아이템 id → 낫는 상태
      const cure: Record<string, Pokemon["status"]> = {
        ANTIDOTE: "poison", PARALYZEHEAL: "paralysis", AWAKENING: "sleep", BURNHEAL: "burn", ICEHEAL: "freeze",
      };
      const target = cure[def.id];
      if (target && p.status === target) { p.status = null; ok = true; text = `${displayName(p)}의 상태가 나았다!`; }
      else text = `${displayName(p)}에게는 효과가 없었다.`;
    }
    if (ok) {
      removeItem(this.registry, def.id, 1);
      this.registry.set("playerParty", [...this.party]);   // 파티 갱신 알림
      this.choosing = false;
      if (this.idx >= this.lines - 1) this.idx = Math.max(0, this.lines - 2);
    }
    this.msg = text;
    this.render();
  }

  private close(): void {
    this.scene.stop();
    if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
    else if (!this.scene.isActive(this.from)) this.scene.start(this.from);
  }

  // ── 그리기 ────────────────────────────────────────────
  // 가상(512x384) → 화면 좌표
  private X(vx: number): number { return this.offX + vx * this.s; }
  private Y(vy: number): number { return this.offY + vy * this.s; }

  private img(key: string, vx: number, vy: number, crop?: Phaser.Geom.Rectangle): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(key)) return undefined;
    const im = this.add.image(this.X(vx), this.Y(vy), key).setOrigin(0).setScale(this.s);
    if (crop) im.setCrop(crop).setPosition(this.X(vx) - crop.x * this.s, this.Y(vy) - crop.y * this.s);
    this.layer.add(im);
    return im;
  }

  // 원본 폰트(그림자 있는 도트 글씨)를 흉내 — base 색 + 1px 밝은 그림자.
  private txt(vx: number, vy: number, s: string, size: number, color: string, shadow: string, align: "left" | "center" | "right" = "left"): void {
    const originX = align === "left" ? 0 : align === "center" ? 0.5 : 1;
    const t = this.add.text(this.X(vx), this.Y(vy), s, {
      fontFamily: FONT, fontSize: `${Math.round(size * this.s)}px`, color,
    }).setOrigin(originX, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), shadow, 0, false, true);
    this.layer.add(t);
  }

  private render(): void {
    if (this.layer) this.layer.destroy();
    this.layer = this.add.container(0, 0).setDepth(10);
    const { width, height } = this.scale;
    this.s = Math.min(width / VW, height / VH);
    this.offX = Math.round((width - VW * this.s) / 2);
    this.offY = Math.round((height - VH * this.s) / 2);

    // 화면 여백(가상 해상도 비율이 안 맞는 부분)은 어둡게
    this.layer.add(this.add.rectangle(0, 0, width, height, 0x0b0f18).setOrigin(0));

    this.img(`bag_bg_${this.pocket}`, 0, 0);   // 배경 = AR 원본을 크림으로 리컬러한 것
    this.drawLeft();
    this.drawList();
    this.drawBottom();
  }

  // 목록/포켓이름처럼 패널 위에 얹는 글자색. 패널이 아이보리라 원본 회색 글씨는 탁하다 → 갈색조로.
  private get panelText(): [string, string] {
    return ["#6b5a44", "#fff3da"];
  }

  // 왼쪽: 가방 그림 + 선택된 포켓 탭 + 포켓 이름 + 좌우 화살표
  private drawLeft(): void {
    const female = (this.registry.get("playerGender") as string) === "girl";
    const bagKey = female && this.textures.exists(`bag_img_${this.pocket}_f`)
      ? `bag_img_${this.pocket}_f` : `bag_img_${this.pocket}`;
    this.img(bagKey, 30, 20);                                  // 원본: IconSprite(30,20)

    // 포켓 탭 — 원본은 배경(bg_<포켓>)에 8칸이 이미 구워져 있고, 선택된 것 하나만 컬러 아이콘을 덧그린다.
    //  icon_pocket 시트 위쪽 행에서 (p-1)*28 을 잘라 (2+(p-1)*22, 226)에.
    this.img("bag_pocketicons", 2 + (this.pocket - 1) * 22, 226,
      new Phaser.Geom.Rectangle((this.pocket - 1) * 28, 0, 28, 28));

    // 포켓 이름 (94,186 중앙정렬)
    const [base, shadow] = this.panelText;
    this.txt(94, 186, POCKET_NAME[this.pocket] ?? "", 20, base, shadow, "center");

    // 좌우 화살표(8프레임 시트의 첫 프레임만) — 원본 (-4,76) / (150,76)
    this.img("ui_left_arrow", -4, 76, new Phaser.Geom.Rectangle(0, 0, 40, 28));
    this.img("ui_right_arrow", 150, 76, new Phaser.Geom.Rectangle(0, 0, 40, 28));
  }

  // 오른쪽 목록 — 아이템(또는 포켓몬 선택 중이면 파티)
  private drawList(): void {
    const [base, shadow] = this.panelText;
    if (this.choosing) {
      // 회복약을 쓸 포켓몬 고르기 — 같은 줄 규격(32px)에 이름 + HP
      this.party.slice(0, ROWS).forEach((p, j) => {
        if (j === this.partyIdx) this.drawCursor(j);
        this.txt(200, 32 + j * ROW_H, displayName(p), 20, base, shadow);
        this.txt(450, 32 + j * ROW_H, `${Math.max(0, p.currentHp)}/${p.maxHp}`, 20, base, shadow, "right");
      });
      return;
    }
    const list = this.items;
    for (let j = 0; j < ROWS; j++) {
      const i = this.top + j;
      if (i >= this.lines) break;
      if (i === this.idx) this.drawCursor(j);
      if (i === list.length) { this.txt(200, 32 + j * ROW_H, "닫는다", 20, base, shadow); break; }
      const { entry, def } = list[i];
      this.txt(200, 32 + j * ROW_H, def.name, 20, base, shadow);
      this.txt(450, 32 + j * ROW_H, `× ${entry.count}`, 20, base, shadow, "right");
    }
    this.drawSlider();
  }

  // 선택 커서 — 원본 cursor.png(282x68, 위 12px는 투명)를 통째로 얹는다(원본과 같은 방식).
  private drawCursor(j: number): void {
    this.img("bag_cursor", 184, 8 + j * ROW_H);
  }

  // 스크롤 슬라이더(원본 계산식 그대로) — 목록이 7줄을 넘을 때만.
  private drawSlider(): void {
    const rowMax = this.lines;
    if (rowMax <= ROWS) return;
    const K = "bag_slider";
    if (this.top > 0) this.img(K, 470, 16, new Phaser.Geom.Rectangle(0, 0, 36, 38));
    if (this.top + ROWS < rowMax) this.img(K, 470, 228, new Phaser.Geom.Rectangle(0, 38, 36, 38));
    const trackH = 174;
    let boxH = Math.floor(trackH * ROWS / rowMax);
    boxH += Math.min(Math.floor((trackH - boxH) / 2), Math.floor(trackH / 6));
    boxH = Math.max(boxH, 38);
    const y = 54 + Math.floor((trackH - boxH) * this.top / (rowMax - ROWS));
    this.img(K, 470, y, new Phaser.Geom.Rectangle(36, 0, 36, 4));
    for (let i = 0; i * 16 < boxH - 4 - 18; i++) {
      const h = Math.min(boxH - 4 - 18 - i * 16, 16);
      this.img(K, 470, y + 4 + i * 16, new Phaser.Geom.Rectangle(36, 4, 36, h));
    }
    this.img(K, 470, y + boxH - 18, new Phaser.Geom.Rectangle(36, 20, 36, 18));
  }

  // 하단 — 선택 아이템 아이콘(중심 48,336) + 설명문(88,311 / 폭 384)
  private drawBottom(): void {
    const list = this.items;
    const sel = this.idx < list.length ? list[this.idx].def : undefined;   // "닫는다" 줄이면 없음
    if (sel && this.textures.exists(`item_${sel.id}`)) {
      const ic = this.add.image(this.X(48), this.Y(336), `item_${sel.id}`).setOrigin(0.5).setScale(this.s);
      this.layer.add(ic);
    }
    const text = this.msg || (sel ? sel.desc : "가방을 닫는다.");
    const long = text.length > 47;
    const y = long ? 296 : 311;
    // 원본 하단 바는 진회색이라 흰 글씨였지만, 크림은 바가 밝아 흰 글씨가 안 보인다 → 짙은 글씨로.
    //  ⚠️ 여기서 회색(#4a4a55) 글씨를 쓰면 화면 전체가 회색으로 읽힌다 → 반드시 따뜻한 갈색.
    const color = "#6b5a44";
    const shadow = "#fff6e0";
    const t = this.add.text(this.X(88), this.Y(y), text, {
      fontFamily: FONT, fontSize: `${Math.round(18 * this.s)}px`, color,
      wordWrap: { width: 384 * this.s },
      lineSpacing: Math.round(8 * this.s),
    }).setOrigin(0, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), shadow, 0, false, true);
    this.layer.add(t);
  }
}
