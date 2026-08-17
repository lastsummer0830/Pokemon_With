---
name: webapp-testing
description: 게임 Playwright 요청을 runtime QA 정본으로 연결한다. 트리거 — "자동으로 눌러서 확인", "진짜 되는지 테스트", "콘솔 에러 잡아줘", "이 화면 실제로 동작하는지", "playwright로 눌러봐", 자동 조작 검증. 그냥 켜기·빌드·exe 굽기는 build-run-debug.
version: 1.1.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, compatibility, playwright]
---

# Game Playwright Compatibility

범용 웹사이트 테스트 대신 Pokemon_With의 `build-run-debug` 계약을 사용하게 하는 호환 Skill이다.

## When to Use
- 사용자가 Playwright, 브라우저 자동화, 게임 화면 캡처를 요청할 때.
- Phaser canvas·입력·scene·console 검증이 필요한 모든 게임 QA.
- DOM 기반 일반 웹사이트 QA에는 사용하지 않는다.

## Required Inputs
- `surface`, `scene`, `acceptance`를 `build-run-debug`과 동일하게 고정한다.

## Procedure
1. `build-run-debug` Skill을 함께 로드하고 그 절차를 정본으로 사용한다.
2. 프로젝트의 `myPokemon_AJ/tools/*.mjs`와 JavaScript Playwright를 우선한다.
3. Phaser renderer 캡처, 정상 입력, scene 상태, console/page error를 수집한다.
4. 이 Skill의 이름 때문에 범용 Python helper나 Vite 기본 포트를 사용하지 않는다.

## Cost Limits
- `build-run-debug`의 surface·scene·재시도·캡처 상한을 그대로 적용한다.

## Verification
- 실제로 사용한 project script와 renderer 캡처 경로를 기록한다.
- runtime·화면·build 세 증거가 모두 없으면 완료로 쓰지 않는다.

## Pitfalls
- `page.screenshot()`만으로 canvas를 검증하지 않는다.
- 이 호환 Skill만 읽고 정본의 필수 입력과 비용 상한을 생략하지 않는다.
