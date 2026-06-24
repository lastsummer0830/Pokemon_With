---
name: save-state-system
description: 저장·불러오기 기능을 만들 때 사용. save, load, localStorage, player progress, party, houseLayout, migration, 세이브 버전 관련 작업. "저장 기능", "세이브 깨졌어", "이어하기" 같은 요청에 발동.
---

# 저장 / 불러오기

> 작업 전 `myPokemon_AJ/AGENTS.md` §3을 먼저 읽는다.

## 역할 분리
- **저장 계산·검증·직렬화**: `src/systems/save.ts`.
- **저장 데이터 타입**: `src/data/` (`Player.ts`, `Pokemon.ts`, `HouseLayout.ts` 등 기존 타입 재사용).
- 저장 단위를 분리: `player`, `party`, `houseLayout`, `progress`.

## 필수 규칙
- **세이브 버전 필드**(`version`)를 반드시 둔다. 구조가 바뀌면 버전 올리고 migration 함수 추가.
- **깨진 세이브 방어**: 파싱 실패·필드 누락·버전 불일치 시 안전하게 복구하거나 초기화(절대 크래시 금지).
- `localStorage` key를 한 곳에서 상수로 관리(예: `mypokemon:save:v1`). 흩뿌리지 말 것.

## 절차
1. 타입에 맞는 직렬화/역직렬화 함수를 `save.ts`에 작성.
2. 저장: 현재 상태 → 검증 → JSON → localStorage. 불러오기: 읽기 → 버전 확인 → migration → 검증 → 상태 복원.
3. 초기화/리셋 경로 제공.

## 검증
- 저장 → 새로고침 → 복원되는지 확인.
- 일부러 손상된 JSON을 넣어 복구/초기화 동작 확인.
- `npx tsc --noEmit`로 타입 일치 확인.
