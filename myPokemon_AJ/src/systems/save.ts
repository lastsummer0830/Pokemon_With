import Phaser from "phaser";
import { Pokemon } from "../data/Pokemon";
import { HouseLayout } from "../data/HouseLayout";
import { BagEntry, addItem, countItem } from "../data/Bag";
import { OAKS_LETTER } from "../data/story";
import { findFurniture } from "../data/furniture";
import { Difficulty, DEFAULT_DIFFICULTY } from "./difficulty";
import { emptyHouse } from "./homeBonus";

// 저장/불러오기 — 브라우저 localStorage.
//  ⚠️ 실제 런타임 상태는 씬 registry에 있다(파티·이름·성별·라이벌 예약·집인트로 등).
//     그래서 registry를 '단일 원천'으로 직렬화/복원한다. 위치(loc)는 메뉴를 연 씬이 미리 registry에 기록한다.
//  v2: houseLayout(집 꾸미기 배치) 추가.
//  v3: 가방·도감·소지금·뱃지 추가. 옛 저장은 아래 마이그레이션이 기본값을 채워 그대로 이어할 수 있다.
//  v4: 파티 포켓몬에 caughtBall(잡은 볼) 추가. 옛 저장은 몬스터볼로 채운다.
//  v5: **세이브 슬롯 여러 개** + 플레이 시간(playSeconds). 옛 1칸 저장은 '세이브 A'로 옮긴다.
const SAVE_VERSION = 5;

// ─────────────────────────────────────────────────────────────────────────────
// 세이브 슬롯 — 원본(Another Red)의 `Auto Multi Save` 플러그인과 같은 구성이다.
//   AUTO_SLOTS  = 자동세이브 3칸(돌아가며 덮어쓴다)
//   MANUAL_SLOTS = 세이브 A~H 8칸(플레이어가 고른다)
// 원본은 저장할 때 "불러온 슬롯에 그대로" 또는 "다른 슬롯 고르기"가 된다 → 우리도 마지막 슬롯을 기억한다.
// ─────────────────────────────────────────────────────────────────────────────
const KEY_PREFIX = "myPokemon.save.";
const LEGACY_KEY = "myPokemon.save";     // 슬롯이 없던 시절의 단일 저장(첫 실행 때 A로 옮긴다)
const LAST_SLOT_KEY = "myPokemon.lastSlot";

export const AUTO_SLOTS = ["auto1", "auto2", "auto3"] as const;
export const MANUAL_SLOTS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type SlotId = typeof AUTO_SLOTS[number] | typeof MANUAL_SLOTS[number];
export const ALL_SLOTS: SlotId[] = [...AUTO_SLOTS, ...MANUAL_SLOTS];

/** 화면에 보일 슬롯 이름(원본 플러그인의 슬롯 이름과 같다). */
export function slotLabel(id: SlotId): string {
  return id.startsWith("auto") ? `자동세이브 ${id.slice(4)}` : `세이브 ${id}`;
}
export function isAutoSlot(id: SlotId): boolean { return id.startsWith("auto"); }

const slotKey = (id: SlotId): string => KEY_PREFIX + id;

