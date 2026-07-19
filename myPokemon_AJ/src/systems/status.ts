// 상태이상(status condition) 규칙의 단일 원천(single source).
//  부여·타입면역·턴종료 데미지·행동제약(잠듦/얼음/마비)·스탯 영향·메시지·아이콘을 여기 모은다.
//  배틀 계산(systems/battle.ts)과 화면(BattleScene)은 이 파일을 "읽기만" 한다 — 로직을 중복 구현하지 말 것.
//  부여 판정 데이터 = moves.json의 functionCode / effectChance (Another Red 추출본).
import { Pokemon, Status, displayName } from "../data/Pokemon";
import { josa } from "../data/josa";

// 잠듦 지속 턴 범위(본가와 동일하게 1~3턴)
export const SLEEP_MIN = 1;
export const SLEEP_MAX = 3;

// 턴종료 데미지 분모: 화상 1/16, 독 1/8 (본가 기준)
const BURN_FRACTION = 16;
const POISON_FRACTION = 8;

// 마비 시 행동불가 확률 / 얼음 매 턴 해동 확률 (본가 25% / 20%)
const FULL_PARALYSIS_CHANCE = 0.25;
const THAW_CHANCE = 0.2;

// 마비 = 스피드 절반, 화상 = 물리공격 절반 (본가 기준)
export const PARALYSIS_SPEED_MULT = 0.5;
export const BURN_ATTACK_MULT = 0.5;

// 혼란: 지속 1~4턴, 자기공격 확률 50%(5세대), 자기공격은 무속성 40위력 물리 (본가 기준)
const CONFUSE_MIN = 1;
const CONFUSE_MAX = 4;
const CONFUSE_SELF_HIT_CHANCE = 0.5;
const CONFUSE_POWER = 40;

// ── 기술 functionCode → 부여할 상태이상 ──────────────────────────────
//  moves.json의 functionCode에 "○○Target"이 연속으로 들어 있으면 그 상태를 건다.
//  (BadPoisonTarget=맹독은 이번 슬라이스에선 일반 독으로 취급. Fire Fang류 BurnFlinchTarget처럼
//   Target이 연속이 아닌 복합코드는 아직 부여 안 함 — 오탐 없이 확실한 것만.)
export function statusFromFunctionCode(fc: string): Status {
  if (fc.includes("BurnTarget")) return "burn";
  if (fc.includes("FreezeTarget")) return "freeze";
  if (fc.includes("ParalyzeTarget")) return "paralysis";
  if (fc.includes("SleepTarget")) return "sleep";
  if (fc.includes("BadPoisonTarget")) return "badpoison"; // 맹독 — Poison보다 먼저 본다("BadPoison"이 "Poison" 포함)
  if (fc.includes("PoisonTarget")) return "poison";
  return null;
}

// 이 상태이상을 지금 걸 수 있나? (이미 다른 상태이면 못 검 + 타입 면역)
export function canInflict(target: Pokemon, status: Status): boolean {
  if (!status) return false;
  if (target.status) return false; // 이미 다른 상태이상 → 중첩 불가(본가 규칙)
  const t = target.types;
  if (status === "burn" && t.includes("FIRE")) return false;
  if (status === "freeze" && t.includes("ICE")) return false;
  if (status === "paralysis" && t.includes("ELECTRIC")) return false; // 6세대+ 전기 면역
  // 독·맹독 모두 독/강철 타입엔 안 걸린다.
  if ((status === "poison" || status === "badpoison") && (t.includes("POISON") || t.includes("STEEL"))) return false;
  return true;
}

// 실제로 상태이상을 건다(canInflict 통과를 가정). 잠듦이면 남은 턴도 굴려서, 맹독이면 카운터를 세팅.
export function applyStatus(p: Pokemon, status: Status, rng: () => number = Math.random): void {
  p.status = status;
  if (status === "sleep") {
    p.sleepTurns = SLEEP_MIN + Math.floor(rng() * (SLEEP_MAX - SLEEP_MIN + 1));
  } else if (status === "badpoison") {
    p.toxicCounter = 1; // 맹독은 1/16부터 시작해 턴마다 누적된다
  }
}

