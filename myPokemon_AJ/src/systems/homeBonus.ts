import { Pokemon } from "../data/Pokemon";
import { HouseLayout } from "../data/HouseLayout";
import { FURNITURE, FurnitureDef, findFurniture } from "../data/furniture";

// ★ 이 게임의 차별점: "집 꾸미기 → 컨디션 → 배틀"을 잇는 계산 (순수 함수 모음)
//
//  규칙(한눈에):
//   - 방을 어떻게 꾸몄는지가 그 포켓몬의 **컨디션 상한**을 정한다.  (빈 방이면 상한 20)
//   - 침대에서 **잠을 잘 때마다** 컨디션이 상한까지 조금씩 오른다. (1회 +10)
//   - 컨디션은 배틀에서 데미지 배율로 읽힌다(systems/battle.ts: 100이면 +10%).
//  즉 "잘 꾸민 방 = 더 높은 상한 = 더 강한 포켓몬"이고, 잠만 자서는 상한을 못 넘는다.

export const CONDITION_MAX = 100;     // 컨디션 절대 상한
export const BASE_CAP = 20;           // 아무것도 안 놓은 빈 방의 상한
export const REST_PER_SLEEP = 10;     // 잠 1회당 오르는 양

// 놓인 가구들의 정의를 실제로 훑는다(카탈로그에 없는 id는 무시).
function placedDefs(house: HouseLayout): FurnitureDef[] {
  return house.furniture
    .map(f => findFurniture(f.itemId))
    .filter((d): d is FurnitureDef => !!d);
}

// 이 포켓몬이 이 방에서 도달할 수 있는 컨디션 상한.
//  = 기본 20 + 모든 가구의 comfort 합 + (속성이 맞는 가구의 affinityBonus 합), 최대 100.
//  예: 파이리(FIRE) + 벽난로 → 20 + 5 + 25 = 50까지 오를 수 있다.
export function conditionCap(pokemon: Pokemon, house: HouseLayout): number {
  let cap = BASE_CAP;
  for (const def of placedDefs(house)) {
    cap += def.comfort;
    if (def.affinity && pokemon.types.includes(def.affinity)) cap += def.affinityBonus;
  }
  return Math.min(CONDITION_MAX, cap);
}

// 잠자기 결과 한 마리분 (대사로 보여주기 위한 값들)
export interface RestResult {
  pokemon: Pokemon;
  before: number;   // 자기 전 컨디션
  after: number;    // 자고 난 뒤 컨디션
  cap: number;      // 이 방에서의 상한
  healed: boolean;  // HP/상태이상이 회복됐는지
}

// 포켓몬 한 마리를 이 방에서 쉬게 한다 (컨디션 = 상한까지 REST_PER_SLEEP 만큼 상승).
//  ⚠️ pokemon 을 직접 고친다(파티 배열의 참조를 그대로 받는 걸 전제).
export function applyHomeBonus(pokemon: Pokemon, house: HouseLayout): RestResult {
  const cap = conditionCap(pokemon, house);
  const before = pokemon.condition;
  // 상한보다 이미 높으면(가구를 치운 경우) 상한으로 내려온다.
  const after = before > cap ? cap : Math.min(cap, before + REST_PER_SLEEP);
  pokemon.condition = after;

  const healed = pokemon.currentHp < pokemon.maxHp || pokemon.status !== null;
  pokemon.currentHp = pokemon.maxHp;
  pokemon.status = null;
  for (const m of pokemon.moves) m.pp = m.maxPp;

  return { pokemon, before, after, cap, healed };
}

// 파티 전원을 재운다 (침대 상호작용에서 호출).
export function sleepAtHome(party: Pokemon[], house: HouseLayout): RestResult[] {
  return party.map(p => applyHomeBonus(p, house));
}

// 방을 아직 한 번도 안 꾸민 상태(빈 방). InteriorScene/저장이 없을 때 기본값으로 쓴다.
//  크기는 침실 격자(rooms.json bedroom)와 같은 20×15.
export function emptyHouse(): HouseLayout {
  return { width: 20, height: 15, furniture: [] };
}

// 꾸미기 화면에서 "이 가구가 지금 파티에 얼마나 도움이 되나"를 한 줄로 설명할 때 쓴다.
export function furnitureHint(def: FurnitureDef, party: Pokemon[]): string {
  if (!def.affinity) return def.desc;
  const match = party.filter(p => p.types.includes(def.affinity!));
  if (match.length === 0) return def.desc;
  return `${def.desc} (지금 파티: ${match.map(p => p.name).join(", ")})`;
}

// 카탈로그 전체(꾸미기 화면 목록용)
export { FURNITURE };
