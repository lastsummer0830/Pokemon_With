import Phaser from "phaser";
import { createFromSpecies, Pokemon } from "./Pokemon";
import { markOwn, markSeen } from "./Pokedex";
import { START_BAG, START_MONEY } from "../systems/save";

// ─────────────────────────────────────────────────────────────
// 디버그 "확인 항목" 목록 — 그날 작업한 것을 한 번에 몰아보는 용도.
//
// ⭐ 규칙(2026-07-22 사용자 지시): **새 작업을 하면 여기에 확인 항목을 추가하는 것까지가 작업 완료다.**
//    (사용자는 하루 한 번 몰아서 확인한다 → 매번 상황을 손으로 만들게 하지 말 것.)
//
// 항목 하나 = "무엇을 고쳤나 한 줄" + "그 연출로 한 방에 가는 버튼".
// 실행하면 상단에 확인바(DebugCheckBarScene)가 떠서 ◀이전 / 다시 / 다음▶ 으로 하루치를 순서대로 훑는다.
// ─────────────────────────────────────────────────────────────
export interface DebugCheck {
  date: string;                     // "0722" — 작업일지 파일명과 같은 MMDD
  title: string;                    // 항목 이름(짧게)
  what: string;                     // 무엇을 고쳤나 (한 줄)
  see: string;                      // 화면에서 뭘 보면 되나 (한 줄)
  scene: string;                    // 이동할 씬 키
  data?: Record<string, unknown>;   // scene.start에 함께 넘길 데이터
  pickMove?: boolean;               // true면 실행 전에 "기술 고르기" 오버레이를 먼저 띄운다
}

// 최신 날짜를 위에 둔다(같은 날 안에서는 작업한 순서).
export const DEBUG_CHECKS: DebugCheck[] = [
  // ── 0722 (1부) 카메라 프레이밍 · 오토타일 물 ──
  {
    date: "0722",
    title: "카메라 프레이밍(세로 12칸 고정)",
    what: "창 크기에 따라 보이는 칸 수가 달라지던 것 → 원본 AR처럼 세로 12칸으로 고정(월드 스케일 계산).",
    see: "창을 늘였다 줄여도 건물 크기(세로 칸 수)가 그대로인지. HUD·대사창은 안 커진다.",
    scene: "WorldScene",
    data: { testParty: true },
  },
  {
    date: "0722",
    title: "오토타일 물 렌더 버그",
    what: "RPG Maker 오토타일 48변형 조립을 빼먹어 연못이 갈색 격자로 나오던 추출 버그 수정(맵 3장 재추출).",
    see: "태초마을 남쪽 연못이 파란 물 + 모래 물가로 원본과 똑같이 보이는지.",
    scene: "WorldScene",
    data: { map: "pallet", spawn: [20, 15], face: "down", testParty: true },
  },
  // ── 0722 (2부) 기술 애니 엔진 ──
  {
    date: "0722",
    title: "기술 애니 재생(기술 골라서)",
    what: "AR 원본 PkmnAnimations를 추출해 Phaser에서 재생하는 엔진(20fps·셀 27칸·focus 4종) + 배틀 연결.",
    see: "고른 기술의 애니가 원본처럼 도는지. 포켓몬 본체가 움직이는 기술(몸통박치기)도 확인.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "move" },
    pickMove: true,
  },
  // ── 0722 (3부) 애니 마감 3종 ──
  {
    date: "0722",
    title: "배경 애니(EARTHQUAKE)",
    what: "타이밍 2·4(배경/전경이 서서히 변화)를 원본 playTiming 그대로 구현 — 전엔 배경이 아예 안 보였다.",
    see: "지진 애니에서 배경이 페이드인되며 흘러가고, 앞쪽 모래폭풍이 겹치는지. 끝나면 판이 남지 않는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "move", demoMove: "EARTHQUAKE" },
  },
  {
    date: "0722",
    title: "애니 중 대사창 유지",
    what: "say()가 매번 대사창을 만들고 부수던 구조 → 한 벌만 만들어 배틀 내내 살려둔다(원본과 동일).",
    see: "대사를 넘긴 뒤 기술 애니가 도는 동안에도 하단 대사창이 그대로 떠 있는지(빈 바가 보이면 실패).",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "msgbox" },
  },
  {
    date: "0722",
    title: "HealthUp(회복 Common 애니)",
    what: "Common 애니 연결 — 회복기·회복 아이템으로 HP가 실제로 늘 때 원본 pbHPChanged 자리에서 재생.",
    see: "반토막 난 HP에 회복 연출(초록 반짝임)이 뜨고 HP바가 차오르는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common", demoCommon: "HealthUp" },
  },
  {
    date: "0722",
    title: "HealthDown(HP 감소 Common 애니)",
    what: "기술 데미지가 아닌 HP 감소(독·화상 잔뎀)에 원본과 같은 Common:HealthDown을 붙였다.",
    see: "HP가 줄 때 붉은 연출이 뜨고 HP바가 내려가는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common", demoCommon: "HealthDown" },
  },
  {
    date: "0722",
    title: "잔뎀 턴(독·화상)",
    what: "턴 종료 잔뎀이 빠지던 경로 수정 + 잔뎀에 HealthDown 연출·메시지 연결(afterTurn).",
    see: "내 포켓몬=독 / 상대=화상을 건 뒤 턴 종료 처리: 양쪽에 메시지 → 연출 → HP바가 순서대로 도는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "residual" },
  },
];

