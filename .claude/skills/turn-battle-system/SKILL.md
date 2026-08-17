---
name: turn-battle-system
description: 배틀 규칙·상태·연출을 결정론적으로 구현·검증한다. 트리거 — "배틀 제대로 짜줘", "데미지 계산 붙여", "타입 상성 넣어", "기술 추가", "포획 확률", "전투 만들어줘", 배틀 텍스트·연출. 난수는 주입 가능하게 두고 재현 가능한 수치로 확인한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, battle, deterministic-qa]
---

# Turn Battle System

배틀 순수 계산과 Phaser 연출 경계를 유지하며 한 mechanic을 결정론적 결과와 실제 화면으로 검증한다.

## When to Use
- 데미지·명중·상성·상태이상·랭크·포획·교체·승패 처리를 변경할 때.
- BattleScene·battleView·기술/Common 애니메이션을 연결할 때.
- 집 유대 계산 자체는 `home-bonus-system`을 사용한다.

## Required Inputs
- `mechanic`: 변경할 규칙 또는 연출 하나.
- `cases`: 정상·경계·실패를 포함한 고정 입력과 기대값.
- `rng`: 난수 주입값 또는 고정 시퀀스.
- `scene`: 실제 화면에서 재현할 battle data와 입력.

## Procedure
1. `src/systems/battle.ts`, `status.ts`, `stages.ts`, `bond.ts` 중 mechanic의 단일 원천을 확인한다.
2. 데이터는 `src/data/ar`와 `Pokemon.ts`, 표시는 `BattleScene.ts`와 `battleView.ts`의 경계를 유지한다.
3. 난수원을 주입해 같은 입력이 같은 데미지·명중·상태 결과를 내도록 한다.
4. 최소 3개 case로 정상·면역/상한·실패 또는 경계를 계산한다.
5. Scene은 계산 결과를 소비하고 수식을 다시 구현하지 않게 한다.
6. 긴 상황은 `debugChecks.ts`의 battle demo로 한 mechanic만 바로 재현한다.
7. `build-run-debug`으로 입력, 메시지, HP/상태 변화, 애니메이션, console, build를 검증한다.

## Cost Limits
- 한 번에 mechanic 1개.
- 결정론적 case 최대 3개와 battle scene 1개.
- 애니메이션 캡처 최대 3장.

## Verification
- 입력 stats·move·rng와 실제 계산 결과를 기록한다.
- HP·PP·status·stage의 전후 상태를 확인한다.
- renderer에서 메시지 순서·target·animation·bar 변화를 직접 본다.
- console/page error와 `npm run build` 결과를 기록한다.

## Pitfalls
- random 결과 한 번을 공식 검증으로 사용하지 않는다.
- 계산과 Scene 연출 양쪽에 같은 규칙을 중복하지 않는다.
- animation 성공을 mechanic 적용 성공으로 착각하지 않는다.
