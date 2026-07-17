import Phaser from "phaser";
import { Pokemon, displayName } from "../data/Pokemon";

// ─────────────────────────────────────────────────────────────
// 배틀 화면 그리기 (Another Red 원본 에셋 + 원본 좌표)
//
// ★ 이 파일에는 "직접 그린 도형"이 없다. 배경·HP박스·커맨드 버튼·대사창 전부
//   AR 원본 PNG이고, 우리는 AR 루비 스크립트(Scripts.rxdata)에서 뽑은 실제 좌표에 놓기만 한다.
//   근거(AR 소스 좌표):
//     배경   Battlebacks/<bd>_bg(512x288) → (0,0) / <bd>_message(512x96) → (0,288)
//     내 포켓몬(back)  (128,304) 하단중앙 · 상대(front) (384,176) 하단중앙
//     내 HP박스  databox_normal(260x84) → (268,192)   [내부: 이름(310,204) Lv(442,208) HP바(404,232) HP숫자(382,244)]
//     상대 HP박스 databox_normal_foe(260x62) → (-16,36) [내부: 이름(8,48) Lv(140,52) HP바(102,76)]
//     커맨드   overlay_command(512x96) → (0,288) · 버튼(130x46) → (252,294)(378,294)(252,336)(378,336)
//              버튼 시트 cursor_command: 좌열=기본 / 우열(x=130)=선택,  행 = 싸운다0 포켓몬1 가방2 도망3
//     대사창   overlay_message(512x96) → (0,288), 글자 시작 (32,306)
//   HP바: 96px 시트를 hp 비율로 자르고, 색 행(각 6px) = 초록0 / 노랑1(hp ≤ 1/2) / 빨강2(hp ≤ 1/4)
// ─────────────────────────────────────────────────────────────

export const VW = 512, VH = 384;          // AR 화면 해상도(가상 좌표계)

const FONT = "Galmuri11";
const NAME_COLOR = "#484848";             // AR: base (72,72,72)
const NAME_SHADOW = "#b8b8b8";            // AR: shadow (184,184,184)
const MSG_COLOR = "#505058";              // AR: base (80,80,88)
const MSG_SHADOW = "#a0a0a8";             // AR: shadow (160,160,168)

const NUM_W = 16, NUM_H = 14;             // icon_numbers.png (176x14) = 11칸(0~9, 10='/')
const BTN_W = 130, BTN_H = 46;            // cursor_command.png (260x506)
// 커맨드 배치: 화면 2x2 (위: 싸운다·가방 / 아래: 포켓몬·도망). 값 = 버튼 시트의 행 번호.
export const CMD_SLOTS = [
  { row: 0, vx: 252, vy: 294 },   // 싸운다
  { row: 2, vx: 378, vy: 294 },   // 가방
  { row: 1, vx: 252, vy: 336 },   // 포켓몬
  { row: 3, vx: 378, vy: 336 },   // 도망
];

// ── 기술 선택(FIGHT) 메뉴 — AR FightMenu 좌표 그대로 ─────────
//  배경 overlay_fight(512x96) → (0,288). ★ 커맨드창과 반대로 "왼쪽이 어두운 버튼칸 / 오른쪽이 흰 정보칸".
//  버튼 시트 cursor_fight(384x874) = 192x46 버튼 × 19행.
//    행   = 기술 타입의 iconPosition(types.json — 타입 키 순서로 추정하면 틀린다)
//    좌열(x=0)=기본(흰 바탕+타입색 테두리) / 우열(x=192)=선택(타입색 채움)
export const FIGHT_BTN_W = 192, FIGHT_BTN_H = 46;
export const FIGHT_SLOTS = [
  { vx: 4,   vy: 294 },   // 기술1 (좌상)
  { vx: 192, vy: 294 },   // 기술2 (우상)
  { vx: 4,   vy: 336 },   // 기술3 (좌하)
  { vx: 192, vy: 336 },   // 기술4 (우하)
];
export const TYPE_ICON_W = 64, TYPE_ICON_H = 28;   // Graphics/UI/types.png (64x560 = 28px × 20행)

