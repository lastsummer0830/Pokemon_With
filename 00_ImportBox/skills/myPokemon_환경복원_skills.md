# myPokemon 워크스페이스 — 환경 복원 키트 (skills + 규칙)

> **이 파일 하나면 다른 PC에서 같은 Claude Code / OpenCode 환경을 재현한다.**
> claude/opencode에게 이 파일을 주고 *"이 키트대로 환경 만들어줘"* 라고만 하면 됨.

---

## 0. AI에게 — 복원 지시 (이대로 실행)

1. **작업 위치** = 이 워크스페이스의 **루트**(`AGENTS.md`가 있는 `myPokemon_AJ/`의 상위 폴더, 즉 세션을 여는 폴더). skill은 그 루트의 `.claude/skills/`에 둔다.
2. 아래 **§3 파일 목록**의 각 파일을 **지정 경로 그대로** 생성한다. 폴더가 없으면 만든다. 내용은 코드펜스 안 그대로(앞뒤 공백/마크다운 포함).
3. `myPokemon_AJ/AGENTS.md`·`CLAUDE.md`가 이미 있으면 **건드리지 말 것**(이 키트는 그걸 보조할 뿐, 규칙 원본은 AGENTS.md다). 없으면 사용자에게 알린다.
4. **만들지 말 것**(§4 참고): `pokemon-project-router`, `typescript-refactor-guard` — 의도적으로 뺀 것. 다시 추가하지 말 것.
5. **gitignore 주의**: 보통 `.claude/`가 `.gitignore`에 있어 skill이 git에 안 올라간다. 로컬 작동엔 무관. **공유/버전관리하려면** `.gitignore`에 `!.claude/skills/` 같은 예외를 추가할지 사용자에게 물어본 뒤 처리.
6. **위치 주의**: skill은 "세션을 여는 폴더"의 `.claude/skills/`에서 발견된다. 만약 `myPokemon_AJ/`만 따로 열어 작업한다면 `myPokemon_AJ/.claude/skills/`에도 같은 파일을 둬야 한다.
7. 생성 후 검증: 각 `SKILL.md`의 YAML frontmatter에 `name`(=폴더명, 소문자-하이픈)과 `description`이 있는지, `pokemon-asset-pipeline/references/asset-sources.md` 링크가 존재하는지 확인하고 결과를 보고한다.

---

## 1. 환경 개요 (요약)

- **프로젝트**: HGSS(하트골드) 감성 2D 탑다운 포켓몬 팬게임, 목표 퀄리티 = 어나더레드(Another Red) 수준.
- **스택**: Phaser 3 + TypeScript + Vite + Electron. 실행 `npm run dev` → http://localhost:5180 (포트 고정). 데스크톱 `npm run app` / `게임실행.bat`.
- **규칙 단일 원본** = `myPokemon_AJ/AGENTS.md` (CLAUDE.md가 `@AGENTS.md`로 자동 로드). **skill들은 이걸 대체하지 않고 "먼저 읽으라"고 연결**한다.
- **확정 규칙**: 화풍 = 픽셀(도트) 전용(매끈한 일러스트 인게임 금지). 남주=1세대 RED, 여주=4세대 DAWN.
- **핵심 함정**:
  - 프로젝트가 `/mnt/d`(D드라이브)에 있어 WSL inotify 안 됨 → `vite.config.ts`의 `server.watch.usePolling: true` **삭제 금지**.
  - 정적 에셋은 **무조건 `myPokemon_AJ/public/assets/`**, 코드 로드는 `"assets/..."`(앞에 `/` 없이).
  - 역할 분리: 화면=`src/scenes/`, 타입=`src/data/`, 계산=`src/systems/`, 외부소스=`src/api/`, 공용렌더=`src/game/`.