// 날짜 목록(최신 순 = 배열에 나온 순서).
export function debugCheckDates(): string[] {
  const seen: string[] = [];
  for (const c of DEBUG_CHECKS) if (!seen.includes(c.date)) seen.push(c.date);
  return seen;
}

export function checksOfDate(date: string): DebugCheck[] {
  return DEBUG_CHECKS.filter((c) => c.date === date);
}

// 지금 훑고 있는 확인 항목(레지스트리에 둔다 — 씬을 옮겨도 확인바가 따라온다).
export interface DebugCheckPos { date: string; idx: number; extra?: Record<string, unknown>; }

export function currentDebugCheck(registry: Phaser.Data.DataManager): DebugCheckPos | null {
  return (registry.get("debugCheck") as DebugCheckPos | undefined) ?? null;
}

// 디버그로 아무 씬이나 바로 열어도 화면이 채워지도록 레지스트리를 채운다.
//  (실게임은 IntroScene이 이름·가방·소지금을 넣어준다 — 바로가기는 그 과정을 건너뛴다.)
export function primeDebugRegistry(scene: Phaser.Scene, opts?: { party?: boolean }): void {
  const reg = scene.registry;
  if (!reg.get("playerName")) reg.set("playerName", "테스트");
  if (!reg.get("playerGender")) reg.set("playerGender", "boy");
  if (opts?.party !== false) {
    const party = (reg.get("playerParty") as Pokemon[]) ?? [];
    if (!party.length) reg.set("playerParty", [
      createFromSpecies("CHARMANDER", 5), createFromSpecies("SQUIRTLE", 5), createFromSpecies("BULBASAUR", 5),
    ]);
  }
  if (!reg.get("money")) reg.set("money", START_MONEY);
  if (!(reg.get("bag") as unknown[])?.length)
    reg.set("bag", [...START_BAG, { itemId: "SUPERPOTION", count: 2 }, { itemId: "ANTIDOTE", count: 1 },
      { itemId: "GREATBALL", count: 3 }, { itemId: "ULTRABALL", count: 3 }, { itemId: "MASTERBALL", count: 1 },
      { itemId: "REVIVE", count: 1 }]);
  if (!(reg.get("dexSeen") as unknown[])?.length) {
    for (const id of ["CHARMANDER", "SQUIRTLE", "BULBASAUR"]) markOwn(reg, id);
    for (const id of ["PIDGEY", "RATTATA", "CATERPIE", "WEEDLE", "SPEAROW"]) markSeen(reg, id);
  }
}

// 확인 항목 하나를 실행한다 — 레지스트리를 채우고, 상단 확인바를 띄우고, 그 씬으로 간다.
//  extra = 항목 데이터에 덧붙일 값(예: 기술 고르기에서 고른 demoMove).
export function startDebugCheck(
  scene: Phaser.Scene, date: string, idx: number, extra?: Record<string, unknown>,
): void {
  const list = checksOfDate(date);
  const c = list[idx];
  if (!c) return;
  primeDebugRegistry(scene);
  scene.registry.set("debugCheck", { date, idx, extra } as DebugCheckPos);
  // 확인바는 별도 씬이라 scene.start로 화면을 갈아타도 살아 있는다(한 번만 띄운다).
  if (!scene.scene.isActive("DebugCheckBarScene")) scene.scene.launch("DebugCheckBarScene");
  scene.scene.start(c.scene, { ...c.data, ...extra });
}

// 같은 날짜 안에서 앞/뒤 항목으로 이동(끝에서 감싼다). step = +1 다음 / -1 이전 / 0 다시.
export function stepDebugCheck(scene: Phaser.Scene, step: number): void {
  const pos = currentDebugCheck(scene.registry);
  if (!pos) return;
  const list = checksOfDate(pos.date);
  if (!list.length) return;
  const next = (pos.idx + step + list.length) % list.length;
  // 다른 항목으로 옮기면 이전 항목의 extra(고른 기술 등)는 버린다.
  startDebugCheck(scene, pos.date, next, step === 0 ? pos.extra : undefined);
}
