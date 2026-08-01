// 필드 이벤트 — 원본(Another Red) 맵 이벤트 중 **말 걸기로 반응하는 것들**(NPC·팻말·바닥 아이템·열매나무).
//
// ⭐ 왜 생겼나 (2026-08-03 원본 전수 대조):
//   우리는 맵 그림·충돌·트레이너만 가져와서, 원본 3맵 이벤트 39개 중 **문 6개 + 트레이너 2명**만 있었다.
//   1번도로 팻말·바닥 아이템 3개·열매나무 2그루, 태초마을 NPC 2명·팻말, 상록시티 NPC·팻말·아이템이
//   통째로 빠져 있었고, 애초에 **필드에서 '말 걸기'라는 동작 자체가 없었다.**
//   (언덕 때와 같은 종류의 구멍 — 그림은 맞는데 동작이 없는 것.)
//
// 데이터는 `tools/ar-map/extract-events.py`가 원본에서 뽑아 `public/assets/world/<맵>_events.json`에 넣는다.
//
// ── 원본 규칙(RPG Maker XP) 그대로 지키는 것 ──────────────────────────────
//  · 이벤트는 **페이지 여러 장**을 갖고, **뒤 페이지부터** 조건을 검사해 처음 맞는 페이지가 '지금 모습'이다.
//  · 그 페이지의 그림이 비어 있으면 **보이지도 않고 말도 안 걸린다**(원본이 스토리 진행 전 NPC를 숨기는 방법).
//  · 셀프스위치(A~D)는 이벤트마다 따로 기억한다 — 아이템을 주우면 A가 켜지고 빈 페이지로 넘어간다.
//  · 우리에게 없는 전역 스위치·변수 조건은 '만족하지 않음'으로 본다(스토리가 붙으면 그때 열린다).

// 레지스트리(세이브에 실리는 게임 전역 저장소).
type Reg = Phaser.Data.DataManager;

export interface EventLine {
  text?: string;
  speaker?: string;
  center?: boolean;               // 팻말(원본 <ac> = 가운데 정렬)
  item?: string;                  // pbItemBall — 바닥에 떨어진 아이템
  berry?: string; count?: number; // pbPickBerry — 열매나무
  choice?: string[];              // 선택지
  branches?: EventLine[][];
  receive?: string;               // pbReceiveItem — 사람이 건네주는 물건("○○을 받았다!")
  se?: string;                    // 원본 효과음 이름(AR Audio/SE/<이름>) — 우리에게 있는 것만 울린다
  shop?: string[];                // pbPokemonMart — 상점(아직 미구현이라 안내만 한다)
  setSelf?: string;               // 셀프스위치 켜기(A~D) — "이 사람은 이제 다음 페이지"
  setSwitch?: [number, boolean];  // 원본 전역 스위치 켜기/끄기
}

export interface EventPage {
  graphic: string;                // AR characters/<이름>.png (빈 문자열 = 안 보이는 페이지)
  dir?: number;                   // 서 있는 방향(RMXP 2=아래 4=왼쪽 6=오른쪽 8=위)
  step?: boolean;                 // 제자리 발동작(원본 step_anime) — 열매나무가 바람에 흔들리는 것
  fixed?: boolean;                // 방향 고정(원본 direction_fix) — 말을 걸어도 안 돌아본다
  trigger: number;                // 0=말걸기 1·2=접촉 3=자동실행 4=병렬
  cond: { selfSwitch?: string; switch?: number; switch2?: number; variable?: [number, number] };
  lines: EventLine[];
  partial?: boolean;              // 추출기가 다 못 옮긴 페이지(조건분기 등) — 게임에선 건너뛴다
}

export interface MapEvent {
  id: number;
  name: string;
  x: number; y: number;           // 그 맵 기준 로컬 좌표
  kind: "npc" | "sign" | "item" | "berry";
  graphic: string;
  pages: EventPage[];
}

export interface MapEventFile { arMap: number; events: MapEvent[] }

/** 세이브에 남는 셀프스위치. 키 = "<맵>:<이벤트id>:<A~D>" */
export const SELF_SWITCH_KEY = "eventSelfSwitches";

export function selfSwitchOn(reg: Reg, map: string, id: number, ch = "A"): boolean {
  const set = reg.get(SELF_SWITCH_KEY) as Record<string, boolean> | undefined;
  return !!set?.[`${map}:${id}:${ch}`];
}

