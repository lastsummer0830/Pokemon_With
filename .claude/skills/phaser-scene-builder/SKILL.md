---
name: phaser-scene-builder
description: Phaser Scene 구조와 전환을 현재 코드에 맞게 만든다. 트리거 — "새 화면 만들어", "씬 추가해", "화면 넘어가게", "전환이 이상해", "돌아오면 상태가 날아가", scene 등록·수명주기·데이터 전달. src/main.ts의 현재 등록 상태를 먼저 확인한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, phaser, scene, lifecycle]
---

# Phaser Scene Builder

현재 등록된 Scene과 Phaser lifecycle을 기준으로 새 scene 또는 전환을 최소 범위로 구현한다.

## When to Use
- 새 Scene, scene transition, overlay, resize, camera, 입력 lifecycle을 추가할 때.
- 재진입 후 busy·sprite·callback 상태가 남는 문제를 고칠 때.
- 기존 Scene 내부의 작은 기능 변경만이면 해당 도메인 Skill을 우선한다.

## Required Inputs
- `scene`: 새 scene key 또는 수정할 현재 key.
- `entry`: 어느 scene·입력·data에서 들어오는지.
- `exit`: 성공·취소·패배 등 각 종료 경로.
- `acceptance`: 재진입과 resize를 포함한 관찰 조건.

## Procedure
1. `src/main.ts`의 실제 scene 등록과 인접 scene의 data 계약을 읽는다.
2. `preload`, `init`, `create`, `update`, `shutdown` 책임을 분리하고 재사용 인스턴스 상태는 `init`에서 리셋한다.
3. scene data와 registry의 소유권을 정하고 일회성 플래그가 전역으로 새지 않게 한다.
4. 입력 listener·timer·async callback이 재진입 후 중복되지 않게 정리한다.
5. 픽셀 scene은 roundPixels와 texture filter를 기존 인접 scene과 맞춘다.
6. 재현이 길면 `DebugMenuScene`과 `src/data/debugChecks.ts`에 한 개의 짧은 진입점을 둔다.
7. `build-run-debug`으로 진입·종료·재진입·resize를 검증한다.

## Cost Limits
- 한 번에 scene 1개 또는 transition 1개.
- 인접 scene 변경은 data 계약에 필요한 최소 파일만.
- renderer 캡처 최대 3장, surface 1개.

## Verification
- 정상·취소·재진입 경로의 active scene과 전달 data를 확인한다.
- listener·timer·sprite 중복과 console/page error가 없는지 확인한다.
- renderer에서 resize·camera·depth를 직접 확인한다.
- `npm run build` 결과를 기록한다.

## Pitfalls
- 클래스 필드 초기화가 scene 재시작마다 다시 돈다고 가정하지 않는다.
- 등록되지 않은 scene key나 오래된 문서의 scene 목록을 사용하지 않는다.
- 긴 정상 흐름을 무조건 dev 우회로 대체하지 않는다.
