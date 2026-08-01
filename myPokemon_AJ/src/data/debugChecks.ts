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
  // ── 0801 날씨 — AR Graphics/Weather 23장을 이식해 필드 날씨를 붙였다 ──
  //   ⚠️ 원본 382맵 중 날씨가 적힌 맵은 3개뿐이고 **우리 3맵은 전부 없음**(= 항상 맑음이 원본 그대로).
  //      그래서 확인은 debugWeather로 강제해서 본다. 2번도로 같은 비 오는 맵을 추가하면 저절로 뜬다.
  {
    date: "0801",
    title: "날씨 — 비 (원본 Graphics/Weather 이식)",
    what: "비·폭풍·눈·눈보라·싸락눈·모래바람·안개를 필드에 뿌리는 장치를 만들었다. 맵 메타데이터의 [:Rain, 확률%]를 그대로 굴린다(원본 방식).",
    see: "빗줄기가 비스듬히 내리고 화면이 푸르스름하게 어둑해지는지. HUD 끝에 '비'가 붙는지.",
    scene: "WorldScene",
    data: { debugWeather: "rain" },
  },
  {
    date: "0801",
    title: "날씨 — 모래바람 (흐르는 무늬 + 알갱이)",
    what: "모래바람·눈보라는 알갱이뿐 아니라 원본의 256px 무늬(sandstorm_tile)가 화면을 가로질러 흐른다.",
    see: "누런 모래 무늬가 옆으로 흐르고 알갱이가 빠르게 지나가는지.",
    scene: "WorldScene",
    data: { debugWeather: "sandstorm" },
  },
  {
    date: "0801",
    title: "날씨 — 밤에 내리는 비(밤낮과 겹치기)",
    what: "날씨(depth 880)를 밤낮 색조(900)보다 아래에 그려, 밤에 내리는 비도 함께 어두워지게 했다.",
    see: "화면이 밤처럼 어두운 채로 비가 내리는지(비만 대낮처럼 밝으면 잘못된 것).",
    scene: "WorldScene",
    data: { debugWeather: "rain", debugTimeBand: "night" },
  },
  // ── 0801 밤낮(시간 흐름) — 지금까지 이 게임엔 시간 개념이 아예 없었다 ──
  //   ⚠️ 시간대는 실제 시계를 읽는다 → 확인 항목은 registry "debugTimeBand"로 강제한다(밤까지 기다릴 순 없다).
  {
    date: "0801",
    title: "밤낮 — 야외 시간대 색조(아침/낮/저녁/밤)",
    what: "실제 시계를 읽어 야외(WorldScene)를 아침·낮·저녁·밤으로 물들인다. 원본 엔진과 같은 경계(아침5~9·낮10~16·저녁17~19·밤20~4).",
    see: "화면이 짙은 남색으로 어두워지고 좌측 상단 HUD 끝에 '밤'이라고 뜨는지. (이 항목은 밤 고정)",
    scene: "WorldScene",
    data: { debugTimeBand: "night" },
  },
  {
    date: "0801",
    title: "밤낮 — 저녁 노을",
    what: "같은 장치의 저녁 색조. 시간이 흘러 구간이 바뀌면 3초에 걸쳐 서서히 물든다(1분마다 확인).",
    see: "화면이 주황빛으로 물들고 HUD에 '저녁'이 뜨는지.",
    scene: "WorldScene",
    data: { debugTimeBand: "evening" },
  },
  {
    date: "0801",
    title: "밤낮 — 배틀 배경도 시간대를 따라간다",
    what: "AR 원본의 시간대별 배틀백(route_eve_bg·route_night_bg 등)을 이식해 배틀 배경이 시간대에 맞춰 바뀌게 했다.",
    see: "야생 배틀 배경이 낮 배경이 아니라 '밤 1번도로'(어두운 하늘)인지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", debugTimeBand: "night" },
  },
  // ── 0801 스토리 봉합: "이상한 꿈"으로 인트로·집·연구소·체육관을 잇는다 ──
  {
    date: "0801",
    title: "엄마 NPC — 1층 아침 대사('이상한 꿈')",
    what: "목소리만 있던 엄마를 1층 거실에 실제 NPC로 세우고, 계단으로 내려오면 다가와 말을 걸게 했다. 인트로(숲에서 깨어남)를 '꿈'으로 받고, 오박사께 미리 연락해 뒀다며 소개장의 근거를 만든다.",
    see: "엄마가 부엌 앞에서 걸어와 마주 서서 '아주 생생한 꿈을 꾼 모양이던데...' → '오박사님께 ... 연락 해두었는데' 2줄을 말하고 제자리로 돌아가는지. (그 뒤 엄마 앞에서 Space = 다시 말 걸기)",
    scene: "InteriorScene",
    data: { room: "living", debugMomGreet: true },
  },
  {
    date: "0801",
    title: "오박사 — '어머니께 얘기는 들었다'(소개장 개연성)",
    what: "소개장을 건네는 대사 앞에 엄마의 연락을 받는 줄을 넣었다. 소개장이 갑자기 생기는 게 아니라 미리 준비돼 있던 물건이 된다.",
    see: "스타터를 고르면 유대 조언 3줄 뒤 → '아 참, ○○! 어머니께 얘기는 들었다. 이상한 꿈을 꿨다고.' → '미리 준비해 둔 게 있단다' → 소개장 획득 순서로 이어지는지.",
    scene: "LabScene",
  },
  // ── 0728 스토리 라인: 컨셉(유대) 안내 + 소중한 물건 포켓 ──
  {
    date: "0728",
    title: "가방 '소중한 물건' 포켓 + 오박사의 소개장",
    what: "포켓 8(소중한 물건)을 가방 탭에 연결하고, AR 원본 아이템 :OAKSINTRODUCTION(오박사의 소개장)을 추출해 넣었다.",
    see: "가방 탭을 좌우로 넘겨 '소중한 물건'이 나오는지 → 그 안에 '오박사의 소개장'이 아이콘과 함께 보이는지.",
    scene: "BagScene",
    data: { testParty: true },
  },
  {
    date: "0728",
    title: "오박사의 유대 조언 + 소개장 지급",
    what: "스타터를 준 직후, 유대를 '어떻게' 깊게 하는지(집에서 재우기·방 꾸미기·쓰다듬기)를 알려주고 소개장을 실제로 준다. 이게 없어 체육관에서 받은 적 없는 소개장을 건네고 있었다.",
    see: "포켓볼 앞에서 Space로 스타터를 고르면 → 오박사 조언 3줄 → '오박사의 소개장을 받았다!' 나레이션이 뜨는지.",
    scene: "LabScene",
  },
  {
    date: "0728",
    title: "집에 돌아왔을 때 유대 힌트",
    what: "파트너를 받고 처음 내 방에 돌아오면 오박사의 조언을 실제 조작(침대=잠자기, F=꾸미기)과 이어 주는 나레이션을 띄운다.",
    see: "방에 들어서자마자 '포켓몬은 편히 쉴 곳이 있어야 마음을 연다' → 'F키: 방 꾸미기' 2줄이 이름창 없이 뜨는지.",
    scene: "InteriorScene",
    data: { room: "bedroom", debugBondHint: true },
  },
  // ── 0727 Common 애니 나머지 연결(능력·상태이상·혼란·아이템) ──
  {
    date: "0727",
    title: "능력 랭크 변화 애니(StatUp/StatDown)",
    what: "능력이 실제로 오르내릴 때(doTurn statChanges) 원본 pbCommonAnimation처럼 StatUp/StatDown을 붙였다(capped면 메시지만).",
    see: "능력 상승 연출(위로 뻗는 빛) → 능력 하락 연출(아래로)이 내 포켓몬에 순서대로 도는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common", demoCommon: "StatUp|StatDown", demoByAlly: true },
  },
  {
    date: "0727",
    title: "상태이상 부여 애니(독·화상·마비·잠듦·얼음)",
    what: "상태이상이 새로 걸릴 때(doTurn statusInflicted) 걸린 쪽에 원본 Common 애니를 붙였다(맹독=Toxic·얼음=Frozen 매핑).",
    see: "상대 포켓몬에 독→맹독→화상→마비→잠듦→얼음 연출이 차례로 도는지(메시지 라벨과 애니가 맞는지).",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common",
            demoCommon: "Poison|Toxic|Burn|Paralysis|Sleep|Frozen", demoByAlly: false },
  },
  {
    date: "0727",
    title: "혼란 애니(부여·자기공격)",
    what: "혼란을 걸 때(statusInflicted 옆 confused) + 혼란으로 자기공격할 때(beforeMove selfDamage)에 Common:Confusion을 붙였다.",
    see: "상대에 혼란 연출(빙글도는 별)이 도는지. 실제 배틀에선 자기공격 직전에도 같은 연출이 뜬다.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common", demoCommon: "Confusion", demoByAlly: false },
  },
  {
    date: "0727",
    title: "아이템 상태치료 애니(UseItem)",
    what: "배틀 중 해독제 등으로 상태이상이 풀릴 때(status→null) UseItem 연출 + 아이콘 제거를 붙였다(HP회복은 기존 HealthUp).",
    see: "내 포켓몬에 아이템 사용 연출이 도는지.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route", demo: "common", demoCommon: "UseItem", demoByAlly: true },
  },
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
      { itemId: "REVIVE", count: 1 },
      // 소중한 물건 포켓(8) 확인용 — 실제 게임에선 오박사가 스타터와 함께 준다(LabScene).
      { itemId: "OAKSINTRODUCTION", count: 1 }]);
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
