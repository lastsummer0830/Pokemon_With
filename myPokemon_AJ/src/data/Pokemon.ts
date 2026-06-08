// 포켓몬 한 마리가 가져야 하는 정보들의 "약속"
export interface Pokemon {
  id: number;            // 도감 번호
  name: string;          // 이름 (예: "파이리")
  type: string;          // 속성 (예: "불꽃")
  level: number;         // 레벨
  maxHp: number;         // 최대 체력
  currentHp: number;     // 현재 체력
  attack: number;        // 공격력
  heldItem: string | null; // ★ 지닌 도구 (없으면 null) — 비밀 기능의 핵심
  condition: number;     // ★ 컨디션(집에서 쉰 정도) — 집 꾸미기와 배틀을 잇는 값
}

// 새 포켓몬을 만들어 주는 함수 (스윙의 copy()/생성자 역할)
export function createPokemon(name: string, type: string): Pokemon {
  return {
    id: 0, name, type, level: 5,
    maxHp: 30, currentHp: 30, attack: 10,
    heldItem: null,   // 처음엔 아무 도구도 안 지님
    condition: 0      // 처음 컨디션은 0
  };
}
