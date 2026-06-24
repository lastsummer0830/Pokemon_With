import { Pokemon } from "./Pokemon";

// 주인공 성별 (남=1세대 RED, 여=4세대 DAWN — AGENTS.md §1.5 확정)
export type Gender = "boy" | "girl";

// 플레이어 정보(이름·성별·파티)
export interface Player {
  name: string;        // 플레이어 이름
  gender: Gender;      // 주인공 성별
  money: number;       // 소지금
  party: Pokemon[];    // 데리고 다니는 포켓몬 (최대 6마리)
}

// 새 플레이어를 만들어 주는 함수
export function createPlayer(name: string, gender: Gender = "boy"): Player {
  return {
    name,
    gender,
    money: 3000,
    party: []
  };
}
