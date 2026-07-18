// 배틀 계산·규칙 (화면과 분리 — 여기엔 데미지/상성/턴순서만).
// 데이터: Another Red 추출본(src/data/ar). 표준 포켓몬 데미지 공식을 따른다.
import { Pokemon, MoveSlot, Status, displayName } from "../data/Pokemon";
import { getMove, typeMultiplier, MoveData } from "../data/ar";
import { bondDamageMult } from "./bond";
import { statusFromFunctionCode, canInflict, applyStatus, speedMult, burnAttackMult } from "./status";
import { effectiveStat, accEvaMult, parseStatChange, applyStatChange, StatChangeResult } from "./stages";

// 매직넘버는 상수로.
const CRIT_CHANCE = 1 / 24;   // 급소 확률
const CRIT_MULT = 1.5;        // 급소 배율
const STAB_MULT = 1.5;        // 자속(Same-Type Attack Bonus)
const RAND_MIN = 0.85;        // 데미지 난수 하한(85~100%)

// 한 번의 기술 사용 결과 (화면이 이걸 보고 텍스트/연출)
export interface MoveResult {
  moveName: string;      // 한글 기술명
  category: string;      // Physical/Special/Status
  missed: boolean;       // 빗나감
  damage: number;        // 준 데미지
  effectiveness: number; // 타입 상성 최종 배율 (0 / 0.5 / 1 / 2 / 4 ...)
  stab: boolean;         // 자속 여부
  crit: boolean;         // 급소 여부
  defenderFainted: boolean;
  noPp: boolean;         // PP가 없어 못 씀
  statusInflicted: Status; // 이 기술로 상대에게 새로 건 상태이상(없으면 null)
  statChanges: StatChangeResult[]; // 이 기술로 생긴 능력 변화(사용자/상대). 규칙은 systems/stages.ts
}

// 표준 데미지 공식.
//  기본 = (⌊(2·레벨/5 + 2) · 위력 · 공/방 / 50⌋ + 2)
//  최종 = 기본 · STAB · 상성 · 급소 · 컨디션보너스 · 난수
function computeDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: MoveData,
  crit: boolean,
  rand: number,
): { damage: number; effectiveness: number; stab: boolean } {
  // 물리=공격/방어, 특수=특수공격/특수방어
  const isPhysical = move.category === "Physical";
  const atkKey = isPhysical ? "attack" : "spAttack";
  const defKey = isPhysical ? "defense" : "spDefense";
  // ★ 능력 변화 랭크를 반영한 유효 스탯(systems/stages.ts) × 화상 물리½(systems/status.ts).
  const atk = Math.floor(effectiveStat(attacker, atkKey) * burnAttackMult(attacker, isPhysical));
  const def = Math.floor(effectiveStat(defender, defKey));

  const baseNum = Math.floor((2 * attacker.level) / 5) + 2;
  let dmg = Math.floor((baseNum * move.power * atk) / def / 50) + 2;

  // 자속: 기술 타입이 사용자 타입에 포함되면 1.5배
  const stab = attacker.types.includes(move.type);
  if (stab) dmg *= STAB_MULT;

  // 타입 상성
  const eff = typeMultiplier(move.type, defender.types);
  dmg *= eff;

  // 급소
  if (crit) dmg *= CRIT_MULT;

  // ★ 유대 보너스: 잘 돌봐 유대가 깊은 포켓몬일수록 살짝 강하게(케어 → 배틀 고리).
  //   유대 100 기준 +10%. 계산은 systems/bond.ts 한 곳에 있고 여기선 읽기만 한다.
  dmg *= bondDamageMult(attacker);

  // 데미지 난수(85~100%)
  dmg *= rand;

  return { damage: Math.max(1, Math.floor(dmg)), effectiveness: eff, stab };
}

