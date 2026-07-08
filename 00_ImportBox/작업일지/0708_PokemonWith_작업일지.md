# 0708 PokemonWith 작업일지

> 주제: **성능·규칙엄수 오버홀** (게임 기능 작업 아님 — 에이전트가 "일하는 방식"과 강제 장치를 공식문서 기준으로 다시 잡음). 며칠째 반복된 규칙 위반·성능 저하를 근본에서 잡는 게 목표.

## 0. 한 줄 요약
"규칙을 **더 쓰는 것**이 규칙 위반의 원인"이라는 공식 진단에 따라, **상시 텍스트(AGENTS/memory)를 절반으로 줄이고**, 강제는 **차단 훅**에 몰았다. 특히 최대 반복실패인 **"UI 고치고 화면 안 보고 '똑같다'"를 Stop 훅으로 하드 차단**하는 장치를 신설했다.

## 1. 근본원인 진단 (공식문서 대조 — code.claude.com/docs)
- **비대한 CLAUDE.md/지침은 Claude가 실제 규칙을 무시하게 만든다**("longer files reduce adherence", 권장 ≤200줄/파일). ← 규칙 위반의 공식 설명.
- **매 턴 UserPromptSubmit 주입은 안티패턴**(턴마다 stdout이 컨텍스트에 누적 → 오래된 세션일수록 규칙이 묻힘).
- **강제는 PreToolUse/Stop 훅 + exit 2로만** 됨(exit 1은 통과). 리마인드 텍스트는 강제력 없음.

## 2. 오늘 바꾼 것 (파일별)
### A. memory 대청소  ⚠️ **git 밖 → 이 PC(학원/D:)에만 적용됨. 집 PC는 §5 이관 필요.**
- **21개(39KB) → 4개(7.7KB).** 삭제 18개 = 대부분 이미 AGENTS/rules로 "승격"됐는데 옛 사본이 안 지워진 2~3중 중복, 또는 `⚠️SUPERSEDED`(옛 좌표)·`✅완료`(끝난 작업).
- 생존: `starter-lab-flow`(진행상태 정본) · `ar-extraction`(신규 = `ar-map-rxdata-pipeline`+`ar-data-extractable` 병합, 옛 계단좌표 제거) · `dev-index-html-trap` · `MEMORY.md`(인덱스 재작성).
- 삭제된 18개: mypokemon-project, protagonist-choice, launch-via-bat-only, dev-then-bake-workflow, research-official-before-building, verify-intent-before-coding, bring-real-candidates, keep-preview-montages, previews-where-user-sees, collision-grid-from-raw-png, bedroom-collision-fix, bedroom-tv-collision-fix, stairs-living-fix, title-menu-wip, workspace-rename-pokemon-with, ar-map-rxdata-pipeline, ar-data-extractable, ask-check-with-localhost-url, dialogue-official-only. (작은 피드백 2개=ask-check/dialogue는 삭제 대신 **AGENTS.md로 승격**.)

### B. 매 턴 리마인더 제거  (git 동기화 O)
- `.claude/hooks/remind.sh` 삭제 + `settings.json`의 `UserPromptSubmit` 블록 제거. 내용은 슬림해진 `AGENTS.md §0`에 상시 1회로 유지.

### C. 지침 문서 슬림화  (git 동기화 O)
- 루트 `AGENTS.md` 4.7KB→2.9KB(중복 §2/§3/§6 통합, remind 참조 제거, localhost 확인규칙 승격).
- 게임 `myPokemon_AJ/AGENTS.md` **15.4KB→7.8KB(-50%)**: 하드룰 전부 보존, 끝난 §6 진행체크리스트 제거(→ starter-lab-flow), exe/충돌 상세는 `.claude/rules/`로 위임, §7 작업일지 압축, 대사규칙 승격. **§4C의 "맵/스토리 로직 못 가져옴" 오류를 rxdata 추출 가능으로 정정.**
- 걷어낸 희귀 함정(ELECTRON_MIRROR 504·WSLg WebGL 플래그·`.lnk`)은 삭제 않고 **`.claude/rules/run-build.md #7`로 이전**(해당 파일 만질 때만 JIT 로드).
- `CLAUDE.md`: remind 항목 제거 + UI 가드 항목 추가 + 성능원칙 주석.

