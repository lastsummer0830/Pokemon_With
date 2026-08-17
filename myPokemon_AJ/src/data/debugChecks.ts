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
  // ── 0818 세이브 v6 — 이벤트 진행이 저장에 안 실려서 로드하면 원상복구됐다 ──
  {
    date: "0818",
    title: "세이브 — 이벤트 진행이 저장/불러오기에 남는가",
    what: "셀프스위치·원본 전역 스위치가 registry에만 있어 **저장하고 불러오면 끝낸 이벤트가 되살아났다**(경호·아일라·민가2 인형 전부). SaveData v6에 두 필드를 넣었다. 옛 저장(v5 이하)은 빈 값으로 채워 예전과 똑같이 동작한다.",
    see: "경호(35,10)에게 한 번 말 걸어 대화를 끝낸 뒤 Z → 저장. 게임을 **새로 켜서** 이어하기 → 경호에게 말 걸면 \"거기 너!\"(첫 페이지)가 아니라 \"22번 트레이너들을 모두 이기고 왔니?\"(둘째 페이지)가 나와야 한다. 민가2 인형을 가져간 뒤 저장·재시작해도 아이가 우는 대사로 남아 있는지도 같이 본다.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [35, 11], face: "up", testParty: true },
  },
  // ── 0818 상록시티 EV14(경호) — 추출기가 못 옮겨 `partial`로 꺼져 있던 페이지 2장을 손으로 옮겼다 ──
  {
    date: "0818",
    title: "상록시티 — 경호(말 걸기 + \"!\"·\"?\")",
    what: "원본 Map56 이벤트14를 그대로 살렸다 — 머리 위 \"!\"(원본 애니 3번)와 주인공 \"?\"(4번), 선택지 2갈래, 셀프스위치로 넘어가는 둘째 페이지. 원본 207의 대상은 [13]이지만 그건 뱃지 뒤에만 보이는 다른 칸의 이벤트라 작성자 실수로 보고 경호 자신에게 띄웠다.\n⛔ 원본과 다르게 **칸을 막지 않는다**(through): 원본 경호는 체육관 문(35,9) 앞 (35,10)에 선 문지기이고 (35,9)로 가는 칸은 그 하나뿐이라, 22번도로를 이식하기 전에 원본대로 막으면 체육관·소개장·배지가 영구 도달 불가가 된다.",
    see: "경호(35,10)에게 (35,11)에서 위를 보고 말 걸기 → 머리 위 \"!\" 뒤 \"거기 너!\", 이어서 **내 머리 위 \"?\"**. 선택지 2개 다 눌러 보고(아래쪽은 마지막에 \"(다른 용무라니까..)\" 한 줄이 더 붙는다), 다시 말 걸면 \"22번 트레이너들을…\" → \"트레이너들을 모두 쓰러뜨리고 다시 오렴.\"으로 바뀌는지. ⭐ 그리고 **경호를 지나 위쪽 상록체육관 문(35,9)으로 들어갈 수 있는지** — 여기가 막히면 배지 진행이 통째로 멈춘다.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [35, 11], face: "up", testParty: true },
  },
  {
    date: "0818",
    title: "상록시티 — 경호 배틀(22번도로 갈래)",
    what: "원본은 스위치 87~90(22번도로 트레이너 4명 격파)이 모두 켜져야 경호와 배틀한다. 22번도로를 아직 안 이식해 정상 플레이로는 켜질 자리가 없어, 이 항목만 debugArSwitches로 미리 켠다(세이브에 안 실리는 자리라 확인 뒤 저절로 꺼진다).",
    see: "경호(35,10)에게 두 번 말 걸기 — 첫 번째로 셀프스위치 A가 켜지고, 두 번째에 \"그래? 잘 됐네!\" → \"마지막 배틀은 바로 나야!\" → CAMPER:경호와 배틀(4마리 L7~8). **이기면** 남은 대사 2줄 뒤 경호가 사라지고 그 칸을 지나갈 수 있는지. **지면** 다시 와서 같은 자리에서 재도전이 되는지.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [35, 11], face: "up", testParty: true, debugArSwitches: [87, 88, 89, 90] },
  },
  {
    date: "0818",
    title: "상록시티 — 아일라 원본 순서 보강",
    what: "원본 명령 순서와 달랐던 것을 맞췄다 — \"(누군가가 서있다.)\"가 **맨 앞**(돌아보기·BGM 교체보다 먼저)이고, \"너!? 너가 어떻게?\" 뒤에 빠져 있던 **주인공 머리 위 \"?\"**(원본 207[-1,4])와 대기 2개를 넣었다.",
    see: "(23,38)에서 위를 보고 서면 자동 시작 — 먼저 \"(누군가가 서있다.)\", 그 뒤 상대가 돌아보며 \"!\", \"너!? 너가 어떻게?\" 다음에 **내 머리 위 \"?\"**가 뜨는지. 그 뒤 배틀·이동은 예전과 같아야 한다.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [23, 38], face: "up", testParty: true },
  },
  // ── 0810 상록시티 EV10(아일라) — 원본 자동실행 페이지를 대사만 남긴 채 건너뛰고 있었다 ──
  {
    date: "0810",
    title: "상록시티 — 아일라 자동 이벤트",
    what: "원본 Map56 이벤트10(자동실행)의 페이지를 그대로 살렸다 — 돌아보기·\"!\"·BGM 교체·트레이너 배틀·배틀 뒤 이동까지 한 줄로 이어진다. 첫 자기소개 전이라 이름은 계속 '???'다.",
    see: "(23,38)에서 위를 보고 서면 바로 자동으로 시작하는지 — 상대가 돌아보고 \"!\", 대사 5줄 뒤 ??? 와의 배틀. 이기면 남은 대사 3줄 뒤 (21,28)까지 걸어가 사라지는지. 지면 다시 와서 재도전이 되는지.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [23, 38], face: "up", testParty: true },
  },
  // ── 0804 상록시티 민가 4채(AR Map160~163) — 문은 원본 좌표대로 있었는데 갈 데가 없었다 ──
  //    네 집은 원본에서 방 그림·충돌이 완전히 같은 한 장이고(맵데이터 md5 동일) 다른 건 이벤트뿐이다.
  {
    date: "0804",
    title: "민가 — 문 4개로 들어가고 나오기",
    what: "AR Map160~163을 뽑아 상록시티 문 4곳((26,18)·(35,18)·(26,11)·(8,27))에 이었다. 좌표는 원본 'Home door'의 이동 값 그대로.",
    see: "바로 앞 문(26,18)으로 들어가지는지. 방 안 도어매트(9,11)에서 아래를 누르면 원래 문 앞으로 나오는지. 나머지 세 집도 같은지.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [26, 19], testParty: true },
  },
  {
    date: "0804",
    title: "민가1 — 원예사의 물뿌리개(선택지)",
    what: "원본 이벤트를 그대로 실행한다. 원예사가 물뿌리개 4종 중 하나를 고르게 하고, 한 번 주면 셀프스위치로 다음 페이지로 넘어간다(무한 지급 방지).",
    see: "원예사(7,4)에게 말 걸기 → 4개 선택지 → 고른 것이 가방 '소중한 물건'에 들어가는지. 다시 말 걸면 \"나무열매에 물을 주자!\"로 바뀌는지. 옆 로젤리아(8,4)·TV(9,2)·도박사(14,5)·여행자(6,9)도 말이 걸리는지.",
    scene: "BuildingScene",
    data: { building: "house1", testParty: true },
  },
  {
    date: "0804",
    title: "민가2 — 아이의 포켓인형(전역 스위치)",
    what: "바닥 볼을 주우면 원본이 켜는 전역 스위치 96번을 우리도 켠다 → 아이 대사가 우는 페이지로 바뀐다(원본 규칙).",
    see: "아이 옆 볼(5,6)을 (4,6)에서 오른쪽 보고 확인키 → 삐삐인형 획득 후 볼이 사라지는지. 그 다음 아이(6,6)에게 말 걸면 \"그거 왜 가져가...?\"로 바뀌는지. 인형은 가방 '배틀 아이템' 포켓에 있다.",
    scene: "BuildingScene",
    data: { building: "house2", testParty: true },
  },
  {
    date: "0804",
    title: "민가3·4 — 피카츄 울음 / 젬 상점",
    what: "원본 효과음(250)도 옮겼다 — 피카츄에게 말 걸면 AR 원본 울음소리가 난다. 민가4의 아주머니는 원본이 상점(pbPokemonMart)이라 아직 안내만 한다.",
    see: "민가3 피카츄(7,6)에게 말 걸기 → \"피카피\" + 울음소리. 주인(9,6)·부인(15,4)도 말이 걸리는지. 민가4는 아주머니(6,6)가 \"준비 중\"이라 하는지.",
    scene: "BuildingScene",
    data: { building: "house3", testParty: true },
  },
  // ── 0803 필드 이벤트 — 원본 맵 이벤트 전수 대조에서 "말 걸기 자체가 없다"를 발견해 붙였다 ──
  {
    date: "0803",
    title: "필드 — NPC·팻말에 말 걸기",
    what: "원본 맵 이벤트를 뽑아(tools/ar-map/extract-events.py) NPC·팻말을 세우고 확인키로 말이 걸리게 했다. 그 전엔 필드에서 확인키가 아무 일도 안 했다.",
    see: "태초마을 NPC(20,12) 앞에서 확인키 → \"과학의 힘은 대단해!\". 1번도로 팻말(18,7)·상록시티 팻말(19,16)도 읽히는지. 사람이 선 칸은 못 지나가는지.",
    scene: "WorldScene",
    data: { map: "pallet", spawn: [20, 13], testParty: true },
  },
  {
    date: "0803",
    title: "필드 — 바닥 아이템·열매나무",
    what: "원본 pbItemBall 4곳(상처약·해독제·몬스터볼·TM09)과 열매나무 2그루(오랭열매 2개)를 이식했다. 주우면 셀프스위치가 켜져 사라진다(원본 규칙).",
    see: "1번도로 볼(16,14) 앞에서 확인키 → \"상처약을 주웠다!\" → 가방에 들어가고 볼이 사라지는지. 열매나무(16,7)는 \"딸까?\"를 묻는지.",
    scene: "WorldScene",
    data: { map: "route1", spawn: [16, 15], testParty: true },
  },
  {
    date: "0803",
    title: "상록시티 물결(오토타일 애니)",
    what: "원본 오토타일 STILL(11프레임)을 뽑아 30칸에 깔았다. 속도는 원본 규칙대로 프레임당 0.25초. 태초마을 물은 원본이 정지 오토타일(NOANIMSEA)이라 일부러 안 붙였다.",
    see: "상록시티 연못 물이 잔잔하게 일렁이는지(잔물결이라 크지 않다). 태초마을 물은 그대로 멈춰 있는 게 맞다.",
    scene: "WorldScene",
    data: { map: "viridian_city", spawn: [24, 20], testParty: true },
  },
  // ── 0803 조작키 — 흩어져 있던 키를 액션(USE/BACK/MENU/BAG/SPEED)으로 모으고 원본 배치를 기본으로 ──
  //   원본 실측: 확인 C · 취소 X · 메뉴 Z(Input::ACTION) · 스페셜 D · 배속 Q (systems/input.ts 머리말 참고)
  {
    date: "0803",
    title: "키 설정 화면 (F1)",
    what: "원본의 F1 커스터마이즈에 해당하는 화면을 만들었다. 프리셋(원본식/기존식) 전환 + 액션별 키 다시 잡기.",
    see: "↑↓로 줄 이동. 맨 윗줄에서 ←→로 원본식↔기존식이 바뀌고 아래 키 이름들이 통째로 바뀌는지. 아무 줄에서 확인키를 누르면 '새 키를 누르세요'가 뜨고, 누른 키가 그 자리에 들어가는지. R로 기본값.",
    scene: "KeyConfigScene",
  },
  {
    date: "0803",
    title: "필드 — 메뉴 Z / 가방 D",
    what: "원본대로 메뉴는 Z(Input::ACTION), 가방은 D로 바로 열리게 했다. 이동 중 취소키(X)를 누르면 여전히 반대 속도.",
    see: "Z를 누르면 메뉴가, D를 누르면 가방이 바로 열리는지. 좌상단 HUD의 안내가 '지금 걸린 메뉴 키'로 적혀 있는지.",
    scene: "WorldScene",
  },
  {
    date: "0803",
    title: "확인키 C — 대사·선택",
    what: "대사 넘기기·선택 확정이 Enter/Space/Z 고정이 아니라 확인 액션(기본 C·Enter·Space)을 따른다.",
    see: "C로 대사가 넘어가는지(Enter·Space도 그대로 되는지). 실내에서 엄마에게 말을 걸 때도 C가 먹는지.",
    scene: "InteriorScene",
    data: { room: "living", skipIntro: true },
  },
  {
    date: "0803",
    title: "배속 Q — 배틀에서만",
    what: "원본 안내문대로 배속은 배틀 전용. Q로 켜고 끈다(시간·트윈 2배).",
    see: "배틀에서 Q를 누르면 우상단에 '≫ 배속 2배'가 뜨고 대사·연출이 빨라지는지. 다시 누르면 원래 속도로.",
    scene: "BattleScene",
    data: { wild: true, testParty: true, backdrop: "route" },
  },
  // ── 0802 옵션 — 타이틀 '옵션'과 인게임 '설정'이 토스트만 띄우던 것을 실제 화면으로 ──
  //   항목은 원본 UI_Options.rb에서 **우리 게임에 붙일 데가 있는 것만** 가져왔다(빠진 것과 이유는 systems/settings.ts).
  {
    date: "0802",
    title: "옵션 — 6항목 + 즉시 반영",
    what: "음악/효과음 볼륨·텍스트 속도·배틀 이펙트·배틀 스타일·기본 이동을 만들고 실제 동작에 배선했다(저장만 되는 껍데기가 아니다).",
    see: "←→로 값이 바뀌는지. 볼륨을 내리면 커서 소리가 실제로 작아지는지. ESC로 닫히는지. R로 기본값 복구.",
    scene: "OptionsScene",
  },
  // ── 0802 세이브 슬롯 — 원본 Auto Multi Save(자동 3 + 수동 8)와 같은 구성으로 바꿨다 ──
  //   전에는 localStorage 키 하나뿐이라 "이어하기 = 마지막 저장 하나"였다.
  {
    date: "0802",
    title: "세이브 — 이어하기(칸 고르기)",
    what: "저장 칸을 원본처럼 자동세이브 3 + 세이브 A~H 8칸으로 늘렸다. 옛 1칸 저장은 자동으로 '세이브 A'로 옮긴다.",
    see: "칸 11개가 뜨고, 내용 있는 칸에 이름·배지 수·플레이 시간·저장 날짜가 적히는지. 빈 칸은 흐리게 '비어 있음'인지.",
    scene: "SaveSlotScene",
    data: { mode: "load" },
  },
  {
    date: "0802",
    title: "세이브 — 인게임 저장(칸 고르기)",
    what: "메뉴의 '저장'이 바로 덮어쓰지 않고 칸을 고르게 했다(원본도 불러온 칸/다른 칸을 고를 수 있다).",
    see: "빈 칸이 '여기에 저장'으로 바뀌고 아래 안내문이 'OO에 저장'으로 바뀌는지.",
    scene: "SaveSlotScene",
    data: { mode: "save", from: "WorldScene" },
  },
  // ── 0802 VS 연출 — AR의 HGSS "VS 트레이너" 전환(4초)을 그대로 이식 ──
  //   원본 규칙: hgss_vs_<트레이너타입> 초상이 있는 상대만 VS가 뜬다(관장·챔피언·로켓보스 21종).
  //   잡트레이너(한주·유정)는 그림이 없어 기존 페이드 그대로다 — 그게 원본 동작이다.
  {
    date: "0802",
    title: "VS 연출 — 그린전 진입",
    what: "원본 Transitions::VSTrainer를 초 단위 타이밍까지 그대로 옮겼다(띠 와이프 0.2s → VS로고 0.7~1.1s → 실루엣 슬라이드 1.25~1.4s → 플래시 1.9s에 색+이름 → 화이트아웃 3.0~3.5s → 블랙 3.8~4.0s).",
    see: "빨간 띠가 오른쪽에서 지그재그로 깔리고 VS 로고가 튀어나온 뒤, 그린이 검은 실루엣으로 들어왔다가 번쩍하며 색이 들어오는지. 배틀 BGM이 연출과 함께 시작되는지.",
    scene: "WorldScene",
    data: { debugVs: ["LEADER_Green:그린", "그린"] },
  },
  {
    date: "0802",
    title: "VS 연출 — 라이벌(네모)전 진입",
    what: "네모는 AR에 VS 초상이 없어 192x128 일러스트 초상을 따로 넣었다. AR도 8세대 갈라르 관장 9명은 손도트가 아니라 일러스트를 192x128로 줄여 쓴다(칸토 12장은 평균 13색, 갈라르 9장은 평균 4,983색 — 실측).",
    see: "같은 연출에 네모가 뜨는지. 그린(12색 손도트)보다 매끈해 보이는 건 원본 갈라르 관장들과 같은 방식이라 정상이다.",
    scene: "WorldScene",
    data: { debugVs: ["NEMONA", "네모"] },
  },
  // ── 0802 언덕(점프대) — 원본에 있는데 우리한텐 동작이 통째로 없던 것 ──
  //   1번도로 61칸·상록시티 39칸이 그냥 걸어 다니는 평지였다(위로도 올라가짐).
  //   원본 규칙: 지형태그 1(:Ledge) + passage로 방향 하나만 열림 → 그 방향으로만 2칸 점프.
  {
    date: "0802",
    title: "언덕 — 아래로 뛰어내리기(2칸 점프)",
    what: "맵 추출기가 지형태그 1(:Ledge)을 읽게 고치고, 원본 수치대로 점프를 붙였다(0.5초·높이 0.75칸·AR 'Player jump' 효과음).",
    see: "↓를 누르면 걷지 않고 언덕을 **폴짝 뛰어넘어 2칸 아래**에 착지하는지. 착지음이 나는지.",
    scene: "WorldScene",
    data: { map: "route1", spawn: [25, 30], face: "down" },
  },
  {
    date: "0802",
    title: "언덕 — 아래에서 위로는 못 올라간다",
    what: "언덕 칸은 blocked로도 막았다. 방향이 안 맞으면 점프가 아니라 벽(부딪힘)이다 — 원본과 같다.",
    see: "↑를 눌러도 언덕을 못 올라가고 '툭' 부딪히는 소리만 나는지. (올라가지면 잘못된 것)",
    scene: "WorldScene",
    data: { map: "route1", spawn: [25, 32], face: "up" },
  },
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
