#!/usr/bin/env bash
# PreToolUse(Edit|Write) 훅: 맵 충돌격자·집 내부 핵심 파일을 수정하기 직전
# 'ask'로 세워 눈대중 금지 체크리스트를 강제로 확인받는다(반복된 분노 1순위 = 충돌격자 눈대중).
# 민감 파일이 아니면 조용히 통과(exit 0). stdin = PreToolUse JSON(tool_input.file_path 포함).
input=$(cat)
python3 - "$input" <<'PY'
import sys, json, fnmatch
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)  # 파싱 실패 시 방해하지 않고 통과
fp = (d.get("tool_input") or {}).get("file_path", "") or ""
# 충돌격자/맵/집 내부 = 반복 실수 다발 지점
pats = [
    "*rooms.json", "*oak_lab.json", "*/assets/world/*.json",
    "*/scenes/InteriorScene.ts", "*/scenes/WorldScene.ts", "*/scenes/LabScene.ts",
    "*/assets/house/*",
]
if not any(fnmatch.fnmatch(fp, p) for p in pats):
    sys.exit(0)  # 민감 파일 아님 → 통과
reason = (
    "⛔ 맵 충돌격자·집 내부 파일 수정 직전 확인:\n"
    "1) blocked/warp를 게임화면 눈대중으로 찍지 않았나? → 원본PNG 640×480(32px 격자)로 1:1 검증했나?\n"
    "2) 이 파일이 지금 라이브가 로드하는 맵이 맞나?(비슷한 방 혼동 금지)\n"
    "3) 수정 후 playwright·walkable()로 실제 검증할 건가?\n"
    "→ 규칙: .claude/rules/maps-collision.md"
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
