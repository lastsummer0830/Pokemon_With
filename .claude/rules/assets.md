---
paths:
  - "**/public/assets/**"
  - "**/src/assets/**"
  - "**/src/game/pokemonSprite.ts"
  - "**/tools/*.mjs"
---

# 에셋 규칙

- 에셋 선택·이식은 `pokemon-asset-pipeline` Skill을 사용한다.
- 인게임 포켓몬·트레이너·맵·UI는 픽셀 소스를 우선하고 공식 artwork를 대체물로 쓰지 않는다.
- 후보 최대 3개를 실물로 비교하고 사용자가 고르기 전 runtime 에셋으로 확정하지 않는다.
- 출처·라이선스·용도·파일 치수·frame 규칙을 기록한다.
- 외부 AR 설치 경로를 추정하지 말고 사용자 제공 경로나 실제 검색 결과를 사용한다.
- 적용 후 loader 응답, renderer, console, build를 확인한다.
