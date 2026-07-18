# 0718 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC의 Claude 포함)이 **이 문서만 보고** 문제없이 이어가게 쓴다.
> 전제: 0717 세션6에서 **틀4(상록체육관 + 첫 배지) 코어를 커밋**(`da0585e`)했으나, 일지가 커밋 직전에 작성돼 "미커밋·미검증·리뷰 안 함"으로 남아 있었다. 오늘은 그 **남은 게이트(검증·리뷰·커밋)**를 닫은 세션이다.

---

## ✅ 완료 — 틀4 남은 게이트 마감 (커밋 `2ef4f62`)

### 1. 시작 시 상태 확인 (단정 전 재검증)
- `git status` 깨끗 + `da0585e` 안에 GymScene/Badges/BattleScene 변경이 **이미 다 들어있었다** → 세션6은 "미커밋"이 아니라 **커밋된 상태였다**(일지가 커밋 직전 시점 기준이라 그렇게 적혔던 것). 그래서 이번 세션은 커밋이 아니라 **검증+리뷰**부터 시작.

### 2. 미검증 4건 — playwright 실주행으로 전부 통과
0717 세션6 §6-1이 남긴 미검증 항목. `window.__game`(전역 핸들. `window.game` 아님)으로 씬을 직접 start해서 확인.
- **상록시티 (35,10)에서 ↑ → (35,9) 밟으면 GymScene 진입**, 스폰 (10,11) ✅
- **체육관 출구에서 ↓ → WorldScene 상록시티 (35,10) 복귀** ✅
- **패배(`battleOutcome=lose`) 후 재입장 → 컷신 재생, 배지 없음** ✅
- **그린 랜덤 3팀이 실제로 갈린다** — `getTrainer("LEADER_Green:그린")` + `trainerTeam()` 300회 → 108/98/94로 고르게(ver1 GROWLITHE/BRONZOR/YAMPER/RHYHORN · ver2 PSYDUCK/NACLI/SMOLIV/HERDIER · ver3 SANDSHREW/LOTAD/MASCHIFF/PIDGEOTTO). ver4(L24)는 안 섞임 ✅
- 산출물: `.claude/.verify/t4b_1~3_*.png`

### 3. `/code-review`(effort medium) — ⚠️ **실제 버그 1건 발견·수정**
- **[높음] 공짜 배지 익스플로잇.** 그린에게 **지고 → 다른 배틀(야생 등)을 이기고 → 체육관 재입장**하면 안 싸우고 배지를 먹었다.
  - 원인: `GymScene.startBattle`이 켠 **전역 레지스트리 플래그 `gymGreenBattleDone`가 패배 경로에서 안 지워진다**(패배는 화이트아웃으로 집行이라 GymScene.create를 안 거침 → 플래그가 살아남음). 재입장 판정이 `lastBattleOutcome==="win"`만 봐서, 그 사이 아무 배틀이나 이기면 조건이 참이 돼 배지 지급 컷신(`afterBattle`)이 돌았다.
  - 세션6이 넣은 방어(`outcome==="win"` 확인)는 '그린전 승리'가 아니라 '아무 승리'만 봐서 뚫렸다.
