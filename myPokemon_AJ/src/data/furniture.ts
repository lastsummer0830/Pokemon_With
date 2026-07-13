// 놓을 수 있는 가구 카탈로그
// HouseLayout 은 itemId 로만 가구를 가리키고, 실제 이름·그림·효과는 여기서 정의한다.
//
// ⚠️ affinity(잘 맞는 속성)는 반드시 종족 데이터(species.json)와 **같은 표기**를 쓴다 = 대문자 영어("FIRE").
//    예전엔 "불꽃"/"물"(한글)로 적혀 있어서 포켓몬 타입("FIRE"/"WATER")과 영원히 안 맞았다.
export interface FurnitureDef {
  id: string;              // 가구 고유 id (PlacedFurniture.itemId 와 짝)
  name: string;            // 화면에 보이는 이름
  sprite: string;          // 텍스처 키 (= public/assets/house/furniture/<id>.png)
  w: number;               // 차지하는 칸 수(가로)
  h: number;               // 차지하는 칸 수(세로)
  walkable: boolean;       // 밟고 지나갈 수 있나 (러그·카펫=true, 벽난로·책장 같은 덩치=false)
  // 그림이 '정면(벽면)' 각도라 벽에 등을 대야만 자연스러운 가구 → 위쪽이 벽인 자리에만 놓을 수 있다.
  //  (벽난로를 방 한가운데 놓으면 공중에 뜬 것처럼 보인다 — 그림 각도가 곧 배치 제약이다.)
  wallOnly: boolean;
  comfort: number;         // 파티 전원에게 주는 편안함 점수 (컨디션 '상한'을 올린다)
  affinity: string | null; // 잘 맞는 포켓몬 속성 (대문자 영어, 없으면 null)
  affinityBonus: number;   // 속성이 맞는 포켓몬에게만 추가로 주는 점수
  desc: string;            // 꾸미기 화면에 띄우는 한 줄 설명
}

// 속성 코드 → 한글 이름 (설명·대사 표시용)
export const TYPE_NAME_KO: Record<string, string> = {
  FIRE: "불꽃", WATER: "물", GRASS: "풀", ELECTRIC: "전기", NORMAL: "노말",
};

// 놓을 수 있는 가구 목록 (여기에 한 줄씩 늘려가면 된다)
//  칸 수(w·h)는 실제 그림 크기와 반드시 같아야 한다(32px = 1칸).
// ⚠️ 2026-07-13: 벽난로·수조·책장 3종을 뺐다(사용자 지적 — 그림이 방에 안 맞는다).
//   - fireplace: 정면 각도라 위쪽 벽에만 붙는데, 이 방엔 그런 자리가 사실상 없다(회전 불가).
//   - aquarium:  실제 그림은 수조가 아니라 '길가 화단'(야외 조경물) — 가정집 방에 둘 물건이 아니다.
//   - bookshelf: 실제 그림은 책장이 아니라 '등받이 맞댄 소파 2인석'(포켓몬센터 대기의자).
//   → 대체할 실내 가구는 AR 타일셋에서 다시 골라 Pick에 올린 뒤 사용자가 고른다.
//     그 전까지 속성 가구는 풀(GRASS)뿐이라 불꽃·물 포켓몬은 comfort 보너스만 받는다.
export const FURNITURE: FurnitureDef[] = [
  {
    id: "plant", name: "관엽식물", sprite: "furn_plant", w: 1, h: 2, walkable: false, wallOnly: false,
    comfort: 5, affinity: "GRASS", affinityBonus: 25,
    desc: "싱그러운 잎. 풀 포켓몬이 특히 좋아한다.",
  },
  {
    id: "rug", name: "러그", sprite: "furn_rug", w: 3, h: 3, walkable: true, wallOnly: false,
    comfort: 10, affinity: null, affinityBonus: 0,
    desc: "폭신한 깔개. 밟고 지나갈 수 있다. 어떤 포켓몬이든 편하게 쉰다.",
  },
  {
    id: "cushion", name: "쿠션", sprite: "furn_cushion", w: 1, h: 1, walkable: false, wallOnly: false,
    comfort: 8, affinity: null, affinityBonus: 0,
    desc: "포켓몬이 몸을 파묻고 자기 좋다.",
  },
];

// id 로 가구 정의를 찾는 도우미 함수
export function findFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE.find(f => f.id === id);
}
