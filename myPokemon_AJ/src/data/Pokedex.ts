import Phaser from "phaser";
import { dexKanto, getSpecies, SpeciesData } from "./ar";

// 도감 — "본 적 있다(seen)"와 "잡았다(own)"만 기록한다.
//  seen = 배틀에서 마주친 종족 / own = 내 것이 된 종족(스타터 수령·포획).
//  Bag과 같이 registry를 단일 원천으로 쓴다(저장은 systems/save.ts가 통째로 직렬화).

type Reg = Phaser.Data.DataManager;

function list(reg: Reg, key: "dexSeen" | "dexOwn"): string[] {
  return (reg.get(key) as string[]) ?? [];
}

function mark(reg: Reg, key: "dexSeen" | "dexOwn", speciesId: string): void {
  const id = speciesId.toUpperCase();
  const cur = list(reg, key);
  if (cur.includes(id)) return;
  reg.set(key, [...cur, id]);
}

// 마주쳤다 (배틀 시작 시 상대 종족)
export function markSeen(reg: Reg, speciesId: string): void {
  mark(reg, "dexSeen", speciesId);
}

// 내 것이 됐다 (포획·스타터 수령) — 잡은 건 당연히 본 것이기도 하다.
export function markOwn(reg: Reg, speciesId: string): void {
  mark(reg, "dexSeen", speciesId);
  mark(reg, "dexOwn", speciesId);
}

export function isSeen(reg: Reg, speciesId: string): boolean {
  return list(reg, "dexSeen").includes(speciesId.toUpperCase());
}
export function isOwn(reg: Reg, speciesId: string): boolean {
  return list(reg, "dexOwn").includes(speciesId.toUpperCase());
}

// 도감 화면 한 줄
export interface DexEntry {
  no: number;                 // 도감번호(칸토 1~151)
  speciesId: string;
  species?: SpeciesData;      // 종족 데이터(못 찾으면 undefined)
  seen: boolean;
  own: boolean;
}

// 칸토 도감 151칸을 번호순으로. 아직 못 본 종족도 자리는 차지한다(이름은 화면에서 가린다).
export function dexEntries(reg: Reg): DexEntry[] {
  const seen = list(reg, "dexSeen");
  const own = list(reg, "dexOwn");
  return dexKanto().map((sid, i) => ({
    no: i + 1,
    speciesId: sid,
    species: getSpecies(sid),
    seen: seen.includes(sid),
    own: own.includes(sid),
  }));
}

// "본 O종 / 잡은 O종" 표시용
export function dexCounts(reg: Reg): { seen: number; own: number; total: number } {
  return { seen: list(reg, "dexSeen").length, own: list(reg, "dexOwn").length, total: dexKanto().length };
}
