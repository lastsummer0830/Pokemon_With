// 경험치·레벨업 계산 (배틀 화면이 아닌 systems에 둔다 — 계산/규칙 분리 원칙)
//  성장 곡선 = medium-fast: 레벨 L에 도달하는 누적 경험치 = L³.
//  스탯 재계산·기술 학습은 Pokemon.ts의 공식을 재사용한다(중복 구현 금지).
import { Pokemon, MoveSlot, recomputeStats } from "../data/Pokemon";
import { getSpecies, getMove } from "../data/ar";

const MAX_LEVEL = 100;
const EXP_YIELD_K = 7;   // 처치 경험치 계수(간단화: 적 레벨 × K). 정식 base-exp 자리의 대체 상수.

// 레벨 L에 도달하는 데 필요한 누적 경험치(medium-fast).
export function expForLevel(level: number): number {
  return level * level * level;
}

// 쓰러뜨린 적이 주는 경험치(간단식: 적 레벨 비례).
export function battleExpYield(enemy: Pokemon): number {
  return Math.max(1, Math.floor(enemy.level * EXP_YIELD_K));
}

export interface LevelUpResult {
  gained: number;                              // 이번에 얻은 경험치
  levels: number[];                            // 도달한 새 레벨들(오름차순)
  learned: { level: number; move: string }[];  // 새로 배운 기술(표시명)
}

// 경험치를 더하고, 임계를 넘을 때마다 레벨업(스탯 재계산 + 해당 레벨 신기술 학습).
//  반환값은 배틀 메시지 출력용.
export function gainExp(p: Pokemon, amount: number): LevelUpResult {
  const res: LevelUpResult = { gained: amount, levels: [], learned: [] };
  p.exp += amount;
  while (p.level < MAX_LEVEL && p.exp >= expForLevel(p.level + 1)) {
    p.level += 1;
    recomputeStats(p);
    res.levels.push(p.level);
    for (const mv of learnMovesAtLevel(p)) res.learned.push({ level: p.level, move: mv });
  }
  return res;
}

// 현재 레벨에 새로 배우는 레벨업 기술을 파티 기술칸에 추가.
//  이미 아는 기술은 건너뛰고, 4칸이 차 있으면 가장 오래된 기술을 밀어낸다(단순화).
function learnMovesAtLevel(p: Pokemon): string[] {
  const sp = getSpecies(p.speciesId);
  if (!sp) return [];
  const learned: string[] = [];
  for (const [lv, id] of sp.levelMoves) {
    if (lv !== p.level) continue;
    if (p.moves.some((m) => m.id === id)) continue;
    const md = getMove(id);
    const pp = md?.pp ?? 5;
    const slot: MoveSlot = { id, pp, maxPp: pp };
    if (p.moves.length >= 4) p.moves.shift();
    p.moves.push(slot);
    learned.push(md?.name ?? id);
  }
  return learned;
}
