---
name: game-ui-hud-polish
description: 포켓몬 UI를 원본 근거와 실제 렌더로 다듬는다. 트리거 — "UI 예쁘게", "메뉴 촌스러워", "간지나게", "글씨 잘려", 텍스트박스·HUD·가방·도감·박스 화면 손질. look이 갈리면 임의 확정 말고 실제 렌더 후보 2~3개를 Pick에 넣어 사용자가 고르게 한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, ui, hud, visual-qa]
---

# Game UI Visual QA

DS/HGSS 계열 픽셀 UI를 기억으로 지어내지 않고 승인된 원본 에셋·좌표와 실제 Phaser 렌더로 구현한다.

## When to Use
- 메뉴·가방·도감·상세·배틀 대화창·옵션·세이브 UI를 만들거나 다듬을 때.
- 폰트·여백·패널·cursor·가상 해상도·texture filter 문제를 고칠 때.
- 맵 배치나 충돌 작업에는 `tiled-map-grid-movement`를 사용한다.

## Required Inputs
- `scene`: 대상 UI scene과 진입 data.
- `reference`: 승인된 AR/HGSS 에셋 또는 화면.
- `acceptance`: 좌표·상태·입력·화면 크기에서 확인할 조건.
- `choice`: look이 갈릴 때 사용자에게 보여줄 후보 수와 차이 축.

## Procedure
1. 대상 scene과 실제 로드 에셋을 읽고 512×384 가상 좌표 사용 여부를 확인한다.
2. 승인된 원본 UI 에셋과 좌표를 먼저 확인하고, 존재하는 그래픽을 도형으로 다시 그리지 않는다.
3. 도트 텍스처에만 `NEAREST`를 적용하고 전역 pixel-art 설정으로 비픽셀 요소를 깨뜨리지 않는다.
4. 사용자 대사·이름 표기·선택 순서를 요청 없이 바꾸지 않는다.
5. look이 갈리면 실제 renderer 후보 2~3개를 같은 상태에서 캡처해 차이를 설명하고 선택을 받는다.
6. 선택안 구현 후 `build-run-debug` 계약으로 정상 입력, renderer, console, build를 검증한다.
7. 원본 재현 주장에는 `ar-compare`의 diff·blend 증거를 추가한다.

## Cost Limits
- 한 번에 UI scene 1개와 상태 1개.
- 후보 최대 3개, 최종 renderer 캡처 최대 3장.
- 전면 테마 교체나 다수 scene 동시 변경은 별도 목표로 나눈다.

## Verification
- 목표 상태와 cursor/선택 입력을 실제로 재현한다.
- 기본 창과 리사이즈 창에서 잘림·흐림·좌표 이탈을 확인한다.
- renderer 캡처를 직접 보고 reference와 다른 점을 구체적으로 적는다.
- console/page error와 `npm run build` 결과를 기록한다.

## Pitfalls
- DOM 웹앱 디자인 패턴을 Phaser canvas에 그대로 옮기지 않는다.
- 캡처 파일이 있다는 사실만으로 보았다고 간주하지 않는다.
- 비활성 hook이 검증을 대신해 준다고 가정하지 않는다.
