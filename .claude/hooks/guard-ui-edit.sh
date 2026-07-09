#!/usr/bin/env bash
# PreToolUse(Edit|Write) 훅: 포켓몬 UI 씬(파티/박스/가방/메뉴/상세)을 만들거나 고치기 직전
# 'ask'로 세워 "AR/공식 게임 실제 레이아웃부터 봤냐"를 강제 확인받는다.
# (반복된 분노 = 실제 포켓몬 UI 조사 없이 밋밋한 리스트로 지어냄 → 운영계약 §0 '공식자료 먼저' 위반.)
# 민감 파일이 아니면 조용히 통과(exit 0). stdin = PreToolUse JSON(tool_input.file_path).
input=$(cat)
python3 - "$input" <<'PY'
import sys, json, fnmatch
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)
fp = (d.get("tool_input") or {}).get("file_path", "") or ""
# 포켓몬 UI = 실제 레퍼런스 없이 지어내면 안 되는 화면들
pats = [
    "*MenuScene.ts", "*PartyScene.ts", "*BagScene.ts", "*BoxScene.ts",
    "*StorageScene.ts", "*SummaryScene.ts", "*PokedexScene.ts", "*/ui/*.ts",
]
if not any(fnmatch.fnmatch(fp, p) for p in pats):
    sys.exit(0)
reason = (
    "⛔ 포켓몬 UI(파티/박스/가방/메뉴/상세) 만들기 전 확인:\n"
    "1) AR 실제 UI 에셋을 봤나? — /mnt/d/Pokemon Another Red_PWT_250829/Graphics/UI/ (이 경로는 학원PC 기준. 다른 PC면 myPokemon_AJ/AGENTS.md §4C의 PC별 경로 확인)"
    "{Party,Storage,Bag,Summary,Ready Menu} (파티=2열 라운드패널 그리드, 박스=벽지+6x5, 가방=포켓탭+목록).\n"
    "2) 공식 HGSS/포켓몬 화면 레이아웃과 대조했나? 밋밋한 세로 리스트로 '지어내지' 말 것.\n"
    "3) 직접 그리지 말고 AR UI 그래픽을 import해 그 위에 아이콘/텍스트를 얹었나?(§4 에셋규칙)\n"
    "4) 만든 뒤 실제 렌더링 캡쳐→레퍼런스와 나란히 비교(.claude/.verify/에 png). 안 하면 Stop훅이 턴 종료를 막는다.\n"
    "→ 규칙: .claude/rules/game-ui.md · 운영계약 §0(공식자료 먼저·완료 전 실동작 확인)"
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": reason,
    }
}))
PY
exit 0