- **수정(리뷰 #3 altitude 방향으로 근본해결):** 전역 플래그 2개(`gymGreenBattleDone`·`lastBattleOutcome`)를 **완전 폐기**하고, `BattleScene.endBattle`이 `returnScene`으로 복귀할 때 **`{fromBattle:true, battleOutcome}`를 씬 데이터로 직접 넘긴다**. 패배는 `returnScene`을 무시하고 InteriorScene(집)으로 가므로 **체육관으로 복귀하는 경로 자체가 없다 → 구조적으로 누수 불가.** GymScene.create는 `this.initData.fromBattle && battleOutcome==="win"`일 때만 `afterBattle`.
- **재실증(playwright 3경로):** ① 데이터 없이 입장 → `badges:[]`, 컷신 재생 ② `fromBattle+lose` 입장 → `badges:[]` ③ `fromBattle+win` 입장 → 대사 넘기면 `badges:["그린 배지"]`, `greenGone:true`. 콘솔 에러 0.
- **정리 2건:** 실수로 커밋됐던 `tools/ar-map/__pycache__/extract-map.cpython-312.pyc` untrack + `.gitignore`에 `__pycache__`·`*.pyc`·`.claude/.verify/` 추가.

**바꾼 파일**
- `src/scenes/BattleScene.ts` — `endBattle`에서 전역 플래그 set 제거, returnScene 복귀에 `{fromBattle,battleOutcome}` 데이터 첨부.
- `src/scenes/GymScene.ts` — `GymInit`에 `fromBattle?/battleOutcome?` 추가, `create`가 레지스트리 대신 initData로 판정, `startBattle`의 플래그 set 제거.
- `myPokemon_AJ/.gitignore` — pycache·verify 무시.
- `tools/ar-map/__pycache__/…pyc` 삭제.
- `npx tsc --noEmit` 통과(반드시 `myPokemon_AJ/`에서).

### 4. 이번에 실제로 걸린 함정 (다음 세션도 걸린다)
1. **전역 핸들은 `window.__game`이다**(`main.ts`가 그렇게 노출). playwright에서 `window.game`은 undefined → `getScenes` TypeError.
2. **그린 트레이너 id = `"LEADER_Green:그린"`**(타입:이름 형식). `getTrainer("LEADER_Green")`은 못 찾는다.
3. **트레이너 팀 몬스터 필드명은 `.id`**(`.species` 아님). `trainers.json` 팀 항목 = `{id, level}`.
4. **씬 재시작 간 상태를 registry 전역 플래그로 넘기면 누수 위험** — 복귀 안 하는 분기(패배 화이트아웃)에서 안 지워져 살아남는다. **결과는 `scene.start(key, data)`의 데이터로 넘기는 게 안전**(그 배틀에서 실제로 그 결과로 돌아온 것이 보장됨).

---

## ⏭ 다음 세션 시작 지점 — **상록시티 건물(PC·마트 BuildingScene)**
> `/clear` 후 새로 시작 권장(체육관 컨텍스트와 분리). 진행상태 정본은 memory `starter-lab-flow`.

1. 맵 png/json 이미 추출됨: `viridian_pc` · `viridian_mart`. ⚠️ **BoxScene(PC 보관)은 실제로 없다**(`viridian_pc.json`은 스텁) — 만들어야 함.
2. **BGM = `tools/ar-audio/render-mid.py`로 뽑는다**(AR 동봉 `soundfont.sf2`로 .mid→ogg. `tinysoundfont` `--no-deps`로 스크래치패드 설치). 대상 = `Poke Center.mid`·`Poke Mart.mid`. (파이프라인은 `bgm_gym.ogg`로 검증됨 — Lab.mid 재렌더가 기존 커밋본과 포락선 상관 0.878.)
3. 체육관 잔여(원본에 있으나 미구현, GymScene 주석에도 박음): **경호(문지기)** = 22번도로 트레이너 4명 조건 → 그 맵 만들 때 함께 / **배지 UI** = `badgeIconRect()`는 있으나 트레이너카드 화면 없음 / TM92·도감지급은 원본 조건상 안 도는 게 정상.
4. 그 뒤 큰 숙제: **affinity 가구 0개 = 이 게임 차별점(집꾸미기→컨디션→배틀) 미발동**(제일 아픔) · 상태이상 거는 코드 없어 치료제가 영원히 "효과 없음" · `BedroomScene`은 진입경로 0인 고아 씬 · 오버월드 걷기 tween이 Lab/World/Gym에 중복(헬퍼 통합 미반영 리뷰).

## 새 지침/skills/memory 요지
- 새 훅·규칙·스킬 **없음**.
- memory `starter-lab-flow` 갱신함: 틀4 코어 완료 + 위 버그·수정 요약 + 다음=상록 PC·마트로 시작지점 이동.
- 이관 필요 항목 없음(memory는 PC-로컬이나 요지를 이 일지에 담았다).

## 사용자가 직접 볼 곳
**http://localhost:5180** → 타이틀 **D** → **`Y` = 상록체육관**. 들어서면 그린 컷신 자동 재생 → 배틀.
⚠️ 테스트 파티(L5 3마리)로는 그린(L10~13 4마리)을 못 이겨 **배지 장면까진 안 간다** — 파티를 키우거나 검증 스크립트로 상대 HP를 낮출 것.

---

# 0718 세션2 — 상록 건물(포켓몬센터+마트) 구현 + 사용자 지적 3건

## ✅ 완료·검증 — 상록시티 실내 건물 (센터 회복 / 마트 진입)
**바꾼/추가 파일**
- **신규 `src/scenes/BuildingScene.ts`** — 센터·마트 겸용 실내 씬(GymScene 패턴 미러링). `init({building:"pc"|"mart"})`로 png/json/BGM/NPC/좌표 분기. 격자이동·도어매트 출입·NPC 배치·센터 회복·마트 점원.
- `src/main.ts` — BuildingScene 등록(GymScene 뒤).
- `src/scenes/DebugMenuScene.ts` — **U=포켓몬센터, I=마트**(keyNames에 U,I 자동바인딩됨).
- `src/scenes/WorldScene.ts` — 워프 2개(`viridian_city` PC문 **(26,25)**, 마트문 **(35,25)** dir up) + handleWarp에 `pc`/`mart` 분기.
- `src/game/sfx.ts` — `BGM.center="bgm_pc"`, `BGM.mart="bgm_mart"`.
- **신규 에셋** `public/assets/audio/bgm_pc.ogg`·`bgm_mart.ogg` — AR `Poke Center.mid`/`Poke Mart.mid`를 원본 soundfont로 렌더(`tools/ar-audio/render-mid.py`, tinysoundfont 스크래치패드 설치).

**전부 AR 원본 소스에서 뽑은 좌표(눈대중 아님)** — AR MapInfos/Map56·158·159 이벤트 판독:
- viridian_pc = **AR Map158**(문(26,25)→내부(7,8)) · viridian_mart = **AR Map159**(문(35,25)→내부(4,7)).
- 도어매트(스폰=출구): PC **(7,8)**, 마트 **(4,7)**(픽셀측정). 복귀 toCity: PC (26,26)·마트 (35,26)(문 한칸 아래, face down).
- 간호순=`NPC 16`@(7,2) · 보조간호순=`NPC_PikeMaid`@(8,2) · 마트점원=`NPC 19`@(2,3)(모두 128×192=32×48 4방향, public에 이미 있음).
- 회복 카운터 앞칸 판정: 위보고 A로 front tile이 counterTiles에 들면 발동(PC=row3 cols5~9 / 마트=row4 cols0~3).

**실동작 검증(playwright, 스샷 `.claude/.verify/`):** ⚠️ **headless는 rAF 스로틀로 걷기가 느려 워프가 안 걸리는 것처럼 보인다** → launch args `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` 붙이면 정상. (이거 몰라서 한참 헤맴 — 다음 세션 필수 팁.)
- `full_2_healed.png`: 도시→위로걸어 센터 진입→카운터 A→**파티 전원 HP/상태이상/PP 완전복구**(A 4→20·화상해제, B 1→18·독해제, PP 5→35)+간호순 대사.
- `exit_back_city.png`: 도어매트 아래→busy=true(tryExit)→**상록시티 (26,26) 복귀**.
- `mart_clerk.png`: 마트 (2,5)위보기 A→**점원 "어서 오세요!"**.
- tsc 통과 · code-review(medium) correctness 버그 0.

⚠️ **BGM은 dev서버 재시작해야 남**(새 ogg가 아직 text/html 응답 — Vite 실행중 추가파일 인식못함). `curl -w '%{content_type}' .../bgm_pc.ogg`가 audio/ogg 나올 때까지.

## ⚠️ 사용자 지적 3건 (2건 미해결 — 다음 세션 최우선)
### ③ [최우선·사용자 분노] **트레이너(남자애)가 나무 타일 위에 서 있음** — 실제 배치 버그
- 사용자 확인: **상록시티(`viridian_city` = AR Map56)** 맵에서 남자애(트레이너/NPC) 스프라이트가 **나무 타일 위에** 서 있음. (앞서 내가 "상수숲"으로 잘못 적었으나 사용자가 상록시티라고 정정 — 숲 아님.)
- **재조사 시작점(상록시티 한정):** AR DB 로드 후 WorldScene에서 이 맵의 트레이너/NPC 스프라이트 실좌표를 찍고 `viridian_city.json` blocked(나무)와 대조. `trainers.json` placements 중 map56 항목 좌표계·오프셋 확인(상록시티 오버월드에 트레이너가 있는지부터).
- ⚠️ **내 오판 기록**: 런타임 프로브에서 `trainers=0`이라 "route1 분홍/회색은 맵에 구워진 꽃장식"이라 단정했는데 **이건 AR DB 로드 전이라 트레이너가 아직 안 뜬 상태였을 뿐**. 사용자가 보는 건 실제 트레이너 스프라이트다.
- **재조사법(다음세션):** `isArDbLoaded()` 완료를 기다린 뒤 WorldScene에서 트레이너 스프라이트 실좌표를 찍고, 그 타일이 해당 맵 json에서 blocked(나무)인지 대조. 정본=`public/assets/data/ar/trainers.json` `placements`. 알려진 route1 트레이너: 한주(25,13)·유정(33,6) — 이 좌표가 나무면 placements 추출 오프셋/좌표계 버그 의심. **"상수숲"이 별도 forest 맵이면 그 맵부터 추출·확인.**

### ② 배틀 상태이상·기술UI·대사 — 미구현 확정(틀3 영역, 별개 큰 작업)
- `src/systems/battle.ts`: 데미지·상성대사만. **상태이상 부여·능력랭크 변화 대사("○○의 ○○가 떨어졌다")·상태이상 애니 전무.** status 카테고리 기술은 effectiveness:1만 반환하고 무효과. `moves.json`에 `functionCode`·`effectChance` 데이터는 있으나 코드 미사용. → `turn-battle-system`으로 상태이상 시스템+대사+애니+기술UI(AR 대조) 전용 블록 필요. (치료제 "효과 없음"도 같은 뿌리.)

### ① 건물 진입 — 위에서 완료·검증함(원인=내가 워프 늦게 붙임).

## 미착수(다음 후보)
- 마트 상점(구매/판매) UI — AR 마트/가방 UI 조사 + Pick 후 구현(사용자가 이번엔 "점원 인사만"으로 합의). AR Map159 판매목록 우리 카탈로그 교집합 = 몬스터볼/슈퍼볼/상처약/좋은상처약/해독제/마비·잠깨는·화상·얼음치료제/기력의조각.
- PC 보관함 BoxScene(6×5 그리드, AR Storage UI). · 상록 민가(Home door Map160~163) 워프.

## 다음 세션 첫 프롬프트 제안 (세션3에서 해결됨 — 아래 참고)
"작업일지 세션2 읽고 **③ 트레이너 나무 위 배치 버그**부터 재조사·수정. 먼저 '상수숲'이 어느 맵인지 확인."

---

# 0718 세션3 — ③ 트레이너 나무 위 배치 버그 해결 (전경 priority 레이어 도입)

## ✅ 완료·검증 — 근본원인 수정
### 진단 (정적 추측 아님 — 런타임 + AR 원본으로 확정)
- 사용자가 본 "나무 위 남자애" = **1번도로 `YOUNGSTER:한주`**(AR 원본 좌표 그대로 (25,13)=local). `유정`(LASS)은 priority 0 = 풀숲 정상 배치라 **버그 아님**(안 건드림).
- **상수숲이라는 별도 맵은 없음**(forest는 타일셋 이미지 하나뿐) — 버그 맵은 1번도로가 맞고, 상록/1번도로가 오프셋0으로 이어붙어 사용자가 "상록시티"로 인식한 것.
- 런타임 프로브(`window.__game`, WorldScene.trainers 실좌표) + AR `Map010` 타일 priority 판독: 한주 칸 z1 타일 **priority=3**(캐릭터 위에 그려지는 전경). 근본원인 = `extract-map.py`가 RMXP `@priorities`를 **안 읽고 전 레이어를 한 장으로 평탄화** → 나무 캐노피가 바닥 PNG에 구워져, 렌더러가 캐릭터(depth 5)로 그 위를 덮음. **플레이어도 나무 근처에서 동일 증상.**

### 수정 (전경 레이어 제대로 — 사용자 확정 방식)
**바꾼 파일**
- `tools/ar-map/extract-map.py` — `@priorities` 읽어 **priority>0 타일을 `<맵>_over.png`로 분리** 추출(바닥은 `<맵>.png`). priority 판정은 기존 `tbl_lookup(prio,tid)` 재사용(리뷰 단순화).
- `public/assets/world/{route1,viridian_city,pallet_town}.png` — 재추출(전경 제거된 바닥).
- **신규** `public/assets/world/{route1,viridian_city,pallet_town}_over.png` — 전경(나무 캐노피·지붕).
- `src/data/region.ts` — `RegionMap.overImg` 필드 + 3맵 경로.
- `src/scenes/WorldScene.ts` — 전경 PNG preload + **depth 6**(캐릭터 5 < 6 < HUD 100 < 대화창 1000)로 렌더. create()에서 `textures.exists` 가드.

### 검증 (playwright 실주행, 스샷 `.claude/.verify/`는 아니고 스크래치패드)
- ✅ 한주가 나무 **뒤로**(모자만 빼꼼) · ✅ 플레이어도 나무 뒤로 · ✅ 풀숲/태초마을에서 **머리 안 잘림**(과거 분노 회피 — 전경은 나무 뒤일 때만 가림).
- ✅ 충돌격자 JSON **바이트 동일**(재추출해도 blocked/grass 불변 — 조용한 붕괴 없음) · ✅ ground PNG 검은 halo 셀 **0** · ✅ route1/viridian_city/pallet_town.png는 **WorldScene만** 소비(BattleScene은 Backdrop 타입만 import) · ✅ 콘솔 에러 0.
- ✅ `/code-review`(medium) 정정성 버그 0, 단순화 1건 적용 · ✅ tsc 통과.

### 함정·팁 (다음 세션)
1. **맵 재추출은 안전**하지만 반드시 재추출 후 `blocked/grass` JSON을 이전과 diff해 불변 확인(격자 조용히 안 깨지게).
2. dev서버 실행 중 만든 **새 public 에셋(_over.png)은 서버 재시작 전까지 text/html** 응답 → `curl -w '%{content_type}'`가 image/png 될 때까지 재시작(세션2 팁 재확인).
3. **playwright는 node쪽**(python playwright 미설치). 스크립트는 `myPokemon_AJ/`에서 실행해야 node_modules 해석됨. headless는 anti-throttle args 필수(세션2 팁).
4. `.gitignore`(루트) M = **내 작업 아님**(python 실행 중 훅이 pycache 무시 추가). 이번 커밋에서 제외함.

## 남은 후보 (세션2 미착수 그대로 + 우선순위)
- ② **배틀 상태이상·기술UI·대사 미구현**(틀3, 별개 큰 작업 — `turn-battle-system`). 치료제 "효과 없음"도 같은 뿌리.
- 마트 상점 UI · PC 보관함 BoxScene · 상록 민가 워프 · affinity 가구(집꾸미기→컨디션→배틀 차별점 미발동) · BedroomScene 진입경로 0.
