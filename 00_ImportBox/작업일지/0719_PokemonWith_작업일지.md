# 0719 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC 포함)이 **이 문서만 보고** 이어가게 쓴다. 컨텍스트 한계로 세션 중단 → 남은 문제 정확히 인계.
> ⚠️ 전부 **미커밋(working tree only)**. 커밋 승인 안 받음. 다음 세션이 유지/보완 후 커밋.

---

## ✅ 완료·검증 — 배틀 토대: 유대(bond)→명중/회피 확장
0718 세션6이 남긴 "유대→회피/명중" 지점 구현.
- **`src/systems/bond.ts`** — `bondAccEvaBonus(p)` + 상수 `BOND_ACC_EVA_MAX_STAGE`(=1). 유대100 → 명중/회피 +1랭크 상당(연속·비례).
- **`src/systems/stages.ts`** — `accEvaMult(atk,def,accBonus=0,evaBonus=0)` 옵셔널 인자 추가(stages는 bond 몰라도 됨, 하위호환).
- **`src/systems/battle.ts`** — 명중판정에 공격자 유대→명중, 방어자 유대→회피 보너스 전달.
- 검증: dev서버 동적import로 실TS 구동 — 순수계산 12/12 + performMove 통합 4/4(유대100 방어자=빗나감, 공격자=명중유지). tsc 통과, 콘솔0.
- 야생/트레이너 몬스터는 condition=0 → 보너스0(내가 돌본 파티만 이득 — 의도한 차별점).

## ✅ 완료·검증 — 상록 실내(포켓몬센터·마트) 3대 버그
사용자 스샷 지적. **눈대중 금지 — AR Map158/159 rxdata 직접 판독 + playwright 스샷 검증.**
- **간호순/점원이 카운터 "위"에 서던 문제** = 세션3 나무와 동일 뿌리(카운터 앞면·NPC칸이 AR에서 **priority>0 전경**인데 우리 실내 PNG는 평탄추출).
  - 수정: `tools/ar-map`로 **priority 타일만 뽑아 `public/assets/world/viridian_pc_over.png`·`viridian_mart_over.png` 생성**(배경 PNG는 안 건드림). BuildingScene가 preload+ **depth6**(NPC depth4 위 · 플레이어 depth7 아래)로 렌더 → 카운터가 NPC 다리를 가려 "뒤에 선" 것처럼.
- **맵이 좌상단 쏠림+검은여백** = PNG 640×480인데 실제 방은 좌상단뿐(PC bbox **480×296**·마트 **352×264**). 전체를 중앙정렬해서 쏠렸음.
  - 수정: BuildingDef에 `content:[w,h]` 추가, `layout()`이 **콘텐츠 크기 기준 중앙정렬**(zoom/origin). cx/cy 공식 불변.
- **말 걸어도 안 돌아봄** = 마트 점원을 `face:"down"`으로 박았으나 **AR EV2는 `dir=right`**. 상호작용 시 안 돌아봄.
  - 수정: AR 방향 반영(clerk=right), `attendant` 인덱스 추가, 카운터에서 A → 담당 NPC를 `idleFrame.down`으로 **돌려** 응대.
- **지어낸 멘트 → AR 원문**: 간호순 = AR Map158 EV2 원문("안녕하세요, 포켓몬 센터입니다."/"여기선 포켓몬을 치료해드리고 있습니다."/"포켓몬을 치료해드릴까요?".../"맡겨두신 포켓몬이 전부 건강해졌습니다."/"안녕히 가세요."). 점원 = AR Map159 EV2는 Essentials 상점만 열고 전용대사 없음, 그 인사말 원문 = **미번역 영어 `"Welcome! How may I help you?"`**(AR Scripts.rxdata에서 확인)를 한글로.
- 검증: playwright 스샷 `verify2_pc_talk.png`/`verify2_mart_talk.png`(스크래치패드) — 둘 다 카운터 뒤·중앙정렬·이름창+원문대사·플레이어 머리 안 잘림. tsc통과, 콘솔0.

**바꾼 파일(이 블록):** `src/scenes/BuildingScene.ts` + 신규에셋 2개(`viridian_pc_over.png`·`viridian_mart_over.png`).

---