// ── 대사창 "계속" 화살표 (AR 원본 pause_arrow) ────────────────
//  근거(AR 소스): Window_AdvancedTextPokemon#allocPause
//    @pausesprite = AnimatedSprite.create("Graphics/UI/pause_arrow", 4, 3)
//      → 4프레임 · frameskip 3 = 3/20초 = 150ms/프레임 (AnimatedSprite: "frameskip is in 1/20ths of a second")
//  위치는 moveCursor의 cursorMode = MessageConfig::CURSOR_POSITION = 1 ("Lower right"):
//    x = 창.x + 창.width  - 40 + 프레임폭/2  = 0   + 512 - 40 + 10 = 482
//    y = 창.y + 창.height - 60 + 프레임높이/2 = 288 + 96  - 60 + 14 = 338
//  (창 = pbBottomLeftLines(msgwindow, 2) → x 0 / width 512 / height borderY 32 + 2*32 = 96 / y 384-96 = 288
//   = overlay_message.png 512x96 을 (0,288)에 놓은 우리 대사창과 정확히 같은 사각형)
export const PAUSE_W = 20, PAUSE_H = 28;           // pause_arrow.png (80x28) = 20x28 × 4프레임
export const PAUSE_VX = 482, PAUSE_VY = 338;       // 위 계산값 (가상좌표)
export const PAUSE_MS = 150;                       // 프레임당 150ms → 4프레임 한 바퀴 600ms

// ⚠️ 타입 아이콘 시트는 20행인데 기술 버튼 시트는 19행뿐이다(스텔라 = iconPosition 19 → 버튼 그림이 없다).
//   그대로 자르면 시트 바깥을 잘라 버튼이 통째로 안 보인다 → 버튼 행만 노말(0)로 떨군다.
const FIGHT_ROWS = 19;
export function fightRow(iconPosition: number): number {
  return iconPosition >= 0 && iconPosition < FIGHT_ROWS ? iconPosition : 0;
}

// 선택한 기술의 PP 글자색 — AR FightMenu::PP_COLORS. 남은 PP 비율 4단계.
//  단계 = min(ceil(4 * pp / maxPp), 3)  → 0:PP0(빨강) 1:1/4이하(주황) 2:1/2이하(노랑) 3:그 이상(기본색)
export const PP_COLORS: [string, string][] = [
  ["#f84848", "#883030"],
  ["#f88820", "#904818"],
  ["#f8c000", "#906800"],
  ["#505058", "#a0a0a8"],
];
export function ppStage(pp: number, maxPp: number): number {
  if (maxPp <= 0) return 3;
  return Math.min(Math.ceil((4 * pp) / maxPp), 3);
}

// 기술명 글자색 = 그 버튼 그림의 "타입 테두리색"을 그대로 뽑아 쓴다(AR과 같은 발상 — 지어낸 색표 없음).
//  ⚠️ AR 원본은 (10, row*46+34)를 샘플하지만, 이 버튼 그림은 왼쪽 모서리가 사선이라 그 점이 투명이다.
//     같은 테두리가 지나가는 버튼 세로중앙 (12, row*46+23)에서 뽑는다(색은 동일).
//  getPixel은 호출할 때마다 시트(384x874) 전체를 캔버스에 다시 그린다 → 행마다 한 번만 뽑아 캐시한다.
const nameColors = new Map<number, string>();
export function moveNameColor(scene: Phaser.Scene, sheetKey: string, row: number): string {
  const hit = nameColors.get(row);
  if (hit) return hit;
  const c = scene.textures.getPixel(12, row * FIGHT_BTN_H + 23, sheetKey);
  if (!c) return MSG_COLOR;                      // 텍스처가 아직 없으면 캐시하지 않는다
  const hex = `#${c.color.toString(16).padStart(6, "0")}`;
  nameColors.set(row, hex);
  return hex;
}

// 화면 채우기 = cover (사용자 확정 2026-07-14, 시안 A안).
//  배경을 화면 가득 채우고(비율 유지, 넘치는 부분만 잘림) 검은 여백을 남기지 않는다.
//  UI는 원본 비율 그대로 두되 "화면 가장자리"에 붙인다(아래 XL/XR).
export class BattleView {
  s = 1; offY = 0;   // 가상좌표 → 화면 변환

  constructor(private scene: Phaser.Scene) { this.measure(); }

  measure(): void {
    // 세로를 화면에 맞추고, 가로는 "화면 가장자리 기준"으로 배치한다(아래 XL/XR).
    //  ⚠️ AR 레이아웃은 화면이 딱 512px인 걸 전제로 HP박스를 화면 밖으로 살짝 흘려보낸다
    //     (상대 x=-16, 내 것은 오른쪽으로 넘침). 512짜리 판을 화면 한가운데 띄우면
    //     그 '흘림'이 허공에서 잘려 보인다 → 반드시 화면 좌우 끝에 붙여야 원본처럼 보인다.
    this.s = this.scene.scale.height / VH;
    this.offY = 0;
  }

