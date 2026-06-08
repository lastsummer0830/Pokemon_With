// 가구 하나가 "어디에 놓였는지" 한 칸 기록
export interface PlacedFurniture {
  itemId: string;  // 가구 종류 (예: "fireplace" = 벽난로)
  x: number;       // 방 격자 칸 x 좌표
  y: number;       // 방 격자 칸 y 좌표
}

// 방 한 칸 전체 = 크기 + 놓인 가구 목록
export interface HouseLayout {
  width: number;                 // 방 가로 칸 수
  height: number;                // 방 세로 칸 수
  furniture: PlacedFurniture[];  // 놓아둔 가구 목록 (이 배열만 저장하면 방이 통째로 복원됨)
}
