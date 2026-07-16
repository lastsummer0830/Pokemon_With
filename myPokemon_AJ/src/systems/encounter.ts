// 야생 조우 — "풀숲을 밟았을 때 포켓몬이 나올까?"와 "그럼 무엇이 몇 레벨로 나올까?"만 담당한다.
//
// ★ 공식은 지어낸 것이 아니라 Another Red 원본(Pokémon Essentials) 스크립트를 그대로 옮긴 것이다:
//     Overworld_WildEncounters.rb 의 `encounter_triggered?` · `choose_wild_pokemon`
//   조우표(가중치·레벨·stepChance)도 AR encounters.dat 추출본(assets/data/ar/encounters.json).
//
// 원본에서 **일부러 뺀 것**(이 게임에 아직 없는 기능들 — 생기면 여기에 더한다):
//   자전거·리펠·검은/하얀 피리·특성(정전기·야망 등)·지닌도구(정화의부적)·포켓치·시간대별 조우표.
//   그래서 남는 건 "기본 확률 + 누산기 + 배틀 직후 유예" 세 가지고, 그건 아래에 전부 있다.

import { EncounterTable, EncounterSlot } from "../data/ar";

// 조우 판정 상태(원본의 PokemonEncounters 인스턴스 변수 두 개).
//  씬을 넘나들어도(배틀 다녀와 WorldScene이 새로 만들어져도) 유지돼야 해서 모듈 수준에 둔다.
//  ⚠️ 저장에는 안 넣는다 — 불러오기 하면 "방금 배틀한 직후" 상태가 아니라 새 걸음으로 시작하는 게 맞다.
const state = {
  stepCount: 0,          // @step_count — 마지막 조우 이후 걸은 수(유예 구간 계산용)
  chanceAccumulator: 0,  // @chance_accumulator — 허탕친 걸음마다 쌓여 확률을 아주 조금씩 올린다
};

/** 조우가 실제로 일어났을 때 원본처럼 걸음수·누산기를 초기화한다(reset_step_count). */
export function resetEncounterSteps(): void {
  state.stepCount = 0;
  state.chanceAccumulator = 0;
}

/**
 * 풀숲에서 한 걸음 걸었다 — 야생 포켓몬이 나오나?
 *  (원본 `encounter_triggered?(enc_type, repel_active=false, triggered_by_step=true)`의 축약판)
 *
 * @param stepChance 그 맵의 land 조우 확률(%) — 1번도로는 21.
 * @param rnd 난수원(테스트에서 고정값을 넣으려고 뺐다). 기본은 Math.random.
 */
export function encounterTriggered(stepChance: number, rnd: () => number = Math.random): boolean {
  if (!stepChance) return false;   // 조우표가 없거나 확률 0인 맵

  // 원본: rand(100) < encounter_chance  → 퍼센트를 그대로 확률로 쓴다.
  const rand100 = () => rnd() * 100;

  // 기본 확률 + 유예 구간 길이. min_steps_needed = (8 - stepChance/10).clamp(0, 8)
  //  1번도로(21)면 5.9보 — 배틀이 끝나고 6보 정도는 연달아 안 걸리게 하는 장치.
  //  ⚠️ 누산기는 Math.floor로 나눈다: 원본에서 @chance_accumulator는 정수라 `/ 200`이 **정수 나눗셈**이다
  //     (허탕 10보마다 +1%p씩 계단식으로 오른다. 실수로 나누면 조금씩 더 잘 나온다).
  const bonus = Math.floor(state.chanceAccumulator / 200);
  const encounterChance = stepChance + bonus;
  const minStepsNeeded = Math.min(Math.max(8 - stepChance / 10, 0), 8);

  // 직전 조우 직후 몇 보는 훨씬 덜 나온다(원본 주석 그대로).
  //  분모가 보정 전 확률이라 보정이 없는 우리 게임에선 항상 rand(100) >= 5 → 95%로 즉시 false다.
  //  (원본 식을 그대로 남겨둔다 — 나중에 자전거·특성 보정이 붙으면 이 비율이 의미를 갖는다.)
  if (state.stepCount < minStepsNeeded) {
    state.stepCount += 1;
    const graceDenom = stepChance + bonus;
    if (rand100() >= (encounterChance * 5) / graceDenom) return false;
  }

  // 진짜 판정
  if (rand100() < encounterChance) return true;

  // 허탕 → 다음 걸음은 아주 조금 더 잘 나오게 (Land 21이면 한 보당 +0.105%p)
  state.chanceAccumulator += stepChance;
  return false;
}

/**
 * 무엇이 몇 레벨로 나올지 뽑는다 (원본 `choose_wild_pokemon`의 가중 룰렛).
 *  슬롯 가중치 합으로 정규화하므로 합이 100이 아니어도 된다.
 */
export function chooseWildPokemon(
  table: EncounterTable, rnd: () => number = Math.random,
): { speciesId: string; level: number } | undefined {
  const list = table.land;
  if (!list || !list.length) return undefined;

  const total = list.reduce((sum, s) => sum + s.w, 0);
  if (total <= 0) return undefined;

  let r = Math.floor(rnd() * total);
  let hit: EncounterSlot = list[list.length - 1];   // 부동소수 오차로 못 고르는 일이 없게 마지막 슬롯을 기본값으로
  for (const slot of list) {
    r -= slot.w;
    if (r < 0) { hit = slot; break; }
  }

  // 원본: level = rand(min..max) — 양끝 포함
  const level = hit.min + Math.floor(rnd() * (hit.max - hit.min + 1));
  return { speciesId: hit.id, level };
}
