# 0707 PokemonWith 작업일지 (2026-07-07)

작업 PC: 학원/현재 PC(user) = `D:\dev\Pokemon_With` (WSL `/mnt/d/dev/Pokemon_With`).
커밋: **안 함**(사용자 요청 없었음). `npx tsc --noEmit` 통과 확인. **미커밋 변경 다수 — 다음 세션에서 리뷰 후 커밋 여부 판단.**

---

## ⚡ 오후 2차 세션 업데이트 (가장 최신 — 먼저 읽어라)
> 오전에 "파티 화면 픽셀 마감 미달로 사용자 크게 불만족"이던 상태를 **오후 세션에 실제로 해결**했다. 아래 오전 기록(§⭐·§B·§미해결 1번)은 그 시점 사실이며, 파티 화면 관련해선 이 블록이 최신이다.

- **증상**: 파티창에 6마리가 들어가야 하는데 2마리가 화면을 꽉 채움. 원인 = `renderParty`가 패널 폭을 **화면 절반**(`panelW=(width-…)/2`)으로 잡아 와이드 화면에서 한 칸이 거대해짐.
- **사용자가 진짜 AR과 나란히 확대 대조를 요구** → 정직하게 비교한 결과: **원본 AR 에셋을 갖고 있으면서 안 쓰고 눈대중 hand-draw로 재현**한 게 근본 원인(볼을 ×3~4로 키움, HP바를 코드로 그림, 배경 단색, 폰트 과대). `.claude/rules/game-ui.md` 3번("직접 그리지 말고 AR UI 얹어라") 위반.
- **해결 = 원본 픽셀 그대로 합성으로 `MenuScene` 파티 렌더 전면 재작성**:
  - `bg.png`(512×384, **6칸 슬롯 홈+벽지가 구워진 배경**) 사용 → 단색 청록 제거.
  - 초록 패널 = 원본 `panel_round`/`panel_rect`(그라데이션), 선택 = `panel_*_blue_sel`(파랑+빨강테, **레퍼런스가 파랑이라 내가 만든 blue 사용** — 원본 `panel_*_sel`은 초록+빨강이라 안 씀), 기절 = 원본 `panel_*_faint`.
  - 몬스터볼 = 원본 `icon_ball`(**44×56 원본 크기 그대로**, 더 이상 안 키움), 포켓몬 아이콘을 볼 위에(scale `s*58/64`).
  - HP바 = 원본 `overlay_hp_back`(138×14 검은테 프레임) + 내부 groove(**로컬 x28~129, y4~10, 픽셀 실측**)에 원본 `overlay_hp` 3색 채움(초록 `0x60f860`/노랑 `0xf8d800`/빨강 `0xf85858`).
  - `overlay_lv` Lv 태그 사용, 이름·HP숫자 폰트 DS 스케일로 축소.
  - **전체를 DS 512×384 가상 레이아웃 'contain' 균일 스케일**(늘리지 않고 중앙 배치)로 → 와이드 화면에서도 비율 유지. 슬롯 좌상단 좌표(가상): 좌열 x2, 우열 x256, 행 y=[10/104/198], 우열 stagger +14.
- **바꾼 파일**: `src/scenes/MenuScene.ts`(preload에 bg/panel/overlay/ball 원본 로드, `renderParty`·`drawPartySlot` 원본 합성 방식 재작성), `src/scenes/DebugMenuScene.ts`(디버그 `0.인게임 메뉴` 테스트파티 **2→6마리**: CHARMANDER5·PIDGEY3·BULBASAUR5·SQUIRTLE4·RATTATA2·CATERPIE3 — 6칸 레이아웃 상시 검증용).
- **검증**: `tsc --noEmit` 통과 + Playwright(1900×950) 실제 진입 스샷 → 레퍼런스와 **나란히 확대 대조**: 배경·6칸 슬롯·초록 그라데이션 패널·짧은 HP바(검은테+주황 HP)·볼+아이콘·Lv 태그·파랑+빨강 선택 패널 모두 일치. 콘솔 에러 없음.
  - **Playwright 실행법(중요, 이 PC엔 python playwright 없음)**: node playwright 사용 → `cd myPokemon_AJ && NODE_PATH="$(pwd)/node_modules" node <script>`, `chromium.launch({headless:true, args:['--no-sandbox','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})`. 진입: goto 5180 → `d`(디버그) → `0`(메뉴) → `Enter`(포켓몬 선택 → 파티).
