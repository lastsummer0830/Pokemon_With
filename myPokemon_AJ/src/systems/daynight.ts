import Phaser from "phaser";

// 밤낮(시간 흐름) — "지금 게임 세계가 몇 시인가"를 한 곳에서 정한다.
//
// 왜 필요한가:
//   원본(Another Red = Pokémon Essentials)은 **실제 시계**를 그대로 쓴다. 그래서 배틀 배경도
//   `route_bg / route_eve_bg / route_night_bg`처럼 시간대별 그림이 따로 있다(원본 Battlebacks에 42장).
//   우리 게임엔 그 개념이 아예 없어서 언제 켜도 항상 대낮이었다.
//
// 설계 원칙:
//   - **세이브에 시간을 저장하지 않는다.** 실제 시계(new Date())를 읽을 뿐이라 저장할 게 없다
//     (원본과 같은 방식이고, 세이브 버전을 올릴 필요도 없다).
//   - 화면을 어둡게 하는 건 **야외(WorldScene)만**. 실내는 원본도 조명이 있는 것으로 친다.
//   - 디버그·검증용으로 시간대를 강제할 수 있어야 한다(밤을 보려고 밤까지 기다릴 순 없다).

type Reg = Phaser.Data.DataManager;

/** 하루의 네 구간. 경계는 Essentials(원본 엔진)의 기본값과 같다. */
export type TimeBand = "morning" | "day" | "evening" | "night";

/** 화면에 보여줄 이름(디버그 표시·확인 항목용). */
export const BAND_LABEL: Record<TimeBand, string> = {
  morning: "아침",
  day: "낮",
  evening: "저녁",
  night: "밤",
};

/**
 * 이 시각(0~23시)은 어느 구간인가.
 *  아침 5~9시 · 낮 10~16시 · 저녁 17~19시 · 밤 20~4시 (원본 엔진 기본 경계)
 */
export function bandOfHour(hour: number): TimeBand {
  if (hour >= 5 && hour <= 9) return "morning";
  if (hour >= 10 && hour <= 16) return "day";
  if (hour >= 17 && hour <= 19) return "evening";
  return "night";
}

/**
 * 지금 시간대. 기본은 **실제 시계**를 읽는다.
 * 단 registry에 `debugTimeBand`가 있으면 그 값을 쓴다(디버그 확인 항목·검증 스크립트용).
 */
export function currentBand(reg?: Reg, now: Date = new Date()): TimeBand {
  const forced = reg?.get("debugTimeBand") as TimeBand | undefined;
  if (forced && forced in BAND_LABEL) return forced;
  return bandOfHour(now.getHours());
}

/**
 * 디버그 확인 항목이 넘긴 시간대 강제값을 registry에 반영한다(씬 init에서 호출).
 *
 * 왜 필요한가: 시간대는 실제 시계를 읽으므로, 밤 화면을 보려면 밤까지 기다려야 한다.
 *   확인 항목(`data: { debugTimeBand: "night" }`)이 이걸 넘겨 강제한다.
 * ⚠️ **값이 없으면 지운다.** 안 지우면 한 번 강제한 밤이 다른 확인 항목·실제 플레이까지 따라다닌다.
 */
export function applyDebugBand(reg: Reg, data?: { debugTimeBand?: TimeBand }): void {
  if (data?.debugTimeBand) reg.set("debugTimeBand", data.debugTimeBand);
  else reg.remove("debugTimeBand");
}

