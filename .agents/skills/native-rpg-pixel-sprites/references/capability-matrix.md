# Capability Matrix

PWH-006은 subtype별 계약을 가진 **하나의 capability**다. Trainer front는 첫 bounded spike일 뿐이며, 나머지 항목을 이 spike로 축소하지 않는다.
한 작업은 아래에서 **정확히 하나**를 고른다. 표의 "산출 형태"는 형태 설명이며 만능 치수가 아니다. 실제 숫자는 그 작업에서 고른 exact 원본을 측정해 정한다.

| # | subtype | 산출 형태 | 필수 측정 |
|---|---|---|---|
| 1 | `character-overworld` | Character 4x4 오버월드 16칸 시트 | frame grid, 칸 크기, 칸별 bbox, alpha family, 논리 격자 |
| 2 | `trainer-front` | Trainer front 배틀 정면 1포즈 | canvas, bbox, baseline, alpha family, 논리 격자, 색 수 |
| 3 | `trainer-back` | Trainer back 공 던지기 5 frames 시트 | frame 수·칸 크기, frame별 bbox, 프레임 간 anchor 이동 |
| 4 | `item` | Item 아이콘 1개 | canvas, bbox, alpha family, 색 수 |
| 5 | `vs-bar` | VS Bar 팔레트 재색칠 | 원본 구조 보존, 색 매핑 표, canvas·frame 동일성 |
| 6 | `vs-portrait-left` | VS portrait-left 반신 | canvas, crop, bbox, 좌측 배치 anchor |
| 7 | `vs-portrait-right` | VS portrait-right 반신 | canvas, crop, bbox, 우측 배치 anchor |
| 8 | `vs-composition` | VS composition: bar + 양쪽 portrait + 가운데 VS | 각 레이어 canvas·배치 좌표, 합성 결과 canvas |
| 9 | `background-removal` | background removal (alpha만 변경) | 변경 전후 canvas·visible bbox·색 수, alpha family 전이 |
| 10 | `format-conversion` | format conversion과 기술 검증 | canvas/frame, 논리 픽셀, run/cluster, contour, alpha, 팔레트, bbox/baseline/anchor, 1× 가독성, runtime 렌더 |

## 항목별 고정 규칙

- **Character 4x4**: 4방향 × 4프레임 배치를 임의로 재배열하지 않는다. frame grid는 호출자가 명시한다.
- **Trainer front**와 **Trainer back**은 독립 작업이다. front에서 back을 추론하거나 back의 한 frame을 front로 쓰지 않는다.
- **Trainer back** 5 frames는 프레임 수를 측정으로 확인하고, 5라는 숫자를 다른 시트에 상속하지 않는다.
- **Item**은 사용자가 고른 exact 원본 아이템 파일을 기준으로만 만든다.
- **VS Bar**는 결정론적 팔레트 재색칠이다. 구조·형태·frame을 다시 생성하지 않는다.
- **portrait-left**와 **portrait-right**는 각각 만든다. 한쪽을 좌우 반전해 다른 쪽을 지어내지 않는다.
- **VS composition**은 이미 승인된 레이어만 합성한다. 합성 단계에서 레이어를 새로 생성하지 않는다.
- **background removal**은 alpha만 바꾼다. 캐릭터를 다시 그리거나 실루엣을 고치지 않는다.
- **format conversion**은 확대·축소를 포함하지 않는다. 미리보기 확대는 정수배 nearest 전용이며 산출물이 아니다.

## 검증 축 (모든 subtype 공통)

기술 축은 `scripts/analyze_native_pixel.py` + `scripts/validate_asset.py`로 판정한다.
시각 축(1× 가독성), 사용자 채택, runtime 렌더는 기계 판정 대상이 아니며 `qa-contract.md`의 별도 상태로 관리한다.
