---
name: tiled-map-grid-movement
description: AR 맵·격자 이동·충돌·워프를 좌표로 검증한다. 트리거 — "맵 붙여줘", "충돌 막아", "문으로 들어가게", "벽을 통과해", "이동이 이상해", 격자·terrain tag·워프 좌표. 화면 눈대중으로 좌표를 찍지 말고 원본 격자와 실제 이동 결과로 확인한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, map, collision, grid-movement]
---

# Map Collision QA

AR 맵 데이터와 현재 region 좌표를 근거로 격자 이동·blocked·warp·depth를 구현하고 실제 주행으로 검증한다.

## When to Use
- 야외·실내 맵, 충돌, 문, 계단, 언덕, warp, overlay를 변경할 때.
- 캐릭터가 지붕·벽·가구 위로 올라가거나 문 앞 좌표가 어긋날 때.
- 대사·스토리 분기만 바꿀 때는 `field-event-pipeline`을 사용한다.

## Required Inputs
- `map`: 현재 map key와 원본 map id.
- `coordinates`: 원본 local 좌표와 현재 scene/region 좌표 변환.
- `movement`: 시작 tile, 입력 순서, 기대 도착/차단 tile.
- `visual`: 지붕·문·overlay·sprite 발 위치 acceptance.

## Procedure
1. `src/data/region.ts`, 대상 scene, 현재 map JSON/PNG와 실제 loader를 읽는다.
2. 원본 데이터 경로는 사용자 제공값으로 확인하고 `tools/ar-map/`의 기존 extractor를 새로 만들지 말고 재사용한다.
3. blocked·grass·terrain·warp 좌표를 화면 눈대중으로 입력하지 않고 원본 grid와 extractor 결과에서 생성한다.
4. local↔region 좌표 변환을 map 이름과 함께 기록하고 경계 양쪽 값을 확인한다.
5. 캐릭터 발 tile, sprite origin, overlay depth를 분리해 지붕·벽 겹침이 충돌 문제인지 depth 문제인지 판정한다.
6. 정상 입력으로 통과 tile과 차단 tile을 각각 주행하고 이동 전후 좌표를 수집한다.
7. `tools/ar-map/audit-parity.py`와 관련 passability 도구의 현재 대상·옵션을 읽은 뒤 필요한 범위만 검사한다.
8. `build-run-debug`으로 실제 이동, 좌표, renderer, console, build를 검증한다.

## Cost Limits
- 한 번에 map 1개 또는 transition 1개.
- 주행 경로는 정상 1개와 차단 1개.
- renderer 캡처 최대 3장, surface 1개.

## Verification
- 원본 local 좌표와 현재 global/scene 좌표를 함께 기록한다.
- 입력 전후 player tile과 blocked/warp 판정을 확인한다.
- 지붕·문·가구와 캐릭터 발 위치·depth를 renderer에서 직접 본다.
- parity/passability 결과, console/page error, `npm run build`를 기록한다.

## Pitfalls
- 화면 중심점이나 sprite 머리 위치를 player tile로 착각하지 않는다.
- map PNG가 비슷하다는 이유로 다른 map JSON을 수정하지 않는다.
- cache 문제를 충돌 좌표 문제로 오진하지 않는다.