- **폴더 구조(참고)**: `src/{api,data,game,scenes,systems}`, `tools/`(fetch-pokemon.mjs, import-from-anotherred.mjs), `electron/main.cjs`, `public/assets/{sprites,characters,tilesets,audio,title,pokemon/{front,icons,<도감번호>}}`.

## 2. skill 목록 (8개)

| skill | 용도 | 자동발동 키워드(예) |
|---|---|---|
| `pokemon-asset-pipeline` | 에셋 수집·배치·소스 비교 | 스프라이트, PokeAPI, Another Red, 타일셋, CORS, gif |
| `tiled-map-grid-movement` | 마을맵·타일맵·칸이동·충돌 | 마을 맵, Tiled, collision, grid 이동, warp |
| `turn-battle-system` | 턴제 배틀 | battle, damage, type, stat, state machine |
| `home-bonus-system` | 집꾸미기→컨디션→배틀보너스(차별점) | house, furniture, condition, homeBonus |
| `save-state-system` | 저장/불러오기 | save, load, localStorage, party, migration |
| `phaser-scene-builder` | Phaser Scene 작업 | Scene, preload/create/update, camera, scale |
| `game-ui-hud-polish` | HGSS 감성 UI/HUD | HUD, menu, textbox, party UI, HGSS |
| `build-run-debug` | 빌드·실행·디버그·Electron | npm run, Vite, Electron, 화면반영, screenshot |

---

## 3. 복원할 파일 목록 (경로 → 내용)

### 3-1) `.claude/skills/pokemon-asset-pipeline/SKILL.md`

````markdown
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
````

### 3-2) `.claude/skills/pokemon-asset-pipeline/references/asset-sources.md`

````markdown
# 에셋 소스 카탈로그 (비교용)

> 에셋을 가져올 때 **한 소스만 보지 말고 이 표에서 비교**해 가장 좋은 걸 고른다.
> 출처: `myPokemon_AJ/AGENTS.md` §4 + `00_ImportBox/링크사이트정리/` + 실제 사용 이력.
> 사용 전 **CORS·라이선스·화질**을 재확인한다. (사이트 정책은 바뀐다.)

## 고르는 기준 (이 순서로 비교)
1. **픽셀 규칙 적합성** — 인게임은 §1.5 "픽셀(도트) 전용". 매끈한 일러스트/월페이퍼는 인게임 금지.
2. **화질** — 같은 도트면 더 또렷·고해상도 픽셀.
3. **CORS** — 열려 있으면 Phaser URL 직접 로드, 없으면 다운로드 후 `public/assets/`.
4. **HGSS/Another Red 톤 일치** — 게임의 통일감.
5. **라이선스** — 팬게임 에셋은 개인 포트폴리오·비상업 한정. 출처 기록.

---

## A. 인게임 포켓몬 스프라이트 (도트 — 1순위)
| 소스 | CORS | 화질/용도 | 비고 |
|---|---|---|---|
| **PokeAPI/sprites** (github raw) | ✅ 열림 | gen-iv HGSS 80×80(인게임 도트), gen-v animated.gif(배틀) | 1순위. 헬퍼 `src/api/pokeapi.ts`. HOME 512는 일러스트라 인게임 금지 |
| **Another Red** (로컬 `D:/Pokemon Another Red_PWT_250829/Graphics/`) | 로컬 | 9세대 포함 애니 Front 시트(대문자 파일명) | ⭐ 9세대 픽셀 핵심. `tools/import-from-anotherred.mjs`로 추가 복사 |
| **pokemondb.net** | ❌ 없음 | 게임별 도트 다양·애니 gif | 다운로드 후 사용. (레쿠자 움짤 등 여기서 받았던 곳) |
| **The Spriters Resource** (spriters-resource.com) | ❌ 봇차단 | 공식 원본 최고화질 도트 | **수동 다운로드만** 가능. 자동 fetch 불가 |
| **Bulbagarden Archives** (archives.bulbagarden.net) | ⚠️ | HGSS 트레이너/캐릭터·위키 이미지 | thumb URL로 받았던 이력(HGSS Ethan 등). UA 필요할 수 있음 |
| **Pokémon Essentials** (github Maruno17/pokemon-essentials) | github raw | 팬게임 표준 Graphics(Trainers 등) | RPG Maker 팬게임 에셋 베이스 |

