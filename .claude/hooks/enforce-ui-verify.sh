#!/usr/bin/env bash
# Stop 훅 v2 (2026-07-14): "이번 세션에서" UI 씬을 편집했는데 편집 이후 '비교' 캡처 증거가 없으면 턴 종료를 막는다(exit 2).
# v1 대비 변경:
#  ① git status(더티 워킹트리) 기준 → 세션 트랜스크립트 기준. 이전 세션의 미커밋 파일에 오탐하던 문제 해결.
#  ② git 프로세스를 아예 안 띄움 → 느린 /mnt 드라이브에서 훅 타임아웃 강제종료 시 .git/index.lock 잔존
#     → GitHub Desktop "A lock file already exists" 커밋 실패를 유발하던 원인 제거.
# 증거 = <repo>/.claude/.verify/ 의 png 중 파일명에 compare|montage|vs|비교|나란히|diff 포함 + 마지막 UI 편집보다 새것 + 검지 않음.
# 끄기: .claude/.verify/DISABLE 생성(비-시각 수정일 때). 애매하면 막지 않는 fail-open 설계.
export GIT_OPTIONAL_LOCKS=0
input=$(cat)
python3 - "$input" <<'PY'
import sys, json, os, glob, fnmatch, re
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)
if d.get("stop_hook_active"):
    sys.exit(0)  # 무한루프 방지
tp = d.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    sys.exit(0)  # 세션 기록 없으면 판단 불가 → 통과(fail-open)
try:
    if os.path.getsize(tp) > 40*1024*1024:
        sys.exit(0)
except Exception:
    sys.exit(0)

ui_pats = ["*MenuScene.ts","*PartyScene.ts","*BagScene.ts","*BoxScene.ts",
           "*StorageScene.ts","*SummaryScene.ts","*PokedexScene.ts","*/ui/*.ts"]

def iter_tool_use(obj):
    if isinstance(obj, dict):
        if obj.get("type") == "tool_use":
            yield obj
        for v in obj.values():
            yield from iter_tool_use(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_tool_use(v)

edited = []
try:
    with open(tp, encoding="utf-8") as fh:
        for line in fh:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            for tu in iter_tool_use(obj):
                if (tu.get("name") or "") not in ("Edit","Write","MultiEdit","NotebookEdit"):
                    continue
                fp = ((tu.get("input") or {}).get("file_path")) or ""
                if fp.endswith("DebugMenuScene.ts"):
                    continue  # 디버그 진입 메뉴(외관 무관) — *MenuScene.ts 오탐 제외
                if any(fnmatch.fnmatch(fp, p) for p in ui_pats) and fp not in edited:
                    edited.append(fp)
except Exception:
    sys.exit(0)
edited = [e for e in edited if os.path.exists(e)]
if not edited:
    sys.exit(0)  # ★이번 세션에 UI 편집 없음 → 이전 세션 더티 파일에는 반응하지 않는다(v2 핵심)

# repo 루트: git 없이 상향 탐색(.git 폴더)
root = os.environ.get("CLAUDE_PROJECT_DIR") or ""
if not (root and os.path.isdir(os.path.join(root, ".git"))):
    cur = os.path.dirname(os.path.abspath(edited[0])); root = ""
    while cur and cur != os.path.dirname(cur):
        if os.path.exists(os.path.join(cur, ".git")):
            root = cur; break
        cur = os.path.dirname(cur)
if not root or os.path.exists(os.path.join(root, ".claude/.verify/DISABLE")):
    sys.exit(0)

newest_ui = max(os.path.getmtime(e) for e in edited)
pngs = glob.glob(os.path.join(root, ".claude/.verify", "*.png"))
cmp_tok = re.compile(r"(compare|montage|vs|비교|나란히|diff)", re.I)
pngs = [p for p in pngs if cmp_tok.search(os.path.basename(p))]
def _bright(path):
    try:
        from PIL import Image
        im = Image.open(path).convert("L"); w, h = im.size
        im = im.crop((0, 0, max(1, w // 3), h))  # 몽타주 왼쪽(내 캡처 패널)만 측정
        px = list(im.getdata())
        return (sum(px)/len(px)) if px else 0
    except Exception:
        return 999  # PIL 없거나 파싱 불가 → 밝기검사 스킵(fail-open)
valid = [q for q in pngs if os.path.getmtime(q) >= newest_ui and _bright(q) >= 15]
if valid:
    sys.exit(0)

rels = ", ".join(os.path.relpath(e, root) for e in edited)
msg = (
    "⛔ 이번 세션에서 UI 씬을 고쳤는데 '편집 이후 렌더링 확인' 증거가 없다: " + rels + "\n"
    "'알겠다/똑같다/됐다'로 끝내지 말고 지금 실제 화면을 봐라:\n"
    "1) webapp-testing으로 화면을 띄워 캡쳐 → .claude/.verify/ 에 png 저장(파일명에 '비교' 포함).\n"
    "2) 따라 만들라던 레퍼런스와 '나란히'(몽타주) 놓고 구체적 차이를 나열해라. '비슷/똑같다' 금지.\n"
    "3) 정말 시각변화 없는 수정이면 .claude/.verify/DISABLE 를 만들어 게이트를 끈다(사유 남길 것).\n"
    "→ 규칙: .claude/rules/game-ui.md · 운영계약 §0.2(완료 전 실동작 확인)"
)
print(msg, file=sys.stderr)
sys.exit(2)
PY
