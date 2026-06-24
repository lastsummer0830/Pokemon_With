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
