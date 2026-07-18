// 유대(Bond) — 이 게임의 핵심 축.
//   "포켓몬을 돌볼수록(케어) 유대가 깊어지고, 그 유대가 배틀로 갚아진다."
//
// 저장은 Pokemon.condition(0~100) 필드를 그대로 재사용한다(기존 세이브 호환 유지).
//   → 값의 '이름'은 아직 condition이지만, 이 게임에서 그 의미는 '유대'다.
// 이 파일이 유대 규칙(값·상승·표시·배틀보정)의 단일 원천이다. 다른 곳에서 재구현하지 말 것.
//   - 케어로 유대를 올리는 방법: 쓰다듬기(pet, 여기) · 집에서 쉬기(systems/homeBonus.ts) · [예정] 먹이.
//   - 유대를 읽는 곳: 배틀 데미지(systems/battle.ts) · 파티/상세 화면(scenes/MenuScene.ts).
import { Pokemon, displayName } from "../data/Pokemon";
import { josa } from "../data/josa";

export const BOND_MAX = 100;      // 유대 절대 상한
export const BOND_HEARTS = 5;     // 표시용 하트 칸 수 (20당 1칸)
const PET_GAIN = 5;               // 쓰다듬기 1회 상승량

// 현재 유대값(0~100). condition 필드를 유대로 읽는다(범위 보정 포함).
export function bondOf(p: Pokemon): number {
  return Math.max(0, Math.min(BOND_MAX, p.condition ?? 0));
}

// 채워진 하트 수(0~5). 유대 20당 1칸. (값이 있으면 최소 1칸은 표시쪽에서 반올림으로 자연히 나온다)
export function bondHearts(p: Pokemon): number {
  return Math.round(bondOf(p) / (BOND_MAX / BOND_HEARTS));
}

// 유대 단계 라벨(짧은 한국어). 화면에 하트와 함께 보여준다.
export function bondLabel(p: Pokemon): string {
  const b = bondOf(p);
  if (b >= 90) return "떼려야 뗄 수 없는 사이";
  if (b >= 70) return "깊은 유대";
  if (b >= 45) return "잘 따른다";
  if (b >= 20) return "친해지는 중";
  return "아직 서먹하다";
}

// 케어 결과 — 화면이 이걸 보고 토스트/대사를 띄운다.
export interface CareResult {
  gained: number;   // 실제 오른 양(만점이면 0)
  bond: number;     // 오른 뒤 유대값
  message: string;  // 표시 문구
}

// 쓰다듬기 — 가장 기본적인 케어. 유대를 조금 올린다.
//   실제 연타 제한(세션당 1회 등)은 호출부(MenuScene)가 관리한다. 여기선 값만 올린다.
export function pet(p: Pokemon): CareResult {
  const before = bondOf(p);
  const gained = Math.min(PET_GAIN, BOND_MAX - before);
  p.condition = before + gained;
  const name = displayName(p);
  const message = gained > 0
    ? `${name}${josa(name, "을를")} 쓰다듬어 주었다.\n${name}${josa(name, "은는")} 무척 기뻐한다!`
    : `${name}${josa(name, "과와")}의 유대는 이미 더할 나위 없다!`;
  return { gained, bond: p.condition, message };
}

// 배틀 보정: 유대가 깊을수록 데미지가 살짝 오른다("집↔배틀 고리"를 유대로 일반화).
//   유대 100 → +10%. battle.ts가 이 값을 '읽기만' 한다(계산은 여기 한 곳).
export function bondDamageMult(p: Pokemon): number {
  return 1 + bondOf(p) / 1000;
}
