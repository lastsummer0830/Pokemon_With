---
name: turn-battle-system
description: 턴제 배틀 시스템을 만들 때 사용. battle, move selection, damage calculation, type effectiveness, Pokemon stat, enemy Pokemon, battle state machine, battle text box, Back 스프라이트 관련 작업. "배틀 제대로 짜줘", "데미지 계산", "타입 상성" 같은 요청에 발동.
---

# 턴제 배틀 시스템

> 작업 전 `myPokemon_AJ/AGENTS.md` §3·§6을 먼저 읽는다.

## 역할 분리 (섞지 말 것)
- **계산·규칙**: `src/systems/battle.ts` (데미지, 상성, 턴 진행).
- **데이터 타입**: `src/data/Pokemon.ts` (포켓몬/기술/스탯/상태 타입).
- **화면**: `src/scenes/BattleScene.ts` — 입력·연출·텍스트박스·스프라이트 표시 중심. 계산 로직을 Scene에 넣지 않는다.
- **스탯 출처**: PokeAPI 스탯(`src/api/pokeapi.ts`)과 로컬 데이터의 경계를 명확히. 어디까지 PokeAPI에서 받고 어디부터 로컬 보정인지 주석으로.

## 상태머신
배틀을 명시적 상태로 분리: `시작 → 행동선택 → (내/적)공격 처리 → 결과/연출 → 다음턴 or 종료`. 각 전이를 함수/상태값으로. Scene은 현재 상태에 맞는 화면만 그린다.

## 스프라이트
- 적/내 포켓몬: Another Red Front(애니) = `pokemonSprite.ts`의 `makeAnimatedFront()`.
- 내 포켓몬 **Back**이 필요하면 `node tools/import-from-anotherred.mjs "<AR경로>" back`로 먼저 가져온다(`pokemon-asset-pipeline` 참고).
- 도트는 `setFilter(NEAREST)`.

## homeBonus 연동
- 집 꾸미기 보너스는 `src/systems/homeBonus.ts`에서 계산된 값을 배틀이 **읽기만** 한다. 배틀 안에서 가구 로직을 재구현하지 말 것. 경계는 `home-bonus-system` 참고.

## 체크리스트 / 검증
- 데미지 공식·상성표는 systems에, 매직넘버는 상수로.
- any 남발 금지, 한국어 주석으로 공식 설명.
- `npx tsc --noEmit`로 타입 확인 후 `npm run dev`로 실제 배틀 플레이.
