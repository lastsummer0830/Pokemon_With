import Phaser from "phaser";
import { Pokemon, displayName, caughtBallOf } from "../data/Pokemon";
import { PETTED_KEY } from "../systems/bond";
import { iconPath, makePartyIcon } from "../game/pokemonSprite";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";
import { saveGame } from "../systems/save";

// 인게임 스타트 메뉴 (오버레이). 필드(WorldScene 등)에서 Enter/X로 연다.
//  상태: main(하단 바: 도감/포켓몬/가방/저장/설정) → party(파티 목록).
//  한 마리 상세는 이 씬이 아니라 별도 오버레이 씬(SummaryScene)이 담당한다.
const FONT = "Galmuri11";

// UI 테마(사용자가 Pick에서 고른 뒤 registry 'uiTheme'로 고정). 기본 = navy(HGSS).
interface Theme { border: number; body: number; line: number; accent: string; text: string; sub: string }
const THEMES: Record<string, Theme> = {
  navy:  { border: 0xf6efd8, body: 0x21314f, line: 0x4a6aa5, accent: "#ffe27a", text: "#ffffff", sub: "#cfe0ff" }, // HGSS 남색+크림
  paper: { border: 0xc98a3c, body: 0xf3e4c8, line: 0xe0b878, accent: "#b5651d", text: "#3a2a14", sub: "#7a5a2c" }, // 따뜻한 종이질(밝은 패널·어두운 글씨)
  dark:  { border: 0x3a4560, body: 0x161b28, line: 0x5a6a8a, accent: "#7ec7ff", text: "#e8edf7", sub: "#9fb3d8" }, // 다크 슬레이트+시안
};

type MenuState = "main" | "party";
interface MenuInit {
  from?: string;
  // "switch" = 배틀에서 교체할 포켓몬 고르기. 파티 화면으로 바로 들어가고, 고르면 onPick으로 그 칸을 돌려준다.
  //  (배틀 전용 파티 화면을 새로 만들지 않고 이 화면을 그대로 재사용한다 — 가방(BagScene)과 같은 방식.)
  mode?: "field" | "switch";
  canCancel?: boolean;              // switch 전용. false = 기절해서 강제 교체라 취소할 수 없다.
  onPick?: (idx: number) => void;   // switch 전용. 고른 파티 칸(취소면 -1).
}

export default class MenuScene extends Phaser.Scene {
  private from = "WorldScene";
  private mode: "field" | "switch" = "field";
  private canCancel = true;
  private onPick?: (idx: number) => void;
  private party: Pokemon[] = [];
  private state: MenuState = "main";
  private idx = 0;
  private layer!: Phaser.GameObjects.Container;
  private dim?: Phaser.GameObjects.Rectangle;
  private t: Theme = THEMES.navy;

  // 시안 A(하단 상시 바) — 사용자 확정 디자인(01_Resources/Pick/메뉴UI/시안A). 아이콘은 그 시안에서 추출.
  private readonly MAIN_ITEMS = ["도감", "포켓몬", "가방", "저장", "설정"];
  private readonly MAIN_ICONS = ["ic_dex", "ic_ball", "ic_bag", "ic_save", "ic_set"];

  constructor() { super("MenuScene"); }

  init(data: MenuInit): void {
    this.from = data?.from ?? "WorldScene";
    this.mode = data?.mode ?? "field";
    this.canCancel = data?.canCancel ?? true;
    this.onPick = data?.onPick;
    // 쓰다듬기 제한(연타 방지)은 상세화면(SummaryScene)과 공유한다. 메뉴를 새로 열 때만 여기서 리셋(세션 단위).
    this.registry.set(PETTED_KEY, new Set<Pokemon>());
    if (this.mode === "switch") {
      this.state = "party";   // 교체는 하단 바를 거치지 않고 파티 화면부터
      this.idx = 0;
    } else {
      this.state = "main";
      this.idx = 1;   // 시안 A: 기본 선택 = 포켓몬(가운데)
    }
  }