## B. 오버월드 / 트레이너 / 타일 (HGSS 감성)
| 소스 | CORS | 용도 | 비고 |
|---|---|---|---|
| **jvnm-dev/pokemon-react-phaser** (github) | github raw ✅ | FRLG 트레이너 시트 24×32 | 현재 주인공 이동에 사용 중 (AGENTS.md §4) |
| **teobz/pkmn-hgss-animated-overworld-sprites** (github) | github raw ✅ | HGSS 애니 오버월드 | 칸 이동 주인공 교체 후보 |
| **TaTaTaZJJ/pokemon-overworld-for-gba** (github) | github raw ✅ | GBA 오버월드 | 비교용 |
| **aaron5670/PokeMMO-...** (github) | github raw ✅ | Phaser tilemap 구조 참고 | 코드/타일맵 레퍼런스 |
| **Another Red Tilesets** (로컬) | 로컬 | 마을 맵 타일셋 | `public/assets/tilesets/`, 이름에 공백/유니코드 |

## C. 타이틀 배경 무드 (★ 인게임 도트 아님 — 타이틀/연출 한정)
> ⚠️ 아래는 매끈한 일러스트/월페이퍼다. **인게임 에셋 금지**(§1.5). 타이틀 화면 배경·무드보드에만.
| 소스 | 용도 | 비고 |
|---|---|---|
| **wallhaven.cc** (API: `/api/v1/search`) | 픽셀풍 배경 월페이퍼 | `01_Resources/Title/background/wallHaven`에 받았던 곳 |
| **deviantart** (예: aerroscape) | 풍경 픽셀 일러스트 | UA/referer 필요 |
| **wallpaperflare.com** | 픽셀아트 배경 | UA 필요 |

## D. 폰트 / 팔레트
| 소스 | 용도 | 비고 |
|---|---|---|
| **Google Fonts** (fonts.gstatic.com) | UI 폰트 | Baloo2-700 받아 `public/assets/fonts/`에 사용 중 |
| **Lospec** (lospec.com/palette-list) | 픽셀 팔레트 참고 | 색감 통일용. 도트 색 과다 방지 |

## E. 사운드 (`public/assets/audio/` 현재 비움)
| 소스 | 용도 | 비고 |
|---|---|---|
| **Another Red Audio** (로컬) | BGM/효과음 | 톤 일치 1순위 |
| **Freesound** (freesound.org) | 효과음 | CC 라이선스 확인(특히 CC-BY-NC 주의) |
| **Bfxr** (bfxr.net) / **ChipTone** (sfbgames.itch.io/chiptone) | 레트로 SFX 생성 | 점프/획득/공격 등 즉석 제작 |

## F. 보조 무료 에셋 (프로토타입용 — 도트 아니면 인게임 금지)
| 소스 | 용도 | 비고 |
|---|---|---|
| **Kenney** (kenney.nl/assets) | 프로토타입 2D 에셋/UI | 라이선스 관대하나 페이지 확인 |
| **OpenGameArt** (opengameart.org) | 오픈 에셋 | 에셋별 라이선스 천차만별, 반드시 확인 |
| **Game-icons.net** | 스킬/아이템/상태 아이콘 | 출처 표기 조건 확인 |

## 도구 (에셋 제작/편집)
- **Tiled** (mapeditor.org) — 타일맵 JSON 제작 → `tiled-map-grid-movement` 참고.
- **Aseprite / LibreSprite** — 도트 편집·스프라이트시트 내보내기 (GIF→시트 변환 등).

