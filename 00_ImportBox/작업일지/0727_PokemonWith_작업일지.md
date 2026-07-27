# 0727 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC 포함)이 **이 문서만 보고** 이어가게 쓴다.
> 이 세션 = 0722(4부)가 남긴 "남은 것 §1 **Common 애니 나머지 연결**"을 처리하고,
> 사용자 질문 3건(원본 소스 매치·태초 남쪽 이동·도감 연결)을 실데이터로 확인했다.

---

## 1. Common 애니 나머지 연결 (Phase C 남은 것 §1)

### 배경
Phase C(0722)에서 `HealthUp`/`HealthDown`만 붙어 있었다. 배틀 로직(능력변화·상태이상·혼란·아이템)은
**전부 이미 구현돼 있었고 Common 애니만 비어 있는** 상태였다(Explore 에이전트로 연결 지점 6곳 확정).

### 바꾼 것 — `myPokemon_AJ/src/scenes/BattleScene.ts`
연결 지점 6곳에 `playCommonAnim(name, onAlly)` 추가:
| 지점(함수) | 붙인 애니 | onAlly |
|---|---|---|
| 상태이상 부여 `doTurn`(res.statusInflicted) | `STATUS_COMMON[...]` (Poison/Toxic/Burn/Paralysis/Sleep/Frozen) | `!isAlly`(걸린 쪽) |
| 혼란 부여 `doTurn`(res.confused) | `Confusion` | `!isAlly` |
| 능력 랭크 +/- `doTurn`(res.statChanges, **outcome==="changed"일 때만**) | `StatUp`/`StatDown` | user면 isAlly, target면 !isAlly |
| 혼란 자기공격 `doTurn`(gate.selfDamage, **자기공격 직전**) | `Confusion` | `isAlly` |
| 아이템 상태치료(커맨드 루프, `status→null`) | `UseItem` + `allyBox.refresh()`(아이콘 제거) | true |
- 새 모듈 상수 2개: `STATUS_COMMON`(상태→원본 애니명. **badpoison=Toxic·freeze=Frozen**) · `COMMON_LABEL`(디버그 한글표).
- 데모 `common` 케이스 확장: `HealthUp`/`HealthDown`은 기존 HP연출, 그 외 이름은 **HP 안 건드리고 애니만** 재생.
  `demoCommon`에 `"A|B|C"`로 여러 개 넘기면 순차 재생.
- (HP회복 `HealthUp`·잔뎀 `HealthDown`은 0722에 이미 붙어 있음 — 안 건드림.)

### ⭐ 원본 소스로 매치 확인 (사용자가 "다 매치되는 거 확인했냐" 물어서 대조)
`Data/Scripts.rxdata`(AR: `/mnt/d/Pokemon Another Red_PWT_250829/`)를 rubymarshal+zlib로 406개 .rb로 풀어
실제 `pbCommonAnimation` 호출을 대조 → **6곳 전부 원본과 일치**:
- `112_Status.rb` 등록: SLEEP→"Sleep"·POISON→"Poison"·BURN→"Burn"·PARALYSIS→"Paralysis"·FROZEN→"Frozen".
- `163_Battler_Statuses.rb` `pbInflictStatus`: **`if newStatus==:POISON && count>0 → "Toxic" else Status.get(newStatus).animation`** (내 맹독=Toxic 분기와 동일).
- `164_Battler_StatStages.rb`: `pbCommonAnimation("StatUp"/"StatDown") if showAnim`(실제 변화 시만 — 내 outcome==="changed"와 동일).
- 혼란 부여 `163:485` / 혼란 자기공격 `168_Battler_UseMoveSuccessChecks.rb:266`(자해 판정부) / UseItem = `230_Battle_ItemEffects.rb` 등 아이템 효과부.
- ⚠️ 추론이 아니라 소스 확정값이다. **추출한 .rb는 세션 스크래치라 사라진다** — 다시 필요하면 위 방법으로 재추출.

### 확인 항목 등록 — `myPokemon_AJ/src/data/debugChecks.ts` (규칙: 추가까지가 완료)
0727 항목 **4개** 추가(배열 맨 위): 능력 StatUp/StatDown · 상태이상 6종 · 혼란 · 아이템 UseItem.
모두 `demo:"common"` + `demoCommon`(| 구분) + `demoByAlly`.

### 검증 (전부 headless, dev 5180)
- 신규 `myPokemon_AJ/tools/dbg-common.mjs`: 4개 데모 구동 → **정확한 애니명 순차 호출** + **셀 스프라이트 렌더**(2~7) + **콘솔에러 0**.
  ⚠️ 이 스크립트 초판은 케이스마다 래퍼를 겹쳐 이름이 중복 기록됐다(게임 버그 아님) → `sc.__origCommonAnim` 한 번만 보관하게 고침.