### D. 규칙 엄수 강화 — 훅  (git 동기화 O) ★핵심
- `guard-ui-edit.sh`: matcher `Write`→**`Edit|Write`**로 확장(UI씬을 Edit로 고칠 때도 ask 뜨게). settings.json은 PreToolUse matcher를 **분리 등록**(한 matcher에 훅 여러 개 넣는 불확실성 제거).
- **신규 `enforce-ui-verify.sh` (Stop 훅)** ← 오늘 가장 중요:
  - UI 씬(Menu/Party/Bag/Box/Storage/Summary/Pokedex·`ui/*.ts`)을 수정했는데 **편집 이후의 렌더링 캡쳐 증거(`.claude/.verify/*.png`)가 없으면 턴 종료를 exit 2로 차단.** "알겠다 해놓고 코드만 봄 / 완전 다른데 똑같다 함"의 하드 차단.
  - fail-open(git/판단 애매하면 안 막음), `stop_hook_active` 무한루프 방지, **끄기 스위치 `.claude/.verify/DISABLE`**(진짜 시각변화 없는 수정용, 사유 남길 것).
  - `.claude/.verify/`(로컬 전용, .gitignore, .gitkeep만 추적) 신설.
  - ⚠️ 한계: 훅은 "캡쳐했냐"는 강제해도 "네 눈 비교가 정확하냐"는 강제 못 함 → 그래서 `rules/game-ui.md #5`에 **레퍼런스와 side-by-side 몽타주 + 구체적 차이 나열(“비슷/똑같다” 금지) + 애매하면 fresh-eyes 에이전트로 재확인**을 규약화.
- `settings.local.json`: 죽은 1회성 allow 81개(포트5173·타임스탬프·특정PID) 제거, 30KB→21KB. (gitignore라 로컬 전용.)

## 3. 검증 (실제로 한 것)
- **공식문서 대조:** PreToolUse `hookSpecificOutput/permissionDecision(ask·deny)` 스키마 현행 PASS, exit2=차단·exit1=통과 PASS, **matcher `"Edit|Write"` bare 파이프가 정답**(리스트 구분자, Edit·Write 둘 다 매칭 — 이스케이프 불필요, 공식 원문 확인). UserPromptSubmit 제거 clean.
- **Stop 훅 6분기 실테스트**(temp git repo): UI변경+증거없음→차단(2) / 캡쳐후→통과(0) / 재편집>캡쳐→재차단 / stop_hook_active→통과 / DISABLE→통과 / UI무변경→통과. 전부 기대대로.
  - 도중 버그 1개 잡음: `git status --porcelain`가 통째 untracked 디렉터리를 접어서(`?? src/`) UI파일 감지 실패 → `-uall` 추가로 수정 후 통과.
- guard-map/guard-ui ask JSON 유효, 현재 리포에서 Stop 훅 통과(이번 턴 UI 수정 없음), settings.json/local.json JSON 유효.

## 4. 다른 PC(집)로 넘길 요지 — git pull이면 되는 것 vs 직접 이관
- **git pull만 하면 반영됨:** `AGENTS.md`·`CLAUDE.md`·`myPokemon_AJ/AGENTS.md`·`.claude/rules/*`·`.claude/hooks/*`(remind.sh 삭제, enforce-ui-verify.sh 신규, guard-ui 수정)·`.claude/settings.json`·`.gitignore`·이 작업일지. **⚠️ 단 아직 커밋 안 됨**(전역 규율상 커밋은 조아진이 직접) → 집 PC는 이 커밋 pull 후 적용.
- **직접 이관 필요(git 밖):** **memory 정리는 이 PC에만 됨.** 집 PC의 memory 폴더엔 옛 21개가 그대로 → §5 이관폴더의 스냅샷·지침대로 동일 정리 필요. `settings.local.json`(gitignore)도 PC별이라 안 넘어감(무해).

