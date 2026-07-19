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

## ⚠️ 남은 문제 2건 (다음 세션 최우선 — 사용자가 마트 스샷으로 재지적, 미해결)

### ① [player-on-counter] **플레이어(RED)가 마트 유리 카운터 "위"에 올라가 보임**
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
