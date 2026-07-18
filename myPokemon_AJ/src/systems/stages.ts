// 능력 변화(stat stage/랭크) 규칙의 단일 원천(single source).
//  배틀 중에만 존재하는 -6..+6 랭크(공/방/특공/특방/스피드/명중/회피)와
//  그 배율·기술 적용·메시지를 여기 모은다. 세이브에는 남기지 않는다(배틀 시작 시 리셋).
//  배틀 계산(systems/battle.ts)과 화면(BattleScene)은 이 파일을 "읽기만" 한다 — 로직 중복 금지.
//  적용 판정 데이터 = moves.json의 functionCode (Another Red 추출본).
import { Pokemon } from "../data/Pokemon";
import { josa } from "../data/josa";

// 랭크가 붙는 스탯 키. 앞 5개는 실제 Pokemon 필드명과 같고, 명중/회피는 배틀 중에만 쓰는 가상 스탯.
export type StatKey = "attack" | "defense" | "spAttack" | "spDefense" | "speed" | "accuracy" | "evasion";

// 한 포켓몬의 능력 변화 랭크 묶음(전부 0 = 변화 없음). Pokemon.stages에 옵셔널로 붙는다.
export type StatStages = Record<StatKey, number>;

export const STAGE_MIN = -6;
export const STAGE_MAX = 6;

// 한글 스탯 이름(메시지용)
const STAT_LABEL: Record<StatKey, string> = {
  attack: "공격", defense: "방어", spAttack: "특수공격", spDefense: "특수방어",
  speed: "스피드", accuracy: "명중률", evasion: "회피율",
};

// 랭크 0인 깨끗한 묶음을 만든다.
export function zeroStages(): StatStages {
  return { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 };
}

// 배틀 시작·교체 시 그 포켓몬의 랭크를 전부 0으로 되돌린다(배틀 스코프 — 세이브에 남기지 않기 위해).
export function resetStages(p: Pokemon): void {
  p.stages = zeroStages();
}

// 현재 랭크 값(없으면 0으로 취급 — 옛 세이브/미초기화 방어).
export function stageOf(p: Pokemon, key: StatKey): number {
  return p.stages?.[key] ?? 0;
}

// ── 배율표 ──────────────────────────────────────────────────────────
//  일반 스탯(공/방/특공/특방/스피드): n>=0 → (2+n)/2, n<0 → 2/(2-n)
//  명중/회피:                          n>=0 → (3+n)/3, n<0 → 3/(3-n)
function regularMult(stage: number): number {
  const n = Math.max(STAGE_MIN, Math.min(STAGE_MAX, stage));
  return n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
}
function accuracyMult(stage: number): number {
  const n = Math.max(STAGE_MIN, Math.min(STAGE_MAX, stage));
  return n >= 0 ? (3 + n) / 3 : 3 / (3 - n);
}

// 랭크가 반영된 유효 스탯(공/방/특공/특방/스피드). 명중/회피는 여기 쓰지 않는다(accEvaMult로).
//  ⚠️ 마비(스피드½)·화상(공격½)은 systems/status.ts가 따로 곱한다 — 여기선 랭크만.
export function effectiveStat(p: Pokemon, key: "attack" | "defense" | "spAttack" | "spDefense" | "speed"): number {
  return p[key] * regularMult(stageOf(p, key));
}

// 명중 판정용 최종 배율 = 공격자 명중랭크와 방어자 회피랭크를 합쳐 하나의 랭크로.
//  본가와 동일: net = clamp(명중 - 회피, -6, 6) → 명중 배율표. 필중기(accuracy 0)에는 이걸 곱하지 않는다.
export function accEvaMult(attacker: Pokemon, defender: Pokemon): number {
  const net = stageOf(attacker, "accuracy") - stageOf(defender, "evasion");
  return accuracyMult(net);
}