function readRaw(id: SlotId): SaveData | null {
  try {
    const raw = localStorage.getItem(slotKey(id));
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch { return null; }
}

/**
 * 슬롯이 없던 시절의 저장(`myPokemon.save`)을 **세이브 A**로 한 번만 옮긴다.
 * (원본 플러그인도 첫 로드 때 옛 Game.rxdata를 첫 수동 슬롯으로 복사한다.)
 * ⚠️ A가 이미 차 있으면 건드리지 않는다 — 남의 저장을 덮으면 안 된다.
 */
function migrateLegacy(): void {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (!old) return;
    if (!localStorage.getItem(slotKey("A"))) {
      localStorage.setItem(slotKey("A"), old);
      localStorage.setItem(LAST_SLOT_KEY, "A");
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* noop */ }
}

/** 마지막으로 저장하거나 불러온 슬롯(없으면 A). 인게임 '저장'의 기본 선택지가 된다. */
export function lastSlot(): SlotId {
  migrateLegacy();
  try {
    const v = localStorage.getItem(LAST_SLOT_KEY) as SlotId | null;
    if (v && ALL_SLOTS.includes(v)) return v;
  } catch { /* noop */ }
  return "A";
}
function setLastSlot(id: SlotId): void {
  try { localStorage.setItem(LAST_SLOT_KEY, id); } catch { /* noop */ }
}

/** 슬롯 목록 — 이어하기/저장 화면이 그대로 그린다. data가 null이면 빈 슬롯. */
export interface SlotInfo {
  id: SlotId;
  label: string;
  auto: boolean;
  data: SaveData | null;
}
export function listSlots(): SlotInfo[] {
  migrateLegacy();
  return ALL_SLOTS.map(id => ({ id, label: slotLabel(id), auto: isAutoSlot(id), data: readRaw(id) }));
}

/** 플레이 시간을 "3시간 12분"처럼. 원본 로드화면의 Time 표시와 같은 자리다. */
export function playTimeText(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// 새 게임 시작 시 기본 소지금·지급품 (v2 이하 저장을 v3으로 올릴 때도 이 값을 쓴다)
export const START_MONEY = 3000;
export const START_BAG: BagEntry[] = [
  { itemId: "POKEBALL", count: 5 },
  { itemId: "POTION", count: 3 },
];

export interface SaveLoc {
  scene: string;                              // 복원할 씬 키
  map?: string;                               // 어느 야외 맵인가(WorldScene) — v3부터. 없으면 태초마을.
  tx?: number; ty?: number;                   // 맵 안에서의 칸 좌표(WorldScene)
  facing?: "down" | "left" | "right" | "up";  // 바라보는 방향(WorldScene)
  room?: string;                              // 실내 방(InteriorScene) — 정밀 타일이 아닌 방 단위 복원
}

// 저장할 전체 게임 상태(버전 필드로 이후 마이그레이션 대비).
export interface SaveData {
  version: number;
  name: string;
  gender: "boy" | "girl";
  party: Pokemon[];
  starterChosen: string | null;
  rivalBattlePending: boolean;
  rivalEnemySpecies: string | null;
  houseIntroDone: boolean;
  houseLayout: HouseLayout;  // ★ 집 꾸미기 배치(컨디션 상한을 결정) — v2부터
  // ── v3부터 ──
  difficulty: Difficulty;    // 게임 시작 시 1회 선택(AR과 동일 — 도중 변경 불가)
  money: number;
  bag: BagEntry[];
  dexSeen: string[];         // 마주친 종족 id
  dexOwn: string[];          // 내 것이 된 종족 id
  badges: string[];          // 얻은 뱃지 id
  trainersDefeated: string[];// 이미 이긴 트레이너 id (재도전 방지)
  loc: SaveLoc;
  savedAt: number;   // 저장 시각(표시용)
  // ── v5부터 ──
  playSeconds?: number;   // 누적 플레이 시간(초) — 원본 로드화면의 "Time"과 같은 자리
}

type Reg = Phaser.Data.DataManager;

// ── 플레이 시간 ──────────────────────────────────────────────────────────────
//  registry에 "playSeconds"(지금까지 쌓인 시간)와 "sessionStart"(이번에 켠 시각)를 둔다.
//  저장할 때 둘을 합쳐 기록한다 — 타이머를 따로 돌리지 않아 씬 전환에 영향받지 않는다.
export function startPlayClock(reg: Reg, base = 0): void {
  reg.set("playSeconds", base);
  reg.set("sessionStart", Date.now());
}
export function currentPlaySeconds(reg: Reg): number {
  const base = (reg.get("playSeconds") as number) ?? 0;
  const start = reg.get("sessionStart") as number | undefined;
  return start ? base + Math.floor((Date.now() - start) / 1000) : base;
}

// 저장이 하나라도 있는가(타이틀 '이어하기' 활성 판정용).
export function hasSave(): boolean {
  migrateLegacy();
  return ALL_SLOTS.some(id => {
    try { return !!localStorage.getItem(slotKey(id)); } catch { return false; }
  });
}

// 현재 registry 상태를 모아 저장한다. 위치는 registry "saveLoc"(메뉴 연 씬이 기록)에서 읽는다.
//  slot을 안 주면 **마지막에 쓰던 슬롯**에 저장한다(원본도 불러온 슬롯에 바로 저장한다).
export function saveGame(reg: Reg, slot: SlotId = lastSlot()): void {
  const data: SaveData = {
    version: SAVE_VERSION,
    name: (reg.get("playerName") as string) ?? "",
    gender: (reg.get("playerGender") as "boy" | "girl") ?? "boy",
    party: (reg.get("playerParty") as Pokemon[]) ?? [],
    starterChosen: (reg.get("starterChosen") as string) ?? null,
    rivalBattlePending: !!reg.get("rivalBattlePending"),
    rivalEnemySpecies: (reg.get("rivalEnemySpecies") as string) ?? null,
    houseIntroDone: !!reg.get("houseIntroDone"),
    houseLayout: (reg.get("houseLayout") as HouseLayout) ?? emptyHouse(),
    difficulty: (reg.get("difficulty") as Difficulty) ?? DEFAULT_DIFFICULTY,
    money: (reg.get("money") as number) ?? START_MONEY,
    bag: (reg.get("bag") as BagEntry[]) ?? [],
    dexSeen: (reg.get("dexSeen") as string[]) ?? [],
    dexOwn: (reg.get("dexOwn") as string[]) ?? [],
    badges: (reg.get("badges") as string[]) ?? [],
    trainersDefeated: (reg.get("trainersDefeated") as string[]) ?? [],
    loc: (reg.get("saveLoc") as SaveLoc) ?? { scene: "WorldScene" },
    savedAt: Date.now(),
    playSeconds: currentPlaySeconds(reg),
  };
  try { localStorage.setItem(slotKey(slot), JSON.stringify(data)); } catch { return; }
  setLastSlot(slot);
}

/**
 * 자동저장 — 원본처럼 **자동 슬롯 3칸을 돌아가며** 쓴다(수동 저장을 덮지 않는다).
 * ⚠️ 마지막 슬롯 표시는 자동 슬롯으로 옮기지 않는다 — 안 그러면 그 다음 수동 저장이
 *    자동 슬롯을 덮어써서 "내가 저장한 칸이 아닌 데" 저장된다.
 */
function nextAutoSlot(): SlotId {
  const times = AUTO_SLOTS.map(id => readRaw(id)?.savedAt ?? 0);
  let oldest = 0;
  for (let i = 1; i < times.length; i++) if (times[i] < times[oldest]) oldest = i;
  return AUTO_SLOTS[oldest];
}

// 저장을 읽어 registry에 되살린다. 성공 시 SaveData(특히 loc)를 반환, 없거나 깨졌으면 null.
//  slot을 안 주면 마지막에 쓰던 슬롯을 연다.
export function loadGame(reg: Reg, slot: SlotId = lastSlot()): SaveData | null {
  migrateLegacy();
  const data = readRaw(slot);
  if (!data) return null;
  setLastSlot(slot);
  // 플레이 시간 이어가기 — 이 슬롯에 쌓여 있던 시간부터 다시 센다.
  startPlayClock(reg, data.playSeconds ?? 0);
  reg.set("playerName", data.name);
  reg.set("playerGender", data.gender);
  // v3 이하 저장의 파티엔 caughtBall이 없다 → 몬스터볼로 채운다(볼 아이콘 표시가 비지 않게).
  const party = data.party ?? [];
  for (const p of party) if (!p.caughtBall) p.caughtBall = "POKEBALL";
  reg.set("playerParty", party);
  reg.set("starterChosen", data.starterChosen ?? null);
  reg.set("rivalBattlePending", !!data.rivalBattlePending);
  reg.set("rivalEnemySpecies", data.rivalEnemySpecies ?? null);
  reg.set("houseIntroDone", !!data.houseIntroDone);
  // v1 저장에는 houseLayout이 없다 → 빈 방으로 채워 그대로 이어하게 한다(마이그레이션).
  //  ⚠️ 카탈로그에서 빠진 가구(예전 벽난로·수조·책장)가 저장에 남아 있으면 그림 없이 칸만 막는
  //     '보이지 않는 벽'이 된다 → 지금 카탈로그에 있는 가구만 남긴다.
  const house = data.houseLayout ?? emptyHouse();
  house.furniture = (house.furniture ?? []).filter(p => !!findFurniture(p.itemId));
  reg.set("houseLayout", house);

  // ── v2 이하 → v3 마이그레이션: 난이도·가방·도감·소지금·뱃지가 없던 저장을 기본값으로 채운다 ──
  reg.set("difficulty", data.difficulty ?? DEFAULT_DIFFICULTY);
  reg.set("money", data.money ?? START_MONEY);
  reg.set("bag", data.bag ?? START_BAG.map(e => ({ ...e })));
  // 도감이 없던 저장이면 "지금 데리고 있는 파티 = 잡은 것"으로 인정한다(빈 도감으로 되돌아가면 이상하니까).
  const partySpecies = (data.party ?? []).map(p => p.speciesId.toUpperCase());
  reg.set("dexSeen", data.dexSeen ?? partySpecies);
  reg.set("dexOwn", data.dexOwn ?? partySpecies);
  reg.set("badges", data.badges ?? []);
  reg.set("trainersDefeated", data.trainersDefeated ?? []);
  // ── 소개장 호환 채우기 ──
  //  '오박사의 소개장'은 스타터를 고르는 순간 지급되게 만들었다(LabScene). 그래서 그 기능이 생기기
  //  전에 스타터를 받아 둔 저장에는 소개장이 없고, 상록체육관 컷신("소개장을 그린에게 건냈다!")이
  //  갖고 있지도 않은 물건을 건네게 된다 → 스타터가 있는데 소개장이 없으면 여기서 채워 넣는다.
  //  ⚠️ 새 세이브 필드가 아니라 '가방 내용 보정'이다(버전을 올릴 필요가 없다).
  if (reg.get("starterChosen") && countItem(reg, OAKS_LETTER) === 0) addItem(reg, OAKS_LETTER, 1);

  // v2 저장의 tx,ty는 '태초마을 안에서의' 칸 좌표다(당시 야외 맵이 태초뿐이었다).
  //  v3부터 야외가 여러 맵이므로 어느 맵인지를 붙여준다 — 좌표 자체는 그대로 유효하다.
  const loc: SaveLoc = data.loc ? { ...data.loc } : { scene: "WorldScene" };
  if (loc.scene === "WorldScene" && !loc.map) loc.map = "pallet";
  reg.set("saveLoc", loc);
  return data;
}

// 스토리 이정표 자동저장 — 위치(loc)를 명시적으로 받아 기록한 뒤 통째로 저장한다.
//  메뉴 수동저장은 씬이 openMenu에서 saveLoc을 미리 넣지만, 자동저장은 메뉴를 안 거치므로
//  호출부(각 이정표 씬)가 "로드하면 돌아갈 위치"를 직접 넘긴다.
//  ⚠️ LabScene·GymScene은 이어하기(MainMenuScene) 복원 대상이 아니다 → 그 두 곳에서 부를 땐
//     loc.scene을 "WorldScene"으로, 좌표를 각 씬의 출구 마을 좌표로 변환해 넘겨야 로드 시 안 튄다.
export function autoSave(reg: Reg, loc: SaveLoc): void {
  reg.set("saveLoc", loc);
  const slot = nextAutoSlot();
  const keep = lastSlot();     // 수동 저장 위치는 그대로 둔다(위 nextAutoSlot 주석 참고)
  saveGame(reg, slot);
  setLastSlot(keep);
}

// 저장 지우기 — 슬롯을 안 주면 전부 지운다.
export function clearSave(slot?: SlotId): void {
  try {
    if (slot) localStorage.removeItem(slotKey(slot));
    else { for (const id of ALL_SLOTS) localStorage.removeItem(slotKey(id)); localStorage.removeItem(LEGACY_KEY); }
  } catch { /* noop */ }
}