## 5. 이관 자료 (바탕화면)
- 위치: **`/mnt/c/Users/user/Desktop/PokemonWith_이관_0708/`** (현재 PC Desktop=user 실확인).
- 내용: `memory-snapshot/`(현재 생존 memory 4개) + `REPLICATE.md`(집 PC에서 삭제할 18개 목록 + 정리 방법).

## 6. 새 워크플로 / 습관 (앞으로 항상)
- **UI 작업 = 렌더 필수.** 고쳤으면 webapp-testing으로 화면 캡쳐→`.claude/.verify/`에 png→레퍼런스와 나란히 몽타주로 **차이 나열**. 안 하면 Stop 훅이 턴을 못 끝내게 막는다. "똑같다"로 뭉개지 말 것.
- **컨텍스트 위생 = 성능 핵심:** 작업 전환 시 `/clear`, 길어지면 `/compact`. 방금 편집한 파일 재통독 금지.
- **규칙은 memory 말고 AGENTS.md에 승격**(PC간 git 동기화). memory엔 진행상황·PC로컬 함정만.

## 7. 다음 할 일 / 미결정
- [ ] 조아진이 위 변경 **커밋**(브랜치 파서). 커밋 후 집 PC에서 pull.
- [ ] 집 PC에서 memory 정리 실행(이관폴더 REPLICATE.md대로).
- [ ] Stop 훅 실사용 관찰: UI 작업 몇 번 하며 오탐(비-시각 수정인데 막힘) 있으면 DISABLE 스위치로 대응하거나 패턴 조정.
- [ ] (게임 본작업) 남은 건 여전히 배틀 연결·정식 마을 다듬기 (memory `starter-lab-flow`).

---

# (추가) 0708 오후 — 인게임 메뉴 파티창(MenuScene) AR 재현 작업
> ⚠️ **미완/사용자 불만족 상태로 세션 종료.** 새 세션이 이어받을 것. 아래를 그대로 따르면 재현·이어작업 가능.

## A. 목표 · 정본 레퍼런스
- **파티창(포켓몬 리스트)을 어나더레드(AR) 실제 파티 UI와 똑같이** 만드는 것. 사용자가 며칠째 "AR과 다르다"고 반복 분노.
- **정본 레퍼런스 = `01_Resources/Pokemon_ingame/AnotherRed/내파티.jpg`** (474x421, git에 있음). 이 화면과 픽셀단위로 맞춰야 함.
  - ⚠️ **이 레퍼런스는 '이동(swap) 모드'** ("어디로 이동하시겠습니까?" 하단). 그래서 선택 패널이 **파랑**임.
- AR 원본 에셋 경로(PC마다 다름, dev PC=`/mnt/d/Pokemon Another Red_PWT_250829/Graphics/UI/Party/`). 이미 `myPokemon_AJ/public/assets/ui/party/`로 import됨(`pui_` 프리픽스로 로드).

## B. 확정한 핵심 사실 (재검증 완료 — 이건 신뢰해도 됨)
1. **선택 패널 = AR 공식 `panel_round_swap_sel2`/`panel_rect_swap_sel2`** (파랑+빨강테+**흰테**). 리컬러 삽질(초록→파랑) 하지 말 것 — 공식 에셋이 이미 있음. `swap_sel`은 빨강만(흰X), `swap_sel2`가 빨강+흰=레퍼런스와 일치. preload 배열과 drawPartySlot의 `sel` 분기에서 사용 중. (예전 `panel_*_blue_sel`은 손수만든 것 → 안 씀, git checkout으로 원복함.)
2. **Galmuri11 `otext` 폰트 오프셋 = 글자 top이 set한 y보다 native +5px 아래** 렌더. 좌표 잡을 때 이만큼 빼야 함.
3. **AR 럭시오 슬롯 실측(내파티.jpg를 빨강테 bbox로 정규화, native 256x98 기준):** 이름=작음(~16px, 상단 x99~), **HP숫자=큼(~24px, 이름보다 큼, 하단우측)**, Lv=하단좌측, 성별=상단우측, 포켓몬=좌측을 크게 채우며 세로중앙쯤, 볼=좌하단(포켓몬이 볼을 **살짝만** 가림 — 정중앙에 올라타면 안 됨).

