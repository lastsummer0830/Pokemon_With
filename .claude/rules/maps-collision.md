---
paths:
  - "**/src/data/region.ts"
  - "**/src/scenes/WorldScene.ts"
  - "**/src/scenes/BuildingScene.ts"
  - "**/src/scenes/InteriorScene.ts"
  - "**/src/scenes/BedroomScene.ts"
  - "**/src/scenes/LabScene.ts"
  - "**/src/scenes/GymScene.ts"
  - "**/tools/ar-map/**"
  - "**/public/assets/world/**"
---

# 맵·충돌 규칙

- 맵·blocked·warp·depth 변경은 `tiled-map-grid-movement` Skill을 사용한다.
- 화면 눈대중으로 tile 좌표를 만들지 말고 원본 grid·extractor·좌표 변환을 근거로 한다.
- 캐릭터가 지붕·벽·가구에 겹치면 발 tile, sprite origin, blocked, overlay depth를 분리해 확인한다.
- 완료 전 정상 입력으로 통과 tile과 차단 tile을 각각 주행한다.
- renderer 캡처, 이동 전후 player tile, parity/passability, console, build 결과를 남긴다.
