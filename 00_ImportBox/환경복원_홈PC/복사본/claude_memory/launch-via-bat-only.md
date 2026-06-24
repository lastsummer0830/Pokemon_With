---
name: launch-via-bat-only
description: 사용자가 더블클릭하는 본체는 Pokemon With.exe — 코드 고치면 매번 npm run app:build로 다시 구워줘야 함
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b
---

사용자가 생각하는 "실행 프로그램 본체"는 **`myPokemon_AJ/build_win/win-unpacked/Pokemon With.exe`** (어나더레드 Game.exe에 해당하는 Electron 패키징 독립 실행파일). 사용자는 항상 이 exe를 더블클릭한다. **이 위치·파일을 본체로 고정**하고 다른 실행법으로 말 바꾸지 말 것.

**핵심 함정:** 이 exe는 패키징 스냅샷이라 **코드를 고쳐도 다시 굽기 전까진 안 바뀐다.** 따라서 코드 변경 후에는 **반드시 `npm run app:build`(= vite build + electron-builder)로 exe를 다시 구워**서 최신으로 만들어 줘야 한다. 굽는 단계를 빼먹으면 사용자는 옛날 화면을 보고 "안 바뀐다"며 분노한다(실제 발생).

`게임실행.bat`(= `npm run app`)은 개발자가 빠르게 미리보는 dev 모드일 뿐 — 사용자에게 "이걸로 실행하라"고 권하지 말 것. 사용자는 exe 하나만 누른다.

**Why:** 세션마다 실행법을 다르게(어제는 exe, 오늘은 bat) 안내해서 사용자가 크게 분노. "exe 쓰지 마라"는 안내는 틀렸음 — exe가 본체가 맞다.

**굽는 명령(중요):** WSL에서 그냥 `electron-builder`를 돌리면 **리눅스 타겟**을 굽는다(헛수고). 반드시 **`npx electron-builder --win --x64`**(또는 dist까지: `npm run build && npx electron-builder --win --x64`)로 윈도우 타겟을 굽는다. (`win.target=dir`, `signAndEditExecutable:false`라 wine 없이도 win-unpacked 생성됨.)

**굽기 전 게임을 반드시 닫을 것:** 게임(`Pokemon With.exe`)이 켜져 있으면 `build_win/win-unpacked/d3dcompiler_47.dll` 등이 잠겨 `unlinkat ... input/output error`로 빌드 실패한다. 굽기 전 PowerShell로 종료: `powershell.exe -NoProfile -Command "Get-Process -Name 'Pokemon With' -ErrorAction SilentlyContinue | Stop-Process -Force"`.

**How to apply:** 코드 수정 끝 → (게임 켜져있으면 종료) → `npm run build && npx electron-builder --win --x64` → exe 빌드 시각이 오늘로 갱신됐는지 확인 후 "그 exe 더블클릭하세요" 안내. 절대 실행 진입점을 매번 바꾸지 말 것. [[mypokemon-project]]
