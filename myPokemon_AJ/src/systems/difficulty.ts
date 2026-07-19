// 난이도 — Another Red의 "Automatic Level Scaling" 플러그인을 그대로 옮긴다.
//
// ⚠️ AR에서 난이도가 바꾸는 것은 **상대 트레이너의 레벨뿐**이다(조사로 확정, 2026-07-13):
//    - 트레이너 팀 구성·기술·아이템: 안 바뀜 (플러그인이 update_moves: false)
//    - 야생 인카운터 테이블·야생 레벨: 안 바뀜 (야생은 난이도와 무관하게 항상 같은 스케일)
//    - 경험치·상금·AI: 안 바뀜
//    그러니 종족/기술/상성 데이터(species.json 등)는 난이도 중립이라 그대로 쓰면 된다.
//
// ⚠️ 또한 AR의 트레이너 레벨은 **고정값이 아니다.** trainers.dat에 적힌 Lv10·Lv13 같은 값은
//    '파티 평균 대비 오프셋'으로만 쓰이고, 실제 레벨은 플레이어 파티 평균에서 다시 계산된다.
//      실제레벨 = (내 파티의 균형 평균) - 2 + 난이도보정 + (체육관 관장 +3 / 챔피언 +5)
//                 + (그 포켓몬의 원본레벨 - 원본팀 평균)
//    → 초반에 파티가 약하면 상대도 약해진다. 그래서 "레벨 노가다로 체육관을 뭉개는" 일이 없다.
//
// 게임 시작 시 1회 고르고 도중에 바꿀 수 없다(AR과 동일).

export type Difficulty = "easy" | "normal" | "hard" | "extreme" | "insane";

export interface DifficultyDef {
  id: Difficulty;
  name: string;            // 화면에 보일 이름
  fixed: number;           // 레벨 고정 보정
  random: number;          // 여기에 0~random 만큼 더 붙는다(매 트레이너마다 굴림)
  desc: string;
}

// AR 원본 수치(플러그인 002_Settings.rb의 DIFFICULTIES) 그대로.
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy:    { id: "easy",    name: "이지",     fixed: -4, random: 0, desc: "상대가 확실히 약하다. 편하게 즐기고 싶다면." },
  normal:  { id: "normal",  name: "노말",     fixed: -3, random: 2, desc: "적당히 무난한 난이도." },
  hard:    { id: "hard",    name: "하드",     fixed: 0,  random: 0, desc: "상대가 내 파티와 비슷한 수준이다." },
  extreme: { id: "extreme", name: "익스트림", fixed: 1,  random: 2, desc: "상대가 나보다 조금 강하다." },
  insane:  { id: "insane",  name: "인새인",   fixed: 3,  random: 2, desc: "상대가 확실히 강하다. 각오할 것." },
};

export const DEFAULT_DIFFICULTY: Difficulty = "normal";

export function difficultyDef(d: Difficulty): DifficultyDef {
  return DIFFICULTIES[d] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

// 트레이너 타입 id로 관장/챔피언 레벨 보정을 정한다(위 공식의 +3/+5).
export function leaderBonusForType(type: string): number {
  const t = type.toUpperCase();
  if (t.includes("CHAMPION")) return 5;
  if (t.includes("LEADER")) return 3;
  return 0;
}

// AR "Automatic Level Scaling" — 트레이너 각 포켓몬의 실제 레벨을 플레이어 파티 평균 기준으로 다시 계산한다.
//  실제레벨 = 파티평균 - 2 + 난이도fixed + rand(0..random) + 관장/챔피언보정 + (원본레벨 - 원본팀평균)
//  → 원본 팀 안의 레벨 격차는 보존되고(에이스가 여전히 제일 셈), 전체 높이는 내 파티에 맞춰 움직인다.
//  clamp 2~100. rng는 테스트 주입용(기본 Math.random).
export function scaledTrainerLevel(
  origLevel: number,
  partyAvg: number,
  teamAvg: number,
  leaderBonus: number,
  diff: Difficulty,
  rng: () => number = Math.random,
): number {
  const d = difficultyDef(diff);
  const rand = d.random > 0 ? Math.floor(rng() * (d.random + 1)) : 0;
  const lv = Math.round(partyAvg - 2 + d.fixed + rand + leaderBonus + (origLevel - teamAvg));
  return Math.max(2, Math.min(100, lv));
}