  preload(): void {
    preloadCommonAudio(this);
    this.party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    for (const p of this.party) {
      const key = "icon_" + p.speciesId;
      if (!this.textures.exists(key)) this.load.image(key, iconPath(p.speciesId));
      // 잡은 볼 아이콘(파티 마커용) — item_<ball>. 볼 아이콘 뜨는 곳에 그 포켓몬을 담은 볼로 표시(태스크4).
      const ball = caughtBallOf(p);
      const bk = "item_" + ball;
      if (!this.textures.exists(bk)) this.load.image(bk, `assets/items/${ball}.png`);
    }
    // AR 파티 UI 원본 에셋을 그대로 합성한다(눈대중 재현 금지 — game-ui.md 3번).
    //  bg=512x384 배경(6칸 홈 구워짐), panel_*=256x98 컬러패널, overlay_*=HP바/Lv 태그, icon_ball=44x56.
    const P = "assets/ui/party/";
    //  선택 패널은 레퍼런스가 '파랑+빨강테'라 내가 만든 blue_sel을 쓴다(원본 _sel은 초록+빨강테).
    for (const f of ["bg",
      "panel_rect", "panel_round", "panel_rect_swap_sel2", "panel_round_swap_sel2",
      "panel_rect_faint", "panel_round_faint",
      "overlay_hp_back", "overlay_hp", "overlay_lv",
      "icon_ball", "icon_ball_sel"]) {
      const k = "pui_" + f;
      if (!this.textures.exists(k)) this.load.image(k, P + f + ".png");
    }
    // 하단 바 아이콘(시안 A에서 추출한 도트) — assets/ui/menu/ic_*.png
    for (const k of this.MAIN_ICONS)
      if (!this.textures.exists(k)) this.load.image(k, `assets/ui/menu/${k}.png`);
  }