---
## 공통 규칙 (재확인)
- 정적 에셋은 **무조건 `myPokemon_AJ/public/assets/`**, 코드 로드는 `"assets/..."`.
- **GIF는 Phaser가 첫 프레임만** 읽음 → 움직임 필요시 spritesheet 변환.
- CORS 없으면 직접 로드 불가 → 다운로드 후 사용.
- 팬게임/외부 에셋 = **개인 포트폴리오·비상업 한정**, git엔 쓰는 것만, 출처 기록.
````

### 3-3) `.claude/skills/tiled-map-grid-movement/SKILL.md`

````markdown
---
name: tiled-map-grid-movement
description: 마을 맵·타일맵·격자(칸) 이동·충돌을 만들 때 사용. Another Red 타일셋, Tiled JSON, tilemap, collision layer, grid movement, warp/door/event tile, 방향 전환 관련 작업. "진짜 마을 맵 만들어줘", "칸 이동 붙여줘", "충돌 처리" 같은 요청에 발동.
---

# 타일맵 & 격자 이동 (HGSS식)

> 작업 전 `myPokemon_AJ/AGENTS.md` §3·§6(다음 우선순위)을 먼저 읽는다. 이건 그 다음 단계 작업이다.

## 목표
AGENTS.md 로드맵의 다음 우선순위 = **Another Red Tilesets로 Tiled 타일맵 + 칸 단위 이동 + 충돌**, 주인공을 Another Red 오버월드로 교체.

## 배치 규칙
- 타일셋 이미지: `public/assets/tilesets/` (Another Red 타일셋 — 이름에 공백/유니코드 있을 수 있음, 로드 시 경로 정확히).
- Tiled JSON: **build에 포함되도록** `public/assets/` 아래(예: `public/assets/maps/`)에 둔다. (string 경로 로드 → public 필수.)
- 맵 로직(충돌 판정·이벤트·워프 데이터)은 `WorldScene`에 다 때려넣지 말고 `src/systems/`·`src/data/`로 분리. Scene은 렌더·입력·연출 중심.

## 절차
1. Tiled에서 레이어 분리: **ground / overlay / collision / event(warp,door)**. 충돌·이벤트는 별도 레이어/속성으로.
2. Phaser `this.make.tilemap` + `addTilesetImage` + `createLayer`로 로드. 충돌은 collision 레이어 속성 기반.
3. **칸(격자) 단위 이동**: 입력 → 한 칸 목표 좌표로 tween 이동, 이동 중 입력 잠금, 도착 후 다음 입력. 정지 시 방향 전환만(HGSS 감성).
4. 워프/도어/이벤트 타일 위 도착 시 트리거 → scene transition.
5. 주인공 스프라이트: Another Red 오버월드(`public/assets/characters/`의 boy_/girl_). 도트는 `setFilter(NEAREST)`.

## 금지/주의
- ⚠️ Another Red `Data/*.rxdata`는 RPG Maker 바이너리라 **맵 배열·로직을 직접 못 가져옴.** 타일셋 "그림"만 쓰고 맵 배치는 Phaser/Tiled로 재구성.
- 좌표 하드코딩 대신 타일 크기·격자 기준 계산.

## 검증
- `npm run dev` → http://localhost:5180 에서 충돌/워프/이동을 직접 플레이. 화면 안 바뀌면 `build-run-debug` 참고.
````

### 3-4) `.claude/skills/turn-battle-system/SKILL.md`

````markdown
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
````

### 3-5) `.claude/skills/home-bonus-system/SKILL.md`

````markdown
---
name: home-bonus-system
description: 집 꾸미기와 포켓몬 컨디션·배틀 보너스 연결을 만들 때 사용. house, furniture, decoration, condition, homeBonus, battle bonus, HouseScene 관련 작업. "집 꾸미기랑 배틀 보너스 연결해줘", "가구 효과", "컨디션 올리기" 같은 요청에 발동.
---