## ✅ 완료·검증 (세션7, 0719 후반) — 회복음 교체 + 카운터 y정렬
- **[커밋 e2aa753] 포켓몬센터 회복음 교체:** 회복 연출이 획득 팡파레(`me_pkmn_get`)를 임시로 쓰던 걸(어색), AR 원본 `Audio/ME/Pkmn healing.ogg`(실제 센터 회복 징글, 2.42s)를 `me_pkmn_heal`로 추가해 교체. `sfx.ts`(키+FILES) · `BuildingScene.ts:277`(healParty). 사용자가 실제 듣고 "저 소리 맞아" 확인. playwright로 healParty 직접호출 → 재생키=me_pkmn_heal(획득음 아님)·BGM pause→resume·실회복 검증. 바꾼파일: `public/assets/audio/me_pkmn_heal.ogg`(신규)·`sfx.ts`·`BuildingScene.ts`.
- **[커밋 f339197] ① player-on-counter 해결:** 아래 ① 문제를 per-캐릭터 y정렬로 해결(전경 overlay를 행별 스트립으로 쪼개 depth=BASE+행+0.5, 캐릭터 depth=BASE+발위치행). 마트 배달/체크아웃·센터 회복카운터 4케이스 playwright 스샷 검증 — 올라탐 없음·머리 안 잘림·NPC 다리 카운터 뒤. 바꾼파일: `BuildingScene.ts`(overStrips[]·charDepth()·layout depth·tween시 depth갱신).
- **② clerk-turn 조사결과 = 코드 정상, exe 미반영 추정:** 실제 SPACE 키로 (2,5)에서 상호작용 → 점원 프레임 8(right)→0(down) **돌아봄** + "어서 오세요!" 확인(스샷 `clerk_after.png`). dev에선 정상. 사용자 실플레이 "안 돌아봄"은 **플레이 중인 `build_win/win-unpacked/PokemonWith.exe`에 지난 세션(0719 세션3)의 attendant-turn 수정이 아직 안 구워진 것**으로 보임 → **`npm run app:bake` 필요**(exe 재굽기, 굽기 전 exe 종료). ⚠️ 확정 아님 — 다음 세션에서 bake 후 사용자 실플레이 재확인.

---

## ⚠️ 남은 문제 (원래 2건 중 ①해결 — 아래는 원문 보존)

### ① [player-on-counter] ✅**해결됨(커밋 f339197)** — **플레이어(RED)가 마트 유리 카운터 "위"에 올라가 보임**
- 사용자 스샷: 마트 좌하단 유리(하늘색 체크) 카운터에 **주인공이 올라간 것처럼** 렌더.
- **근본원인(내 이번 수정의 부작용):** 전경 오버레이를 **depth6(플레이어 depth7 아래)**로 뒀다. NPC(카운터 뒤, 늘 뒤)엔 맞지만, **플레이어가 카운터에 인접해 서면 카운터 앞면 위로 플레이어가 그려져** "위에 올라간" 것처럼 보인다. (반대로 depth를 플레이어 위로 올리면 카운터 앞에 설 때 **머리 잘림** = 사용자 격노 재발.)
- **진짜 해결 = per-캐릭터 y-정렬 depth(RMXP식).** 고정 depth 오버레이로는 움직이는 플레이어를 카운터와 올바르게 앞뒤정렬 못 함. 이게 "priority 타일" 난제의 본질(세션3 나무와 동류지만 실내는 플레이어가 카운터 바로 앞에 서서 더 까다로움).
  - 후보 A: 플레이어/NPC depth = `base + ty*k`로 두고, 전경 타일도 **행별로 분리**해 각 행 오버레이 depth = 그 행 캐릭터보다 크게(그 행 위에 선 캐릭터만 가림). 즉 카운터 앞면(그 행)은 같은 행/뒤 캐릭터만 가리고, 앞(아래 행) 플레이어는 안 가림.
  - 후보 B(단순): 카운터를 캐릭터가 **밟을 수 없게** 하고(그 유리 카운터 앞칸이 walkable이면 blocked로), 앞면 오버레이는 그 카운터 "뒤 칸"에 선 캐릭터만 가리게 위치별 depth. → 우선 마트 좌하단 배달카운터(row6 cols0~2)·클럭카운터(row4) 주변 walkable/blocked를 `viridian_mart.json`으로 재확인.
- ⚠️ 착수 전 **원본 PNG 격자 오버레이로 카운터 칸 실측**(스크래치패드 `mart_grid.png`·`pc_grid.png` 참고) 후, playwright로 플레이어를 카운터 근처 여러 칸에 세워 스샷 검증.

