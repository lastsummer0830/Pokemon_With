#!/usr/bin/env bash
# PokemonWith.exe 파일 자체의 아이콘을 build/icon.ico로 바꾼다.
#
# 왜 따로 필요한가:
#   package.json의 `win.signAndEditExecutable: false` 때문에 electron-builder가 exe를 손대지 않는다
#   (WSL 리눅스에선 exe를 편집하는 rcedit이 wine 없이는 못 돈다). 그래서 윈도우쪽 rcedit을
#   WSL interop(리눅스에서 .exe 바로 실행)으로 직접 불러 아이콘만 박는다.
#
# 언제 다시 돌리나:
#   · `npm run app:bake`(dist만 교체)는 exe를 안 건드리므로 **아이콘이 그대로 남는다** → 안 돌려도 된다.
#   · `npx electron-builder --win --x64`로 exe를 새로 구우면 아이콘이 초기화된다 → 그때 한 번 돌린다.
#
# 사용법: cd myPokemon_AJ && bash tools/set-exe-icon.sh
#   ⚠️ PokemonWith.exe가 실행 중이면 파일이 잠겨 실패한다 → 먼저 창을 닫을 것.
set -e
cd "$(dirname "$0")/.."

EXE="build_win/win-unpacked/PokemonWith.exe"
ICO="electron/assets/icon.ico"
RCEDIT="/mnt/c/Users/ONE/AppData/Local/Temp/rcedit-x64.exe"
RCEDIT_URL="https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe"

[ -f "$EXE" ] || { echo "exe가 없다: $EXE — 먼저 exe를 구울 것"; exit 1; }
[ -f "$ICO" ] || { echo "아이콘이 없다: $ICO — tools/make-icons.py로 먼저 구울 것"; exit 1; }
[ -f "$RCEDIT" ] || { echo "rcedit 받는 중…"; curl -sL -o "$RCEDIT" "$RCEDIT_URL"; }

# rcedit은 윈도우 프로그램이라 인자도 윈도우 경로로 줘야 한다.
WIN_EXE=$(wslpath -w "$(realpath "$EXE")")
WIN_ICO=$(wslpath -w "$(realpath "$ICO")")
"$RCEDIT" "$WIN_EXE" --set-icon "$WIN_ICO"
echo "아이콘 적용 완료: $EXE ← $ICO"
echo "⚠️ 윈도우 탐색기가 옛 아이콘을 캐시해 안 바뀐 것처럼 보일 수 있다(파일명 바꿨다 되돌리거나 탐색기 재시작)."