## C. 현재 코드 상태 (`myPokemon_AJ/src/scenes/MenuScene.ts`, 커밋 안 함)
- `drawPartySlot` 현재 좌표(native, 패널 256x98): 볼 `L(ballX,58)` ballX=lead?34:28 / 포켓몬 `L(ballX+14,48)` scale `s*62/64` / 이름 `(100,11)` size18 / 성별 `(238,12)` size16 / HP프레임 `L(92,40)` / **HP숫자 `(238,55)` size23** / Lv태그 `L(8,70)` / Lv숫자 `(32,68)` size15. `otext` 외곽선 = `size*0.09`.
- `renderParty`: `barH=height*0.11`, 슬롯블록을 세로중앙 배치(`offY` 계산). 배경 `pui_bg`.
- tsc 통과.

## D. 사용자가 마지막까지 지적한 것 (아직 사용자 눈엔 불만 — 새 세션 우선순위)
- 이름·레벨이 패널 밖으로 튀어나옴 → 여백 넣어 고쳤다 했으나 **선두(라운드 패널)는 좌측/하단 곡선이 커서 볼·Lv가 모서리에 닿음.** 라운드 패널 전용 좌표 더 손볼 것.
- 포켓몬이 볼 정중앙에 올라타 볼을 덮음 → 아래·크게로 옮겼으나 사용자는 **빨간펜 동그라미(내파티 우측 파이리의 볼 아래쯤)** 위치를 원함. 포켓몬을 그 지점에 크고 낮게.
- 폰트 굵기가 AR과 다름(더 얇게 요구) → 0.09로 줄였음.
- **"조잡하다"** = 전반적으로 아직 AR만큼 안 깔끔. 계속 1:1로 비교하며 다듬을 것.

## E. 검증 방법 (새 세션이 그대로 재현 — 스크래치패드 스크립트는 세션끝나면 사라지니 방법만 기록)
1. dev 서버: `cd myPokemon_AJ && npm run dev` (localhost:5180).
2. 파티화면 캡쳐(playwright, 뷰포트 **1007x1010**=사용자화면): `window.__game.scene.start('DebugMenuScene')` → 키 `'0'`(테스트 6마리 채우고 MenuScene 오픈) → `scene.getScene('MenuScene')`의 `state='party';idx=0;renderState()` 호출 → 스크린샷. (playwright-core는 CJS: `import pkg ...; const {chromium}=pkg`.)
3. **비교(핵심):** PIL로 (a) 내 파이리 패널과 AR 럭시오 패널을 **각자 빨강테 bbox로 잘라 256x98로 정규화**, (b) `Image.blend(ar,mine,0.5)`로 **1:1 겹침** + 8px 격자 → 어긋난 요소가 유령처럼 두 개로 보임. (c) 파이리·구구 슬롯 초확대로 볼/포켓몬 튀어나옴 확인.
4. AR 실측: 내파티.jpg를 빨강테 bbox로 native 변환 후 흰텍스트 y범위로 이름/HP숫자/Lv 위치 측정.
- 로컬 증거(gitignore, PC로컬): `.claude/.verify/party_1to1_blend.png`, `party_ball_diag.png`.
- ⚠️ **규칙 준수:** UI 씬은 `.claude/rules/game-ui.md`+guard-ui 훅(ask)+Stop훅(렌더증거 필요). skill=`game-ui-hud-polish`, 검증=`webapp-testing`. 추측·"똑같다" 금지, 1:1 겹침으로 차이 나열.