# 집 꾸미기 → 컨디션 → 배틀 보너스 (이 게임의 차별점)

> 작업 전 `myPokemon_AJ/AGENTS.md` §1(차별점)을 먼저 읽는다. 이게 이 프로젝트의 "내 색"이다.

## 핵심 개념
집 꾸미기는 단순 장식이 아니라 포켓몬 **컨디션**을 올리고, 그게 **배틀**로 이어진다.
예: 불꽃 포켓몬을 벽난로 옆에서 재우면 컨디션 ↑ → 배틀에서 더 강함.

## 역할 분리
- **가구/배치 데이터**: `src/data/furniture.ts`, `src/data/HouseLayout.ts`.
- **보너스 계산**: `src/systems/homeBonus.ts` (가구 + 포켓몬 타입/성격/컨디션 → 보너스 값).
- **화면**: `src/scenes/HouseScene.ts` — 배치·표시·입력 중심. 계산은 systems에서.

## 연결 절차
1. 가구 ↔ 효과 매핑을 `furniture.ts`에 데이터로 정의(가구 종류, 영향 주는 포켓몬 타입/성격, 컨디션 증가량).
2. `homeBonus.ts`에서 현재 배치(`HouseLayout`) + 파티 포켓몬을 읽어 컨디션/보너스를 계산하는 **순수 함수**로 작성.
3. 배틀 시스템(`turn-battle-system`)은 이 보너스를 **읽기만** 한다 — 어떤 필드를 어떻게 읽는지 인터페이스를 명확히.
4. 보너스 결과는 저장 대상이면 `save-state-system`의 `houseLayout`/progress에 반영.

## 체크리스트 / 검증
- 가구 효과는 데이터로(하드코딩 분기 최소화), 새 가구 추가가 쉬워야 함.
- 타입/성격/컨디션 → 보너스 규칙을 한국어 주석으로 설명.
- `npx tsc --noEmit` 후 HouseScene에서 배치 변경 → 배틀에서 보너스 반영되는지 플레이 확인.
````

### 3-6) `.claude/skills/save-state-system/SKILL.md`

````markdown
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
````

### 3-7) `.claude/skills/phaser-scene-builder/SKILL.md`

````markdown
---
name: phaser-scene-builder
description: Phaser Scene 작업에 사용. TitleScene, WorldScene, BattleScene, HouseScene, preload/create/update, input, camera, scene transition, scale resize 관련. 새 씬 추가·씬 구조 정리·씬 전환 작업에 발동.
---

# Phaser Scene 빌더

> 작업 전 `myPokemon_AJ/AGENTS.md` §3·§5를 먼저 읽는다.

## 위치 & 등록
- Scene 파일: `src/scenes/` (`Phaser.Scene` 상속). 게임 설정/씬 등록은 `src/main.ts`.
- 현재 씬: Title / World / Battle / House.

## 규칙
- **데이터·계산 로직을 Scene에 과하게 넣지 않는다.** 계산은 `src/systems/`, 타입/데이터는 `src/data/`, 외부 소스는 `src/api/`. Scene은 화면·입력·연출 담당.
- 화면은 `Scale.RESIZE`로 창을 꽉 채운다. **좌표는 `this.scale.width/height` 기준 비율 배치**(절대 픽셀 하드코딩 지양).
- `preload`에서 에셋 로드(경로는 `"assets/..."`), `create`에서 배치, `update`에서 프레임 로직.
- 도트 텍스처는 필요 시 개별 `setFilter(Phaser.Textures.FilterMode.NEAREST)`. 전역 `pixelArt`는 켜지 않는다.
- 씬 전환은 `this.scene.start/launch`로. 리사이즈 대응은 `scale` resize 이벤트에서 좌표 재계산.

## 체크리스트
- 새 씬은 `main.ts`에 등록했는가.
- 입력 핸들러 정리(씬 종료 시 리스너 누수 없게).
- any 남발 금지, 한국어 주석.

