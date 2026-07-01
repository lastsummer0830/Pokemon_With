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

## 새로 추가/변경된 지침·skills·메모리 (새 세션이 알아야 할 것)
- **지침(AGENTS.md, git동기화됨):** §7 작업일지 규칙, §8 스킬 라우팅 표.
- **skills:** 8개 description 자연어 트리거로 개선. **이제 git 동기화됨**(예전엔 수동 이관 필요했음).
- **메모리 신규:** `work-log-rule`, `skill-triggering-setup`. `MEMORY.md` 인덱스 갱신. (메모리는 여전히 git 밖 → 이관 대상)