## F. 커밋 상태
- **미커밋.** 변경=`myPokemon_AJ/src/scenes/MenuScene.ts`(파티 슬롯 좌표/선택패널/폰트)뿐. (blue_sel PNG는 원복됨.)
- Pick 후보(미추적, 참고용): `01_Resources/Pick/메뉴UI/_시안_인게임메뉴_5종.png`+개별 — 이건 별건(인게임 메뉴 '바' 방향 시안, 파티창과 무관).

---

# (추가) 0708 저녁 — 게임 수정 3종(스프라이트·충돌·메뉴 시안A) + 성능설정 재검증
> ⚠️ 전부 **미커밋**. 커밋 승인 대기. 아래 순서/함정 그대로 이어받으면 됨.

## 0. 성능 개선 관련 설정 — 재검증 결과 (사용자 강조 → 꼼꼼히)
세션 시작 시 "전 세션 성능개선(피그마 해제 등)이 실제 적용됐나"를 **실파일로 근거 조사**함(주장/memory 인용 아님):
- **Figma 플러그인 = 실제 비활성 확정(4중 확인):**
  1. `~/.claude/settings.json` → `"enabledPlugins": { "figma@claude-plugins-official": false }` ← 실제 킬스위치.
  2. 활성 플러그인 배열(`~/.claude.json` `tengu_amber_lattice.plugins`)에 figma **없음**.
  3. 전역 `mcpServers` 블록 전부 `{}`(활성 MCP 서버 0), 프로젝트 `.mcp.json` 없음.
  4. **이번 세션에 figma 툴/스킬 0개 로드**(시스템 프롬프트에 figma 항목 없음) = 런타임 증거.
  - ⚠️ `~/.claude.json` 1241행~ 의 `figma@...`/`figma:figma-*` 문자열은 **pluginUsage/skillUsage 통계 잔재**(usageCount/lastUsedAt)일 뿐 활성설정 아님 → "figma 아직 있네"로 오인 금지.
- **claude.ai 커넥터 차단:** 프로젝트 `.claude/settings.json` → `"disableClaudeAiConnectors": true` (커밋 bc284ee). 컨텍스트 오염 차단.
- **memory/컨텍스트 다이어트:** memory 5개 파일/합계 95줄/~10KB로 슬림. 상시 로드 CLAUDE.md 20줄·루트 AGENTS.md 39줄. 프로젝트 settings.json에 `skillListingBudgetFraction:0.02`·`skillListingMaxDescChars:1536`(스킬 목록 컨텍스트 상한) 확인.
- **`settings.local.json`(=gitignore, **PC로컬**) 정리 시도했으나 원복됨:** `WebFetch(domain:help.figma.com)`·`Bash(git commit -m ' *)` 자동허용을 제거했지만 **직후 linter가 파일을 재정비하며 둘 다 되돌아옴(현재 다시 존재)**. → git-commit 자동허용은 살아있으나 **실질 커밋 게이트 = settings.json의 tsc PreToolUse 훅**(타입에러 시 커밋 exit2 차단)이라 안전. figma help WebFetch는 무해 잔재. 이 파일은 git 안 넘어가니 다른 PC엔 무관.
- 결론: **피그마 해제·커넥터 차단·다이어트 다 실제 적용돼 있음.** 소소한 잔재(figma 통계로그·help WebFetch) 외 문제 없음.

