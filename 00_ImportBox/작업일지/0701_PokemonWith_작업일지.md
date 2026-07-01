# 0701 PokemonWith 작업일지 (2026-07-01)

> 다른 PC / 새 세션의 Claude가 **이 문서만 보고 끊김 없이 이어가도록** 정리. 리포 루트 = `git rev-parse --show-toplevel` (현재PC `D:\dev\Pokemon_With`, 집PC `C:\Users\ONE\Documents\GitHub\Pokemon_With` — 폴더명 리네임 전일 수 있으니 절대경로 말고 상대경로 사용).

## 오늘 한 일

### 1. 이름 통일: `myPokemon` → `PokemonWith`
- **왜:** 워크스페이스를 `Pokemon_With`로 이사했는데 실행프로그램/창 제목이 옛 이름(myPokemon, "Pokemon With" 공백)이라 통일.
- **바꾼 파일:** `myPokemon_AJ/electron/main.cjs`(BrowserWindow title), `myPokemon_AJ/index.html`(`<title>`), `myPokemon_AJ/package.json`(name `pokemon-with`, productName `PokemonWith`), `myPokemon_AJ/게임실행.bat`(title).
- **⚠️ exe 갱신 방식(중요):** WSL에서 `npm run app:build`는 **리눅스용(snap/AppImage/linux-unpacked)을 구움** → 윈도우 exe는 안 바뀜. 윈도우 exe는 **asar repack**으로 갱신하는 게 정답:
  - `build_win/win-unpacked/resources/app.asar`를 `node_modules/.bin/asar extract` → `dist/`·`electron/main.cjs`·`package.json` 교체 → `asar pack`.
  - 검증은 `grep -a -c "PokemonWith — 집 꾸미기" app.asar`(있음) / `myPokemon…`(0). exe 바이너리 자체는 6/26자 그대로여도 정상(껍데기라 asar만 갱신하면 됨).
  - 리눅스 빌드 쓰레기(snap/AppImage/linux-unpacked/*.yml/*.blockmap) 삭제함.
- **바로가기:** 죽은 `포켓몬 위드 실행.lnk`(옛 경로 `D:\dev\AJ_Proj\vcPortfolio_AJ...` + 공백이름 `Pokemon With.exe` 가리킴) 삭제 → `PokemonWith.lnk` 새로 생성(바탕화면 + `D:\dev\Pokemon_With`), 현재 exe 경로로 연결.
- **커밋:** `13bf78b` (main) — **아직 push 안 함.**

### 2. GitHub Desktop 재연결
- 이사로 옛 경로를 못 찾던 것을 **Locate → `D:\dev\Pokemon_With`** 로 재연결(사용자가 직접). 원격 `Pokemon_With.git` 정상, main 추적.

### 3. 작업일지 규칙 신설 (AGENTS.md §7)
- 일지 = `<repo-root>/00_ImportBox/작업일지/MMDD_PokemonWith_작업일지.md`(git 동기화, 날짜 하위폴더 X, 같은날 이어서 보강).
- 멀티PC: **절대경로 박지 말고 리포 상대경로.** git 안 되는 이관자료만 바탕화면 `PokemonWith_이관_MMDD/`.
- 메모리: `work-log-rule.md`.

### 4. 스킬 자연어 트리거 셋업 (공식문서 근거)
- **원인:** 사용자가 "자연어로 말해도 스킬이 잘 안 걸린다"고 지적.
- 조사(claude-code-guide 에이전트, code.claude.com/docs): **스킬 자동발동은 오직 `description` 매칭**. 라우팅용 훅은 **안티패턴**(안 씀).
- **적용:**
  - `.claude/skills/*/SKILL.md` 8개 **description을 자연어 한국어 트리거 문구로 강화**("실행해줘/exe 구워줘/배틀 짜줘/예쁘게 해줘" 등).
  - `.claude/settings.json` 신규: `skillListingBudgetFraction: 0.02`, `skillListingMaxDescChars: 1536`(스킬 많아 description 잘림 방지). ※ 이 키들 **설치본 바이너리 `strings`로 실재 검증함**(일반 grep은 245MB 단일바이너리라 안 먹힘).
  - AGENTS.md **§8 스킬 라우팅 표** 추가(항상 로드되는 보조 리마인더).
  - `.gitignore` `.claude/` → **`.claude/settings.local.json`** 으로 변경 → **스킬·settings.json이 이제 git으로 PC간 동기화**(기계별 local만 제외). 사용자 확인 후 진행.
  - `pokemon-asset-pipeline` 스킬의 AR 원본경로에 "PC마다 다름" 표기.
  - 메모리: `skill-triggering-setup.md`.
- **주의:** 이 버전(2.1.197) `/doctor`는 스킬 잘림을 **안 보여줌**(버전·서버 상태만). 그 확인용으로는 무용 → 잊어도 됨.

## 특별/주의사항 (함정)
- WSL+D드라이브: `npm run app:build` = 리눅스 빌드. **윈도우 exe = asar repack.**
- `asar extract-file`은 stdout으로 안 뿌리고 **cwd에 파일 흘림** → 찌꺼기 주의(오늘 `myPokemon_AJ/main.cjs` 찌꺼기 생겨서 삭제).
- claude 설치본은 **245MB 단일 바이너리** → 일반 grep 안 됨, `strings`로 검색.
- 줄바꿈 경고(LF→CRLF)는 무시 가능.

## 다음에 이어서 할 일
1. **미커밋 변경 커밋 + push**(집 PC 동기화용). 대상: `.gitignore`, `myPokemon_AJ/AGENTS.md`, `.claude/`(스킬8 + settings.json). 이름커밋 `13bf78b`도 push 전.
2. **새 세션에서 본격 게임 개발 시작.** AGENTS.md §6 다음 우선순위: 진짜 마을 맵(Tiled) → 격자이동+충돌 → 배틀 제대로(Back+스탯+데미지) → 스타팅→배틀→집꾸미기→homeBonus.
3. 작업일지 갱신 요청 시 **이 파일에 이어서 보강**.
4. (집 PC 갈 때) 메모리 이관: 바탕화면 `PokemonWith_이관_0701/` → 집 PC `~/.claude/projects/.../memory/`로 복사.

---

# 0701 (오후 세션) — 시작 집(침실/거실) 충돌·계단·워크플로 대수술

## 배경
사용자 반복 불만: "2층에서 1층 안 내려가짐", "침대/램프/TV 위에 올라타짐", "계단이 성급하게 발동". 며칠~몇 주 막혀 마을 진행 자체를 못 함. 원인은 **내가 어두운 스크린샷 보고 충돌 격자를 추측으로 짜서 실제 그림과 계속 어긋난 것**.

## 확정한 개발↔확인↔굽기 워크플로 (사용자 강력 요청 — 앞으로 고정)
- **작업 중:** 코드 고치면 `npm run dev`로 dev 서버 띄우고 사용자에게 "**http://localhost:5180 에서 확인**" 안내. exe는 안 건드림.
- **"굽자" 하면:** `npm run app:bake` **한 방**(신설 = `tools/bake-exe.sh`: `npm run build`로 dist 굽고 → 기존 `build_win/win-unpacked/resources/app.asar` 안 dist만 교체). WSL이라 `npm run app:build`(electron-builder)는 **리눅스빌드**라 헛수고 — asar repack이 정답.
- 경로 못박음: 리포루트 `/mnt/d/dev/Pokemon_With`, 프로젝트 `myPokemon_AJ`, dev=`localhost:5180`(포트고정), exe=`myPokemon_AJ/build_win/win-unpacked/PokemonWith.exe`, 바로가기=`/mnt/c/Users/user/Desktop/PokemonWith.lnk`.

## 고친 것 (파일별)
1. **`index.html`** — 루트 index.html이 **빌드본(`./assets/index-*.js`)으로 덮여 커밋**돼 있어 **dev 서버가 계속 검정화면**(canvas 0, 404)이었음. → `<script src="/src/main.ts">`로 되돌림. (이래서 예전 dev 확인이 안 됐던 것.)
2. **`public/assets/house/rooms.json`** — 침실·거실 **충돌 격자 전면 재작성**. PIL로 각 방 그림에 32px 좌표격자를 찍어 **실측** 후 가구 위치에 정확히 맞춤:
   - 침실: TV=(7-8,6-7), 침대=(3-5,9-10), 상단 PC/선반=(3-7,3), 계단=(9-10,3-4)+워프(10,4 dir up), 러그=col11(걷힘). **스폰을 TV 위(8,6)→TV 2칸 아래 빈 바닥 (8,9)로.**
   - 거실: **램프=(5,5-7) 막음**(위에 올라타던 것), 액자/콘솔=(3,6-7), 냉장고·오렌지장·싱크·스토브=(13-16,3-4), **침대=(14-16,8-9) 전체 막음**(약간 밟히던 것), 계단=(3-4,3-4)+워프(4,4), 문=(8-9,11 dir down). 스폰 (9,9).
   - **계단 "오른쪽→왼쪽으로 올라감" 반영:** 거실 계단 워프 `dir:"left"`(러그 (5,4)에서 왼쪽으로 밟아 진입)+`climb:[-1,-1]`(대각 올라서는 연출). 침실 계단 `dir:"up"`+`climb:[0,-1]`.
3. **`src/scenes/InteriorScene.ts`** —
   - **전환 멈춤 버그 방지:** `handleWarp`가 카메라 `camerafadeoutcomplete` 이벤트에만 의존 → 이벤트 안 오면 `busy=true`로 영영 멈춤(="밟았는데 안 넘어감"). `doWarpTransition`에서 **`time.delayedCall(320)` 시간기반**으로 바꿈.
   - **계단 연출:** 밟자마자 순간이동하던 걸, 계단이면 `climb` 오프셋만큼 한 칸 걸어 올라선 뒤 전환. `Warp.climb?`, `dirVec()` 추가.
   - `DEBUG_COLLISION` 오버레이의 막힌칸을 빨간 외곽선으로(그림 비침) 개선. **최종은 false로 꺼둠.**
4. **`src/main.ts`** — dev 플레이테스트용 `window.__game` 노출(배포 영향 없음).
5. **`package.json`** — `"app:bake"` 스크립트 추가.
6. **신규 도구:** `tools/bake-exe.sh`(굽기), `tools/shot-interior.mjs`(playwright 방/거실 캡처, swiftshader 플래그 필수).

## 검증 방법 (중요 — 함정 기록)
- ⚠️ **playwright headless는 idle이면 Phaser rAF 루프가 멈춘다** → 페이드/`delayedCall`/씬전환 같은 **시간기반 동작이 안 끝나** headless로 검증 불가(이동 트윈은 키 누르는 동안이라 됨). **층 전환의 실제 완료·계단 연출 모양은 반드시 localhost(실브라우저)에서 확인.**
- **결정론적 검증 2종(이걸로 정렬·도달성 확정):** ① `rooms.json` 격자를 코드로 **BFS** → 스폰에서 모든 워프 도달 O, 못 가는 섬 없음(양 방). ② **PIL로 그림에 충돌칸 덧그리기**(`col_bedroom.png`/`col_living.png`, 바탕화면 `PokemonWith_shots/`) → 가구에 정확히 얹힘 확인.
- 실측 좌표격자 이미지: 바탕화면 `PokemonWith_shots/grid_bedroom.png`·`grid_living.png`(가구별 타일좌표 읽는 용).

## 다음에 이어서 할 일 (오후 세션 기준)
1. **사용자가 localhost에서 최종 확인:** 침실→거실 내려가짐 / 거실→침실 올라가짐(오른쪽→왼쪽 계단 느낌) / 문→마을 / 가구 안 밟힘. → OK면 **"굽자" 시 `npm run app:bake`로 exe 반영.**
2. 계단 climb 방향/칸수(거실 [-1,-1], 침실 [0,-1])는 **실제 보고 튜닝** 여지. 스토브 (16,5) 등 초경미 여백 남을 수 있음.
3. 미커밋 다수(`index.html`, `rooms.json`, `InteriorScene.ts`, `main.ts`, `package.json`, `tools/bake-exe.sh`, `tools/shot-interior.mjs`) — 커밋/푸시 필요.

## 새로 추가/변경된 지침·skills·메모리 (오전+오후 통합)
- **지침(AGENTS.md, git동기화됨):** §7 작업일지 규칙, §8 스킬 라우팅 표.
- **skills:** 8개 description 자연어 트리거로 개선(git 동기화됨).
- **메모리 신규/변경:** 오전 `work-log-rule`, `skill-triggering-setup` / 오후 `dev-then-bake-workflow`(확인=localhost, 굽기=app:bake), `dev-index-html-trap`(dev 검정화면=루트 index.html 빌드본 덮임→/src/main.ts), `bedroom-tv-collision-fix`(실측·BFS·PIL 검증법+headless 함정), `launch-via-bat-only` 굽기명령 갱신(app:bake). `MEMORY.md` 인덱스 갱신. (메모리는 git 밖 → 이관 대상)
