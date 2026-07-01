#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# bake-exe.sh — 오늘 변경분을 윈도우 실행프로그램(PokemonWith.exe)에 반영한다.
#
# 왜 이 스크립트가 필요한가:
#  - 이 프로젝트는 WSL + D드라이브라 `npm run app:build`(electron-builder)는
#    리눅스용(snap/AppImage)을 구울 뿐, 윈도우 exe는 안 바뀐다.
#  - 윈도우 exe는 "껍데기"고 실제 앱은 resources/app.asar 안의 dist/ 를 읽는다.
#    → 그래서 "굽기" = ① npm run build 로 dist 새로 굽고 ② app.asar 안의 dist 만 갈아끼우기.
#  - 수동으로 asar 만지다 찌꺼기(main.cjs 등) 흘리고 엉키던 걸 이 한 방으로 대체한다.
#
# 사용: 프로젝트 폴더(myPokemon_AJ)에서  bash tools/bake-exe.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASAR="node_modules/.bin/asar"
APP_ASAR="build_win/win-unpacked/resources/app.asar"
# 추출/재패킹은 cwd에 파일 흘리지 않도록 scratch 임시폴더에서.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "▶ [1/4] dist 새로 빌드 (tsc + vite build)…"
npm run build

echo "▶ [2/4] 현재 app.asar 추출 (node_modules 보존용)…"
[ -f "$APP_ASAR" ] || { echo "✗ $APP_ASAR 없음. exe가 아직 패키징 안 됐다면 먼저 npm run app:build 한 번 필요."; exit 1; }
"$ASAR" extract "$APP_ASAR" "$STAGE/app"

echo "▶ [3/4] 새 dist/electron/package.json 로 교체…"
rm -rf "$STAGE/app/dist"
cp -r dist "$STAGE/app/dist"
cp electron/main.cjs "$STAGE/app/electron/main.cjs"
cp package.json "$STAGE/app/package.json"

echo "▶ [4/4] app.asar 재패킹…"
"$ASAR" pack "$STAGE/app" "$APP_ASAR"

echo "✓ 완료 → $ROOT/$APP_ASAR 갱신됨."
echo "  검증: grep -a -c 'PokemonWith' 로 이름 확인, 바탕화면 PokemonWith.lnk 로 실행."
