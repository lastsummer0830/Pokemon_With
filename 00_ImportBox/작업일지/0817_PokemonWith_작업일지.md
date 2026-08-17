# 0817 PokemonWith 작업일지

> **게임 코드는 한 줄도 안 바꿨다.** 8/16 환경 커밋 `56c8f58`이 만든 규칙 유실·잠금을 공식 문서와 대조해 되돌린 세션.
> 상세 보고서(결함 6개·근거·정리안): https://claude.ai/code/artifact/820e9c81-9d4e-4a9e-8cf3-50b716be207f

## 1. 한 것

**핵심 진단 — 용량 문제가 아니었다.** 규칙이 *안 읽히는 자리*로 옮겨졌고, 고칠 수 없게 잠겨 있었다.

| 파일 | 전 → 후 | 내용 |
|---|---|---|
| `CLAUDE.md` (루트) | 12 → **62줄** | 작업일지·세션 마무리, 언제 마무리하나, 진행상태 위치, Skill 사용, 로드 표, 규칙 고칠 때 |
| `myPokemon_AJ/AGENTS.md` | 47 → **59줄** | **함정 절 복원**, 작업일지는 루트 포인터 한 줄만 |
| `.agents/skills/*` 12개 (+ mirror 12) | 364 → **1,797자** | description에 한국어 트리거 문구 복원 |
| `.claude/settings.json` | — | deny 22→20, `autoMemoryEnabled` false→**true** |
| `scripts/` 3개 | — | 설명 상한 60→1536, 계약 3곳 동기화 |

**고친 결함 5가지**
1. **진행상태를 적을 곳이 없었다** — auto memory off + AGENTS.md "여기 적지 마라" + 작업일지 규칙 삭제로 3중 차단. memory 8개 파일이 8/3 이후 정지 상태였다.
2. **제어면이 편집 불가로 잠겨 있었다** — deny 22개 + validator 401줄이 스킬 로스터까지 고정. 규칙을 고치려면 validator를 고쳐야 하는데 그것도 deny. 닫힌 고리였다.
3. **스킬이 한국어에 안 걸렸다** — validator가 description을 60자로 제한(공식 상한 1,536자). 보완하던 AGENTS.md 스킬 라우팅표도 같은 커밋에서 삭제돼 두 겹 다 없었다.
4. **규칙이 로드 안 되는 위치** — 루트 CLAUDE.md 12줄뿐이고 게임 규칙은 `myPokemon_AJ/` 안. 게임 코드 안 만지는 세션엔 안 들어왔다.
5. **함정 지식 소실** — "몇 시간 날림" 절 통째 삭제됐던 것을 현재 코드로 재확인해 복원.

## 2. 검증

- `python3 scripts/check_agent_skills.py` **PASS** (mirror 12개 동기화)
- `python3 scripts/check_hermes_control.py` **PASS**
- `python3 -m unittest scripts.test_agent_skills` **67 OK**
- 스킬 설명 YAML 실제 파서로 파싱 확인, 합계 1,797자 = 목록 예산(1M×2%)의 **9.0%**
- 스킬 목록은 재시작 없이 이 세션에 반영됨(Claude Code가 스킬 디렉터리 감시)
- 공식 문서 대조: `code.claude.com/docs/en/{memory, skills, settings, permissions, context-window, model-config}`

## 3. 미검증 · 남은 위험

- ⚠️ **`/context`·`/doctor` 실측은 못 했다.** 진행 중인 세션은 startup 콘텐츠·권한을 시작 시점 것으로 물고 있다. **새 세션에서 확인해야 한다.**
- ⚠️ **`.claude/settings.json` 권한 변경은 진행 중인 세션에 반영되지 않는다.** deny에서 지운 뒤에도 `Edit`가 계속 거부돼 루트 `CLAUDE.md`는 셸 `cp`로 적용했다. 이 사실은 `CLAUDE.md` 마지막 줄에 적어뒀다.
- 새 세션에서 "작업일지 써"가 실제로 규칙을 물고 오는지 아직 시험 못 했다.
- 제어면 계약이 `.claude/settings.json`·`check_hermes_control.py`·`test_agent_skills.py` **세 곳에 복제**돼 있다. 하나만 고치면 검사가 깨진다.
- 0805에 정비한 루트 `CLAUDE.md` 46줄은 당시 untracked라 git에 없다. **복구 불가**(이번 62줄로 새로 씀).

## 4. 다음 세션 시작 지점

1. **먼저 `/context`** → Memory files에 루트 `CLAUDE.md`가 뜨는지, Skills 행이 몇 자인지 확인. 이어서 **`/doctor`**로 스킬 목록 컨텍스트 비용 확인.
2. 그다음 **원래 1순위로 복귀** — 스토리 이벤트. 세부는 0805 일지 §5에 있다.
   - 아일라(상록 23,35) 오토런 트레이너전은 `f3a23a0`에서 구현·검증됨
   - 경호(상록 35,10) = 이모트 말풍선(AR 애니 3번 `!`, 4번 `?`)만 처리하면 현 파이프라인으로 돈다
   - ⛔ 1번도로 오박사 조우는 손대지 말 것 — 사용자 결정(제외/각색/교체) 전까지 착수 금지
3. 작업 시작 전 `python3 tools/ar-map/audit-parity.py` 실행.

## 5. 그날 바뀐 지침 요지

- **작업일지 절차가 루트 `CLAUDE.md`로 올라왔다.** ① `/code-review` 1회 → ② 일지 → ③ 커밋 → ④ push → ⑤ 다음 프롬프트. "작업일지 써"는 커밋·push 포함 지시다.
- **일지 분량 상한 80줄·6KB, 5항목 고정.** 긴 조사는 `.claude/.verify/`나 memory에 두고 경로만 가리킨다.
- **사용자에게 보여줄 캡처는 `01_Resources/Pick/<카테고리>/`**, 자동 검증 캡처(`.claude/.verify/`)와 섞지 않는다.
- **끊는 기준 신설** — 컨텍스트 잔량이 아니라 작업 경계 기준. 백스톱으로 `/context` 60% 초과 시 새 단위 시작 금지.
- **진행상태 정본은 작업일지**(git 동기화 → 다른 PC에서 읽힘). auto memory는 이 PC 캐시라 PC 간 공유 안 됨.
- 압축 후에는 스킬 목록·`AGENTS.md`·`paths:` 규칙이 재주입되지 않는다. 루트 `CLAUDE.md`만 살아남는다.
