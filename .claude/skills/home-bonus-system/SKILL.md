---
name: home-bonus-system
description: 집 꾸미기부터 유대와 배틀 보너스까지 검증한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, home, bond, battle]
---

# Home Bonus System

Pokemon_With의 차별점인 가구 배치→휴식 상한→유대→배틀 보너스를 한 흐름으로 구현하고 증명한다.

## When to Use
- 가구·방 꾸미기·잠자기·유대 상한·타입 affinity를 변경할 때.
- 집 효과가 세이브되거나 배틀 계산에 반영되지 않는 문제를 고칠 때.
- 일반 배틀 규칙만 바꿀 때는 `turn-battle-system`을 사용한다.

## Required Inputs
- `furniture`: 대상 가구와 comfort/affinity 기대값.
- `pokemon`: 비교할 타입과 시작 condition.
- `flow`: 배치→잠자기→배틀에서 보일 acceptance.
- `save_case`: 배치를 저장·복원해야 하는지 여부.

## Procedure
1. `src/data/furniture.ts`, `HouseLayout.ts`, `src/scenes/InteriorScene.ts`의 현재 배치·충돌·표시 경계를 확인한다.
2. `src/systems/homeBonus.ts`와 `bond.ts`에서 상한·증가·배율의 단일 원천을 확인한다.
3. `src/systems/battle.ts`가 유대 계산을 읽기만 하고 가구 규칙을 중복하지 않게 한다.
4. 같은 시작 condition에서 affinity 일치/불일치 포켓몬의 상한과 휴식 결과를 결정론적으로 비교한다.
5. 가구로 출구·침대 경로를 막지 않는지 `InteriorScene`의 연결성 검사와 실제 이동으로 확인한다.
6. 저장 대상이면 `save-state-system` 계약으로 houseLayout 복원을 확인한다.
7. `build-run-debug`으로 꾸민 방, 휴식 결과, 배틀 효과를 실제 화면에서 재현한다.

## Cost Limits
- 한 번에 가구 1개 또는 보너스 규칙 1개.
- 포켓몬 비교는 affinity 일치/불일치 각 1마리.
- renderer 캡처 최대 3장, surface 1개.

## Verification
- 순수 계산의 before/cap/after와 배틀 배율을 기록한다.
- 방에서 가구 위치·cursor·이동 경로를 renderer와 실제 입력으로 확인한다.
- 휴식 결과와 배틀에서 관찰 가능한 차이를 확인한다.
- console/page error와 `npm run build` 결과를 기록한다.

## Pitfalls
- `condition`과 화면 문구의 유대 표현을 별도 값으로 만들지 않는다.
- affinity 문자열은 species type 표기와 정확히 맞춘다.
- 한 번의 잠자기만으로 상한 차이가 드러나지 않으면 시작값을 통제한다.
