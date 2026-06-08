import { Pokemon } from "./Pokemon";

// 플레이어 정보(이름·파티)
export interface Player {
  name: string;        // 플레이어 이름
  money: number;       // 소지금
  party: Pokemon[];    // 데리고 다니는 포켓몬 (최대 6마리)
}

// 새 플레이어를 만들어 주는 함수
export function createPlayer(name: string): Player {
  return {
    name,
    money: 3000,
    party: []
  };
}
