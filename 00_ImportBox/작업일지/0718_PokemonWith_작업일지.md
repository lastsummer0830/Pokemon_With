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
