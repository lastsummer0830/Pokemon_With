// 옵션(설정) — 원본(Another Red)의 `UI_Options.rb` 항목을 우리 게임에 있는 것만 옮겼다.
//
// ⚠️ 원본에 있지만 **일부러 안 넣은 항목**과 그 이유(나중에 그 기능이 생기면 여기 추가할 것):
//    · Send to Boxes(박스 자동전송) — 우리는 아직 **박스 시스템 자체가 없다**
//    · Give Nicknames(별명 주기)   — 잡을 때 별명 짓는 흐름이 아직 없다(BattleScene 주석에도 명시)
//    · Speech/Menu Frame(창 스킨)  — 우리 UI는 windowskin 그림이 아니라 코드로 그린다
//    동작하지 않는 토글을 화면에 두면 "고장난 옵션"이 되므로 넣지 않는다.
//
// 저장은 세이브(슬롯)와 별개다 — 원본도 옵션은 세이브 파일이 아니라 전역 설정이다.
// 그래서 어느 슬롯을 불러오든 같은 설정이 유지된다.

const KEY = "myPokemon.settings";

export type TextSpeed = "slow" | "mid" | "fast";
export type BattleStyle = "switch" | "set";
export type MoveStyle = "walk" | "run";

export interface Settings {
  musicVolume: number;      // 0~10 (원본 Options도 0~10 눈금)
  seVolume: number;         // 0~10
  textSpeed: TextSpeed;
  battleEffects: boolean;   // 기술 애니메이션을 보여줄 것인가
  battleStyle: BattleStyle; // switch=상대가 쓰러지면 교체할지 물어봄 / set=안 물어봄
  moveStyle: MoveStyle;     // 기본 이동 속도(원본: 반대 속도는 이동 중 Back키를 누르고 있으면)
}

export const DEFAULTS: Settings = {
  musicVolume: 7,
  seVolume: 7,
  textSpeed: "mid",
  battleEffects: true,
  battleStyle: "switch",
  moveStyle: "walk",
};

let current: Settings = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<(s: Settings) => void>();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* 깨졌으면 기본값 그대로 */ }
}

export function settings(): Settings {
  load();
  return current;
}

/** 한 항목을 바꾸고 즉시 저장 + 구독자에게 알린다(볼륨은 소리에 바로 반영돼야 한다). */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  load();
  current = { ...current, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* noop */ }
  for (const fn of listeners) fn(current);
}

/** 볼륨처럼 "바뀌는 즉시" 반영해야 하는 곳이 구독한다. */
export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── 다른 모듈이 쓰는 파생값 ─────────────────────────────────────────────────
/** 0~10 눈금 → 0.0~1.0 배율. 각 재생 지점의 기존 볼륨에 곱한다. */
export const musicFactor = (): number => settings().musicVolume / 10;
export const seFactor = (): number => settings().seVolume / 10;

/** 대사 한 글자가 찍히는 간격(ms). 기본값 38ms가 '보통'이다(DialogBox 원래 값). */
export function textDelayMs(): number {
  return { slow: 70, mid: 38, fast: 14 }[settings().textSpeed];
}

/** 한 칸 걷는 시간(ms). 원본은 걷기/달리기 두 단계다. */
export function stepDurationMs(running: boolean): number {
  return running ? 100 : 150;
}

// 화면에 보여줄 이름표
export const TEXT_SPEED_LABEL: Record<TextSpeed, string> = { slow: "느림", mid: "보통", fast: "빠름" };
export const BATTLE_STYLE_LABEL: Record<BattleStyle, string> = { switch: "교체", set: "고정" };
export const MOVE_STYLE_LABEL: Record<MoveStyle, string> = { walk: "걷기", run: "달리기" };