## 1. 스프라이트 examine 또렷하게 — `src/scenes/LabScene.ts`
- 문제: 살펴보기 액자 스프라이트(나오하 등)가 흐릿.
- 원인: `ensureStill`이 frame0(96px)을 6배(576) 확대 후 표시 때 축소 → **전역 antialias=true 기본**이라 축소 단계에서 GL LINEAR 보간으로 도로 흐려짐.
- 수정: `bakeStill(species, dispPx)` 신설 — frame0을 **표시할 화면 픽셀 크기 그대로** 캔버스 nearest로 굽고 **scale 1.0(1:1)** 로 얹음(1:1이라 GL 보간 개입 불가 → 또렷). `drawWindow`가 `frontMetrics`로 native 기준 크기·중심 잡고 dispPx로 구움. `winSpecies` 필드 추가, `STILL_UP`/`ensureStill` 제거. tsc 통과.
- 검증: **같은 headless 환경**에서 OLD(6x→축소,LINEAR) vs NEW(1:1 nearest) 나란히 렌더 → NEW 엣지 또렷 확인(`tools/shot-sprite-ab.mjs`).
- ⚠️ 정직: 개선폭은 "번짐 제거" 수준(극적 아님). 핵심 스머지(5088px가 WebGL 최대폭 초과로 통째 깨지는 버그)는 **기존 frame0 크롭이 이미 잡고 있었음.**
- ⚠️⚠️ **함정: headless(swiftshader) 캡쳐는 전체가 어둡게 나온다. 실제 크롬은 밝다.** → 사용자 밝은 크롬 스샷(before)과 내 어두운 headless 스샷(after)을 붙이면 **비교 무의미**(밝기 달라 차이 안 보임). 반드시 **같은 환경끼리** 비교.

