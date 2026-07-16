// Another Red에서 뽑은 배틀 기반 데이터(타입 상성·종족·기술)를 게임에서 쓰는 곳.
// 원본 JSON은 public/assets/data/ar/ 에 있고(도구: tools/ar-data/extract-battle-data.py),
// 용량이 크므로 import(번들 포함)하지 않고 런타임에 fetch해서 캐시한다.

// ── 타입 정의 (JSON 구조와 1:1) ──────────────────────────────
export interface TypeData {
  id: string;
  name: string;           // 한글 타입명 (예: "불꽃")
  // 타입 아이콘·기술버튼 시트의 '행 번호'(AR 원본값). types.png(28px 행) · cursor_fight.png(46px 행).
  //  ⚠️ 타입 키 순서로 추정하면 틀린다(키 20개 vs cursor_fight 19행) — 반드시 이 값을 쓸 것.
  iconPosition: number;
  special: boolean;
  pseudo: boolean;        // ??? 같은 실제 아닌 타입
  weaknesses: string[];   // 이 타입이 '받을 때' 2배인 공격 타입들
  resistances: string[];  // 0.5배
  immunities: string[];   // 0배
}

export interface BaseStats {
  HP: number; ATTACK: number; DEFENSE: number;
  SPECIAL_ATTACK: number; SPECIAL_DEFENSE: number; SPEED: number;
}

export interface Evolution {
  species: string;
  method: string;
  param: string | number | null;
}

export interface SpeciesData {
  id: string;
  form: number;
  name: string;          // 한글 종족명 (없으면 영문)
  nameEn: string;
  kind: string | null;   // 분류 (예: "씨앗")
  height: number;        // m (도감 표시용)
  weight: number;        // kg
  dexEntry: string;      // 도감 설명문(한글)
  types: string[];       // 1~2개
  baseStats: BaseStats;
  abilities: string[];
  hiddenAbilities: string[];
  genderRatio: string;
  growthRate: string;
  catchRate: number;
  baseExp: number;
  eggGroups: string[];
  levelMoves: [number, string][];  // [레벨, 기술id]
  tutorMoves: string[];
  eggMoves: string[];
  evolutions: Evolution[];
  generation: number;
}

export type MoveCategory = "Physical" | "Special" | "Status";

export interface MoveData {
  id: string;
  name: string;          // 한글 기술명
  nameEn: string;
  type: string;
  category: MoveCategory;
  power: number;         // 0 = 위력 없음(변화기 등)
  accuracy: number;      // 0 = 필중
  pp: number;
  priority: number;
  target: string;
  effectChance: number;
  functionCode: string;
  flags: string[];
  description: string;   // 한글 설명
}

// 아이템 (tools/ar-data/extract-items.py — 세로 슬라이스에 쓰는 10종만 뽑는다)
export interface ItemData {
  id: string;
  name: string;          // 한글명 (예: "몬스터볼")
  nameEn: string;
  pocket: number;        // 1=일반 2=회복약 3=몬스터볼 (AR 포켓 번호)
  price: number;
  desc: string;          // 한글 설명
  fieldUse: number;      // 0이 아니면 필드에서 쓸 수 있다
  battleUse: number;     // 0이 아니면 배틀에서 쓸 수 있다
  consumable: boolean;
}

// 야생 조우표 (tools/ar-data/extract-encounters.py — AR encounters.dat 그대로)
export interface EncounterSlot {
  w: number;      // 가중치(그 맵 land 슬롯들의 합 = 100)
  id: string;     // 종족 id
  min: number;    // 레벨 하한
  max: number;    // 레벨 상한
}
export interface EncounterTable {
  land: EncounterSlot[];
  stepChance: number;   // AR step_chances[:Land] — 풀숲 한 걸음의 기본 조우 확률(%)
}

// ── 캐시 & 로더 ──────────────────────────────────────────────
const DB = {
  types: {} as Record<string, TypeData>,
  species: {} as Record<string, SpeciesData>,
  moves: {} as Record<string, MoveData>,
  items: {} as Record<string, ItemData>,
  dexKanto: [] as string[],   // 칸토 도감 순서(151종). 배열 인덱스+1 = 도감번호.
  encounters: {} as Record<string, EncounterTable>,   // 키 = AR 맵 번호 문자열(예: "10" = 1번도로)
};
let loaded = false;
let loading: Promise<void> | null = null;

// 게임 부팅 시 한 번 호출(main.ts). 이미 로드했으면 즉시 반환.
export function loadArDb(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  const base = "assets/data/ar";   // Phaser 로더와 같은 상대경로 규칙(앞에 / 없이)
  loading = Promise.all([
    fetch(`${base}/types.json`).then((r) => r.json()),
    fetch(`${base}/species.json`).then((r) => r.json()),
    fetch(`${base}/moves.json`).then((r) => r.json()),
    fetch(`${base}/items.json`).then((r) => r.json()),
    fetch(`${base}/dex_kanto.json`).then((r) => r.json()),
    fetch(`${base}/encounters.json`).then((r) => r.json()),
  ]).then(([t, s, m, i, d, e]) => {
    DB.types = t;
    DB.species = s;
    DB.moves = m;
    DB.items = i;
    DB.dexKanto = d;
    DB.encounters = e;
    loaded = true;
  });
  return loading;
}

export function isArDbLoaded(): boolean {
  return loaded;
}

export function getSpecies(id: string): SpeciesData | undefined {
  return DB.species[id.toUpperCase()];
}
export function getMove(id: string): MoveData | undefined {
  return DB.moves[id.toUpperCase()];
}
export function getType(id: string): TypeData | undefined {
  return DB.types[id.toUpperCase()];
}
export function getItem(id: string): ItemData | undefined {
  return DB.items[id.toUpperCase()];
}
export function allItems(): ItemData[] {
  return Object.values(DB.items);
}
// 칸토 도감 순서(151종). 도감 화면이 번호순으로 훑는 데 쓴다.
export function dexKanto(): string[] {
  return DB.dexKanto;
}
// 그 맵의 야생 조우표. 조우가 없는 맵(태초·상록)은 undefined.
export function getEncounters(arMapId: number): EncounterTable | undefined {
  return DB.encounters[String(arMapId)];
}

// 공격 타입 atkType이 방어측 타입들(defTypes)에 주는 최종 배율(곱).
//  각 방어 타입에 대해: 면역이면 0, 약점이면 2, 저항이면 0.5, 아니면 1 → 전부 곱한다.
//  (예: 물 공격 → 불꽃/바위 2타입 방어 = 2 × 1 = 2배)
export function typeMultiplier(atkType: string, defTypes: string[]): number {
  let mult = 1;
  for (const d of defTypes) {
    const td = getType(d);
    if (!td) continue;
    if (td.immunities.includes(atkType)) mult *= 0;
    else if (td.weaknesses.includes(atkType)) mult *= 2;
    else if (td.resistances.includes(atkType)) mult *= 0.5;
  }
  return mult;
}
