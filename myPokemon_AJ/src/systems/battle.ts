// 배틀 계산·규칙 (화면과 분리 — 여기엔 데미지/상성/턴순서만).
// 데이터: Another Red 추출본(src/data/ar). 표준 포켓몬 데미지 공식을 따른다.
import { Pokemon, MoveSlot, displayName } from "../data/Pokemon";
import { getMove, typeMultiplier, MoveData } from "../data/ar";

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
  const atk = isPhysical ? attacker.attack : attacker.spAttack;
  const def = isPhysical ? defender.defense : defender.spDefense;

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

  // ★ 컨디션 보너스: 집에서 잘 쉰 포켓몬일수록 살짝 강하게(집 꾸미기 → 배틀 고리).
  //   condition 100 기준 +10%. (homeBonus.ts가 채운 값을 읽기만 함)
  const conditionMult = 1 + Math.min(attacker.condition, 200) / 1000;
  dmg *= conditionMult;

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

  // 변화기(위력 0)는 데미지 없음 — 지금은 메시지만(효과는 추후 구현)
  if (!move || move.power <= 0) {
    return baseResult(name, move, {});
  }

  // 명중 판정 (accuracy 0 = 필중)
  if (move.accuracy > 0 && rng() * 100 >= move.accuracy) {
    return baseResult(name, move, { missed: true });
  }

  const crit = rng() < CRIT_CHANCE;
  const rand = RAND_MIN + rng() * (1 - RAND_MIN);
  const { damage, effectiveness, stab } = computeDamage(attacker, defender, move, crit, rand);

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  return {
    moveName: name,
    category: move.category,
    missed: false,
    damage,
    effectiveness,
    stab,
    crit,
    defenderFainted: defender.currentHp <= 0,
    noPp: false,
  };
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
  if (a.speed !== b.speed) return a.speed > b.speed;
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