// 기술 하나를 실제로 사용한다(명중·데미지 적용·PP 소모). 결과를 돌려준다.
//  rng: 0~1 난수 공급자(테스트 주입 가능). 기본 Math.random.
export function performMove(
  attacker: Pokemon,
  defender: Pokemon,
  slot: MoveSlot,
  rng: () => number = Math.random,
): MoveResult {
  const move = getMove(slot.id);
  const name = move?.name ?? slot.id;

  // PP 없음
  if (slot.pp <= 0) {
    return baseResult(name, move, { noPp: true });
  }
  slot.pp -= 1;

  // 기술 데이터 자체가 없으면(미등록) 메시지만.
  if (!move) {
    return baseResult(name, move, {});
  }

  // 명중 판정 (accuracy 0 = 필중). 변화기·데미지기 모두 여기서 판정한다(전기자석파처럼 빗나가는 변화기 있음).
  //  명중랭크·회피랭크를 반영한다(필중기 accuracy 0에는 곱하지 않음 — systems/stages.ts).
  if (move.accuracy > 0 && rng() * 100 >= move.accuracy * accEvaMult(attacker, defender)) {
    return baseResult(name, move, { missed: true });
  }

  // 변화기(위력 0): 데미지 없음 — 상태이상·능력변화만 시도한다(그 외 효과는 아직 미구현).
  if (move.power <= 0) {
    return baseResult(name, move, {
      statusInflicted: rollStatus(move, defender, rng),
      statChanges: rollStatChanges(move, attacker, defender, rng),
    });
  }

  const crit = rng() < CRIT_CHANCE;
  const rand = RAND_MIN + rng() * (1 - RAND_MIN);
  const { damage, effectiveness, stab } = computeDamage(attacker, defender, move, crit, rand);

  defender.currentHp = Math.max(0, defender.currentHp - damage);
  const fainted = defender.currentHp <= 0;

  return {
    moveName: name,
    category: move.category,
    missed: false,
    damage,
    effectiveness,
    stab,
    crit,
    defenderFainted: fainted,
    noPp: false,
    // 데미지기의 부가 상태이상·능력변화(effectChance %). 쓰러진 상대에겐 적용하지 않는다.
    //  단 능력변화는 "쓰러뜨려도 사용자 자기강화는 적용"되므로 상대 대상만 스킵(rollStatChanges 내부에서 판정).
    statusInflicted: fainted ? null : rollStatus(move, defender, rng),
    statChanges: rollStatChanges(move, attacker, defender, rng, fainted),
  };
}

// 이 기술이 능력 변화를 일으키나? 일으키면 실제로 적용하고 결과 목록을 돌려준다(없으면 빈 배열).
//  발동 확률: 순수 변화기(위력0)는 확정(100%), 데미지기의 부가효과는 effectChance %.
//  대상이 상대(target)여도 사용자(user)여도 여기서 처리.
//  defenderFainted=true면 상대(target) 대상 변화만 스킵한다(쓰러진 상대는 못 깎지만, 사용자 자기강화는 유효).
function rollStatChanges(
  move: MoveData, attacker: Pokemon, defender: Pokemon, rng: () => number,
  defenderFainted = false,
): StatChangeResult[] {
  const spec = parseStatChange(move.functionCode);
  if (!spec) return [];
  if (spec.target === "target" && defenderFainted) return [];
  const chance = move.power <= 0 ? 100 : move.effectChance;
  if (chance <= 0) return [];
  if (rng() * 100 >= chance) return [];
  const p = spec.target === "user" ? attacker : defender;
  return spec.changes.map((c) => ({
    side: spec.target, stat: c.stat, delta: c.delta,
    outcome: applyStatChange(p, c.stat, c.delta),
  }));
}

// 이 기술이 상대에게 상태이상을 걸어야 하나? 걸리면 실제로 적용하고 그 상태를 돌려준다(없으면 null).
//  발동 확률: 순수 변화기(위력0)는 확정(effectChance 0=100%), 데미지기의 부가효과는 effectChance %.
function rollStatus(move: MoveData, defender: Pokemon, rng: () => number): Status {
  const st = statusFromFunctionCode(move.functionCode);
  if (!st) return null;
  const chance = move.power <= 0 ? 100 : move.effectChance;
  if (chance <= 0) return null;
  if (rng() * 100 >= chance) return null;
  if (!canInflict(defender, st)) return null;
  applyStatus(defender, st, rng);
  return st;
}

function baseResult(
  name: string,
  move: MoveData | undefined,
  over: Partial<MoveResult>,
): MoveResult {
  return {
    moveName: name,
    category: move?.category ?? "Status",
    missed: false,
    damage: 0,
    effectiveness: 1,
    stab: false,
    crit: false,
    defenderFainted: false,
    noPp: false,
    statusInflicted: null,
    statChanges: [],
    ...over,
  };
}

// 이번 턴에 누가 먼저 움직이나? (우선도 우선, 같으면 스피드, 그래도 같으면 난수)
//  반환: true면 a가 먼저.
export function movesFirst(
  a: Pokemon, aMove: MoveSlot,
  b: Pokemon, bMove: MoveSlot,
  rng: () => number = Math.random,
): boolean {
  const pa = getMove(aMove.id)?.priority ?? 0;
  const pb = getMove(bMove.id)?.priority ?? 0;
  if (pa !== pb) return pa > pb;
  // 스피드 랭크(systems/stages.ts) × 마비 절반(systems/status.ts). 유효 스피드로 선공을 정한다.
  const sa = effectiveStat(a, "speed") * speedMult(a);
  const sb = effectiveStat(b, "speed") * speedMult(b);
  if (sa !== sb) return sa > sb;
  return rng() < 0.5;
}

// 쓰러졌는지
export function isFainted(pokemon: Pokemon): boolean {
  return pokemon.currentHp <= 0;
}

// 타입 상성 배율 → 한글 메시지 (없으면 빈 문자열)
export function effectivenessText(mult: number): string {
  if (mult === 0) return "효과가 없는 것 같다...";
  if (mult > 1) return "효과가 굉장했다!";
  if (mult < 1) return "효과가 별로인 듯하다...";
  return "";
}

// 화면에서 쓰기 좋은 표시 이름 재노출
export { displayName };