### ② [clerk-turn] **카운터에서 말 걸 때 점원이 돌아보고 대답 안 함(실플레이)**
- 내 playwright 검증(`onKey` 직접호출)에선 점원이 아래로 돌고 "어서 오세요!" 떴다. 그런데 **사용자 실플레이에선 안 돌아본다**고 재지적. 스샷엔 "(상점은 아직 준비 중이다.)"(clerkGreet 2번째 줄)만 보임.
- **의심점(다음 세션 확인):** 실제로 플레이어가 서는 칸이 `counterTiles`(마트 row4 cols0~3)와 안 맞아 `onKey`가 조기 return하거나, 사용자가 **점원 옆/유리카운터 아래**에서 말 걸어 다른 경로로 도는지. 마트 카운터 기하(점원@(2,3) dir=right, 카운터 row4, 배달카운터 row6)와 **플레이어가 자연히 접근하는 칸**을 다시 대조. attendant 인덱스가 실제로 돌려지는지 실플레이 좌표로 재현.
- 사용자 원문: "저기서 말 거는게 아니라 **카운터에서 말 걸 때 돌아보고 대답** 안한다".

## ✅ 완료·검증 — 효과음(ME) 재생 시 BGM 겹침 해소
- **진단(서브에이전트):** 사용자 의심한 "playBgm 누적"은 원인 아님(bgm.ts는 전역 단일핸들+새곡 전 stop, 올바름). 진짜 원인 = **음악성 팡파레 ME `me_pkmn_get`을 BGM 멈추지 않고 일반 SFX(`scene.sound.play`)로 얹어 재생** → BGM+팡파레 동시재생. 원본 포켓몬은 ME 동안 BGM pause→resume.
- **수정(최소):** `src/game/bgm.ts`에 `pauseBgm()`/`resumeBgm()` 추가. `src/game/sfx.ts`에 `playMe(scene,key,vol)` 추가(pauseBgm→ME add/play→COMPLETE에서 resume+destroy). ME 호출 3곳 `playSfx(...,SFX.pkmnGet,...)` → `playMe(...)`: `BuildingScene.ts:277`(회복)·`GymScene.ts:303`(배지)·`LabScene.ts:291`(스타팅 획득).
- **검증(playwright, 실모듈):** BuildingScene에서 bgm_pc 재생 → `playMe(me_pkmn_get)` → BGM 사운드 **isPaused=true**(멈춤 확인) → ME COMPLETE 발화 → **BGM resume(isPlaying=true)**. tsc통과·콘솔0. (스크래치패드 `verify_me_bgm.mjs`.) ⚠️ headless라 소리 자체는 못 들음 — pause/resume '상태'로 검증.
- **바꾼 파일:** `src/game/bgm.ts`·`src/game/sfx.ts`·`BuildingScene.ts`·`GymScene.ts`·`LabScene.ts`.

## ⚠️ 남은 문제 (다음 세션)

### ④ [보류] 입장 자동멘트
- AR 포켓몬센터엔 입장 자동멘트 이벤트 없음(오토런=윌리 팁뿐). 그래서 안 넣고 카운터 상호작용 멘트만. 사용자가 원하면 간호순 실제 대사를 입장 자동재생으로. (지어내기 금지 유지.)

---

## 함정·팁 (이번에 실제로 걸림)
1. **priority 전경 오버레이를 고정 depth로 두는 건 반쪽 해결** — NPC(늘 뒤)는 되지만 **움직이는 플레이어**는 y-정렬 없이는 카운터와 올바르게 안 겹친다(위=머리잘림, 아래=올라탐). 실내 카운터는 이 난제가 정면으로 나온다.
2. **새 public 에셋(_over.png)은 dev서버 재시작 전까지 text/html** → 재시작 후 `curl -w '%{content_type}'`가 image/png 확인(세션2/3 트랩 재확인).
3. **playwright headless 격자이동 누락** — 키 press가 일부 드랍돼 카운터 앞칸까지 못 감. 상호작용 검증은 `scene.tx/ty` 직접 세팅 + `layout()` 후 `scene.onKey()` 호출이 확실(스크래치패드 `verify_building2.mjs`). anti-throttle args 필수.
4. `window.__game`(≠window.game). 씬 준비 전 `player`/`npcSprites` undefined → `waitForFunction`으로 폴링 후 조작.

## 검증물 위치(스크래치패드, git 아님)
`.../scratchpad/`: `pc_grid.png`·`mart_grid.png`(격자실측), `ar_pc_composited*.png`·`ar_mart_composited.png`(AR 정답모습), `verify2_pc_talk.png`·`verify2_mart_talk.png`(수정후 검증), `verify_building2.mjs`(상호작용 검증 스크립트).

