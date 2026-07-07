# Pokemon_With — Claude Code 진입점

이 저장소의 규칙 정본(source of truth)은 아래 두 곳이다. Claude Code는 `AGENTS.md`를 직접 읽지 않으므로 여기서 import 해 로드한다.

@AGENTS.md

## 규칙 계층 (이 순서로 신뢰)
1. **`AGENTS.md`** (이 파일이 import) — 작업 방식 공통 규칙.
2. **`myPokemon_AJ/AGENTS.md`** — 게임 자체(화풍·에셋·실행·함정) 정본. `myPokemon_AJ/`에서 작업하면 자동 로드된다.
3. **`.claude/rules/*.md`** — 특정 파일(`paths:`)을 건드릴 때 뜨는 STOP 체크리스트(맵 충돌격자·에셋·실행빌드). ⚠️ **뜨는 건 '표시'지 '강제'가 아니다**(읽어도 안 지킬 수 있음 — 공식: CLAUDE.md/rules는 context일 뿐 enforced 아님). 진짜 강제는 아래 훅.
4. **`~/.claude/.../memory/`** — 진행상황·해결로그·PC-로컬 보조. **규칙이 AGENTS.md와 충돌하면 AGENTS.md가 우선**(memory는 "그때의 사실"일 뿐 — 현재 코드로 재검증).

## 강제되는 것 (신뢰 아님, 시스템 차단 — `.claude/settings.json` 훅/권한)
> 소프트 규칙(위 1~4)은 '읽고 지키길 바라는' 것이라 반복 위반됨. 그래서 자주 틀리는 지점만 훅으로 하드화한다.
- **커밋 전 `tsc --noEmit` 실패 시 커밋 자동 차단** (PreToolUse/Bash).
- **`00_ImportBox/Important/**`(개인 메모) Read 차단** (permissions.deny).
- **매 턴 STOP 체크리스트 자동 주입** — 스킬 라우팅·memory 재검증·맵/에셋 규칙 (UserPromptSubmit → `.claude/hooks/remind.sh`).
- **맵 충돌격자·집 내부 파일(`rooms.json`·`oak_lab.json`·world/house·InteriorScene/WorldScene/LabScene) Edit/Write 직전 `ask` 확인** — 눈대중 금지 (PreToolUse/Edit|Write → `.claude/hooks/guard-map-edit.sh`).