export function setSelfSwitch(reg: Reg, map: string, id: number, ch = "A"): void {
  const set = (reg.get(SELF_SWITCH_KEY) as Record<string, boolean> | undefined) ?? {};
  set[`${map}:${id}:${ch}`] = true;
  reg.set(SELF_SWITCH_KEY, set);
}

/**
 * 원본(RPG Maker XP)의 **전역 스위치**. 세이브에 남는다. 키 = 원본 스위치 번호.
 *
 * ⚠️ 우리가 스토리를 다 옮긴 게 아니므로 **원본이 켜는 자리에서 우리도 켤 때만** 켜진다
 *    (예: 상록시티 민가2에서 포켓인형을 가져가면 96번이 켜져 아이가 우는 페이지로 넘어간다).
 *    아직 안 옮긴 스토리 스위치는 영영 꺼져 있고, 그 조건이 걸린 페이지는 없는 셈이 된다 — 예전과 같다.
 */
export const AR_SWITCH_KEY = "arSwitches";

export function arSwitchOn(reg: Reg, id: number): boolean {
  const set = reg.get(AR_SWITCH_KEY) as Record<number, boolean> | undefined;
  return !!set?.[id];
}

export function setArSwitch(reg: Reg, id: number, on: boolean): void {
  const set = (reg.get(AR_SWITCH_KEY) as Record<number, boolean> | undefined) ?? {};
  set[id] = on;
  reg.set(AR_SWITCH_KEY, set);
}

/**
 * 지금 보여줄 페이지를 고른다 — **원본과 같이 뒤 페이지부터** 검사한다.
 * 우리가 못 다루는 페이지(partial·전역 스위치 조건)는 없는 셈 친다.
 */
export function activePage(reg: Reg, map: string, ev: MapEvent): EventPage | null {
  for (let i = ev.pages.length - 1; i >= 0; i--) {
    const p = ev.pages[i];
    if (p.partial) continue;
    const c = p.cond;
    if (c.variable !== undefined) continue;                                   // 변수 조건 — 아직 못 옮긴다
    if (c.switch !== undefined && !arSwitchOn(reg, c.switch)) continue;       // 원본 전역 스위치
    if (c.switch2 !== undefined && !arSwitchOn(reg, c.switch2)) continue;
    if (c.selfSwitch && !selfSwitchOn(reg, map, ev.id, c.selfSwitch)) continue;
    return p;
  }
  return null;
}

/**
 * 원본 방향번호 → AR 캐릭터 시트의 정지 프레임 번호.
 * 시트는 가로 4칸 × 세로 4칸(아래·왼쪽·오른쪽·위 순)이라 각 줄의 첫 칸이 정지 모습이다.
 */
export function dirFrame(dir?: number): number {
  return { 2: 0, 4: 4, 6: 8, 8: 12 }[dir ?? 2] ?? 0;
}

/**
 * 말을 걸었을 때 이벤트가 향할 방향(RMXP 번호).
 *
 * 원본은 말을 걸면 **항상 플레이어를 돌아본다** — `Interpreter`가 `event.lock`을 부르고
 * `Game_Character#lock`이 `turn_toward_player`를 한다. 게다가 `@prelock_direction = 0`이라
 * 대화가 끝나도 **원래 방향으로 안 돌아간다**(계속 플레이어를 본 채로 있다).
 * 단 `direction_fix`(우리 `page.fixed`)가 켜진 이벤트는 예외 —
 * 열매나무가 그렇다(그 그림은 '방향' 줄이 곧 성장 단계라 돌리면 딴 그림이 된다).
 */
export function faceDirToward(playerFacing: "up" | "down" | "left" | "right"): number {
  return { down: 8, up: 2, left: 6, right: 4 }[playerFacing];
}

/** 지금 화면에 그려야 하는가(=보이는 페이지가 있고 그림이 있는가). */
export function visibleGraphic(reg: Reg, map: string, ev: MapEvent): string | null {
  const p = activePage(reg, map, ev);
  return p && p.graphic ? p.graphic : null;
}

/** 말을 걸 수 있는가(말걸기 트리거 + 할 말이 있음). 자동실행·병렬은 스토리라 아직 안 다룬다. */
export function talkablePage(reg: Reg, map: string, ev: MapEvent): EventPage | null {
  const p = activePage(reg, map, ev);
  if (!p || p.trigger !== 0 || !p.lines.length) return null;
  return p;
}
