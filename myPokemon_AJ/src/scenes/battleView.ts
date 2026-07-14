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

// 한국어 조사 — 마지막 글자의 받침 유무로 고른다. (kind 문자열은 [받침있음, 받침없음] 순서!)
export function josa(word: string, kind: "은는" | "이가" | "을를"): string {
  const last = word.charCodeAt(word.length - 1);
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return hasBatchim ? kind[0] : kind[1];
}
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

// 화면 채우기 방식 — 시안 2안.
//  cover  = 배경을 화면 가득(잘림 허용), UI는 원본 비율로 가운데 4:3 영역에 (검은 여백 없음)
//  contain= 화면 전체를 원본 4:3 비율로 (좌우 검은 여백)
export type Fit = "cover" | "contain";

export class BattleView {
  s = 1; offX = 0; offY = 0;   // 가상좌표 → 화면 변환

  constructor(private scene: Phaser.Scene, private fit: Fit) { this.measure(); }

  measure(): void {
    const { width, height } = this.scene.scale;
    if (this.fit === "contain") {
      // 원본 4:3을 통째로 화면 안에 (좌우 검은 여백)
      this.s = Math.min(width / VW, height / VH);
      this.offX = Math.round((width - VW * this.s) / 2);
      this.offY = Math.round((height - VH * this.s) / 2);
    } else {
      // 와이드: 세로를 화면에 맞추고, 가로는 "화면 가장자리 기준"으로 배치한다(아래 XL/XR).
      //  ⚠️ AR 레이아웃은 화면이 딱 512px인 걸 전제로 HP박스를 화면 밖으로 살짝 흘려보낸다
      //     (상대 x=-16, 내 것은 오른쪽으로 넘침). 512짜리 판을 화면 한가운데 띄우면
      //     그 '흘림'이 허공에서 잘려 보인다 → 반드시 화면 좌우 끝에 붙여야 원본처럼 보인다.
      this.s = height / VH;
      this.offX = 0;
      this.offY = 0;
    }
  }

  private get W(): number { return this.scene.scale.width; }

  // 가로 좌표 3종 — 어디에 붙일지에 따라 다르다.
  XL(vx: number): number {   // 화면 왼쪽 기준 (상대 HP박스, 대사 글자)
    return this.fit === "contain" ? this.offX + vx * this.s : vx * this.s;
  }
  XR(vx: number): number {   // 화면 오른쪽 기준 (내 HP박스, 커맨드 버튼) — 원본에서 오른쪽 끝까지의 거리를 유지
    return this.fit === "contain" ? this.offX + vx * this.s : this.W - (VW - vx) * this.s;
  }
  XC(vx: number): number {   // 화면 비율 기준 (포켓몬 스프라이트 — 배경 발판 위치를 따라간다)
    return this.fit === "contain" ? this.offX + vx * this.s : this.W * (vx / VW);
  }
  X(vx: number): number { return this.XL(vx); }
  Y(vy: number): number { return this.offY + vy * this.s; }
  get barW(): number { return this.fit === "contain" ? VW * this.s : this.W; }   // 하단 바 = 화면 폭 전체

  // 배경: AR 배틀백(bg 512x288 + message 512x96). 아무것도 그리지 않는다 — 원본 PNG 그대로.
  drawBackdrop(into: Phaser.GameObjects.Container, bgKey: string, msgKey: string): void {
    const { width, height } = this.scene.scale;
    if (this.fit === "cover") {
      // 배경은 화면을 가득(비율 유지, 넘치는 부분만 잘림) → 검은 여백 없음.
      const bs = Math.max(width / VW, height / 288);
      into.add(this.scene.add.image(width / 2, (288 / 2) * this.s, bgKey).setOrigin(0.5).setScale(bs));
    } else {
      into.add(this.scene.add.image(this.X(0), this.Y(0), bgKey).setOrigin(0).setScale(this.s));
    }
    // 하단 바 — 화면 폭을 꽉 채운다(세로는 원본 비율 96px).
    const bar = this.scene.add.image(this.fit === "contain" ? this.offX : 0, this.Y(288), msgKey).setOrigin(0);
    bar.setDisplaySize(this.barW, 96 * this.s);
    into.add(bar);
  }

  // 하단 바에 얹는 오버레이(대사창·커맨드창)도 화면 폭을 채운다.
  bottomOverlay(into: Phaser.GameObjects.Container, key: string): void {
    const im = this.scene.add.image(this.fit === "contain" ? this.offX : 0, this.Y(288), key).setOrigin(0);
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
