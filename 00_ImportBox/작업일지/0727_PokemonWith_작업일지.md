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

---

# 0727 (2부) — 스타팅 지급 흐름 점검 → 스토리 이정표 자동저장 구현

## A. 점검 결과 (실동작 headless 검증)
LabScene 스타터 지급을 실제로 완주시켜(`tools/dbg-starter.mjs` 신규) 데이터로 확인:
- **파티 ✅**(CHARMANDER Lv5·기술3·maxHp18) · **도감 ✅**(dexSeen/dexOwn 둘 다 CHARMANDER) · **직렬화 ✅**(JSON 가능).
- **세이브 ❌** — 지급 직후 localStorage에 세이브가 **아예 없음**. 원인 = **지급 흐름 어디에도 `saveGame()` 호출이 없음**(저장 트리거는 MenuScene 수동 "저장" 한 곳뿐). 버그가 아니라 **영속화 누락**. (파티·도감은 registry엔 완벽히 들어감.)

## B. 원본(AR) 저장 방식 확인 — 추측 금지, 소스 대조
`Scripts.rxdata`(406개 .rb, rubymarshal+zlib) 조사:
- AR = **Essentials v21.1**(`000_Settings.rb:455`). 저장 = `Game.save`→`SaveData.save_to_file`→`Marshal.dump`(단일 슬롯).
- **자동저장 없음**(autosave/pbAutosave grep 0건). 게임 자체 저장은 크래시 긴급저장·배틀챌린지 진행저장뿐.
- 메뉴 저장 문구(`306_UI_Save.rb`): `"Would you like to save?"` 확인 → **`"{1} saved the game."`**(=○○은 게임을 저장했다) + ME `\me[GUI save game]`.
- ⭐ 사용자 결정: 원본엔 없지만 **"스토리 진행 후 자동저장"을 새로 넣기로**(라이벌=네모 SV 감성 → SV식 "저장 중…" 표시). 수동저장도 원본식 문구·사운드로.

## C. 현재 스토리 라인(이정표) — 조사 확정
①인트로(IntroScene) ②집 인트로·네모 첫 등장(`houseIntroDone`) ③집→마을→연구소 ④연구소 스타터 수령(`starterChosen`+`rivalBattlePending`) ⑤마을 첫 라이벌전(승리 시 `rivalBattlePending=false`) ⑥상록 그린전 배지(`badges`).

## D. 구현 (자동+수동 저장)
- **에셋:** AR `Audio/ME/GUI save game.ogg`→`public/assets/audio/me_save_game.ogg`, `SE/GUI save choice.ogg`→`se_save_choice.ogg`(SE는 미사용, 이식만).
- `src/game/sfx.ts`: `SFX.save`(me_save_game) 추가.
- `src/systems/save.ts`: **`autoSave(reg, loc)`** 추가(saveLoc 기록+saveGame).
- **신규 `src/game/saveIndicator.ts`**: `showSavingToast(scene)`(우상단 "저장 중…" 배너, **무음**, `setScrollFactor(0)`) + `autoSaveWithToast(scene, loc)`.
- **자동저장 4곳:** InteriorScene(`houseIntroDone` 직후, room복원) · LabScene(스타터 수령·busy=false 직전, `map.exit.toTown`→pallet 좌표) · GymScene(`giveBadge` 직후, `map.exit.toCity`→viridian 좌표) · WorldScene(라이벌 승리 복귀 — BattleScene:957에서 `rivalJustWon` 원샷 플래그 → World create에서 소비).
  - ⚠️ **Lab/Gym은 이어하기(MainMenuScene) 복원 대상이 아님** → 그 두 곳은 `scene:"WorldScene"` + 출구 마을 좌표로 저장해야 로드 시 안 튄다(조사로 확인한 핵심 제약).
- **수동저장(MenuScene:164):** `"${이름}은/는 게임을 저장했다!"` + `playMe(SFX.save)`.

## E. 검증 상태
- **`tsc --noEmit` EXIT=0** ✅.
- 실동작(스타터→세이브 반영) 재검증 + **화면 캡처**(자동저장 배너/수동저장 문구, `.claude/.verify/`)는 **세션 끝 서브에이전트로 진행 중** — 결과 확인 후 커밋. (Stop 훅이 MenuScene 캡처 증거 요구.)
- ⭐ **미완:** 디버그 확인항목(`debugChecks.ts`) 등록 아직 안 함(규칙상 완료 조건) · exe 미반영(`app:bake`) · `/code-review` 미실행.

## F. 함정
- **`dbg-starter.mjs`는 Space 6번으론 autoSave(네모 대사·walkNemonaOut 뒤)까지 못 감** → 15~20번+대기 필요(`rivalBattlePending=true` 찍히면 도달). 첫 실행 때 `rivalBattlePending=undefined`였던 게 이 때문.
- Lab/Gym `exit.toTown`/`toCity`는 **맵 로컬 좌표**(pallet/viridian_city) — `map`을 반드시 함께 저장.

## 다음 세션 첫 프롬프트 제안 (검증·커밋 완료 후 최신)
> ⭐ 이번 세션에서 **실동작 검증 완료**: 스타터 받으면 세이브에 실제로 들어감(party CHARMANDER·dexOwn·starterChosen·loc WorldScene/pallet(28,15)) · tsc EXIT=0 · 캡처 육안확인(수동 "레드는 게임을 저장했다!" / 자동 "저장 중…" 배너) · 콘솔에러0 · **커밋·push 완료**. 검증 몽타주 = `.claude/.verify/저장_자동수동_비교.png`.

"0727(2부) 일지 읽고 이어서. 스토리 이정표 자동저장(집인트로·스타터·라이벌전·배지)+수동저장 원본식 문구는 구현·검증(세이브 실반영 확인)·커밋까지 끝.
다음 = ① `debugChecks.ts`에 확인항목 등록(자동저장 배너/수동저장 문구 — 규칙상 이게 완료조건) → ② exe `app:bake`로 실행본 반영 → ③ `/code-review`(effort medium).
자동저장 4곳 중 Lab·Gym은 WorldScene 출구좌표로 저장하는 게 핵심(복원 대상 아님). playwright는 tools/ 안에서, 창 띄우기 전 먼저 물어볼 것."
