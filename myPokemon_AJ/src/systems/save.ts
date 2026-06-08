import { Player } from "../data/Player";
import { HouseLayout } from "../data/HouseLayout";

// 저장/불러오기 로직
// 우선은 브라우저 localStorage 에 저장한다. (나중에 선택적으로 스프링부트 백엔드로 교체 가능)

const SAVE_KEY = "myPokemon.save";

// 저장할 전체 게임 상태
export interface SaveData {
  player: Player;
  house: HouseLayout;
}

// 게임 상태를 글자(JSON)로 바꿔서 저장
export function save(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

// 저장된 글자를 다시 게임 상태로 복원 (없으면 null)
export function load(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SaveData;
}

// 저장 지우기
export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
