// 놓을 수 있는 가구 카탈로그
// HouseLayout 은 itemId 로만 가구를 가리키고, 실제 이름·그림·효과는 여기서 정의한다.
export interface FurnitureDef {
  id: string;       // 가구 고유 id (PlacedFurniture.itemId 와 짝)
  name: string;     // 화면에 보이는 이름
  sprite: string;   // assets/sprites 안의 그림 키
  affinity?: string; // 잘 맞는 포켓몬 속성 (예: "불꽃") — homeBonus 계산에 참고
}

// 놓을 수 있는 가구 목록 (여기에 한 줄씩 늘려가면 된다)
export const FURNITURE: FurnitureDef[] = [
  { id: "fireplace", name: "벽난로", sprite: "furniture_fireplace", affinity: "불꽃" },
  { id: "pond",      name: "연못",   sprite: "furniture_pond",      affinity: "물" },
  { id: "bed",       name: "침대",   sprite: "furniture_bed" },
  { id: "table",     name: "탁자",   sprite: "furniture_table" },
];

// id 로 가구 정의를 찾는 도우미 함수
export function findFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE.find(f => f.id === id);
}