  private get W(): number { return this.scene.scale.width; }

  // 가로 좌표 3종 — 어디에 붙일지에 따라 다르다.
  XL(vx: number): number { return vx * this.s; }                      // 화면 왼쪽 기준 (상대 HP박스, 대사 글자)
  XR(vx: number): number { return this.W - (VW - vx) * this.s; }      // 화면 오른쪽 기준 (내 HP박스, 커맨드 버튼)
  XC(vx: number): number { return this.W * (vx / VW); }               // 화면 비율 기준 (포켓몬 스프라이트 — 배경 발판을 따라간다)
  X(vx: number): number { return this.XL(vx); }
  Y(vy: number): number { return this.offY + vy * this.s; }
  get barW(): number { return this.W; }   // 하단 바 = 화면 폭 전체

  // 배경: AR 배틀백(bg 512x288 + message 512x96). 아무것도 그리지 않는다 — 원본 PNG 그대로.
  drawBackdrop(into: Phaser.GameObjects.Container, bgKey: string, msgKey: string): void {
    const { width, height } = this.scene.scale;
    // 배경은 화면을 가득(비율 유지, 넘치는 부분만 잘림) → 검은 여백 없음.
    const bs = Math.max(width / VW, height / 288);
    into.add(this.scene.add.image(width / 2, (288 / 2) * this.s, bgKey).setOrigin(0.5).setScale(bs));
    // 하단 바 — 화면 폭을 꽉 채운다(세로는 원본 비율 96px).
    const bar = this.scene.add.image(0, this.Y(288), msgKey).setOrigin(0);
    bar.setDisplaySize(this.barW, 96 * this.s);
    into.add(bar);
  }

  // 하단 바에 얹는 오버레이(대사창·커맨드창)도 화면 폭을 채운다.
  bottomOverlay(into: Phaser.GameObjects.Container, key: string): void {
    const im = this.scene.add.image(0, this.Y(288), key).setOrigin(0);
    im.setDisplaySize(this.barW, 96 * this.s);
    into.add(im);
  }

  // 글자(도트 폰트 + 1px 그림자) — AR 텍스트 색 그대로.
  text(into: Phaser.GameObjects.Container, vx: number, vy: number, s: string, size: number,
       color = NAME_COLOR, shadow = NAME_SHADOW, align: "left" | "center" | "right" = "left"): Phaser.GameObjects.Text {
    const ox = align === "left" ? 0 : align === "center" ? 0.5 : 1;
    const t = this.scene.add.text(this.X(vx), this.Y(vy), s, {
      fontFamily: FONT, fontSize: `${Math.round(size * this.s)}px`, color,
    }).setOrigin(ox, 0);
    t.setShadow(Math.max(1, this.s), Math.max(1, this.s), shadow, 0, false, true);
    into.add(t);
    return t;
  }

  // icon_numbers 시트로 숫자 찍기(레벨·HP 숫자). AR과 같은 그림.
  //  align: left = vx부터 오른쪽으로, right = vx에서 끝나게.
  numbers(into: Phaser.GameObjects.Container, vx: number, vy: number, str: string, align: "left" | "right" = "left"): void {
    const chars = [...str];
    const startX = align === "left" ? vx : vx - chars.length * NUM_W;
    chars.forEach((c, i) => {
      const idx = c === "/" ? 10 : Number(c);
      if (Number.isNaN(idx)) return;
      const im = this.scene.add.image(this.X(startX + i * NUM_W), this.Y(vy), "bt_icon_numbers")
        .setOrigin(0).setScale(this.s)
        .setCrop(idx * NUM_W, 0, NUM_W, NUM_H);
      // setCrop은 원본 좌표 기준이라, 잘라낸 만큼 위치를 되돌려 준다.
      im.setPosition(this.X(startX + i * NUM_W) - idx * NUM_W * this.s, this.Y(vy));
      into.add(im);
    });
  }
}

// HP박스 하나 (내 것 / 상대 것) — AR databox 그림 위에 이름·Lv·HP바·HP숫자를 원본 좌표로 얹는다.
export class DataBox {
  private layer: Phaser.GameObjects.Container;
  displayHp: number;

  constructor(
    private scene: Phaser.Scene,
    private view: BattleView,
    private mon: Pokemon,
    private isAlly: boolean,
  ) {
    this.displayHp = mon.currentHp;
    this.layer = scene.add.container(0, 0).setDepth(150);
    this.redraw();
  }

  setMon(mon: Pokemon): void { this.mon = mon; this.displayHp = mon.currentHp; this.redraw(); }
  destroy(): void { this.layer.destroy(); }

