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