## 2. 연구소 충돌 — `public/assets/world/oak_lab.json`
- ⚠️⚠️ **최대 실수: 사용자가 준 캡쳐(Image#2)를 픽셀단위로 안 보고, 서브에이전트 분석만 믿고 엉뚱한 곳(상단 노란 실험대 y2 cols0-5)을 막았다가 되돌림.** 사용자 격노. **캡쳐의 주인공은 하단-좌측 책장 위**에 올라서 있었음.
- 진짜 원인: 책장(책 y8, 받침 y9)만 blocked인데 **책장 상판 줄 y7이 통과** → 주인공 발이 흰 상판에 올라섬.
- 수정: `blocked` **y7의 책장 열(cols 0–4, 8–12) 차단**. 잘못 건드린 y2는 원상복구(원래 cols6-8만 통과).
- 검증(캡쳐+함수): `walkable(2,7)=false`, 주인공 아래로 밀어도 (2,6) 유지 = 책장 못 들어감(`tools/shot-shelf.mjs`).
- ⚠️ **미결(사용자 답 대기):** 수정 후 주인공이 책장 **한 칸 앞**에서 멈춤(상판이 그 칸이라). "한칸앞 멈춤(지금) vs 책장에 바짝붙기(단 발끝이 상판에 살짝 닿음)" 중 택1 물어봄.
- 방법: maps-collision 규칙대로 PNG에 PIL 32px 격자+점유율 얹어 확인(눈대중 금지), walkable() 직접 호출로 검증.

## 3. 인게임 메뉴 = 시안 A(하단 상시 바) — MenuScene/WorldScene/DebugMenuScene
- 배경: 사용자가 `01_Resources/Pick/메뉴UI/`에 **메뉴 5종 시안**을 이미 만들어 뒀고 **A(하단 상시 바)에 "추천" 표시**. 기존 메뉴는 C(우측 세로열)였고 검은 배경 위에 떠서 불만.
- `WorldScene`: `init`에 `openMenu` 플래그, create 끝에서 `if(autoMenu) openMenu()` → 메뉴를 **월드 위 오버레이**로. `DebugMenuScene` 0번을 `MenuScene` 단독 start → `scene.start("WorldScene",{openMenu:true})`로 바꿔 **검은 배경 방지**(예전엔 월드 없이 떠서 순수 검정 = 사용자가 본 그 화면).
- `MenuScene.renderMain` 재작성: 하단 크림(0xf6efd8)+남색(0x222f43) 바, 5칸(도감·포켓몬·가방·저장·설정), 선택칸=노란(0xffe27a) 하이라이트(라벨 숨김·아이콘 크게), **좌우 이동**, main 상태는 딤 없음(월드 그대로 보임). init idx=1(포켓몬). confirm은 포켓몬→파티, 나머지→"준비중" 토스트. X/ESC로 닫힘.
- 아이콘: **지어 그리지 않고 사용자 승인본(시안A 이미지)에서 5개 추출**(투명배경 키잉+autocrop) → `public/assets/ui/menu/ic_{dex,ball,bag,save,set}.png`. 바 남색·크림은 시안 색 그대로.
- ⚠️ **새 public 에셋이라 dev 서버 재시작 필요**(안 하면 `curl -w %{content_type}`가 text/html = vite가 새 파일 못 잡음. maps-collision #5 함정과 동일).
- 검증: 게임에서 캡쳐(월드 위 바 메뉴), 좌우 idx 변화 확인, 시안A와 나란히 비교=거의 일치(`tools/shot-menuA.mjs`).
- ⚠️ `hgss_frame.png`(AR choice1 윈도우스킨)은 처음 윈도우스킨 방식 시도하다 남긴 **미사용 잔재**. 시안A는 크림/남색 손그림 바라 안 씀 → 지워도 됨.

## 4. 프로세스 실수 & 교훈 (이번 세션 반복분노 원인 — 꼭 지킬 것)
1. **사용자가 준 캡쳐를 먼저 직접(픽셀단위) 봐라.** 충돌을 캡쳐 안 보고 엉뚱한 곳 고침 → 격노.
2. **미리보기·검증 비교본은 `.claude/.verify`(숨은 폴더) 말고 `01_Resources/Pick/`에.** 두 달째 규칙인데 또 `.verify`에 넣고 "거기 보라" 함 → 격노. 이번엔 `01_Resources/Pick/_검증_수정3종/`로 옮김.
3. **비교는 같은 환경끼리.** 밝은 크롬 vs 어두운 headless는 무의미.
4. **look 갈리는 UI는 지어내거나 되묻기 전에 사용자 Pick 후보부터 봐라.** 메뉴 윈도우스킨을 물어보려 했지만 이미 Pick에 5종 시안이 있었음.

## 5. 신규/변경 파일 (미커밋)
- 코드: `oak_lab.json`(y7 책장), `LabScene.ts`(bakeStill), `MenuScene.ts`(시안A 바), `WorldScene.ts`(openMenu), `DebugMenuScene.ts`(메뉴를 월드 위로).
- 에셋(신규): `public/assets/ui/menu/ic_*.png`(5), `hgss_frame.png`(미사용).
- 검증 스크립트(git추적): `tools/verify-fixes.mjs`·`shot-menuA.mjs`·`shot-collision.mjs`·`shot-shelf.mjs`·`shot-sprite-ab.mjs`.
- 검증 스샷(Pick, git추적): `01_Resources/Pick/_검증_수정3종/`(스프라이트 OLD/NEW·메뉴·책장).

## 6. 다음 할 일
- [ ] 책장 충돌 "한칸앞 멈춤 vs 바짝붙기" 사용자 답 받고 반영.
- [ ] 스프라이트가 사용자 크롬에서 아직 깨져보이면 **크롬 스샷** 받아 재진단(headless 어둠 아님).
- [ ] 메뉴 시안A 확정이면 도감/가방/저장/설정 기능 연결. 다른 시안 원하면 B~E로 교체(Pick에 있음).
- [ ] 커밋(승인 필요): 위 코드 5개 + `public/assets/ui/menu/` + `tools/shot-*.mjs` + 이 작업일지.
- [ ] 미사용 `hgss_frame.png` 정리 여부 결정.
- [ ] (게임 본작업 잔여) 배틀 연결·정식 마을 다듬기(memory `starter-lab-flow`).
