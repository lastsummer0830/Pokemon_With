---
name: field-event-pipeline
description: AR 필드·스토리 이벤트를 추출·구현·회귀 검증한다. 트리거 — "이벤트 넣어줘", "NPC 말 걸면", "팻말", "아이템볼", "열매나무", "오토런으로 말 걸어오게", "스토리 이벤트 붙여", 원본 이벤트 판독·이식·재도전 처리.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, story, field-events, rmxp]
---

# Field Event Pipeline

AR 맵 이벤트를 원본 page·trigger·switch 근거로 추출하고 Pokemon_With의 공용 runner와 debug QA에 연결한다.

## When to Use
- NPC·팻말·아이템·열매·상점·자동실행·스토리 배틀 이벤트를 추가할 때.
- self switch, global switch, choice, 승패 분기, event sprite refresh가 깨질 때.
- 맵 이미지·충돌 자체는 `tiled-map-grid-movement`를 사용한다.

## Required Inputs
- `source`: 원본 map id, event id, page와 좌표.
- `trigger`: 말걸기·접촉·자동실행·병렬 중 현재 원본 trigger.
- `branches`: switch/variable/self switch와 승리·패배 후 상태.
- `acceptance`: 입력, 대사, 이동, 배틀, 재진입에서 보일 결과.

## Procedure
1. `tools/ar-map/extract-events.py`의 현재 출력과 원본 event page를 읽고 event id·좌표·trigger·조건·명령을 기록한다.
2. `src/systems/mapEvents.ts`의 `partial` 표시는 지원하지 않는 분기가 있다는 증거이므로 임의로 지우지 않는다.
3. `fieldEventRunner.ts`의 기존 line type과 공용 실행 범위를 확인하고 새 opcode는 한 종류씩 최소 확장한다.
4. `WorldScene`과 `BuildingScene`이 공용 runner를 공유하도록 유지하고 scene 전용 복사본을 만들지 않는다.
5. 자동실행은 재진입 무한 반복을 막을 완료 switch와 busy lifecycle을 정의한다.
6. 배틀 이벤트는 승리·패배·재도전·비켜남·영구 상태를 각각 명시하고 return scene data를 확인한다.
7. 사용자 작성 대사와 첫 자기소개 전 이름 `???` 규칙을 보존한다.
8. `src/data/debugChecks.ts`에 한 이벤트 흐름의 시작 scene, data, 화면 acceptance를 추가한다.
9. `build-run-debug`으로 정상 입력, branch state, renderer, console, build를 검증한다.

## Cost Limits
- 한 번에 event 1개 또는 공용 opcode 1개.
- branch는 대표 성공·실패 각 1개.
- renderer 캡처 최대 3장, surface 1개.

## Verification
- 원본 map/event/page/trigger/조건과 현재 JSON을 대조한다.
- 대사·choice·item·switch·sprite refresh의 전후 state를 기록한다.
- 승리·패배 후 재진입에서 반복/소멸/재도전 상태를 확인한다.
- renderer, console/page error, `npm run build` 결과를 기록한다.

## Pitfalls
- `partial` page의 여러 branch를 한 줄 대사로 합치지 않는다.
- 자동실행 trigger를 말걸기 event처럼 처리하지 않는다.
- 원본 오프닝과 사용자 작성 오프닝이 충돌하면 임의 각색하지 않고 선택을 받는다.
