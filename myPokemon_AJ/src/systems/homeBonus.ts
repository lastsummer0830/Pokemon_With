import { Pokemon } from "../data/Pokemon";
import { HouseLayout } from "../data/HouseLayout";

// 집에서 쉴 때 호출 — 방 안의 가구를 보고 컨디션을 조정한다 (내 색의 핵심 규칙)
export function applyHomeBonus(pokemon: Pokemon, house: HouseLayout): void {
  // 방에 벽난로가 하나라도 있는지 확인
  const hasFireplace = house.furniture.some(f => f.itemId === "fireplace");
  if (pokemon.type === "불꽃" && hasFireplace) {
    pokemon.condition += 10;  // 불꽃 포켓몬 + 벽난로 → 컨디션 +10
  }

  // 물 포켓몬은 연못이 있으면 컨디션 상승 (같은 방식으로 규칙을 늘려가면 됨)
  const hasPond = house.furniture.some(f => f.itemId === "pond");
  if (pokemon.type === "물" && hasPond) {
    pokemon.condition += 10;
  }
}