// ── functionCode → 능력 변화 파싱 ───────────────────────────────────
//  status.ts와 같은 철학: "오탐 없이 확실한 것만". 순수 능력변화기만 앵커 정규식으로 정확히 매칭하고,
//  뒤에 다른 효과가 붙은 복합코드(예: LowerTargetDefense1FlinchTarget, RaiseUserSpAtkSpDef1CureStatus,
//  Side/Allies 전체대상, TwoTurnAttack…)는 매칭하지 않는다(잘못 적용 방지 — 추후 개별 구현).
export interface StatChangeSpec {
  target: "user" | "target";       // 대상: 사용자 자신 / 상대
  changes: { stat: StatKey; delta: number }[];
}

// 스탯 토큰(코드 표기 → 키). 긴 것 먼저 시도해 SpAtk/SpDef가 Speed로 오해되지 않게 한다.
const STAT_TOKENS: [string, StatKey][] = [
  ["SpAtk", "spAttack"], ["SpDef", "spDefense"],
  ["Attack", "attack"], ["Atk", "attack"],
  ["Defense", "defense"], ["Def", "defense"],
  ["Speed", "speed"], ["Spd", "speed"],
  ["Accuracy", "accuracy"], ["Acc", "accuracy"],
  ["Evasion", "evasion"], ["Eva", "evasion"],
];
// MainStats = 공/방/특공/특방/스피드 전부(본가 "모든 능력" 상승기)
const MAIN_STATS: StatKey[] = ["attack", "defense", "spAttack", "spDefense", "speed"];

export function parseStatChange(fc: string): StatChangeSpec | null {
  // 앵커: (Raise|Lower)(User|Target)<스탯표기><숫자> 로 정확히 끝나야 한다.
  const m = /^(Raise|Lower)(User|Target)([A-Za-z]+?)(\d)$/.exec(fc);
  if (!m) return null;
  const [, dir, tgt, statPart, digitStr] = m;
  const magnitude = Number(digitStr);
  const sign = dir === "Raise" ? 1 : -1;

  let stats: StatKey[];
  if (statPart === "MainStats") {
    stats = MAIN_STATS;
  } else {
    stats = [];
    let rest = statPart;
    while (rest.length) {
      const tok = STAT_TOKENS.find(([t]) => rest.startsWith(t));
      if (!tok) return null;           // 알 수 없는 토큰 → 통째로 스킵(오탐 방지)
      stats.push(tok[1]);
      rest = rest.slice(tok[0].length);
    }
  }
  return { target: tgt === "User" ? "user" : "target", changes: stats.map((stat) => ({ stat, delta: sign * magnitude })) };
}

// ── 적용 ────────────────────────────────────────────────────────────
export type StageOutcome = "changed" | "capped"; // capped = 이미 한계라 변화 없음
export interface StatChangeResult {
  side: "user" | "target";
  stat: StatKey;
  delta: number;         // 시도한 변화량(±1..3). 실제 반영은 outcome이 changed일 때.
  outcome: StageOutcome;
}

// 랭크 하나를 실제로 바꾼다. 이미 ±6 한계면 capped(변화 없음)로 알린다.
export function applyStatChange(p: Pokemon, stat: StatKey, delta: number): StageOutcome {
  if (!p.stages) p.stages = zeroStages();
  const before = p.stages[stat];
  const after = Math.max(STAGE_MIN, Math.min(STAGE_MAX, before + delta));
  if (after === before) return "capped";
  p.stages[stat] = after;
  return "changed";
}

// 능력 변화 메시지. who = 화면 표시 이름(예: "개구마르" / "상대 개구마르").
export function statChangeMessage(who: string, r: StatChangeResult): string {
  const stat = STAT_LABEL[r.stat];
  const js = josa(stat, "이가");
  if (r.outcome === "capped") {
    return r.delta > 0
      ? `${who}의 ${stat}${js} 더 올라가지 않는다!`
      : `${who}의 ${stat}${js} 더 내려가지 않는다!`;
  }
  const mag = Math.abs(r.delta);
  if (r.delta > 0) {
    const how = mag >= 3 ? "매우 크게 " : mag === 2 ? "크게 " : "";
    return `${who}의 ${stat}${js} ${how}올라갔다!`;
  }
  const how = mag >= 3 ? "매우 크게 " : mag === 2 ? "크게 " : "";
  return `${who}의 ${stat}${js} ${how}떨어졌다!`;
}