/**
 * 시각별 색조 기준점 —— 해가 **점점** 지고 **점점** 뜨게 만드는 뼈대.
 *
 * 구간(아침/낮/저녁/밤)으로 색을 툭툭 바꾸면 20시 정각에 화면이 순간적으로 캄캄해진다.
 * 그래서 아래 몇 개 시각에만 색을 정해 두고, 그 사이는 **분 단위로 섞어서** 쓴다.
 *  hour = 기준 시각, color = 덮는 색, alpha = 덮는 세기(0이면 아무것도 안 덮는 대낮).
 *
 * ⚠️ 색을 지어낸 게 아니라 원본 엔진의 시간대 색조 방향(아침=옅은 노랑, 저녁=주황, 밤=짙은 남색)을
 *    그대로 따랐다. 밤도 길이 안 보일 만큼 어둡게 하지 않는다(안 보이면 게임이 안 된다).
 */
const TONE_STOPS: Array<{ hour: number; color: number; alpha: number }> = [
  { hour: 0, color: 0x0b1a4a, alpha: 0.45 },   // 한밤
  { hour: 4, color: 0x0b1a4a, alpha: 0.45 },   // 동트기 직전까지 그대로
  { hour: 5, color: 0x5a3f7a, alpha: 0.34 },   // 여명(보랏빛)
  { hour: 6, color: 0xffb066, alpha: 0.22 },   // 해가 뜬다
  { hour: 8, color: 0xffd9a0, alpha: 0.10 },   // 아침 햇살이 옅어지고
  { hour: 10, color: 0xffd9a0, alpha: 0 },     // 낮 — 원본 그림 그대로
  { hour: 16, color: 0xffd9a0, alpha: 0 },     // 낮의 끝
  { hour: 18, color: 0xff8a3d, alpha: 0.26 },  // 노을
  { hour: 19, color: 0xd2622e, alpha: 0.34 },  // 해가 진다
  { hour: 20, color: 0x3b2a6a, alpha: 0.40 },  // 땅거미
  { hour: 22, color: 0x0b1a4a, alpha: 0.45 },  // 다시 한밤
  { hour: 24, color: 0x0b1a4a, alpha: 0.45 },  // 0시로 이어짐(자정을 넘어가도 안 튄다)
];

/** 색 두 개를 t(0~1)만큼 섞는다. RGB 채널을 따로 섞어야 중간색이 탁해지지 않는다. */
function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * **지금 이 순간**의 색조 — 시:분을 실수 시각(예: 18시 30분 = 18.5)으로 보고 기준점 사이를 섞는다.
 * 그래서 18시부터 20시까지 두 시간에 걸쳐 노을이 서서히 짙어지고 밤으로 넘어간다.
 */
export function toneAt(now: Date = new Date()): { color: number; alpha: number } {
  const h = now.getHours() + now.getMinutes() / 60;
  for (let i = 0; i < TONE_STOPS.length - 1; i++) {
    const a = TONE_STOPS[i], b = TONE_STOPS[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const t = b.hour === a.hour ? 0 : (h - a.hour) / (b.hour - a.hour);
      return { color: mixColor(a.color, b.color, t), alpha: a.alpha + (b.alpha - a.alpha) * t };
    }
  }
  return { color: TONE_STOPS[0].color, alpha: TONE_STOPS[0].alpha };
}

/** 구간을 강제했을 때(디버그) 쓸 대표 시각 — 그 구간의 한가운데. */
const BAND_HOUR: Record<TimeBand, number> = { morning: 7, day: 13, evening: 18.5, night: 23 };

/** 지금 화면에 덮을 색조. debugTimeBand가 걸려 있으면 그 구간의 대표 시각으로 계산한다. */
export function currentTone(reg?: Reg, now: Date = new Date()): { color: number; alpha: number } {
  const forced = reg?.get("debugTimeBand") as TimeBand | undefined;
  if (forced && forced in BAND_HOUR) {
    const h = BAND_HOUR[forced];
    const d = new Date(now);
    d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    return toneAt(d);
  }
  return toneAt(now);
}

/**
 * 배틀 배경 파일 이름 — 시간대 변형이 있는 배경이면 `_eve` / `_night` 판을 쓴다.
 *  원본 파일명 규칙 그대로다: `route_bg` / `route_eve_bg` / `route_night_bg`.
 *  ⚠️ 실내(체육관)는 원본에도 변형이 없다 → 아래 목록에 없으면 그냥 기본 그림을 쓴다.
 */
