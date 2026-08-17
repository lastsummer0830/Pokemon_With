---
name: build-run-debug
description: 게임 실행·입력·화면·console·build를 검증한다. 트리거 — "실행해줘", "게임 켜봐", "앱으로 켜봐", "빌드 안 돼", "왜 안 떠", "화면이 안 바뀌어", "exe 다시 구워줘", "스크린샷 찍어봐", console error. dev는 5180 포트, exe 갱신은 app:bake.
version: 1.1.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, game-runtime-qa, phaser, playwright]
---

# Game Runtime QA

Pokemon_With의 한 surface와 한 목표 흐름을 실제 입력으로 재현하고 화면·runtime·build 증거를 함께 남긴다. 실행하지 않은 항목은 완료로 쓰지 않는다.

## When to Use
- 게임 실행, 빌드, 화면 미반영, console error, 입력·scene 동작 확인.
- 맵·충돌·UI·에셋·애니메이션 변경의 실제 화면 acceptance 검증.
- bake·installer 생성만 필요한 경우에는 별도 승인을 먼저 받는다.

## Required Inputs
- `surface`: `web` 또는 `electron` 하나.
- `scene`: `src/main.ts`에 현재 등록된 목표 scene 또는 한 개의 사용자 흐름.
- `acceptance`: 입력 순서와 화면·상태에서 관찰할 성공 조건.

## Procedure
1. `myPokemon_AJ/package.json`, `vite.config.ts`, `src/main.ts`를 다시 읽어 현재 script·포트·scene을 확정한다.
2. web은 `npm run dev`, electron은 `npm run app`으로 실행한다. web 주소는 현재 Vite 설정의 `5180` 포트다.
3. 포트 또는 HTTP 응답으로 준비 상태를 확인한다. 자신이 시작하지 않은 서버는 종료하지 않는다.
4. `tools/*.mjs`에서 가장 가까운 JavaScript Playwright 절차를 재사용한다. 날짜가 붙은 기대값은 현재 코드와 대조한다.
5. Chromium의 `console` error와 `pageerror`를 수집하고 목표 scene의 준비 상태까지 기다린다.
6. 정상 사용자 입력을 우선한다. 긴 선행 흐름만 기존 DebugMenu 또는 dev 전용 `window.__game.scene.start`로 건너뛰고 우회 data를 기록한다.
7. Phaser 화면은 `tools/_snap.mjs`의 `renderer.snapshot()`으로 캡처하고 이미지를 직접 확인한다.
8. 맵·충돌 acceptance는 화면뿐 아니라 플레이어 타일 좌표, 이동 전후 좌표, blocked/warp 결과를 함께 확인한다.
9. QA 뒤 자신이 시작한 process를 종료하고 `npm run build`를 실행한다.

## Cost Limits
- surface 1개, 목표 scene 또는 흐름 1개.
- 실패 재시도 최대 2회, renderer 캡처 최대 3장.
- `app:bake`, `app:build`, 패키지 설치, 두 번째 surface는 별도 승인 대상.

## Verification
- **화면:** renderer 캡처에서 acceptance의 관찰 지점을 직접 확인한다.
- **runtime:** 입력·scene·좌표·상태와 console/page error 결과를 기록한다.
- **build:** `npm run build`의 실제 종료 코드를 기록한다.
- 명령, 사용한 script, 캡처 경로, 우회 data, 재시도 횟수와 미검증 항목을 보고한다.

## Pitfalls
- build 성공은 Phaser canvas와 입력 회귀의 증거가 아니다.
- 검은 화면·빈 화면·오래된 캡처는 증거로 인정하지 않는다.
- `window.__game`은 dev 전용이며 배포 surface에 있다고 가정하지 않는다.
- 일반 웹사이트용 Python Playwright helper 대신 프로젝트의 JavaScript 도구를 사용한다.
- Claude를 `myPokemon_AJ`에서 시작하면 저장소 root의 `.claude/.verify/*.png`는 primary working directory 밖이라 Read가 거부된다. 대화 중에는 `/add-dir ..`, 단발 실행은 `--add-dir ..`로 상위 directory를 먼저 추가한 뒤 캡처를 읽는다.
- `permissions.additionalDirectories: [".."]`로 고정하지 않는다. 같은 설정이 repository root에서 시작할 때는 부모 directory 전체를 과하게 허용한다.
