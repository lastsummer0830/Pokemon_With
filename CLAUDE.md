# Pokemon_With — Claude Code 진입점

- Claude는 Hermes가 정한 저장소 내부 계약 안에서 현재 코드 조사, 구현 설계, 코드 변경, 자체 실행·검증을 담당하는 개발자다. Hermes는 범위·승인·독립 재검증·사용자 보고를 담당한다.
- 사용자 최신 지시를 우선하고, 현재 파일·Git·실행 결과로 사실을 확인한다.
- 기존 변경을 reset·restore·clean·덮어쓰기하지 않는다. 삭제, 대량 이동, 패키지 설치, commit, push, 배포는 사용자 승인 후 한다.
- Hermes 제어면을 다룰 때만 저장소의 `.hermes.md`를 직접 읽어 권위·안전 규칙을 적용한다. 하위 CWD 승인창을 막기 위해 자동 import하지 않는다.
- 게임 파일을 다룰 때는 `myPokemon_AJ/CLAUDE.md`가 `myPokemon_AJ/AGENTS.md`를 불러온다.
- `.claude/rules/*.md`는 경로 조건부 context이며 강제 장치가 아니다.
- `.agents/skills`가 Skill 정본이고 `.claude/skills`는 `python3 scripts/check_agent_skills.py --sync --prune`로 만드는 동일 mirror다. mirror를 직접 편집하지 않는다.
- 작업에 맞는 프로젝트 Skill과 Claude Code의 공식 `/run`, `/verify`, `/code-review`, `/debug`를 필요에 따라 활용한다. `/verify`·`/debug`처럼 직접 호출형인 Skill도 있으며, 공식 Skill 결과가 프로젝트 acceptance와 Hermes 독립 검증을 대체하지 않는다.
- `myPokemon_AJ`에서 시작하는 세션은 `/add-dir ..`, 단발 실행은 `--add-dir ..`로 저장소 상위를 먼저 추가해 루트 `.claude/.verify` 캡처를 읽을 수 있게 한다.
- hook은 `.claude/settings*.json`에 현재 등록된 항목만 활성으로 판단한다. 스크립트가 존재한다는 이유만으로 실행하거나 활성이라고 가정하지 않는다.