// 턴종료에 받는 상태이상 데미지(화상·독·맹독). 없으면 0. 최소 1.
//  맹독은 maxHp × 카운터 / 16 (카운터는 advanceStatusTurn에서 매 턴 +1).
export function residualDamage(p: Pokemon): number {
  if (p.status === "burn") return Math.max(1, Math.floor(p.maxHp / BURN_FRACTION));
  if (p.status === "poison") return Math.max(1, Math.floor(p.maxHp / POISON_FRACTION));
  if (p.status === "badpoison") {
    const n = p.toxicCounter ?? 1;
    return Math.max(1, Math.floor((p.maxHp * n) / BURN_FRACTION));
  }
  return 0;
}

// 턴종료 잔뎀을 적용한 뒤, 맹독 누적 카운터를 한 칸 올린다(다음 턴 데미지가 커진다).
export function advanceStatusTurn(p: Pokemon): void {
  if (p.status === "badpoison") p.toxicCounter = (p.toxicCounter ?? 1) + 1;
}

// 휘발성 상태(풀죽음·혼란)를 지운다 — 배틀 진입·교체 시 호출(랭크 리셋과 같은 스코프).
//  주요 상태이상(화상/독/맹독/마비/잠/얼음)은 배틀 밖까지 지속되므로 여기서 지우지 않는다.
export function clearVolatileStatus(p: Pokemon): void {
  p.flinch = false;
  p.confusionTurns = undefined;
}

// 마비=스피드 절반 (턴 순서용)
export function speedMult(p: Pokemon): number {
  return p.status === "paralysis" ? PARALYSIS_SPEED_MULT : 1;
}

// 화상=물리공격 절반 (데미지 계산용)
export function burnAttackMult(p: Pokemon, isPhysical: boolean): number {
  return isPhysical && p.status === "burn" ? BURN_ATTACK_MULT : 1;
}

// ── 행동 직전 판정: 이번 턴 움직일 수 있나? ─────────────────────────
//  잠듦(턴 감소 후 깨어남)·얼음(해동 굴림)·마비(행동불가 굴림)를 여기서 처리하고 메시지를 만든다.
//  `who` = 화면 표시 이름(예: "개구마르" 또는 "상대 개구마르"). p의 상태를 직접 변경할 수 있다.
export interface MoveGate {
  canMove: boolean;
  messages: string[];
  selfDamage?: number; // 혼란 자기공격 데미지(있으면 공격자 자신에게 적용). 화면이 처리.
}
export function beforeMove(p: Pokemon, who: string, rng: () => number = Math.random): MoveGate {
  const j = josa(who, "은는");
  // 풀죽음: 선공에게 맞으면 이번 턴 완전 봉쇄. 다른 어떤 판정보다 먼저 보고, 소비하며 해제.
  if (p.flinch) {
    p.flinch = false;
    return { canMove: false, messages: [`${who}${j} 풀이 죽어 움직일 수 없다!`] };
  }
  if (p.status === "sleep") {
    if (p.sleepTurns == null) p.sleepTurns = SLEEP_MIN; // 옛 세이브(잠듦인데 카운터 없음) 방어
    p.sleepTurns -= 1;
    if (p.sleepTurns <= 0) {
      p.status = null;
      p.sleepTurns = undefined;
      return { canMove: true, messages: [`${who}${j} 잠에서 깨어났다!`] };
    }
    return { canMove: false, messages: [`${who}${j} 쿨쿨 잠들어 있다.`] };
  }
  if (p.status === "freeze") {
    if (rng() < THAW_CHANCE) {
      p.status = null;
      return { canMove: true, messages: [`${who}${j} 얼음이 녹았다!`] };
    }
    return { canMove: false, messages: [`${who}${j} 얼어붙어서 움직일 수 없다!`] };
  }
  // 혼란: 매 턴 카운터 감소. 남아 있으면 확률로 자신을 공격(무속성 40위력).
  const pre: string[] = [];
  if (p.confusionTurns != null && p.confusionTurns > 0) {
    p.confusionTurns -= 1;
    if (p.confusionTurns <= 0) {
      p.confusionTurns = undefined;
      pre.push(`${who}${j} 혼란이 풀렸다!`);
    } else {
      pre.push(`${who}${j} 혼란에 빠져 있다!`);
      if (rng() < CONFUSE_SELF_HIT_CHANCE) {
        return { canMove: false, messages: [...pre, "영문도 모른 채 자신을 공격했다!"], selfDamage: confusionSelfDamage(p, rng) };
      }
    }
  }
  if (p.status === "paralysis" && rng() < FULL_PARALYSIS_CHANCE) {
    return { canMove: false, messages: [...pre, `${who}${j} 몸이 저려서 움직일 수 없다!`] };
  }
  return { canMove: true, messages: pre };
}

