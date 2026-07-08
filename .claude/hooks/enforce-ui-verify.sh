#!/usr/bin/env bash
# Stop 훅: UI 씬을 수정했는데 '편집 이후의 렌더링 스크린샷 증거'가 없으면 턴 종료를 막는다(exit 2).
# 목적 = "UI 고쳐놓고 화면 안 보고 '됐다/똑같다'"의 하드 차단. soft 규칙(계약·guard-ui ask)으로는 반복 위반됨.
# 증거 = <repo>/.claude/.verify/ 안의 최신 png 가 '수정된 UI 파일'보다 새것(편집 후 캡쳐했다는 뜻).
# 설계: fail-open — git/판단 애매하면 막지 않는다(오탐으로 턴을 브릭하지 않게).
# 끄기: .claude/.verify/DISABLE 파일 생성(비-시각 수정일 때), 또는 settings.json의 Stop 훅 제거.
input=$(cat)
python3 - "$input" <<'PY'
import sys, json, os, glob, subprocess, fnmatch
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)
# 무한루프 방지: 이미 stop 훅이 한 번 막은 상태면 통과
if d.get("stop_hook_active"):
    sys.exit(0)
try:
    root = subprocess.check_output(["git","rev-parse","--show-toplevel"], stderr=subprocess.DEVNULL).decode().strip()
except Exception:
    sys.exit(0)
if not root or os.path.exists(os.path.join(root, ".claude/.verify/DISABLE")):
    sys.exit(0)  # 끄기 스위치
ui_pats = ["*MenuScene.ts","*PartyScene.ts","*BagScene.ts","*BoxScene.ts",
           "*StorageScene.ts","*SummaryScene.ts","*PokedexScene.ts","*/ui/*.ts"]
try:
    st = subprocess.check_output(["git","-C",root,"status","--porcelain","-uall"], stderr=subprocess.DEVNULL).decode()
except Exception:
    sys.exit(0)
changed = []
for line in st.splitlines():
    p = line[3:].strip().strip('"')
    if " -> " in p:            # rename → 도착 경로
        p = p.split(" -> ")[-1]
    if any(fnmatch.fnmatch(p, pat) for pat in ui_pats):
        changed.append(os.path.join(root, p))
changed = [c for c in changed if os.path.exists(c)]
if not changed:
    sys.exit(0)  # UI 변경 없음 → 통과
newest_ui = max(os.path.getmtime(c) for c in changed)
pngs = glob.glob(os.path.join(root, ".claude/.verify", "*.png"))
newest_ev = max((os.path.getmtime(p) for p in pngs), default=0.0)
if newest_ev >= newest_ui:
    sys.exit(0)  # 편집 후 캡쳐 증거 있음 → 통과
rels = ", ".join(os.path.relpath(c, root) for c in changed)
msg = (
    "⛔ UI 씬을 고쳤는데 '편집 이후 렌더링 확인' 증거가 없다: " + rels + "\n"
    "'알겠다/똑같다/됐다'로 끝내지 말고 지금 실제 화면을 봐라:\n"
    "1) webapp-testing으로 화면을 띄워 캡쳐 → .claude/.verify/ 에 png 저장.\n"
    "2) 따라 만들라던 레퍼런스와 '나란히'(몽타주) 놓고 구체적 차이를 나열해라. '비슷/똑같다' 금지 — 다른 점을 짚어라.\n"
    "3) 정말 시각변화 없는 수정이면 .claude/.verify/DISABLE 를 만들어 게이트를 끈다(사유 남길 것).\n"
    "→ 규칙: .claude/rules/game-ui.md · 운영계약 §0.2(완료 전 실동작 확인)"
)
print(msg, file=sys.stderr)
sys.exit(2)
PY
