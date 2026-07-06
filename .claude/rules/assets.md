---
paths:
  - "**/public/assets/**"
  - "**/game/pokemonSprite.ts"
  - "**/api/pokeapi.ts"
  - "**/tools/*.mjs"
---

# 🎨 에셋 규칙 (STOP 체크리스트)

> 정본: `myPokemon_AJ/AGENTS.md` §1.5·§3·§4.

1. **화풍 = 픽셀(도트) 전용.** 매끈한 일러스트(공식 아트워크·HOME 512)는 **인게임 금지.** "고화질"=최고 품질의 픽셀.
2. **직접 그리지 않는다.** 소스에서 가져온다: PokeAPI sprites(CORS ○, 1순위) / pokemondb(CORS ✗ → 다운로드) / Another Red(로컬 픽셀 핵심, 경로는 §4C·PC마다 다름 → `find`로 확인).
3. **"후보 뽑아와/보여줘"** → 실제 소스에서 실물을 `01_Resources/Pick/<카테고리>/`에 번호+설명 파일명 + 미리보기 몽타주. **사용자가 고른 뒤에야** public/assets로 적용. `_미리보기` 삭제 금지. (ASCII·직접그림 금지 — 실제 렌더로 보여줄 것.)
4. GIF는 Phaser가 첫 프레임만 읽음 → 스프라이트시트로 변환. Front 시트는 정사각 프레임 애니(`makeAnimatedFront`).
5. 도트는 텍스처별 `NEAREST`. 전역 `pixelArt`는 끄기(부드러운 일러스트 깨짐).
6. ⚠️ WebGL 텍스처폭 ~4096 초과 시 frame0 크롭이 깨짐 → `addCanvas`로 소형 텍스처 사용(memory `starter-lab-flow`).
