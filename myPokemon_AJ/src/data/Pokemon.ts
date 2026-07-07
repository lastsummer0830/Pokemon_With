// 포켓몬 한 마리가 가져야 하는 정보들의 "약속"
// 배틀에 필요한 실제 스탯(6종)·기술·상태이상까지 담는다.
// 종족값·기술 데이터는 Another Red 추출본(src/data/ar)에서 온다.
import { getSpecies, getMove, BaseStats } from "./ar";

// 상태이상
export type Status = "burn" | "poison" | "paralysis" | "sleep" | "freeze" | null;

// 배운 기술 한 칸 (id + 남은 PP)
export interface MoveSlot {
  id: string;      // AR 기술 id (예: "FLAMETHROWER")
  pp: number;      // 남은 PP
  maxPp: number;   // 최대 PP
}

export interface Pokemon {
  speciesId: string;     // AR 종족 id (예: "FROAKIE") — 데이터 조회 키
  id: number;            // 도감 번호 (표시용, 없으면 0)
  name: string;          // 종족명 (한글, 예: "개구마르")
  nickname?: string;     // 별명 (없으면 종족명 사용)
  types: string[];       // 속성 1~2개 (예: ["FIRE","FLYING"])
  type: string;          // (기존 호환) 대표 속성 = types[0]
  level: number;

  // 실제 스탯 (종족값 + 레벨에서 계산)
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;

  moves: MoveSlot[];     // 최대 4개
  status: Status;        // 상태이상 (없으면 null)

  heldItem: string | null; // ★ 지닌 도구 (없으면 null)
  condition: number;       // ★ 컨디션(집에서 쉰 정도) — 집 꾸미기와 배틀을 잇는 값
  gender: "male" | "female" | null; // 성별(무성=null). 파티/상세창 ♀♂ 표시용.
}

// 표시 이름(별명 우선)
export function displayName(p: Pokemon): string {
  return p.nickname ?? p.name;
}

// ── 스탯 계산 (표준 포켓몬 공식, 개체값·노력치=0 단순화) ──
//  HP = ⌊2·종족값·레벨 / 100⌋ + 레벨 + 10
//  그 외 = ⌊2·종족값·레벨 / 100⌋ + 5
function calcHp(base: number, level: number): number {
  return Math.floor((2 * base * level) / 100) + level + 10;
}
function calcStat(base: number, level: number): number {
  return Math.floor((2 * base * level) / 100) + 5;
}

// 레벨업 기술 중, 현재 레벨 이하로 배우는 것들의 "가장 최근 4개"를 고른다.
function pickMoves(levelMoves: [number, string][], level: number): MoveSlot[] {
  const learnable = levelMoves.filter(([lv]) => lv <= level).map(([, id]) => id);
  const last4 = learnable.slice(-4);
  return last4.map((id) => {
    const md = getMove(id);
    const pp = md?.pp ?? 5;
    return { id, pp, maxPp: pp };
  });
}

// ★ AR 종족 데이터로 배틀용 포켓몬을 만든다. (loadArDb() 이후에 호출)
//   데이터가 없으면(로드 전/미등록) 최소 스탯으로 폴백해 최소한 동작하게 한다.
export function createFromSpecies(speciesId: string, level = 5): Pokemon {
  const sp = getSpecies(speciesId);
  const key = speciesId.toUpperCase();
  if (!sp) {
    // 폴백: 데이터 없을 때도 게임이 멈추지 않게 기본치.
    return {
      speciesId: key, id: 0, name: key, types: ["NORMAL"], type: "NORMAL", level,
      maxHp: 20, currentHp: 20, attack: 10, defense: 10, spAttack: 10, spDefense: 10, speed: 10,
      moves: [{ id: "TACKLE", pp: 35, maxPp: 35 }], status: null, heldItem: null, condition: 0,
      gender: Math.random() < 0.5 ? "male" : "female",
    };
  }
  const b: BaseStats = sp.baseStats;
  const maxHp = calcHp(b.HP, level);
  return {
    speciesId: key,
    id: 0,
    name: sp.name,
    types: sp.types.length ? sp.types : ["NORMAL"],
    type: sp.types[0] ?? "NORMAL",
    level,
    maxHp,
    currentHp: maxHp,
    attack: calcStat(b.ATTACK, level),
    defense: calcStat(b.DEFENSE, level),
    spAttack: calcStat(b.SPECIAL_ATTACK, level),
    spDefense: calcStat(b.SPECIAL_DEFENSE, level),
    speed: calcStat(b.SPEED, level),
    moves: pickMoves(sp.levelMoves, level),
    status: null,
    heldItem: null,
    condition: 0,
    gender: Math.random() < 0.5 ? "male" : "female",
  };
}

// (기존 호환) 이름·속성만으로 간단히 만드는 함수 — 옛 호출부가 아직 쓴다.
//  가능하면 createFromSpecies를 쓰고, 이건 데이터 없을 때의 임시용.
export function createPokemon(name: string, type: string): Pokemon {
  return {
    speciesId: name.toUpperCase(), id: 0, name, types: [type], type, level: 5,
    maxHp: 30, currentHp: 30, attack: 10, defense: 10, spAttack: 10, spDefense: 10, speed: 10,
    moves: [{ id: "TACKLE", pp: 35, maxPp: 35 }], status: null,
    heldItem: null, condition: 0, gender: null,
  };
}
