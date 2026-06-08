@echo off
chcp 65001 >nul
cd /d "%~dp0"
title myPokemon

REM 최초 1회: 패키지가 없으면 자동 설치
if not exist node_modules (
  echo ============================================
  echo  [최초 1회] 패키지 설치 중... 몇 분 걸려요
  echo  (Electron 다운로드가 멈추면 이 창 닫고 다시 실행)
  echo ============================================
  call npm install
)

echo.
echo  게임 실행 중... 잠시 후 창이 떠요. 끄려면 이 검은 창을 닫으세요.
echo.
call npm run app

pause
