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
2. **직접 그리지 않는다. 소스 우선순위대로 가져온다:** ① **Another Red**(로컬 픽셀 핵심, §4C·PC마다 다름 → `find`) / **PokeAPI sprites**(CORS ○, §4A) → ② 없으면 pokemondb(CORS ✗ → 다운로드, §4B) → ③ **그래도 마땅한 게 없을 때만 PokeRogue 폴백**(§4D): 에셋 본체 = 서브모듈 `pagefaultgames/pokerogue-assets`(branch `beta`), 포켓몬 스프라이트는 **PNG+JSON 아틀라스**(`load.atlas`, 단순 프레임 슬라이스 아님). 픽셀만·비상업 한정.
3. **"후보 뽑아와/보여줘"** → 실제 소스에서 실물을 `01_Resources/Pick/<카테고리>/`에 번호+설명 파일명 + 미리보기 몽타주. **사용자가 고른 뒤에야** public/assets로 적용. `_미리보기` 삭제 금지. (ASCII·직접그림 금지 — 실제 렌더로 보여줄 것.)
4. GIF는 Phaser가 첫 프레임만 읽음 → 스프라이트시트로 변환. Front 시트는 정사각 프레임 애니(`makeAnimatedFront`).
5. 도트는 텍스처별 `NEAREST`. 전역 `pixelArt`는 끄기(부드러운 일러스트 깨짐).
6. ⚠️ WebGL 텍스처폭 ~4096 초과 시 frame0 크롭이 깨짐 → `addCanvas`로 소형 텍스처 사용(memory `starter-lab-flow`).
