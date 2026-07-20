import Phaser from "phaser";
import { Pokemon } from "../data/Pokemon";
import { HouseLayout } from "../data/HouseLayout";
import { BagEntry } from "../data/Bag";
import { findFurniture } from "../data/furniture";
import { Difficulty, DEFAULT_DIFFICULTY } from "./difficulty";
import { emptyHouse } from "./homeBonus";

// 저장/불러오기 — 브라우저 localStorage.
//  ⚠️ 실제 런타임 상태는 씬 registry에 있다(파티·이름·성별·라이벌 예약·집인트로 등).
//     그래서 registry를 '단일 원천'으로 직렬화/복원한다. 위치(loc)는 메뉴를 연 씬이 미리 registry에 기록한다.
const SAVE_KEY = "myPokemon.save";
//  v2: houseLayout(집 꾸미기 배치) 추가.
//  v3: 가방·도감·소지금·뱃지 추가. 옛 저장은 아래 마이그레이션이 기본값을 채워 그대로 이어할 수 있다.
//  v4: 파티 포켓몬에 caughtBall(잡은 볼) 추가. 옛 저장은 몬스터볼로 채운다.
const SAVE_VERSION = 4;

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
}

type Reg = Phaser.Data.DataManager;

// 저장이 존재하는가(타이틀 '이어하기' 활성 판정용).
export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

// 현재 registry 상태를 모아 저장한다. 위치는 registry "saveLoc"(메뉴 연 씬이 기록)에서 읽는다.
export function saveGame(reg: Reg): void {
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
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

// 저장을 읽어 registry에 되살린다. 성공 시 SaveData(특히 loc)를 반환, 없거나 깨졌으면 null.
export function loadGame(reg: Reg): SaveData | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return null; }
  if (!raw) return null;
  let data: SaveData;
  try { data = JSON.parse(raw) as SaveData; } catch { return null; }
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

  // v2 저장의 tx,ty는 '태초마을 안에서의' 칸 좌표다(당시 야외 맵이 태초뿐이었다).
  //  v3부터 야외가 여러 맵이므로 어느 맵인지를 붙여준다 — 좌표 자체는 그대로 유효하다.
  const loc: SaveLoc = data.loc ? { ...data.loc } : { scene: "WorldScene" };
  if (loc.scene === "WorldScene" && !loc.map) loc.map = "pallet";
  reg.set("saveLoc", loc);
  return data;
}

// 저장 지우기
export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
}