  create(): void {
    this.party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    this.t = THEMES[(this.registry.get("uiTheme") as string) ?? "navy"] ?? THEMES.navy;
    const { width, height } = this.scale;
    this.dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setDepth(0);

    // 도트(픽셀) UI 텍스처는 NEAREST로 — 안 하면 확대 시 뭉개져서 테두리가 지저분해진다(스킬 지침).
    this.textures.getTextureKeys().forEach((k) => {
      if (k.startsWith("pui_") || k.startsWith("icon_") || k.startsWith("ic_") || k.startsWith("item_")) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
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
    // 하단 바(main)는 시안 A대로 월드를 딤 없이 그대로 보여준다. 전체화면 파티만 딤.
    this.dim?.setVisible(this.state !== "main");
    if (this.state === "main") this.renderMain();
    else this.renderParty();
  }

  // 방향 이동. 파티는 2열 그리드(좌우=열 이동, 상하=행 이동), 메인(하단 바)은 좌우.
  private nav(dir: "up" | "down" | "left" | "right"): void {
    if (this.state === "main") {
      const n = this.MAIN_ITEMS.length;
      if (dir === "left") this.idx = (this.idx - 1 + n) % n;   // 하단 바 = 좌우 이동
      else if (dir === "right") this.idx = (this.idx + 1) % n;
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
      // 도감·가방은 별도 씬(오버레이). 메뉴는 멈춰 두고, 돌아오면 다시 살아난다.
      else if (item === "도감") { this.scene.pause(); this.scene.launch("PokedexScene", { from: "MenuScene" }); }
      else if (item === "가방") { this.scene.pause(); this.scene.launch("BagScene", { from: "MenuScene" }); }
      else if (item === "저장") { saveGame(this.registry); this.toast("저장했다!"); }
      else if (item === "설정") { this.toast("설정은 준비 중이야."); }
    } else if (this.state === "party") {
      if (!this.party.length) return;
      // 교체 모드 — 상세로 안 들어가고 고른 칸을 배틀에 돌려준다.
      //  못 내보내는 포켓몬(이미 나와 있음·기절)인지는 배틀이 판단해 이유를 말해준다.
      if (this.mode === "switch") { this.pick(this.idx); return; }
      // 필드 모드 = 고른 포켓몬 상세(Summary) 오버레이를 연다(도감·가방과 같은 pause+launch 관용구).
      this.scene.pause(); this.scene.launch("SummaryScene", { party: this.party, index: this.idx, from: "MenuScene" });
    }
  }

  private cancel(): void {
    // 교체 모드는 파티 화면 하나뿐이라, 취소 = 배틀에 "안 고름(-1)"을 돌려주는 것.
    if (this.mode === "switch") {
      // 기절해서 강제로 교체하는 중이면 취소가 안 된다(반드시 골라야 한다).
      if (!this.canCancel) return;
      playSfx(this, SFX.cancel, 0.4);
      this.pick(-1);
      return;
    }
    playSfx(this, SFX.cancel, 0.4);
    if (this.state === "main") this.close();
    else { this.state = "main"; this.idx = 1; this.renderState(); }   // 파티 → 하단 바로 되돌아감
  }

  // 교체 모드에서 결과를 돌려주고 닫는다.
  private pick(i: number): void {
    const cb = this.onPick;
    this.onPick = undefined;   // 두 번 부르지 않게(닫히는 도중 키가 또 들어올 수 있다)
    this.close();
    cb?.(i);
  }

  private close(): void {
    this.scene.stop();
    if (this.scene.isPaused(this.from)) this.scene.resume(this.from);
    else if (!this.scene.isActive(this.from)) this.scene.start(this.from);
  }

  private txt(x: number, y: number, s: string, size: number, color?: string, origin = 0): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: color ?? this.t.text }).setOrigin(origin, 0);
    this.layer.add(t); return t;
  }

  // 시안 A: 하단 상시 바. 크림 테두리+남색 본문, 5칸(도감·포켓몬·가방·저장·설정),
  //  선택칸=노란 하이라이트 박스에 아이콘 크게(라벨 숨김), 나머지=아이콘+라벨.
  private renderMain(): void {
    const { width, height } = this.scale;
    const barH = Math.max(76, Math.round(height * 0.135));
    const m = Math.max(12, Math.round(width * 0.012));
    const barW = width - m * 2;
    const bx = m, by = height - barH - m;

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(bx + 3, by + 6, barW, barH, 14);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(bx, by, barW, barH, 14);        // 크림 테두리
    g.fillStyle(0x222f43, 1); g.fillRoundedRect(bx + 5, by + 5, barW - 10, barH - 10, 10); // 남색 본문
    this.layer.add(g);

    const slotW = barW / this.MAIN_ITEMS.length;
    const labelFs = Math.max(14, Math.round(barH * 0.2));
    this.MAIN_ITEMS.forEach((label, i) => {
      const cx = bx + slotW * (i + 0.5);
      const sel = i === this.idx;
      const iconKey = this.MAIN_ICONS[i];
      if (sel) {
        const hw = slotW * 0.84, hh = barH * 0.78;
        const hg = this.add.graphics();
        hg.fillStyle(0x000000, 0.25); hg.fillRoundedRect(cx - hw / 2 + 2, by + barH * 0.13, hw, hh, 12);
        hg.fillStyle(0xffe27a, 1); hg.fillRoundedRect(cx - hw / 2, by + barH * 0.11, hw, hh, 12);
        this.layer.add(hg);
      }
      if (this.textures.exists(iconKey)) {
        const tex = this.textures.get(iconKey).getSourceImage();
        const target = sel ? barH * 0.5 : barH * 0.42;    // 선택칸 아이콘은 조금 더 크게
        const sc = target / Math.max(tex.width, tex.height);
        const iy = sel ? by + barH * 0.5 : by + barH * 0.4;
        const ic = this.add.image(cx, iy, iconKey).setOrigin(0.5).setScale(sc);
        this.layer.add(ic);
      }
      if (!sel) this.txt(cx, by + barH * 0.68, label, labelFs, this.t.text, 0.5);
    });
  }

  // 외곽선 있는 흰 글씨(AR 파티창 폰트 느낌 — bold 아님 + 가는 검은 외곽선).
  private otext(x: number, y: number, s: string, size: number, color = "#ffffff", origin = 0): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${Math.round(size)}px`, color,
      stroke: "#173026", strokeThickness: Math.max(1, Math.round(size * 0.09)),
    }).setOrigin(origin, 0);
    this.layer.add(t); return t;
  }

  // AR 파티 화면 재현 — 원본 에셋(bg/패널/overlay/볼)을 원본 픽셀 좌표에 그대로 합성.
  //  DS 512x384 가상 레이아웃을 균일 스케일해 중앙 배치(늘리지 않음 → 와이드 화면에서도 비율 유지).
  private renderParty(): void {
    const { width, height } = this.scale;
    const VW = 512, VH = 384;
    const barH = Math.max(46, Math.round(height * 0.11));   // 하단 메시지바 높이
    const s = Math.min(width / VW, (height - barH) / VH);   // 가로/세로 중 작은 배율(contain)
    const offX = Math.round((width - VW * s) / 2);
    // 슬롯 블록(≈native y0~320)이 위로만 몰려 하단이 비지 않게, 재생영역 세로 중앙에 배치(AR도 상하 여백 있음).
    const offY = Math.max(0, Math.round(((height - barH) - 320 * s) / 2));

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
    // 패널: 초록(기본) / 파랑+흰+빨강테(선택 = AR 공식 swap_sel2, 레퍼런스와 동일) / 회색(기절). 선두=round.
    const key = faint ? (lead ? "pui_panel_round_faint" : "pui_panel_rect_faint")
      : sel ? (lead ? "pui_panel_round_swap_sel2" : "pui_panel_rect_swap_sel2")
        : (lead ? "pui_panel_round" : "pui_panel_rect");
    if (this.textures.exists(key)) this.layer.add(this.add.image(x, y, key).setOrigin(0).setScale(s));

    // 포켓몬 아이콘 — AR처럼 패널 좌측을 '크게' 채우며 세로 중앙쯤.
    //  로컬 62px 박스: 선두(round)는 중심 x=48(→17..79), 나머지는 중심 x=42(→11..73). 세로 17..79.
    const ballX = lead ? 34 : 28;
    const ik = "icon_" + p.speciesId;
    if (this.textures.exists(ik)) {
      const [ix, iy] = L(ballX + 14, 48);
      const ic = makePartyIcon(this, ik, ix, iy, s * 62 / 64); ic.setOrigin(0.5); this.layer.add(ic);
    }

    // 볼 마커 — 그 포켓몬을 '담은 볼'(caughtBall) 종류. 전엔 아이콘 뒤(좌하단)라 선두 칸에선 거의 안 보였다.
    //  → 패널 하단의 실제 빈 구역으로 옮긴다(눈대중 아님, 원본 패널 256x98 픽셀로 측정):
    //    Lv 태그/숫자는 x≤50, 포켓몬 아이콘은 x≤79, HP 수치("999 / 999"도) 는 x≥133에서 시작 →
    //    x 82..108 · y 64..90 이 어느 요소와도 안 겹치는 자리. Lv 태그(y70~84)와 높이도 맞는다.
    //  아이콘 다음에 그려 항상 위로 오게 하고, 26px로 맞춰 볼 색이 바로 구분되게 한다.
    //  잡은 볼 아이콘(item_*, 48x48)이 없으면 옛 AR 파티 볼(pui_icon_ball, 44x56)로 폴백.
    const ballItemKey = "item_" + caughtBallOf(p);
    const ballKey = this.textures.exists(ballItemKey) ? ballItemKey : (sel ? "pui_icon_ball_sel" : "pui_icon_ball");
    if (this.textures.exists(ballKey)) {
      const [bx, by] = L(95, 77);
      const src = this.textures.get(ballKey).getSourceImage() as HTMLImageElement;
      const bs = s * 26 / Math.max(1, src.width, src.height);   // 긴 변을 26 로컬px에 맞춤
      this.layer.add(this.add.image(bx, by, ballKey).setOrigin(0.5).setScale(bs));
    }

    // 이름(상단, 포켓몬 오른쪽) + 성별(우상). 상단 여백 두고 안쪽에(튀어나오지 않게).
    this.otext(x + 100 * s, y + 11 * s, displayName(p), 18 * s);
    if (p.gender) {
      const gs = p.gender === "female" ? "♀" : "♂";
      const gc = p.gender === "female" ? "#f06898" : "#5aa8f0";
      this.otext(x + 238 * s, y + 12 * s, gs, 16 * s, gc, 1);
    }

    // HP바: 원본 overlay_hp_back(138x14) 프레임 + 안쪽 groove(로컬 x28~129, y4~10)에 색 채움.
    if (this.textures.exists("pui_overlay_hp_back")) {
      const [hx, hy] = L(92, 40);
      this.layer.add(this.add.image(hx, hy, "pui_overlay_hp_back").setOrigin(0).setScale(s));
      const ratio = Math.max(0, Math.min(1, p.currentHp / p.maxHp));
      const col = ratio > 0.5 ? 0x60f860 : ratio > 0.2 ? 0xf8d800 : 0xf85858; // 원본 overlay_hp 3색
      const [fx, fy] = L(92 + 28, 40 + 4);
      const g = this.add.graphics();
      g.fillStyle(col, 1); g.fillRect(fx, fy, 101 * s * ratio, 6 * s);
      this.layer.add(g);
    }
    // HP 수치(HP바 아래 우측) — AR는 이름보다 큼(크게).
    this.otext(x + 238 * s, y + 55 * s, `${Math.max(0, p.currentHp)} / ${p.maxHp}`, 23 * s, "#ffffff", 1);

    // Lv 태그 + 레벨 숫자(좌하 밴드 — 패널 안쪽 유지, 바닥 밖으로 안 나가게).
    if (this.textures.exists("pui_overlay_lv")) {
      const [vx, vy] = L(8, 70);
      this.layer.add(this.add.image(vx, vy, "pui_overlay_lv").setOrigin(0).setScale(s));
    }
    this.otext(x + 32 * s, y + 68 * s, `${p.level}`, 15 * s);
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