- **남은 것**: ①**exe 미반영** — dev(5180)에서만 검증. 본체 반영은 `npm run app:bake` 필요. ②상세(Summary)·가방·박스는 아직 이 원본-에셋 합성 방식으로 안 만듦(같은 방식으로 해야 함). ③커밋 안 함.
- **교훈 확정**: 오전의 "눈대중 반복조정" 실패를 오후에 "원본 에셋을 원본 픽셀좌표에 합성"으로 해결. **UI는 처음부터 원본 에셋을 가공 없이 좌표만 얹는 방식이 정답**(hand-draw 금지). 픽셀 위치가 애매하면 원본 PNG를 PIL로 열어 좌표/색을 실측(눈대중 금지).

---

## ⭐ 오늘 가장 중요한 상황 (오전 기록 — 파티 화면은 위 §오후 업데이트가 최신)
- 오늘 대부분 시간을 **인게임 메뉴 → 파티 화면 UI를 어나더레드(AR) 실물과 1:1로 맞추는 데** 썼는데, **사용자 기준 픽셀 디테일을 끝내 못 맞춰 사용자가 크게 불만족**한 상태로 중단. 파티 화면은 "기능·구조는 됨 / 픽셀 마감이 사용자 눈높이에 미달". **(⚠️ 이 미달 상태는 오후 2차 세션에 해결됨 — 위 §오후 업데이트 참고)**
- **교훈: 눈대중 반복 조정으로 픽셀을 맞추려다 두께를 두껍다↔얇다 오락가락하며 사용자를 반복 분노시킴.** 다음엔 (1) AR 실제 UI 에셋을 **가공 없이 그대로** 쓰거나, (2) 사용자에게 **정확한 수치(px)** 를 먼저 확정받고 한 번에 반영할 것. 내 임의 판단으로 조금씩 고치지 말 것.
- **하드 가드 추가함**: `.claude/hooks/guard-ui-edit.sh` + `.claude/rules/game-ui.md` — 포켓몬 UI 씬(MenuScene/Party/Bag/Box/Summary/`ui/*`) **Write** 시 "AR/공식 레퍼런스 봤냐" ask 강제. (Edit엔 안 걸리게 Write-only로 좁혀둠 — 반복 편집 스팸 방지.)

---

## A. 완료 + 검증된 것 (playwright 실검증)

### M1 — 파티 → 배틀 연결 ✅
- `LabScene.ts`: 스타터를 `createPokemon`(폴백 HP30·몸통박치기) → **`createFromSpecies(pick.key,5)`** 로 교체 + `await loadArDb()`. 실제 스탯·기술(파이리 GROWL/SCRATCH/EMBER, HP18) 확인.
- `WorldScene.ts`: B키/조우 진입이 `registry.playerParty[0]`를 `ally`로 전달 + `returnPos/returnFacing`(복귀좌표).
- 검증: 개구마르 주입 후 B → 배틀 아군이 개구마르(데모 아님). LabScene pick 완주 → 실제 스탯.

### M2 — 뒷모습 + 승패처리 ✅
- AR back 스프라이트 import: `node tools/import-from-anotherred.mjs "/mnt/d/Pokemon Another Red_PWT_250829" back` → `public/assets/pokemon/back/`(1567개, 32M).
- `pokemonSprite.ts`: `backPath()` 추가. `BattleScene.ts` 아군=back, 적=front.
- `BattleScene.ts`: 승패 처리 — 패배→"눈앞이 깜깜"→집(InteriorScene) 복귀+파티 전원 회복 / 승리·도망→원위치 WorldScene 복귀. `BattleInit`에 `returnPos/returnFacing/outcome`.
- 검증: 뒷모습 렌더 스샷, 패배→집+HP회복(3→19), 승리→[17,8] 복귀.

### M3 — 인게임 메뉴 + 파티 화면 (기능 완료 / 픽셀 마감 미흡) ⚠️
- 신규 `src/scenes/MenuScene.ts` (오버레이). 필드에서 **Enter/X로 열기**(`WorldScene.openMenu`: pause+input off+launch). 항목: **포켓몬 / 가방 / 저장 / 닫기**.
  - **가방·저장은 아직 stub**(토스트 "준비 중"). M4/M5에서 연결.
  - 파티: 목록 + 상세(스탯/기술/컨디션). 상세는 아직 옛 테마 스타일(AR화 안 함).
