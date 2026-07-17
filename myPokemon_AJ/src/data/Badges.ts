// 체육관 배지.
//
// 어디에 저장되나: registry "badges" = string[] (배지 이름들). 세이브(v3)가 이미 이 키를 그대로
//   직렬화·복원한다(save.ts) → **여기서 registry에 넣기만 하면 저장까지 자동으로 흐른다.**
//
// AR 원본에서 확인한 사실(추측 아님 — Map194 이벤트 판독):
//   · 상록체육관 관장 그린을 이기면 `$player.badges[0] = true` → **그린 배지가 0번(=첫 번째) 배지**다.
//     (AR 스위치 이름도 "Defeated Gym 1". "원래라면 마지막 배지를 먼저 따버렸다"가 이 게임의 설정.)
//   · 배지 아이콘 = `Graphics/UI/Trainer Card/icon_badges.png` (256x64 = 32px 격자 8열×2행).
//     트레이너카드 코드가 `[i*32, region*32, 32, 32]`로 자른다 → 지방0은 윗줄, **그린 배지 = (0,0)**.
//     ⚠️ AR 배지 아이콘은 전부 흑백이다(색 없음) — 색이 빠진 게 아니라 원본이 그렇다.

/** 배지 하나의 정의. index = AR `$player.badges[i]`의 i이자 아이콘 시트의 열 번호. */
export interface BadgeDef {
  name: string;    // 화면·세이브에 쓰는 이름(원본 대사의 표기 그대로)
  index: number;   // AR badges 배열 인덱스 = 아이콘 시트 열
  region: number;  // 아이콘 시트 행(지방). 칸토 = 0
}

export const GREEN_BADGE = "그린 배지";

// 지금은 그린 배지 하나뿐이다. 체육관을 추가하면 여기에 같이 적는다.
export const BADGES: Record<string, BadgeDef> = {
  [GREEN_BADGE]: { name: GREEN_BADGE, index: 0, region: 0 },
};

type Reg = Phaser.Data.DataManager;

/** 지금까지 딴 배지 이름들. 세이브에서 복원된 값이 그대로 들어있다. */
export function getBadges(reg: Reg): string[] {
  return (reg.get("badges") as string[]) ?? [];
}

export function hasBadge(reg: Reg, name: string): boolean {
  return getBadges(reg).includes(name);
}

/**
 * 배지를 준다. 이미 있으면 아무 일도 안 한다(같은 배지가 두 번 들어가면 배지 수가 틀어져
 * 패배 시 뺏기는 상금 배수(LOSE_MONEY_MULT)까지 어긋난다).
 */
export function giveBadge(reg: Reg, name: string): void {
  const cur = getBadges(reg);
  if (cur.includes(name)) return;
  reg.set("badges", [...cur, name]);
}

/** 아이콘 시트에서 이 배지를 잘라낼 사각형. 없는 배지면 undefined. */
export function badgeIconRect(name: string): { x: number; y: number; w: number; h: number } | undefined {
  const d = BADGES[name];
  if (!d) return undefined;
  return { x: d.index * 32, y: d.region * 32, w: 32, h: 32 };
}