- `tsc --noEmit` **EXIT=0**.
- 못 함: **실배틀 RNG 트리거(기술이 실제로 상태 걸 때) 강제 재현 안 함** — 데모 경로로 검증(0722 HealthUp/Down과 동일 기준). 소리 못 들음(headless). `npm run app:bake` 안 함(exe 미반영). `/code-review` 미실행(슬래시=사용자 트리거).

---

## 2. 사용자 질문 2건 — 실데이터로 확인(둘 다 버그 아님)

### ① "태초마을에서 더 아래로 안 내려감 — 의도?" → **의도된 것**
- 스폰 `[20,15]`(오토타일 물 확인 항목) **바로 아래가 연못 물칸**(pallet local y=17~19 / col 19~22 = blocked). y=16 한 칸만 내려가고 물에 막힌다.
- 리전 세로 배치(`src/data/region.ts`) = **상록시티(oy=0)→1번도로(oy=40)→태초마을(oy=80~99, 최남단)**. 태초 아래엔 맵 없음(실게임도 1번도로는 태초 **북쪽**). 마을 남쪽 경계에서 멈추는 게 설계대로.

### ② "도감 제대로 연결됐냐" → **정상**
- 디버그메뉴 `W. 도감`(PokedexScene) 실경로로 열어 스샷 확인: 씬 활성·**콘솔에러 0**·**본 8/잡은 3** 정상 렌더. 안 본 칸 `———`는 정상.
- ⚠️ 레지스트리 키는 **`dexSeen`/`dexOwn`**(dexOwned 아님 — 처음에 오조회함). `markOwn`이 seen+own 둘 다 찍는다(`src/data/Pokedex.ts`).

### ③ "세이브엔 스타팅 없는데 도감엔 3마리 잡음?" → **디버그 가짜 데이터**
- 도감 3마리(파이리/꼬부기/이상해씨)는 잡은 게 아니라 **`primeDebugRegistry()`**(`debugChecks.ts:117~135`)가
  디버그 진입 시 화면 채우려고 주입하는 테스트값(파티 3마리 Lv5 + markOwn 3 + markSeen 5 = 본8/잡은3).
  **세이브와 별개**(registry 메모리에만 잠깐). 세이브에 스타터 없는 건 **실제 스타팅 지급 흐름(LabScene)을 아직 안 탔기 때문** — 버그 아님.

---

## 3. 남은 것 (다음 세션)
0. **실제 스타팅 지급 흐름 점검/구현** — 사용자가 이번에 발견. 세이브에 스타터가 안 들어간다.
   오박사(LabScene)에서 스타터 받아 **파티+도감(markOwn)+세이브**에 실제로 반영되는지 확인부터. (memory `starter-lab-flow` 참조.)
1. **Common 애니 실배틀 RNG 트리거 실검증**(이번엔 데모만) — 상태 거는 기술 실제로 써서 doTurn 경로 확인.
2. Common 애니 그 외 미연결분: 날씨(Sun/Rain/Sandstorm/Hail)·Attract·EatBerry 등(필요 시).
3. 애니 근사 유지분: 색 보정=틴트 / 감산 블렌드→곱셈 / 시트 hue 회전 무시. 타이밍 2·4 스크롤 원본 미대조.
4. `도감번호 ———`(SummaryScene에서 디버그 파티 도감번호가 dash) · Summary 빈 기술칸 · 라이벌집 마감(NPC·워프·매트).
5. **exe 미반영** — 체크포인트에서 `npm run app:bake`.

## 4. 함정 (이번에 걸린 것)
1. **playwright `.mjs`는 `myPokemon_AJ/tools/` 안에서 실행**해야 `import {snap} from "./_snap.mjs"` + node_modules가 잡힌다. 스크래치패드에 두면 `ERR_MODULE_NOT_FOUND`. (`_snap.mjs` export는 `snap(page, path)`.)
2. **Bash `cd`가 호출 사이에 리셋**될 수 있다(다음 호출이 프로젝트 루트 밖이면 `cd tools` 실패) → 절대경로나 `cd /full/path && ...`로.
3. 도감 데이터 확인은 **반드시 디버그메뉴 실경로**(프라이밍 포함)로. PokedexScene 직접 start하면 dex 비어 0으로 나온다.

## 다음 세션 첫 프롬프트 제안
"0727 일지 읽고 이어서. Common 애니 나머지 연결(6곳·원본 매치 확인)은 끝났다.
**다음 = 실제 스타팅 지급 흐름 점검** — 오박사(LabScene)에서 스타터 받아 파티+도감+세이브에 실제 반영되는지부터 확인.
(세이브에 스타터가 안 들어간다는 게 이번에 발견됨. 도감의 3마리는 primeDebugRegistry 가짜값.)
캡처는 headless, playwright는 tools/ 안에서, 창 띄우기 전 먼저 물어볼 것."
