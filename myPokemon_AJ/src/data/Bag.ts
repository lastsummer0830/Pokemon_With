import Phaser from "phaser";
import { getItem, ItemData } from "./ar";

// 가방(인벤토리) — 아이템을 "무엇을 몇 개" 들고 있는지만 기록한다.
//  ⚠️ 실제 런타임 상태는 씬 registry 에 있다(파티·이름과 같은 방식). 저장은 systems/save.ts 가 registry를 통째로 직렬화한다.
//     그래서 여기 함수들은 전부 registry(reg)를 받아 조작한다.

export interface BagEntry {
  itemId: string;   // 아이템 id (= ar/items.json 의 키, 예: "POKEBALL")
  count: number;    // 개수
}

type Reg = Phaser.Data.DataManager;

// AR 포켓 번호 → 화면에 보일 한글 이름. (가방 탭)
//  원본(Essentials v21.1)은 포켓이 9개다: 1=일반 2=회복약 3=몬스터볼 4=기술머신 5=나무열매
//  6=편지 7=배틀아이템 8=소중한물건 9=Z크리스탈. 가방 배경 그림에도 8칸이 이미 구워져 있다.
//  아직 아이템이 하나도 없는 포켓(기술머신·열매 등)은 여기 안 적어 탭 순회에서 빠진다.
export const POCKET_NAME: Record<number, string> = {
  1: "일반",
  2: "회복약",
  3: "몬스터볼",
  4: "기술머신",    // 상록시티 바닥의 TM09(원본 Map56 이벤트)
  5: "나무열매",    // 1번도로 열매나무의 오랭열매(원본 Map10 이벤트)
  8: "소중한 물건",
};
// 탭 순서(회복약 → 볼 → 일반 → 기술머신 → 나무열매 → 소중한 물건).
//  원본 가방 배경에 8칸이 구워져 있고, 우리는 아이템이 실제로 생긴 포켓만 돈다.
export const POCKETS = [2, 3, 1, 4, 5, 8];

/**
 * 소중한 물건 포켓 — 스토리 진행용 물건이 들어간다(예: 오박사의 소개장).
 * 이 포켓 물건은 **버리거나 팔 수 없다**(원본 규칙과 동일). 판정을 여기 한 곳에 둔다.
 */
export const KEY_ITEM_POCKET = 8;

/** 이 아이템을 버리거나 팔 수 있나 — 소중한 물건이면 안 된다. */
export function isKeyItem(pocket: number): boolean {
  return pocket === KEY_ITEM_POCKET;
}

export const MAX_STACK = 99;

// 지금 가방 내용물 (없으면 빈 배열)
export function getBag(reg: Reg): BagEntry[] {
  return (reg.get("bag") as BagEntry[]) ?? [];
}

// 이 아이템을 몇 개 갖고 있나
export function countItem(reg: Reg, itemId: string): number {
  return getBag(reg).find(e => e.itemId === itemId)?.count ?? 0;
}

// 아이템 넣기 (같은 종류는 한 칸에 쌓인다)
export function addItem(reg: Reg, itemId: string, n = 1): void {
  const bag = [...getBag(reg)];
  const hit = bag.find(e => e.itemId === itemId);
  if (hit) hit.count = Math.min(MAX_STACK, hit.count + n);
  else bag.push({ itemId, count: Math.min(MAX_STACK, n) });
  reg.set("bag", bag);
}

// 아이템 빼기 (0개가 되면 목록에서 사라진다). 모자라면 아무것도 안 하고 false.
export function removeItem(reg: Reg, itemId: string, n = 1): boolean {
  const bag = [...getBag(reg)];
  const hit = bag.find(e => e.itemId === itemId);
  if (!hit || hit.count < n) return false;
  hit.count -= n;
  reg.set("bag", hit.count > 0 ? bag : bag.filter(e => e.itemId !== itemId));
  return true;
}

// 한 포켓(탭)에 든 것들 — 가방 화면이 목록을 그릴 때 쓴다.
//  카탈로그(items.json)에 없는 id는 건너뛴다(데이터가 바뀌어도 안 죽게).
export function itemsByPocket(reg: Reg, pocket: number): Array<{ entry: BagEntry; def: ItemData }> {
  const out: Array<{ entry: BagEntry; def: ItemData }> = [];
  for (const entry of getBag(reg)) {
    const def = getItem(entry.itemId);
    if (def && def.pocket === pocket) out.push({ entry, def });
  }
  return out;
}

// 소지금
export function getMoney(reg: Reg): number {
  return (reg.get("money") as number) ?? 0;
}
export function addMoney(reg: Reg, n: number): void {
  reg.set("money", Math.max(0, getMoney(reg) + n));
}
