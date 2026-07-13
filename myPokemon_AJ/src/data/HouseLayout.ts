import { FurnitureDef, findFurniture } from "./furniture";

// 가구 하나가 "어디에 놓였는지" 한 칸 기록
export interface PlacedFurniture {
  itemId: string;  // 가구 종류 (예: "fireplace" = 벽난로)
  x: number;       // 방 격자 칸 x 좌표 (가구의 왼쪽 위 칸)
  y: number;       // 방 격자 칸 y 좌표
}

// 방 한 칸 전체 = 크기 + 놓인 가구 목록
export interface HouseLayout {
  width: number;                 // 방 가로 칸 수
  height: number;                // 방 세로 칸 수
  furniture: PlacedFurniture[];  // 놓아둔 가구 목록 (이 배열만 저장하면 방이 통째로 복원됨)
}

// 가구 하나가 실제로 깔고 앉는 칸들 (w×h 만큼)
export function cellsOf(p: PlacedFurniture): Array<{ x: number; y: number }> {
  const def = findFurniture(p.itemId);
  const w = def?.w ?? 1;
  const h = def?.h ?? 1;
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) out.push({ x: p.x + dx, y: p.y + dy });
  }
  return out;
}

// (x,y) 칸을 점유한 가구를 찾는다 (없으면 undefined). 캐릭터 충돌·치우기에 쓴다.
export function furnitureAt(house: HouseLayout, x: number, y: number): PlacedFurniture | undefined {
  return house.furniture.find(p => cellsOf(p).some(c => c.x === x && c.y === y));
}

// 이 가구를 (x,y)에 놓을 수 있나?
//  isFloor(x,y) = 그 칸이 원래 방 바닥(걸어다닐 수 있는 칸)인가 — 방 격자(rooms.json blocked)를 아는 씬이 넘겨준다.
//  조건: 필요한 칸이 전부 바닥이고, 이미 놓인 다른 가구와 겹치지 않아야 한다.
export function canPlace(
  house: HouseLayout,
  def: FurnitureDef,
  x: number,
  y: number,
  isFloor: (cx: number, cy: number) => boolean,
): boolean {
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= house.width || cy >= house.height) return false;
      if (!isFloor(cx, cy)) return false;
      if (furnitureAt(house, cx, cy)) return false;
    }
  }
  return true;
}
