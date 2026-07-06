# Pokemon_With — Claude Code 진입점

이 저장소의 규칙 정본(source of truth)은 아래 두 곳이다. Claude Code는 `AGENTS.md`를 직접 읽지 않으므로 여기서 import 해 로드한다.

@AGENTS.md

## 규칙 계층 (이 순서로 신뢰)
1. **`AGENTS.md`** (이 파일이 import) — 작업 방식 공통 규칙.
2. **`myPokemon_AJ/AGENTS.md`** — 게임 자체(화풍·에셋·실행·함정) 정본. `myPokemon_AJ/`에서 작업하면 자동 로드된다.
3. **`.claude/rules/*.md`** — 특정 파일을 건드릴 때만 뜨는 STOP 체크리스트(맵 충돌격자·에셋·실행빌드). 정본의 요약 강제판.
4. **`~/.claude/.../memory/`** — 진행상황·해결로그·PC-로컬 보조. **규칙이 AGENTS.md와 충돌하면 AGENTS.md가 우선**(memory는 "그때의 사실"일 뿐 — 현재 코드로 재검증).

## 강제되는 것 (신뢰 아님, 시스템 차단)
- 커밋 전 `tsc --noEmit` 실패 시 커밋 자동 차단(`.claude/settings.json` PreToolUse).
- `00_ImportBox/Important/**`(개인 메모) Read 차단(`.claude/settings.json` permissions.deny).