  redraw(): void {
    const v = this.view;
    this.layer.removeAll(true);
    // 박스 그림 + 내부 좌표 (AR 원본 그대로).
    //  ★ 내 박스는 화면 오른쪽 끝(XR), 상대 박스는 화면 왼쪽 끝(XL)에 붙인다.
    //    AR은 화면이 512라 박스가 화면 밖으로 살짝 흘러나가며 가장자리에 잘리는데,
    //    와이드에서 가운데에 띄우면 그 흘림이 허공에서 잘려 보인다.
    const X = (vx: number) => (this.isAlly ? v.XR(vx) : v.XL(vx));
    const boxX = this.isAlly ? 268 : -16;
    const boxY = this.isAlly ? 192 : 36;
    const baseX = this.isAlly ? 34 : 16;          // AR @spriteBaseX
    const key = this.isAlly ? "bt_databox_normal" : "bt_databox_normal_foe";
    this.layer.add(this.scene.add.image(X(boxX), v.Y(boxY), key).setOrigin(0).setScale(v.s));

    const nameX = boxX + baseX + 8, nameY = boxY + 12;
    this.txt(X(nameX), v.Y(nameY), displayName(this.mon), 15);

    // Lv 표식 + 레벨 숫자
    this.layer.add(this.scene.add.image(X(boxX + baseX + 140), v.Y(boxY + 16), "bt_overlay_lv")
      .setOrigin(0).setScale(v.s));
    this.nums(X(boxX + baseX + 162), v.Y(boxY + 16), String(this.mon.level));

    // HP바 — 96px 시트를 비율만큼 자르고, 색은 행(6px)으로 고른다.
    const hpX = boxX + baseX + 102, hpY = boxY + 40;
    const ratio = Math.max(0, this.displayHp) / this.mon.maxHp;
    const w = Math.round((96 * ratio) / 2) * 2;                        // AR: 2px 단위
    const color = this.displayHp <= this.mon.maxHp / 4 ? 2 : this.displayHp <= this.mon.maxHp / 2 ? 1 : 0;
    if (w > 0) {
      const bar = this.scene.add.image(X(hpX), v.Y(hpY), "bt_overlay_hp").setOrigin(0).setScale(v.s);
      bar.setCrop(0, color * 6, w, 6);
      bar.setPosition(X(hpX), v.Y(hpY) - color * 6 * v.s);
      this.layer.add(bar);
    }

    // HP 숫자는 내 포켓몬만 (AR도 플레이어측만 표시)
    if (this.isAlly) {
      const nx = boxX + baseX + 80, ny = boxY + 52;
      const cur = String(Math.max(0, Math.ceil(this.displayHp)));
      this.nums(X(nx + 54), v.Y(ny + 2), cur, "right");
      this.nums(X(nx + 54), v.Y(ny + 2), "/", "left");
      this.nums(X(nx + 70), v.Y(ny + 2), String(this.mon.maxHp), "left");
    }
  }

  // 아래 두 개는 화면좌표(px)를 직접 받는다 — 박스마다 좌/우 앵커가 다르기 때문.
  private txt(x: number, y: number, s: string, size: number): void {
    const v = this.view;
    const t = this.scene.add.text(x, y, s, {
      fontFamily: "Galmuri11", fontSize: `${Math.round(size * v.s)}px`, color: "#484848",
    }).setOrigin(0);
    t.setShadow(Math.max(1, v.s), Math.max(1, v.s), "#b8b8b8", 0, false, true);
    this.layer.add(t);
  }
  private nums(x: number, y: number, str: string, align: "left" | "right" = "left"): void {
    const v = this.view;
    const chars = [...str];
    const startX = align === "left" ? x : x - chars.length * 16 * v.s;
    chars.forEach((c, i) => {
      const idx = c === "/" ? 10 : Number(c);
      if (Number.isNaN(idx)) return;
      const im = this.scene.add.image(startX + i * 16 * v.s, y, "bt_icon_numbers").setOrigin(0).setScale(v.s);
      im.setCrop(idx * 16, 0, 16, 14);
      im.setPosition(startX + i * 16 * v.s - idx * 16 * v.s, y);
      this.layer.add(im);
    });
  }

  // HP를 현재값까지 부드럽게 깎으며 갱신
  animateTo(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this, displayHp: this.mon.currentHp, duration: 500, ease: "Sine.inOut",
        onUpdate: () => this.redraw(),
        onComplete: () => { this.displayHp = this.mon.currentHp; this.redraw(); resolve(); },
      });
    });
  }
}