// 혼란을 건다(휘발성 — 교체하면 사라짐). 이미 혼란이면 다시 걸지 않는다.
export function applyConfusion(p: Pokemon, rng: () => number = Math.random): boolean {
  if (p.confusionTurns != null && p.confusionTurns > 0) return false;
  p.confusionTurns = CONFUSE_MIN + Math.floor(rng() * (CONFUSE_MAX - CONFUSE_MIN + 1));
  return true;
}

// 혼란 자기공격 데미지 — 무속성 40위력 물리, 자신의 공/방으로 표준 공식(자속·상성·급소 없음).
function confusionSelfDamage(p: Pokemon, rng: () => number): number {
  const base = Math.floor((2 * p.level) / 5) + 2;
  let dmg = Math.floor((base * CONFUSE_POWER * p.attack) / p.defense / 50) + 2;
  dmg *= 0.85 + rng() * 0.15;
  return Math.max(1, Math.floor(dmg));
}

// 상태이상에 걸렸을 때의 알림 메시지
export function inflictMessage(who: string, status: Status): string {
  const j = josa(who, "은는");
  switch (status) {
    case "burn": return `${who}${j} 화상을 입었다!`;
    case "poison": return `${who}${j} 독에 당했다!`;
    case "badpoison": return `${who}${j} 맹독에 당했다!`;
    case "paralysis": return `${who}${j} 마비되어 기술이 나오기 힘들어졌다!`;
    case "sleep": return `${who}${j} 잠들어 버렸다!`;
    case "freeze": return `${who}${j} 얼어붙었다!`;
    default: return "";
  }
}

// 혼란에 빠졌을 때의 알림 메시지
export function confusionMessage(who: string): string {
  return `${who}${josa(who, "은는")} 혼란에 빠졌다!`;
}

// 턴종료 상태이상 데미지 메시지(화상·독·맹독)
export function residualMessage(who: string, status: Status): string {
  const j = josa(who, "은는");
  if (status === "burn") return `${who}${j} 화상 데미지를 입었다!`;
  if (status === "poison" || status === "badpoison") return `${who}${j} 독 데미지를 입었다!`;
  return "";
}

// DataBox 상태 아이콘 시트(assets/ui/battle/statuses.png, 44x16 세로 9행)의 행 번호.
//  AR 원본 순서: 0=잠듦 1=독 2=화상 3=마비 4=얼음. 해당 없으면 -1.
export function statusIconRow(status: Status): number {
  switch (status) {
    case "sleep": return 0;
    case "poison": return 1;
    case "badpoison": return 1; // 맹독도 독 아이콘을 쓴다(AR 시트에 전용 없음)
    case "burn": return 2;
    case "paralysis": return 3;
    case "freeze": return 4;
    default: return -1;
  }
}
