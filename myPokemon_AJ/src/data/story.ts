// 스토리 이정표 — "지금 이야기가 어디까지 왔나"를 한 값으로 읽는 곳.
//
// 왜 필요한가:
//   진행 상태가 registry의 개별 플래그(houseIntroDone·starterChosen·rivalBattlePending·badges)로
//   흩어져 있어서, NPC가 "지금 몇 번째 이정표인지"를 보고 대사를 바꿀 수가 없었다.
//   이 파일이 그 플래그들에서 진행도를 **파생**해 하나의 값(Story)으로 만든다.
//
// ⚠️ 새 세이브 필드를 만들지 않는다(전부 기존 플래그에서 계산).
//    → 기존 세이브(v4)를 그대로 읽을 수 있고 마이그레이션도 필요 없다.
//
// 이 게임의 이야기 축(IntroScene 나레이션 = 사용자가 쓴 원문):
//   "상처받은 포켓몬들의 마음을 마주하고, **잊혀진 유대**를 되찾기 위한 길을 찾아라."
//   → 그래서 유대(systems/bond.ts)가 시스템이자 주제다. NPC 대사도 이 축을 따른다.
import { josa } from "./josa";
import { GREEN_BADGE, hasBadge } from "./Badges";
import { countItem } from "./Bag";

type Reg = Phaser.Data.DataManager;

/** 스토리 이정표. 숫자가 클수록 뒤쪽 — `storyStep(reg) >= Story.Partner` 처럼 비교해 쓴다. */
export enum Story {
  /** 시작의 숲에서 깨어남(IntroScene). 아직 집 인트로 전. */
  Awakening = 0,
  /** 집 인트로 완료(네모 첫 등장) — 연구소로 가는 중. */
  Morning = 1,
  /** 스타터 수령 — 마을에서 첫 라이벌전이 기다린다. */
  Partner = 2,
  /** 첫 라이벌전 승리 — 상록시티로 향한다. */
  Rival = 3,
  /** 상록체육관 그린 격파(그린 배지). */
  Badge = 4,
}

/**
 * 지금 이정표. 뒤쪽부터 검사한다(뒤 조건이 참이면 앞 조건도 당연히 지났으므로).
 *
 * ⚠️ `rivalBattlePending`은 스타터를 받기 **전에도** false다(아직 예약이 안 걸렸으니).
 *    그래서 반드시 `starterChosen`을 먼저 본 뒤에 pending을 따져야 Rival로 잘못 튀지 않는다.
 */
export function storyStep(reg: Reg): Story {
  if (hasBadge(reg, GREEN_BADGE)) return Story.Badge;
  if (reg.get("starterChosen")) {
    return reg.get("rivalBattlePending") ? Story.Partner : Story.Rival;
  }
  return reg.get("houseIntroDone") ? Story.Morning : Story.Awakening;
}

/**
 * 오박사의 소개장 아이템 id —— 상록체육관(GymScene)에서 그린에게 보여주는 그 소개장.
 *
 * ⚠️ 우리가 지어낸 아이템이 아니라 **AR 원본에 실제로 있는 것**이다:
 *    items.dat의 `:OAKSINTRODUCTION` = "오박사의 소개장", pocket=8(소중한 물건).
 *    아이콘도 원본 `Graphics/Items/OAKSINTRODUCTION.png`를 그대로 쓴다.
 */
export const OAKS_LETTER = "OAKSINTRODUCTION";

/** 소개장을 갖고 있나 — 가방(소중한 물건 포켓)에 실제로 들어있는지로 판단한다. */
export function hasIntroLetter(reg: Reg): boolean {
  return countItem(reg, OAKS_LETTER) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 컨셉 훅 대사 — "집에서 돌보면 유대가 깊어지고, 그게 배틀로 돌아온다"를 게임 안에서 알려주는 말들.
//
// ⚠️ 여기 있는 건 **새로 추가하는 대사뿐**이다. 기존 대사(인트로 나레이션·엄마·네모·오박사)는
//    사용자가 쓴 원문이라 건드리지 않는다(myPokemon_AJ/AGENTS.md §1.5).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 오박사가 스타터를 건넨 직후 이어서 하는 말.
 * 기존 대사가 "포켓몬은 트레이너의 마음을 느낀다"까지만 말하고 끝나서,
 * **"그래서 어떻게 하면 되는데?"**(집에서 재우기·방 꾸미기·쓰다듬기)가 비어 있었다. 그걸 채운다.
 * @param disp 스타터의 표시 이름(별명이 있으면 별명)
 */
export function oakBondAdvice(disp: string): string[] {
  return [
    `${disp}${josa(disp, "과와")}의 유대를 깊게 하고 싶다면, 무엇보다 편히 쉴 곳이 필요하단다.`,
    "집으로 돌아가거든 침대에서 함께 자보렴. 방을 네 손으로 꾸밀수록 그 아이는 그곳을 제 집처럼 여길 게다.",
    "가끔 쓰다듬어 주는 것도 잊지 말고. 그렇게 쌓인 유대는 배틀에서 반드시 되돌아온단다.",
  ];
}

/** 대사 한 줄. speaker가 없으면 이름창 없이 박스만 뜬다(= 상황설명·나레이션, AGENTS.md §1.5). */
export interface Line {
  text: string;
  speaker?: string;
}

/**
 * 오박사가 소개장을 건네는 말. 이게 없으면 상록체육관에서 그린에게
 * **받은 적 없는 소개장**을 건네게 된다(GymScene의 원본 이식 컷신이 소개장을 전제한다).
 * @param you 플레이어 이름
 */
export function oakLetterLines(you: string): Line[] {
  return [
    { text: "아 참, 이걸 깜빡할 뻔했구나.", speaker: "오박사" },
    { text: "상록시티 체육관에 내 손자 그린이 있단다. 네 사정을 아는 아이는 아마 그 아이뿐일 게야.", speaker: "오박사" },
    // 아이템 획득 알림은 화자가 없는 나레이션이다(이름창 없이 박스만).
    { text: `${you}${josa(you, "은는")} 오박사의 소개장을 받았다!` },
    { text: "그 아이는 좀 무뚝뚝하지만... 이 소개장을 보여주면 이야기를 들어줄 게다.", speaker: "오박사" },
  ];
}

/**
 * 스타터를 받고 집에 처음 돌아왔을 때의 나레이션(이름창 없는 상황설명).
 * 오박사의 조언을 실제 조작(F=꾸미기, 침대=자기)과 이어 붙여 준다.
 */
export const HOME_BOND_HINT: string[] = [
  "오박사님의 말이 떠올랐다. — 포켓몬은 편히 쉴 곳이 있어야 마음을 연다고.",
  "침대에서 함께 자면 유대가 깊어진다. (F키: 방 꾸미기)",
];

// ── [미적용] 첫 라이벌전 패배 후 네모의 유대 언급 ────────────────────────────
//  "네 파트너가 유난히 잘 따르더라"로 유대가 배틀에 영향을 준다는 걸 플레이어가 눈치채게 하려던 자리.
//  ⚠️ 일부러 비워 뒀다: 네모 대사는 **SV 공식 대사를 확인한 뒤에만** 쓴다(AGENTS.md §1.5 "말투 지어내기 금지",
//     WorldScene의 기존 네모 대사도 "SV 공식 대사 기반, 창작 아님"으로 못박혀 있다).
//     SV 첫 라이벌전 패배 대사 원문을 확보하면 그 말투에 맞춰 여기에 추가할 것.