## 다음 세션 첫 프롬프트 제안
"작업일지 0719 읽고 **①마트 플레이어-카운터 y정렬(올라타 보이는 것)**부터. 카운터 칸을 원본 PNG 격자로 실측하고, per-캐릭터 y-정렬 depth로 플레이어는 카운터 앞에선 위·뒤에선 아래로. 그다음 ②점원 실플레이 돌아봄 재현·수정, ③BGM/SFX 겹침(bgm.ts). 전부 playwright 스샷 검증 전엔 완료라 하지 말 것."

---

## ✅ 세션8 (0719 야간) — exe bake + 배틀시스템 대폭 확장 + 시각버그 (⚠️전부 미커밋)
> "빨리 다 해놔 — 배틀로직·상태이상 등 기본 시스템 + UI·픽셀 렌더 모든 장면 어색한 것 싹 확인" 요청. 감사 서브에이전트 3종(배틀시스템/씬UI코드/실제렌더 스샷) 병렬로 현황 정밀 파악 후 우선순위대로 착수.

### ②[clerk-turn] 해결 = exe bake (지난 세션 추정 확정)
- **원인 확정:** exe의 `app.asar`(Jul 10)에 `attendant`·`counterTiles` 코드가 **아예 없었음**(asar 뜯어 grep 확인) → 점원 돌아봄 코드가 exe에 안 구워진 게 맞았다. `npm run app:bake` 실행 → 새 asar(Jul 19)에 counterTiles/attendant/me_pkmn_heal **모두 포함 확인**. ⚠️**사용자 실플레이 재확인 필요**(exe 껐다 켜서 마트/센터 카운터에서 A → 점원·간호순 돌아보는지).

### 배틀 로직 / 상태이상 (코드완료 + tsc + 순수로직 유닛테스트 23/23, ⚠️in-game 통합검증은 아래)
- **[실버그]** 독/화상 지속뎀이 **일반 공격 턴에 통째로 누락**되던 것 수정: `BattleScene.ts` 공격턴 종료가 `resolveFaints()`→**`afterTurn()`**(잔뎀+정리 유일 호출부). 감사B가 계약위반으로 확정.
- **급소 5세대화:** `battle.ts` CRIT_CHANCE 1/24→**1/16**, CRIT_MULT 1.5→**2.0**.
- **맹독(badpoison):** Status 유니온에 추가, `toxicCounter`(1부터 턴마다 +1), residualDamage= maxHp×n/16. `statusFromFunctionCode`에서 BadPoison을 Poison보다 **먼저** 매칭(문자열 포함관계). `advanceStatusTurn()`이 afterTurn에서 카운터 증가.
- **풀죽음(flinch):** `Pokemon.flinch` 휘발성. 데미지기 functionCode에 "Flinch"면 effectChance로 `res.flinched` → BattleScene에서 `defender.flinch=true`. `beforeMove`가 맨 위에서 소비(못 움직임). afterTurn에서 양쪽 flinch=false.
- **혼란(confusion):** `Pokemon.confusionTurns`(1~4). "ConfuseTarget"이면 `applyConfusion`. `beforeMove`가 감소·50% 자기공격(무속성 40위력, status.ts 안에서 자체 계산 — 순환import 회피) → `MoveGate.selfDamage` 반환 → BattleScene가 공격자 자신에게 적용.
- **회복기(heal):** 위력0 변화기 "HealUserHalfOfTotalHP"(50%)/"...QuarterOfTotalHP"(25%)면 `rollHeal`이 사용자 HP 회복 → `res.healed` → BattleScene 메시지+HP바. (흡수/반동 계열은 여전히 미구현.)
- **휘발성 리셋:** `clearVolatileStatus()`(flinch/confusion) — 배틀진입·교체(내/상대) 3곳, resetStages 옆에 함께 호출.
- **난이도 스케일링(그동안 무효였음):** `difficulty.ts`에 `scaledTrainerLevel()`(주석 명세 그대로: 파티평균-2+fixed+rand+관장/챔피언보정+(원본레벨-원본팀평균), clamp2~100) + `leaderBonusForType`(LEADER +3/CHAMPION +5). `BattleScene.buildScaledTrainerTeam()`가 트레이너 팀 생성 시 적용(야생·넘어온 팀은 스케일 안 함 = AR 중립). 계산검증 6/6.