## 검증
- `npx tsc --noEmit` → `npm run dev` → 씬 전환·리사이즈 직접 확인.
````

### 3-8) `.claude/skills/game-ui-hud-polish/SKILL.md`

````markdown
---
name: game-ui-hud-polish
description: HGSS 감성의 UI/HUD 품질을 개선할 때 사용. title UI, menu, HUD, battle text box, party UI, starter select, pokedex UI, HGSS style 관련. "UI를 HGSS 느낌으로 개선해줘", "텍스트박스 다듬어", "메뉴 만들어" 같은 요청에 발동.
---

# UI/HUD 폴리시 (HGSS 감성)

> 작업 전 `myPokemon_AJ/AGENTS.md` §1(어나더레드 수준)·§5를 먼저 읽는다. 참고로 일반 웹앱 디자인 감각은 캔버스 게임에 안 맞는다.

## 방향
- **일반 웹앱처럼 보이는 버튼/카드 UI 지양.** DS/HGSS식 **텍스트 박스, 메뉴 패널, 파티창** 감성으로.
- 색감·간격·폰트·패널 라운딩을 **일관되게**. 폰트는 `public/assets/fonts/`.
- 목표 퀄리티는 어나더레드 수준 — 어설픈 프로토타입 UI 금지.

## 텍스처 필터 주의 (중요)
- 도트와 매끈한 일러스트가 한 화면에 섞임. **전역 `pixelArt` 금지**, 도트 텍스처에만 개별 `setFilter(NEAREST)`. 일러스트(있다면)는 기본 LINEAR로 둬서 깨지지 않게 분리.
- 좌표는 `this.scale.width/height` 기준 비율 배치(리사이즈 대응).

## 작업 단위
- 타이틀/스타팅 선택, 월드 HUD, 배틀 텍스트박스, 파티 UI, 도감 UI 등 화면별로 컴포넌트화.
- 반복되는 패널/박스는 헬퍼로 공통화(중복 코드 방지).

## 참고
- 디자인 톤이 막히면 빌트인 design 관련 skill을 **참고만**(웹/DOM 전제라 그대로 적용 금지, 캔버스에 맞게 변환).

## 검증
- `npm run dev`로 실제 화면 확인. 여러 창 크기로 리사이즈 깨짐 체크. 화면 미반영 시 `build-run-debug`.
````

### 3-9) `.claude/skills/build-run-debug/SKILL.md`

````markdown
---
name: build-run-debug
description: 빌드·실행·디버깅·데스크톱 앱 실행에 사용. npm run dev/build/app, Vite, Electron, 게임실행.bat, electron/main.cjs, console error, build failed, 화면이 안 바뀜, screen not updated, localhost 5180, playtest, screenshot, WSL/Windows 실행 차이 관련. "화면이 안 바뀌는데 고쳐줘", "빌드 안 돼", "앱으로 실행" 같은 요청에 발동.
---

# 빌드 · 실행 · 디버그 (Vite + Electron, WSL/D드라이브)

> 작업 전 `myPokemon_AJ/AGENTS.md` §2(실행·함정)을 먼저 읽는다.

## 실행 명령
- 개발: `npm run dev` → http://localhost:5180 (포트 고정 5180, 5173 아님).
- 빌드: `npm run build` (= `tsc && vite build`). 타입만: `npx tsc --noEmit`.
- 데스크톱 앱: `npm run app` (dev서버 + Electron 한 번에, 창 닫으면 둘 다 종료). 진입점 `electron/main.cjs`.
- 초보자용: 폴더의 **`게임실행.bat` 더블클릭**(Windows) — 이 실행 경로는 유지한다.
- .exe 패키징: `npm run app:build`.

