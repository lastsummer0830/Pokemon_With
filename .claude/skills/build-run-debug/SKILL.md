---
name: build-run-debug
description: 게임을 빌드·실행하거나 화면이 안 바뀔 때·에러날 때 디버깅하는 스킬. npm run dev/build/app, Vite, Electron, 게임실행.bat, PokemonWith.exe 재빌드(WSL은 asar repack), localhost:5180, playtest, screenshot, WSL/Windows 실행차이, console error, build failed. 트리거 예: "실행해줘/앱으로 켜봐/게임 켜줘", "빌드 안 돼/왜 안 떠", "화면이 안 바뀌어", "exe 다시 구워줘", "스크린샷 찍어봐".
---

# 빌드 · 실행 · 디버그 (Vite + Electron, WSL/D드라이브)

> 작업 전 `myPokemon_AJ/AGENTS.md` §2(실행·함정)을 먼저 읽는다.

## 실행 명령
- 개발: `npm run dev` → http://localhost:5180 (포트 고정 5180, 5173 아님).
- 빌드: `npm run build` (= `tsc && vite build`). 타입만: `npx tsc --noEmit`.
- 데스크톱 앱: `npm run app` (dev서버 + Electron 한 번에, 창 닫으면 둘 다 종료). 진입점 `electron/main.cjs`.
- 초보자용: 폴더의 **`게임실행.bat` 더블클릭**(Windows) — 이 실행 경로는 유지한다.
- .exe 패키징: `npm run app:build`.

## 🔴 D드라이브/WSL 함정 (몇 시간 날린 것)
- 이 프로젝트는 `/mnt/d`에 있어 WSL inotify 파일 감지가 **안 됨**. 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`** 가 있다. **절대 삭제 금지.** 지우면 코드 고쳐도 화면 반영 안 되는데 서버 curl엔 새 코드가 보여서 디버깅이 미궁에 빠진다.
- 코드 수정 후 화면이 안 바뀌면 → 브라우저 **`Ctrl+Shift+R`**(강력 새로고침) 한 번.
- `localhost`는 윈도우 `wslrelay.exe`가 WSL 서버로 포워딩(정상).

## Electron / WSL
- WSLg에서 WebGL 막히면 `electron/main.cjs`의 `ignore-gpu-blocklist`/`enable-unsafe-swiftshader` 플래그가 풀어줌(실제 윈도우엔 영향 없음). WSL 실행 시 `--no-sandbox` 필요할 수 있음.
- ⚠️ `npm install` 시 Electron 본체(~216MB) 504 뜨면 미러: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`.
- Electron 수정은 일반 Vite 설정과 충돌하지 않게.

## 디버깅 절차
1. 재현 조건을 먼저 적는다(어떤 화면/입력에서).
2. `npm run dev` 콘솔 + 브라우저 콘솔 에러 확인. 에셋 404면 `curl -s -I http://localhost:5180/assets/<경로>`.
3. 화면 미반영 의심 → 먼저 Ctrl+Shift+R, 그래도 안 되면 usePolling 살아있는지 확인.
4. 빌드 실패 → `npx tsc --noEmit`로 타입 에러부터.
5. 로컬 실행 확인이 필요하면 빌트인 `run`/`verify` skill 활용(캔버스라 스크린샷 위주, DOM 쿼리는 제한적).

## 검증/기록
- 수정 전후 **재현 조건과 검증 결과**를 남긴다. "고쳤다"는 실제 실행으로 확인 후에만.
