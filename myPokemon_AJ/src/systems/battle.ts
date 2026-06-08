import { Pokemon } from "../data/Pokemon";

// 데미지·턴 계산 로직 (화면과 분리해서 규칙만 담는다)

// 한 번 공격했을 때 데미지를 계산한다.
// condition(집에서 쉰 정도)이 높을수록 살짝 더 강하게 — 집 꾸미기 → 배틀로 이어지는 고리.
export function calcDamage(attacker: Pokemon, defender: Pokemon): number {
  const base = attacker.attack;
  const conditionBonus = Math.floor(attacker.condition / 10); // 컨디션 10당 +1
  const damage = base + conditionBonus;
  return Math.max(1, damage); // 최소 1은 들어가게
}

// 실제로 데미지를 적용한다 (HP를 깎음)
export function applyDamage(attacker: Pokemon, defender: Pokemon): number {
  const dmg = calcDamage(attacker, defender);
  defender.currentHp = Math.max(0, defender.currentHp - dmg);
  return dmg;
}

// 쓰러졌는지 확인
export function isFainted(pokemon: Pokemon): boolean {
  return pokemon.currentHp <= 0;
}