## 🔴 D드라이브/WSL 함정 (몇 시간 날린 것)
- 이 프로젝트는 `/mnt/d`에 있어 WSL inotify 파일 감지가 **안 됨**. 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`** 가 있다. **절대 삭제 금지.** 지우면 코드 고쳐도 화면 반영 안 되는데 서버 curl엔 새 코드가 보여서 디버깅이 미궁에 빠진다.
- 코드 수정 후 화면이 안 바뀌면 → 브라우저 **`Ctrl+Shift+R`**(강력 새로고침) 한 번.
- `localhost`는 윈도우 `wslrelay.exe`가 WSL 서버로 포워딩(정상).

## Electron / WSL
- WSLg에서 WebGL 막히면 `electron/main.cjs`의 `ignore-gpu-blocklist`/`enable-unsafe-swiftshader` 플래그가 풀어줌(실제 윈도우엔 영향 없음). WSL 실행 시 `--no-sandbox` 필요할 수 있음.
- ⚠️ `npm install` 시 Electron 본체(~216MB) 504 뜨면 미러: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`.
- Electron 수정은 일반 Vite 설정과 충돌하지 않게.

## 디버깅 절차
1. 재현 조건을 먼저 적는다(어떤 화면/입력에서).
2. `npm run dev` 콘솔 + 브라우저 콘솔 에러 확인. 에셋 404면 `curl -s -I http://localhost:5180/assets/<경로>`.
3. 화면 미반영 의심 → 먼저 Ctrl+Shift+R, 그래도 안 되면 usePolling 살아있는지 확인.
4. 빌드 실패 → `npx tsc --noEmit`로 타입 에러부터.
5. 로컬 실행 확인이 필요하면 빌트인 `run`/`verify` skill 활용(캔버스라 스크린샷 위주, DOM 쿼리는 제한적).

## 검증/기록
- 수정 전후 **재현 조건과 검증 결과**를 남긴다. "고쳤다"는 실제 실행으로 확인 후에만.
````

---

## 4. 의도적으로 만들지 않은 것 (다시 추가하지 말 것)

- **`pokemon-project-router`** ❌ — Claude/OpenCode skill은 "라우터가 하위 skill을 dispatch"하는 구조가 **아님**. 각 skill의 `description` 키워드 매칭으로 자동 발동한다. 또 "항상 AGENTS.md 먼저"는 `CLAUDE.md → @AGENTS.md` 자동 로드로 이미 처리됨. 라우터는 중복+오작동이라 제거.
- **`typescript-refactor-guard`** ❌ — 작업이 아닌 "행동 가드"라 키워드 자동발동이 약하고 `AGENTS.md §5`(코드 컨벤션)와 중복. 규칙은 각 skill 체크리스트에 흡수됨.
- **공식 skill 통째 복사**(webapp-testing/frontend-design/skill-creator) ❌ — Phaser는 canvas 렌더라 DOM 기반 테스트/디자인 적합도 낮음. 빌트인 `run`/`verify`/`code-review`로 충분. 필요하면 "참고"로만 연결.
- **gpt-image 류 AI 이미지 생성 skill** ❌ — 유료 키 필요 + 결과물이 매끈한 일러스트라 "픽셀 전용" 규칙과 충돌.

## 5. 한 줄 사용 시나리오 (복원 후)

이 환경이 깔리면, skill 이름을 직접 안 불러도 아래가 자동으로 맞는 skill을 탄다:
- "진짜 마을 맵 만들어줘" → `tiled-map-grid-movement`
- "배틀 시스템 제대로 짜줘" → `turn-battle-system`
- "Another Red 스프라이트 적용해줘" / "더 좋은 소스 비교" → `pokemon-asset-pipeline`
- "집 꾸미기랑 배틀 보너스 연결해줘" → `home-bonus-system`
- "UI를 HGSS 느낌으로 개선해줘" → `game-ui-hud-polish`
- "화면이 안 바뀌는데 고쳐줘" → `build-run-debug`