//  mountain(22번도로) = 원본에 mountain_night_bg와 mountain__eve_bg가 둘 다 있다.
//  ⚠️ 원본 저녁판 파일명이 `mountain__eve_bg`(밑줄 두 개)로 오타 나 있어 복사할 때 `mountain_eve_bg`로 맞췄다.
const HAS_TIME_VARIANT = new Set(["route", "town", "mountain"]);

export function backdropName(backdrop: string, band: TimeBand): string {
  if (!HAS_TIME_VARIANT.has(backdrop)) return `${backdrop}_bg`;
  if (band === "night") return `${backdrop}_night_bg`;
  if (band === "evening") return `${backdrop}_eve_bg`;
  return `${backdrop}_bg`;   // 아침·낮은 기본 그림(원본도 아침 전용 배경은 없다)
}

/**
 * 야외 씬에 색조 오버레이를 붙이고, 시간이 흐르는 대로 색이 **조금씩** 바뀌게 하는 장치.
 *
 * 쓰는 법: 씬 create()에서 `this.dayNight = attachDayNight(this)` — 그러면 알아서 돈다.
 *  - 화면 크기가 바뀌어도 따라 늘어난다(RESIZE 스케일).
 *  - 1분마다 지금 시각의 색조를 다시 계산해 그 값으로 서서히 옮겨간다.
 *    구간이 바뀌는 순간에만 물드는 게 아니라 **해가 지는 두 시간 내내 조금씩 짙어진다**(사용자 지적).
 *  - 씬이 꺼지면 타이머도 함께 정리된다.
 */
export interface DayNightOverlay {
  /** 지금 구간(HUD 표시·배틀 배경 고르기용). 색조 자체는 구간이 아니라 시:분으로 계산된다. */
  band: TimeBand;
  rect: Phaser.GameObjects.Rectangle;
  /** 지금 시각의 색조를 다시 반영. instant=true면 트윈 없이 즉시(씬 진입·디버그 강제). */
  refresh(instant?: boolean): void;
}

export function attachDayNight(
  scene: Phaser.Scene,
  depth = 900,
  /** 구간이 바뀌었을 때 알려준다(예: HUD의 '낮/저녁' 글자 갈아끼우기). */
  onBandChange?: (band: TimeBand) => void,
): DayNightOverlay {
  const tone = currentTone(scene.registry);
  const rect = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, tone.color, tone.alpha)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(depth).setName("dayNight");
  // ⚠️ 오버레이가 입력을 가로채면 안 된다 — 색만 덮고 클릭은 통과시킨다.
  rect.disableInteractive();

  const fit = (): void => { rect.setSize(scene.scale.width, scene.scale.height); };
  scene.scale.on("resize", fit);

  const out: DayNightOverlay = {
    band: currentBand(scene.registry),
    rect,
    refresh(instant = false): void {
      const prev = out.band;
      out.band = currentBand(scene.registry);
      if (out.band !== prev) onBandChange?.(out.band);
      const t = currentTone(scene.registry);
      if (instant) { rect.setFillStyle(t.color, t.alpha); return; }
      // 1분치 변화라 폭이 아주 작다 → 색을 걷어냈다 입히지 말고 그대로 흘려 보낸다(번쩍임 없음).
      rect.fillColor = t.color;
      scene.tweens.add({ targets: rect, fillAlpha: t.alpha, duration: 2000, ease: "Sine.inOut" });
    },
  };

  // 1분마다 지금 시각의 색조를 다시 계산한다(해가 지는 동안 조금씩 짙어진다).
  const timer = scene.time.addEvent({ delay: 60_000, loop: true, callback: () => out.refresh() });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    timer.remove();
    scene.scale.off("resize", fit);
  });
  return out;
}
