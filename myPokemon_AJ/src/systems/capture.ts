// 포획 — "던진 볼이 몇 번 흔들리고, 잡히나?"만 계산한다. 연출·볼 소비·파티 편입은 BattleScene이 한다.
//
// ★ 공식은 Another Red 원본(Pokémon Essentials) `pbCaptureCalc`
//   (Battle_CatchAndStoreMixin.rb)를 그대로 옮긴 것이다 — **5세대식**이다.
//   (예전 계획 메모엔 "3세대 공식"이라 적혀 있었는데 원본을 열어보니 아니었다:
//    상태이상 배율이 잠듦/얼음 ×2.5(3세대는 ×2), 흔들림 임계값도 y = 65536 / (255/x)^0.1875 다.)
//
// 원본에서 뺀 것:
//   · 울트라비스트·마스터볼(isUnconditional?) — 그런 볼·종족이 이 게임에 없다.
//   · 크리티컬 캡처 — 원본은 켜져 있지만 dex_modifier가 "잡은 종족 30종 초과"부터라 지금은 항상 0이다.
//     (도감이 30종을 넘기면 그때 붙인다. 지금 넣으면 절대 안 도는 코드가 된다.)

import { Pokemon } from "../data/Pokemon";
import { getSpecies } from "../data/ar";

// 볼별 포획률 배율 — 원본 Battle::PokeBallEffects::ModifyCatchRate 에 등록된 값.
//  몬스터볼은 핸들러가 아예 없다 = 배율 없음(×1). 슈퍼볼만 ×1.5로 등록돼 있다.
const BALL_RATE: Record<string, number> = {
  POKEBALL: 1,
  GREATBALL: 1.5,
};

export function isBall(itemId: string): boolean {
  return itemId.toUpperCase() in BALL_RATE;
}

/**
 * 볼을 던진 결과 = 흔들린 횟수 0~4. **4면 포획 성공**, 그 미만이면 그만큼 흔들리고 빠져나온다.
 *  (원본과 같은 반환 규약 — 연출이 이 숫자만큼 볼을 흔들면 된다.)
 *
 * @param target 야생 포켓몬(현재 HP·상태이상이 확률에 들어간다)
 * @param ballId "POKEBALL" | "GREATBALL"
 * @param rnd 난수원(테스트에서 고정값을 넣으려고 뺐다)
 */
export function captureShakes(target: Pokemon, ballId: string, rnd: () => number = Math.random): number {
  const species = getSpecies(target.speciesId);
  const baseRate = species?.catchRate ?? 255;   // 데이터가 없으면 가장 잘 잡히는 값으로(게임이 멈추는 것보다 낫다)
  const catchRate = baseRate * (BALL_RATE[ballId.toUpperCase()] ?? 1);

  // x = ((3·최대HP − 2·현재HP) × 포획률) / (3·최대HP)   — HP를 깎을수록 커진다
  const a = target.maxHp;
  const b = Math.max(0, target.currentHp);
  let x = ((3 * a - 2 * b) * catchRate) / (3 * a);

  // 상태이상 보정 — 잠듦·얼음 ×2.5 / 그 외(독·마비·화상) ×1.5
  if (target.status === "sleep" || target.status === "freeze") x *= 2.5;
  else if (target.status !== null) x *= 1.5;

  x = Math.max(1, Math.floor(x));
  if (x >= 255) return 4;   // 확정 포획 — 난수를 굴릴 필요가 없다

  // y = 흔들림 한 번을 통과할 임계값(65536 중). x가 클수록 y도 커져 잘 잡힌다.
  const y = Math.floor(65536 / Math.pow(255 / x, 0.1875));

  // 흔들림 4번을 각각 독립으로 판정 — 한 번 실패하면 거기서 멈춘다(원본 break 조건 그대로).
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (shakes < i) break;
    if (Math.floor(rnd() * 65536) < y) shakes += 1;
  }
  return shakes;
}

// 흔들림 횟수별 실패 대사 — AR 한국어판 messages_kor_core.dat의 번역문 그대로.
export const SHAKE_FAIL_TEXT: Record<number, string> = {
  0: "아이고! 포켓몬이 빠져나왔다!",
  1: "앗! 잡힌 줄 알았는데!",
  2: "으윽! 거의 잡았는데!",
  3: "으악! 정말 아슬아슬했다!",
};
