---
name: pokemon-asset-pipeline
description: 포켓몬/맵 에셋을 가져오고 배치할 때 사용. PokeAPI, Another Red, pokemondb, Spriters Resource, Bulbagarden, teobz/jvnm 오버월드, sprite, front/back/icon, tileset, animated gif, CORS, public/assets 경로, npm run fetch, pokemonSprite 로더, 팔레트(Lospec)·폰트·SFX 소스 비교 관련 작업. "스프라이트 적용", "에셋 가져와", "타일셋 추가", "더 좋은 소스 비교", "도감 받아" 같은 요청에 발동.
---

# 포켓몬 에셋 파이프라인

> 작업 전 반드시 `myPokemon_AJ/AGENTS.md` §1.5(픽셀 전용)·§4(에셋 소스)를 먼저 읽는다. 이 파일은 그 요약·절차다.

## 절대 규칙
- **픽셀(도트) 전용.** 매끈한 일러스트(공식 아트워크, PokeAPI HOME 512)는 **인게임 에셋 금지.** "고화질"="최고 품질의 픽셀"을 뜻함.
- 손으로 그리거나 저화질 임의 대체 금지. 항상 정해진 소스에서 가져온다.
- 에셋 파일(png/gif/mp3)은 **무조건 `myPokemon_AJ/public/assets/` 아래.** `src/`에 두지 않는다.
- 코드 로드 경로는 앞에 `/` 없이 `"assets/..."`. 예: `this.load.image("tiles","assets/tilesets/town.png")`.

## 소스 우선순위 (요약)
1. **PokeAPI/sprites (github raw)** — CORS 열림(`*`), Phaser URL 직접 로드 가능. 헬퍼: `src/api/pokeapi.ts` (`homeUrl/artworkUrl/animatedGifUrl/hgssUrl/spriteUrl`). 인게임 도트는 `hgssUrl`(generation-iv/heartgold-soulsilver, 80×80) 우선.
2. **Another Red (로컬 원본, `D:/Pokemon Another Red_PWT_250829/`)** — 9세대 픽셀 핵심. `Graphics/`만 사용(Data는 RPG Maker 바이너리라 못 씀). 추가 복사: `node tools/import-from-anotherred.mjs "<AR경로>" <back|followers|trainers|battlebacks|ui>`.
3. **pokemondb.net** — CORS 없음 → 직접 로드 불가. 다운로드 후 `public/`에 넣고 사용.

> 🔎 **소스를 비교해 더 좋은 걸 고를 땐 [`references/asset-sources.md`](references/asset-sources.md) 카탈로그를 본다.**
> 오버월드/트레이너(teobz HGSS, jvnm FRLG), 공식 원본(Spriters Resource·Bulbagarden), 팔레트(Lospec), SFX(Freesound/Bfxr), 폰트(Google Fonts) 등 실사용 소스가 CORS·화질·용도·라이선스로 정리돼 있다. **항상 한 소스만 쓰지 말고 후보를 비교**한다.

## 에셋 배치 맵 (public/assets/)
- `pokemon/front/` — Another Red 애니 배틀 스프라이트(파일명 대문자, 예 `KORAIDON.png`)
- `pokemon/icons/` — 파티/박스 아이콘(128×64 = 64×64 2프레임)
- `pokemon/<도감번호>/` — PokeAPI 다운로드본
- `sprites/`, `characters/`, `tilesets/`, `audio/`, `title/`

## 함정 체크리스트
- **GIF는 Phaser가 첫 프레임만 읽음.** 움직임 필요하면 spritesheet로 변환 후 로드. (Another Red Front는 이미 가로 PNG 시트라 바로 애니됨.)
- **Another Red Front = 가로로 이어붙인 정사각 프레임 시트** (프레임 크기=이미지 높이, 개수=너비/높이). 로더 `src/game/pokemonSprite.ts`의 `frontPath(name)` + `makeAnimatedFront()`.
- 도트 텍스처는 또렷하게 개별 `setFilter(NEAREST)` (전역 `pixelArt`는 켜지 않음 — 일러스트 깨짐).
- 팬게임 에셋 = 개인 포트폴리오·비상업 한정. **git엔 실제 쓰는 것만** 골라 넣고 대량 커밋 금지(이미 ~62MB).

## 검증
- 추가 후 `npm run dev` 띄우고 `curl -s -I "http://localhost:5180/assets/<경로>"`로 200 확인.
- 새 PokeAPI 도감: `npm run fetch <도감번호...>`로 받아 오프라인 OK.
