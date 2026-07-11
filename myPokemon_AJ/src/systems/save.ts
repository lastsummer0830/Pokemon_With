import Phaser from "phaser";
import { Pokemon } from "../data/Pokemon";

// 저장/불러오기 — 브라우저 localStorage.
//  ⚠️ 실제 런타임 상태는 씬 registry에 있다(파티·이름·성별·라이벌 예약·집인트로 등).
//     그래서 registry를 '단일 원천'으로 직렬화/복원한다. 위치(loc)는 메뉴를 연 씬이 미리 registry에 기록한다.
const SAVE_KEY = "myPokemon.save";
const SAVE_VERSION = 1;

export interface SaveLoc {
  scene: string;                              // 복원할 씬 키
  tx?: number; ty?: number;                   // 월드 좌표(WorldScene)
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
  reg.set("playerParty", data.party ?? []);
  reg.set("starterChosen", data.starterChosen ?? null);
  reg.set("rivalBattlePending", !!data.rivalBattlePending);
  reg.set("rivalEnemySpecies", data.rivalEnemySpecies ?? null);
  reg.set("houseIntroDone", !!data.houseIntroDone);
  reg.set("saveLoc", data.loc);
  return data;
}

// 저장 지우기
export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
}