- `main.ts`에 MenuScene 등록. `DebugMenuScene`에 **"0. 인게임 메뉴"** 추가(테스트파티 자동 세팅). 디버그 항목 10개 화면 넘침 → 항목수 맞춰 자동 배치로 수정.
- `Pokemon.ts`에 **`gender: "male"|"female"|null`** 필드 추가(+`createFromSpecies`/`createPokemon` 세팅). 파티창 ♀♂ 표시.
- `pokemonSprite.ts`: **`iconPath()`, `makePartyIcon()`**(128x64=64x64 2프레임 아이콘, NEAREST) — 파티/박스 공용.
- **방향키 2D 그리드**: 좌우=열, 상하=행 (오른쪽 누르면 옆칸 idx0→1). PokeRogue 관례와 일치 확인.
- 검증: Enter로 메뉴 열림·party·detail·닫기→WorldScene. idx 네비 동작.

## B. 파티 화면 UI — AR(젠5 BW식) 재현 (미완·논쟁)
- **AR 파티 = 젠5(블랙/화이트) 파티 UI 스타일**(웹검색+Spriters Resource 확인). PokeRogue `src/ui/handlers/party-ui-handler.ts`가 관례 소스(2열·좌우열전환·`_sel`선택프레임·`party_pb_sel`볼·성별색·메시지박스).
- AR UI 에셋 import: `public/assets/ui/party/`(AR `Graphics/UI/Party` 복사) — `bg,panel_rect,panel_round,icon_ball,icon_ball_sel(열린볼),overlay_*` 등.
- 파생 에셋(PIL): `panel_*_blue*`(초록→파랑 G/B스왑), `panel_*_blue_sel`(선택=파랑+빨강+흰 테두리 **패널 실루엣 따라 baked**, 링 두께 침식으로 조절 — 현재 red4px+white4px).
- 구성: 청록 배경(#48c0c8) + 2열 스태거드 + 선택=파랑+빨강/흰테두리+열린볼 / 나머지=초록+닫힌볼 + 몬스터볼+아이콘+이름+성별+Lv+HP + 하단 메시지박스+취소.
- **핵심 수정(스킬 game-ui-hud-polish 따름)**: 도트 UI 텍스처에 **`setFilter(NEAREST)` 필수**(안 하면 LINEAR로 뭉개져 테두리 지저분). MenuScene create에서 `pui_*`/`icon_*` 텍스처에 NEAREST 적용.
- **리사이즈 핸들러 추가**: MenuScene가 `scale.on("resize")` 미처리라 창 넓히면 오른쪽이 안 채워짐 → `onResize`에서 re-render + dim 리사이즈. (파티창 한정 해결. 아래 미해결 참고.)

## ❗ 미해결 / 주의 (다음 스텝)
1. **파티 화면 픽셀 마감이 사용자 기준 미달** — 테두리 두께(현 red4/white4 baked), 볼 안 포켓몬 정렬·크기, 하단 텍스트박스 스타일. **사용자와 수치 확정 후 반영할 것.** 텍스트박스는 아직 코드 hand-draw(둥근→각진 픽셀프레임으로 바꿈) — **AR 윈도우스킨 에셋(RMXP 9슬라이스, `Graphics/Windowskins/Windowskin.png` 192x128)** 로 교체가 정석.
2. **전체화면 시 타이틀 오른쪽 검정** — 사용자는 "이번 세션 후 발생"이라 주장. 그러나 **git diff상 `index.html`·`vite.config`·`main.ts` scale설정·`TitleScene` 미변경**(main.ts는 MenuScene 한 줄 등록만). playwright 1920×1040(DPR1.25)에선 캔버스 1920 꽉 참 → **재현 실패**. dev서버를 이번에 수십 번 재시작해 브라우저 HMR 깨졌을 가능성 → **하드 새로고침(Ctrl+Shift+R) 권장**. 그래도 재현되면 사용자 화면 배율/줌 조건 확인 필요. **원인 미확정 상태로 남김.**
3. 상세(Summary)·박스·가방 UI는 파티와 같은 방식(AR 에셋)으로 아직 안 만듦.
4. **M2b 1번도로**: 야생 조우 = 태초마을 북쪽에 AR Route1 신규 제작으로 **결정만 함, 미착수**. `tools/ar-map/extract.py` 파이프라인 유효.
5. 커밋 안 함 — 미커밋 변경 리뷰 후 판단.

## 남은 마일스톤 (합의된 순서)
설정(메뉴·파티·가방·저장·박스) 먼저 → 1번도로. 즉 **M3(파티 마감)→M4 가방→M5 저장→M6 박스(MVP, 집PC+메뉴 둘다)→M2b 1번도로.**
- 박스: MVP(박스1개 30칸, 포획 만원시 자동예치, 파티↔박스 이동). `Box.ts`/`playerBoxes`. 파티 이원화(registry.playerParty vs Player.party) 단일화 필요.
- 가방: 실사용(포션 회복/볼 포획), AR `Graphics/Items`(48x48) 소수 복사. `items.ts`/`playerBag`.
- 저장: `save.ts` 확장(version+party+bag+위치), 메뉴 저장, MainMenu 이어하기 배선.

## 함정 재확인 (다음 PC 필독)
- **vite dev서버는 시작 후 새로 만든 public 에셋을 안 서빙**(text/html 폴백) → 에셋 추가/생성하면 **서버 재시작 필수**. `curl -w '%{content_type}'`로 image/png 확인.
- **`pkill -f vite`는 자기 셸(cmdline에 'vite' 포함)도 죽임(exit 144)** → `lsof -ti tcp:5180 | xargs -r kill` 사용.
- **도트 UI 텍스처 = `setFilter(Phaser.Textures.FilterMode.NEAREST)` 필수**(스킬 game-ui-hud-polish). 전역 pixelArt는 끄기.
- 픽셀 UI를 **hand-draw(graphics)로 그리지 말 것** — AR 실제 에셋 import해서 얹기(§4·rules/game-ui.md). 테두리는 패널 실루엣 따라 baked(둥근사각 hand-draw는 노치 무시해서 따로 놈).

## 규칙/스킬/메모리 변경 (이관 요약 — 대부분 git 동기화됨)
- **AGENTS.md §6.5 추가**(git 동기화): "주요 씬은 DebugMenuScene 등록 / UI look은 Pick에 실제 스샷 후보로 사용자 결정".
- **`.claude/hooks/guard-ui-edit.sh` + `.claude/rules/game-ui.md` 신규**(git 동기화): 포켓몬 UI 씬 Write 시 AR 레퍼런스 확인 ask. `.claude/settings.json`에 Write 매처로 연결.
- **이관 대상 재확인 (사용자 "꼼꼼히" 요청 — 오후 세션에 재점검):**
  - skills(오늘 변경 없음, 전부 7/1~7/4)·`.claude/hooks`·`.claude/rules`·`settings.json`·코드·에셋(`public/assets/ui`,`pokemon/back`)·`Pick/메뉴UI`·이 일지 = **전부 git 추적** → **커밋만** 하면 다른 PC 동기화. **이관 폴더 불필요.**
  - **⚠️ 유일한 git 미추적 = 홈 `memory/`** (오늘 09:50 "정확성 정정"됨, git엔 안 잡힘). 오전 일지의 "메모리 변경 없음" 서술은 부정확 → **정정.** 안전하게 바탕화면 **`C:\Users\user\Desktop\PokemonWith_이관_0707\memory\` 에 22개 사본**을 배치했다. 다른 PC의 `~/.claude/projects/<프로젝트>/memory/`로 덮어쓰기(⚠️ **집PC는 프로젝트 경로가 달라 폴더명이 `-mnt-c-Users-ONE-...`류로 다름** — 그 PC의 실제 memory 폴더를 찾아 넣을 것). 이미 반영했으면 무시.
- 파티 화면 스샷 후보는 `01_Resources/Pick/메뉴UI/`(미리보기 몽타주 포함, git). Desktop엔 미리보기 두지 말 것(사용자 지적 — Desktop은 §7 PC이관용).

## 검증 방법 (다음 PC)
- `cd myPokemon_AJ && npm run dev` → localhost:5180.
- 파티 화면: 타이틀 `D`(디버그) → `0` → `Enter`(포켓몬) → 방향키로 커서 이동(테스트 파티 2마리).
- playwright 주행 스크립트는 세션 scratchpad(임시)에 있었음. WSL args: `--no-sandbox --use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. `window.__game`으로 씬 제어(`scene.getScene('MenuScene').state/idx`).
