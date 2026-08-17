---
name: save-state-system
description: 세이브 스키마·마이그레이션·복원을 회귀 검증한다. 트리거 — "저장", "불러오기", "이어하기", "세이브 깨졌어", "슬롯 추가해", 세이브 필드 추가·변경. 기존 세이브 호환을 깨지 않는지 실제 로드까지 확인한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, save, migration, localstorage]
---

# Save State System

현재 save schema의 직렬화·마이그레이션·slot 복원을 실제 game state와 화면에서 검증한다.

## When to Use
- 저장 필드·slot·autosave·migration·이어하기를 변경할 때.
- party·bag·houseLayout·story switch·badge·위치 복원이 깨질 때.
- 설정값만 다룰 때는 `src/systems/settings.ts`의 별도 저장 경계를 확인한다.

## Required Inputs
- `schema_change`: 추가·변경할 필드와 기본값.
- `source_version`: 재현할 이전 save version 또는 빈 저장.
- `destination`: load 후 기대 scene·좌표·registry 상태.
- `slots`: 영향을 받는 자동/수동 slot 범위.

## Procedure
1. `src/systems/save.ts`에서 현재 `SAVE_VERSION`, slot key, 직렬화 필드와 migration 순서를 읽는다.
2. 기존 필드를 제거하지 말고 새 필드의 하위 호환 기본값과 version 전환을 먼저 정의한다.
3. 브라우저의 실제 사용자 localStorage를 덮지 않도록 격리된 context와 고정 fixture를 사용한다.
4. 이전 version fixture를 저장하고 load한 뒤 party·bag·houseLayout·story·badge·위치를 확인한다.
5. 저장→새 context→이어하기를 거쳐 같은 상태가 복원되는지 확인한다.
6. `SaveSlotScene`에서 빈 slot, 내용 있는 slot, 저장 대상 문구를 실제 입력으로 확인한다.
7. `build-run-debug`으로 화면·runtime·build 증거를 남긴다.

## Cost Limits
- 한 번에 migration 경로 1개 또는 save 필드 묶음 1개.
- 대표 slot 최대 3개.
- 실제 사용자 저장 변환·삭제는 별도 승인 대상.

## Verification
- source/destination version과 migration 전후 JSON의 핵심 필드를 기록한다.
- 저장 후 새 browser context에서 복원됨을 확인한다.
- slot 화면과 복원 scene/좌표를 renderer로 확인한다.
- console/page error와 `npm run build` 결과를 기록한다.

## Pitfalls
- TypeScript interface 변경만으로 localStorage 데이터가 자동 migration된다고 가정하지 않는다.
- 필드 누락과 falsy 값 0/false를 같은 것으로 처리하지 않는다.
- 테스트 중 실제 사용자 save key를 지우지 않는다.
