---
paths:
  - "**/vite.config.ts"
  - "**/electron/**"
  - "**/package.json"
  - "**/tools/bake-exe.sh"
---

# ▶️ 실행·빌드·굽기 (STOP 체크리스트)

> 정본: `myPokemon_AJ/AGENTS.md` §2.

1. **`vite.config.ts`의 `server.watch.usePolling: true` 절대 지우지 말 것.** /mnt/d(WSL)는 inotify 안 됨 → 지우면 코드 고쳐도 화면 반영 안 되고 디버깅 미궁.
2. 실행: `npm run dev` → **http://localhost:5180** (포트 고정). 화면 안 바뀌면 `Ctrl+Shift+R`.
3. **exe 본체 = `build_win/win-unpacked/PokemonWith.exe`.** 코드 고쳐도 **굽기 전까진 exe에 반영 안 됨** — "빌드만 하고 끝" 금지.
4. **평상시 굽기 = `npm run app:bake`**(dist만 교체, 빠름). ⚠️ `app:build`는 WSL 리눅스타겟 헛수고. 굽기 전 PokemonWith.exe 종료(dll 잠김).
5. 자주 굽지 말 것 — dev로 모아 확인 후 체크포인트마다 1회.
6. 커밋은 tsc 훅 통과해야 함(타입에러 시 자동 차단 — 훅 무력화 금지).
7. **희귀 함정(막힐 때만):** ① `npm install`에서 Electron 본체(~216MB) 받다 `504` → 미러: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`(윈도우 CMD는 `set ELECTRON_MIRROR=...`). ② WSLg에서 WebGL 막히면 `electron/main.cjs`의 `ignore-gpu-blocklist`/`enable-unsafe-swiftshader`가 풀어줌(실윈도우 무영향), WSL 실행 시 `--no-sandbox` 필요할 수 있음. ③ 출력 폴더 = `build_win`(package.json `directories.output`과 일치, 우회용 `build_new`는 폐기). ④ 최상위·바탕화면 실행은 바로가기 `.lnk`(→ build_win exe). exe는 옆 dll·app.asar와 같이 있어야 하니 혼자 옮기면 깨짐. `*.lnk`는 .gitignore, 폴더명 바꾸면 재생성.