### 시각/렌더
- **파이리 뒷모습:** AR 원본 `Graphics/Pokemon/Back/CHARMANDER.png` **자체가 앞모습**(전 프레임 얼굴·꼬리불꽃, 다른 스타터 back은 정상). PokeAPI **5세대 BW animated back**(id 4, `.../generation-v/black-white/animated/back/4.gif`, 정상 뒷모습)을 가로 애니시트 PNG(2530×46, 55프레임)로 변환해 `public/assets/pokemon/back/CHARMANDER.png` 교체. 로더(pokemonSprite.makeStillFront=정사각 프레임0 크롭)와 포맷 호환 확인. **원본 백업**: 스크래치패드 `CHARMANDER_back_OLD.png`.
- **NEAREST 픽셀 블러 4건**(서브에이전트): TitleScene(title_bg/logo, setFilter 아예 없었음)·IntroScene(intro_dark/base)·PokedexScene(발자국 dexfoot_ prefix 누락)·MainMenuScene(menu_dither). 각 씬 기존 idiom대로 최소수정. tsc통과.

### 검증 상태 (정직)
- **tsc 통과** + status.ts 순수로직 **23/23** + difficulty 6/6.
- **in-game 통합검증(playwright, 실렌더 스냅샷) 완료 — 스크래치패드 `verify/`:**
  - ✅ **파이리 ally 뒷모습 정상**(`battle_ally_backsprite.png` — 등/나페가 뒤로, 꼬리불꽃 앞으로. 앞모습 아님).
  - ✅ **배틀 무크래시**: 새 상태이상 코드(풀죽음/혼란/맹독/회복) 경로 포함 ~40턴·3회 반복, **JS 예외 0**, HP변화·메시지·전투종료 정상.
  - ✅ **NEAREST 4씬**(Title/Intro/Pokedex/MainMenu) 또렷하게 렌더 확인.
- ⚠️ **아직 눈으로 특정 안 한 것**(로직·무크래시는 통과, 수치 확인만 남음): (c)독/화상 걸고 **공격턴마다 잔뎀** 실제 들어오는지, (d)난이도 **easy vs insane 트레이너 레벨 실제 차이**, 혼란 자기공격/회복기 메시지 실물. 다음 세션에서 상태이상기 강제로 걸어 눈 확인 권장(로직 유닛테스트는 통과).
- **exe 미반영:** 이 세션 변경 전부 dev소스만. 사용자 실플레이(exe) 확인하려면 `npm run app:bake` 다시 필요(bake는 exe 껐다).

### 남은 것 (다음 세션, 우선순위)
1. **위 in-game 검증부터**(완료라 못 박기 전 필수). 문제 있으면 수정.
2. **진화(레벨업)** — 데이터형식 파악완료(`species.json` evolutions: `{species,method:"Level",param:레벨}`. 파이리16/꼬부기16/구구18 등). exp.gainExp 레벨업 뒤 Level진화 param<=레벨이면 speciesId/name/types 교체+recomputeStats+메시지. 배틀중 스프라이트 스왑 or 전투후 처리 택1.
3. **씬 폴리시(감사B/C 지적):** DialogBox 줄/높이 상한 없음→긴대사 박스밖 넘침(Gym/Intro/Battle 공통)·MenuScene 하단바 하드코드색(테마무시)·실내 씬 카메라 줌 불일치(침실 vs 거실 레터박스)·BedroomScene(미도달 레거시인데 `this.scale.off("resize")`가 전역 resize리스너 전부 제거 = 위험).
4. **판단 필요(사용자 결정):** 그린 관장 이름창 첫대면부터 노출 — 규칙은 "자기소개 전 ???"인데 AR에서 그린이 자기소개 안 함. 규칙충실 vs AR충실 어느쪽?

### 함정·메모
- 배틀 시스템 파일(battle/status 등)은 BattleScene가 import → 편집 시 dev 핫리로드 → **playwright 검증 에이전트 돌 때 소스 편집 금지**(캡처 오염). 감사·검증 서브에이전트 병렬 시 이 순서 주의.
- status.ts 순수함수는 ar 데이터 불필요 → esbuild 번들로 node 단위테스트 가능(스크래치패드 `test-status.mjs`, `createRequire(프로젝트/package.json)`로 esbuild 해결).
- 파이리 back 첫 판단 때 작은 크기로 앞/뒤 오판했다 → front vs back 나란히 비교로 확정(스크래치패드 `front_vs_back.png`). **작은 스프라이트 방향판단은 반드시 대조.**
