---
paths:
  - "**/vite.config.ts"
  - "**/electron/**"
  - "**/package.json"
  - "**/tools/*.mjs"
---

# 실행·빌드 규칙

- 실제 script·포트·scene은 `myPokemon_AJ/package.json`, `vite.config.ts`, `src/main.ts`에서 다시 확인한다.
- Claude Code의 공식 `/run`·`/verify`로 실행과 검증을 오케스트레이션할 수 있다. 이 게임의 구체적 입력·Playwright·renderer·scene·console·build acceptance는 `build-run-debug` Skill을 따른다.
- web 기본 포트는 현재 Vite 설정의 `5180`이며 일반 Vite 기본값으로 추정하지 않는다.
- 화면·입력 변경은 build만으로 완료하지 않고 Phaser renderer 캡처와 실제 입력을 확인한다.
- `app:bake`, `app:build`, 패키지 설치는 사용자 승인 후 수행한다.
