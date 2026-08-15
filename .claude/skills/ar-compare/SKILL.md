---
name: ar-compare
description: AR 원본과 게임 렌더를 픽셀 단위로 대조한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, visual-qa, pixel-diff]
---

# AR Pixel Comparison

Another Red 원본과 Pokemon_With의 Phaser 렌더를 수치와 이미지로 대조한다. 정지 화면만 보고 동작·충돌까지 같다고 결론내리지 않는다.

## When to Use
- 원본과 같아 보이는지, 좌표·색·크기 차이를 확인할 때.
- 맵·UI·스프라이트·애니메이션 이식 결과를 검증할 때.
- 단순 기능 테스트만 필요한 경우에는 `build-run-debug`을 사용한다.

## Required Inputs
- `target`: 비교할 화면 요소와 허용 가능한 차이.
- `mine`: `renderer.snapshot()`으로 얻은 현재 게임 캡처.
- `reference`: 사용자 제공 또는 승인된 원본 이미지 경로.
- `normalization`: 크기·crop·애니메이션 프레임 정렬 방법.

## Procedure
1. `build-run-debug` 계약으로 목표 scene을 재현하고 유효한 renderer 캡처를 만든다.
2. 외부 AR 설치 경로를 추정하지 말고 사용자 제공 경로나 저장소의 승인된 reference를 확인한다.
3. 크기와 crop을 맞춘 뒤 `myPokemon_AJ/tools/imgdiff.mjs`로 diff·blend·heatmap을 생성한다.
4. 생성 이미지를 직접 열어 위치·색·크기·누락 요소를 구체적으로 기록한다.
5. 애니메이션이면 같은 프레임 또는 같은 위상끼리 비교하고, 위상 차이를 구현 차이로 세지 않는다.

## Cost Limits
- 한 번에 target 1개와 이미지 쌍 1개.
- 결과 이미지는 원본·현재·diff를 포함해 최대 3장.
- 대량 에셋 전수 비교는 별도 승인 후 수행한다.

## Verification
- 캡처가 검거나 비어 있지 않은지 확인한다.
- 크기 일치 여부와 diff 수치를 기록한다.
- 수치뿐 아니라 blend/heatmap을 직접 보고 주요 차이를 나열한다.
- 동작 acceptance가 있으면 별도로 실제 입력과 scene 상태를 확인한다.

## Pitfalls
- `page.screenshot()`만으로 Phaser canvas를 검증하지 않는다.
- 외부 AR 경로와 파일 이름의 대소문자를 추정하지 않는다.
- 시간대·날씨·애니메이션 위상을 맞추지 않은 비교는 무효다.
