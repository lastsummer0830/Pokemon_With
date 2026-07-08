# myPokemon — 프로젝트 규칙 & 기본 틀

> 이 파일 = 이 프로젝트 규칙의 **단일 원본(source of truth)** — 모든 AI 도구(Claude/Codex/Cursor)가 이 폴더에서 작업 전 먼저 읽는다. (CLAUDE.md는 이 파일을 불러올 뿐.)
> 세부 STOP 체크리스트는 `.claude/rules/*.md`(해당 파일 건드릴 때 자동 표시), 진짜 강제 차단은 `.claude/hooks/`.

## 1. 이 게임이 뭔가
- **2D 탑다운 포켓몬 팬게임.** 하트골드(HGSS) 같은 맵 이동 + 턴제 배틀.
- **차별점(내 색):** "집 꾸미기"가 장식이 아니라 포켓몬 **컨디션**을 올리고 그게 **배틀**로 이어진다. (예: 불꽃 포켓몬을 벽난로 옆에서 재우면 컨디션↑ → 배틀에서 강함.)
- **목표 퀄리티 = 팬게임 "어나더 레드(Another Red)" 수준**의 완성도(어설픈 프로토타입 아님). → **에셋은 항상 고화질, 손으로 그리지 말 것.**

## 1.5 확정 디자인 결정 (사용자 지정 — 임의 변경 금지)
> 사용자가 직접 정한 절대 규칙. 다른 걸 제안·변경 말 것. 새 대화에서도 기본으로 따른다.
- **화풍 = 픽셀(도트) 전용.** 매끈한 일러스트(공식 아트워크·PokeAPI HOME 512 등)는 인게임 에셋 **금지.** "고화질/최품질"이라 해도 = **"최고 품질의 픽셀"**(일러스트 아님).
- **남자 주인공 = 1세대 RED / 여자 주인공 = 4세대 DAWN.**
- **라이벌 = 네모(Nemona, 9세대 SV).** AR 픽셀 사용(오버월드 `characters/trainer_NEMONA.png` 32x48 4방향, 배틀 `Trainers/NEMONA.png`). AR의 CHAMPION/LEADER_Nemona는 동일 복제본 → 디자인 1종뿐.
- **이름창 공개 규칙:** 캐릭터 이름은 **본인이 처음 자기소개할 때부터** 뜨고 그 전엔 `???`. 단 배틀 안 하는 일반 NPC(엄마·간호순·오박사)는 처음부터 이름 그대로(예: `반바지 꼬마`).
- **대화 UI:** 말하는 사람 있는 대사는 대화박스 위 **이름창(작은 박스)**. 상황설명·나레이션("…", "여기는 어디지…?")은 **이름창 없이** 박스만. (구현: `IntroScene`의 `setSpeaker`/`applySpeaker`.)
- **대사 작성(사용자 강조):** ① **사용자가 설정한 멘트(나레이션·엄마 대사·기존 대사)는 절대 안 바꾼다** — 요청받은 대상만 손댄다. ② 신규/수정 대사는 **실제 게임의 공식 캐릭터 대사를 확인 후** 적용(말투 지어내기 금지). 요청 범위 밖은 건드리지 말 것.
- **인트로 순서 = 성별 선택 → 이름 입력**(각각 대화 오버레이 아닌 전용 화면, 오박사·박스 숨김). 이름 화면엔 선택한 성별 카드 함께 표시, 이름 확정 시 예/아니오(아니오면 재입력).
- 트레이너 픽셀 자동소스 최고 = AR HD 128px(공식 원본 The Spriters Resource는 봇 차단 → 수동 다운로드만).

## 2. 기술 스택 · 실행
- **Phaser 3 · TypeScript · Vite.** 실행: `npm run dev` → **http://localhost:5180**(포트 고정). 빌드 `npm run build`, 에셋 다운 `npm run fetch [도감번호...]`.
- **데스크톱(Electron):** `게임실행.bat` 더블클릭(Windows) 또는 `npm run app`(dev서버+창 한 번에, 창 닫으면 둘 다 종료). 진입점 `electron/main.cjs`.
- **⭐ 실행본(exe) = 사용자가 더블클릭하는 본체** (세부·함정은 `.claude/rules/run-build.md`):
  - 본체 = `build_win/win-unpacked/PokemonWith.exe`. **코드 고쳐도 굽기 전까진 exe 반영 안 됨** — "빌드만 하고 끝" 금지("안 바뀐다" 분노 발생).
  - **평상시 굽기 = `npm run app:bake`**(dist만 교체, 빠름). ⚠️ `app:build`는 WSL 리눅스타겟 헛수고. 전체 재빌드(네이티브 의존성 변경)만 `npx electron-builder --win --x64`.
  - 굽기 전 PokemonWith.exe 먼저 종료(dll 잠김). 자주 굽지 말고 dev로 모아 확인 후 **체크포인트마다 1회.**

### ⚠️ 반드시 기억할 함정 (이것 때문에 몇 시간 날림)
- 프로젝트는 **D 드라이브(`/mnt/d`)** — WSL에서 윈도우 드라이브는 파일 변경 감지(inotify)가 안 됨. 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`가 있다. 절대 지우지 말 것.** (없으면 코드 고쳐도 브라우저 반영 안 되고, 서버 curl로는 새 코드가 보여 디버깅이 미궁.) 화면 안 바뀌면 브라우저 **`Ctrl+Shift+R`**.

### ⭐ 집 내부 맵 충돌격자 (눈대중 금지 — 세부는 `.claude/rules/maps-collision.md`)
- **충돌격자를 게임 실행화면 눈대중으로 찍지 말 것**(몇 주째 반복 분노의 근본원인 — 스케일·중앙정렬·스프라이트겹침이 셀 경계를 착각시킴). **정답: 방 원본 PNG(`public/assets/house/*.png`, 640×480 = 20×15칸 ×32px)에 PIL로 32px 격자+좌표라벨을 얹어 셀↔가구 1:1, blocked는 가구 사각형 좌표로 스크립트 생성**(손타이핑 금지). 작은 소품까지 훑고, 수정 후 playwright·`walkable()`로 실검증.
- **계단(사용자 확정):** 계단 그림의 파란 난간 = 밟기 금지(막음), 노란 발판만 층이동. 카펫→계단 진입이 정답 루트.
- **전경 오버레이(가구 뒤로 지나가기) 금지** — 캐릭터 머리 잘림(사용자 격노). `overImg`는 `setVisible(false)` 유지.

## 3. 폴더 구조 & 규칙
- **`public/assets/`** = ★모든 정적 에셋(string 경로로 로드하는 파일은 반드시 여기 둬야 build 포함). 하위: `sprites/`(캐릭터 시트) · `characters/`(AR 오버월드) · `tilesets/` · `audio/` · `pokemon/{front, icons, <도감번호>}`.
- **`src/`** = `main.ts`(진입점) · `api/`(외부 소스, pokeapi.ts) · `game/`(렌더 헬퍼, pokemonSprite.ts) · `scenes/`(화면) · `data/`(타입/데이터) · `systems/`(계산 로직). **섞지 말 것.** 코드 로드 경로는 `"assets/..."`(앞에 `/` 없이).
- `tools/` = 스크립트(fetch-pokemon.mjs, import-from-anotherred.mjs, ar-map/). `vite.config.ts` = usePolling(위 함정).
- **⭐ 후보 고르기(사용자 확정 워크플로):** "후보 추려/보여줘/내가 고를게" → 실물 에셋을 **`01_Resources/Pick/<카테고리>/`**(예 `06_인게임캐릭터/{남,여}`)에 번호+설명 파일명 + 비교 미리보기 몽타주로 정리. **사용자가 고른 뒤에야** `public/assets/`로 옮겨 적용. (Pick = 고르기 전 보관소, `_미리보기` 삭제 금지.)

## 4. 에셋 소스 규칙 (가장 중요) — 항상 고화질, 직접 그리지 말 것
> 우선순위: **① Another Red(C) / 공식 PokeAPI(A) → ② pokemondb(B) → ③ 그래도 없을 때만 PokeRogue(D) 폴백.** 항상 최고화질, 픽셀만(§1.5).

**A. PokeAPI/sprites** — github raw, **CORS 열림 → Phaser에서 URL 직접 로드 가능(1순위).** 베이스 `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon`. 용도별: `/other/home/{id}.png`(512, 메뉴/도감) · `/other/official-artwork/{id}.png`(475) · `/versions/generation-v/black-white/animated/{id}.gif`(움직이는 도트, 배틀) · `/versions/generation-iv/heartgold-soulsilver/{id}.png`(80, HGSS 인게임). 헬퍼 `src/api/pokeapi.ts`.

**B. pokemondb.net** — **CORS 없음 → 반드시 다운로드해 `public/`에 넣고 쓴다**(직접 로드 시 WebGL 텍스처 깨짐). 애니 도트·게임별 다양성. `https://img.pokemondb.net/sprites/{게임}/{normal|shiny}/{이름}.png`.

**C. Another Red** (RPG Maker XP 팬게임, 로컬 원본, ⭐9세대 픽셀 핵심). **경로가 PC마다 다름**(리포 밖 → git 동기화 안 됨):
- 현재 PC(user): `/mnt/d/Pokemon Another Red_PWT_250829/` · 집 PC(ONE): `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829/`. **못 찾으면 추측 말고** `find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname "*Another*Red*" -type d`. (참고: 태초마을=Map55, 레드의방 2F=Map155, 오박사 연구소 내부=Map157.)
- **쓸 수 있는 것:** `Graphics/`(PNG) + `Audio/` + `Fonts/` → public/assets로 복사. **`Data/*.rxdata`(맵 배치·Ruby 스크립트)도 rubymarshal로 읽힌다** (memory [[ar-extraction]], `tools/ar-map/rxrender.py`) — 예전 "맵/스토리 로직은 못 가져옴"은 **틀린 서술.**
- **Front 스프라이트 = 가로로 이어붙인 정사각 프레임 애니시트**(프레임=이미지높이, 개수=너비/높이). 파일명 대문자, 변형 `_1`/`_female`. 로더 `src/game/pokemonSprite.ts`의 `frontPath` + `makeAnimatedFront`.
- 이미 복사됨: Front/Icons/Characters/Tilesets(~62MB). 더 필요할 때(뒷모습·Followers·트레이너배틀·배경·UI): `node tools/import-from-anotherred.mjs "<AR경로>" <back|followers|trainers|battlebacks|ui>`.

**D. PokeRogue** (사용자 포크, 폴백 — AR·공식에 마땅한 게 없을 때만, 2026-07 확정). 에셋 본체 = 서브모듈 **`pagefaultgames/pokerogue-assets`**(branch `beta`), raw `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/<경로>`(CORS 열림, 쓸 것만 `public/assets/`로 복사). 포켓몬 스프라이트는 **PNG+JSON 아틀라스**(`load.atlas`, 단순 프레임 슬라이스 아님). 아이콘 = `pokemon_icons_<세대>.png`+`.json`.

⚠️ **AR·PokeRogue 모두 개인 포트폴리오·비상업 한정**(재배포/상업화 금지, 무거우니 쓰는 것만 git에). **GIF는 Phaser가 첫 프레임만 읽음** → 스프라이트시트로 변환 후 로드.

## 5. 코드 컨벤션
- 주석은 한국어로 초보(Java 스윙 경험자)도 이해 가능하게. 도트는 텍스처별 `setFilter(Phaser.Textures.FilterMode.NEAREST)`(전역 `pixelArt`는 끔 — 부드러운 일러스트 깨지므로). 화면 `Scale.RESIZE`로 창 꽉 채움, 좌표는 `this.scale.width/height` 기준 비율 배치.

## 6. 장면 확인 · 진행 (사용자 확정 워크플로 — 항상 적용)
- **새 씬은 `DebugMenuScene`에 등록**(타이틀 **D키 → DebugMenuScene**에서 숫자키로 바로 진입) → `src/scenes/DebugMenuScene.ts`. 사용자가 매번 인트로/이동 안 거치고 그 화면만 바로 확인.
- **look(생김새)이 갈리는 UI**(가방·메뉴·박스·저장 등)는 임의 확정 말고 **2~3개 스타일 변형을 playwright 실제 스샷으로 Pick에 넣고(+비교 몽타주) 사용자가 고른다**(§3 후보규칙과 동일 철학 — 기능은 내가 만들되 look은 사용자 결정).
- 현재 진행상태(무엇이 됐고 뭐가 남았나)는 memory [[starter-lab-flow]] 참조(문서에 고정 서술하면 stale 위험).

## 7. 작업 일지 규칙
사용자가 "작업일지 작성"(동일 의도 포함) 하면: **`<repo-root>/00_ImportBox/작업일지/`**(git 동기화됨)에 **`MMDD_PokemonWith_작업일지.md`** 한 파일로 만든다(날짜 하위폴더 만들지 않음, 같은 날 파일 있으면 덮지 말고 이어 보강). 리포 루트는 `git rev-parse --show-toplevel`(절대경로 박지 말 것 — 폴더명·드라이브가 PC마다 다름). **내용:** 오늘 한 것(무엇/왜/어느 파일)·주의사항·다음 이어서 할 스텝·그날 새로 바뀐 지침/skills/memory 요지(다른 PC의 Claude가 이 문서만 보고 이어받게). git 동기화 안 되는 것(memory·`~/.claude` skills)만 현재 PC **바탕화면 `PokemonWith_이관_MMDD/`**에 사본을 두고 그 경로를 사용자에게 알린다(리포 안엔 이관폴더 X). 이관할 게 없으면 md 파일만.

## 8. 스킬 자동 라우팅 (자연어 → 스킬)
> 사용자는 한국어 자연어로 말한다. 아래 의도가 보이면 **바로 코딩하지 말고 해당 스킬을 먼저 발동**해 그 절차·함정을 따른다(스킬 = 이 프로젝트의 검증된 작업법). 여러 개 걸치면 주된 것부터.

| 이런 말/의도가 보이면 | 발동할 스킬 |
|---|---|
| 실행·빌드·"왜 안 떠"·화면 안 바뀜·exe 다시 구워·스크린샷·플레이테스트 | `build-run-debug` |
| 자동으로 클릭/이동 눌러보며 검증·"진짜 되는지 테스트"·콘솔 에러 잡기·특정화면 자동확인(Playwright) | `webapp-testing` |
| 배틀·전투·데미지 계산·타입 상성·기술/스탯 | `turn-battle-system` |
| 마을맵·타일맵·칸(격자) 이동·충돌·문/워프 | `tiled-map-grid-movement` |
| 스프라이트·에셋·타일셋·도감 받아·소스 비교·"후보 뽑아와" | `pokemon-asset-pipeline` |
| 새 씬·씬 전환·화면 넘어가게 | `phaser-scene-builder` |
| 저장·불러오기·이어하기·세이브 | `save-state-system` |
| 집 꾸미기·가구·컨디션·집↔배틀 연결 | `home-bonus-system` |
| UI·메뉴·HUD·텍스트박스·"예쁘게/간지나게/촌스러워" | `game-ui-hud-polish` |

- 에셋·디자인은 §3 후보규칙, §1.5 확정 디자인을 함께 따른다. **추측 금지 — 의도 애매하면 인계문서/Pick 미리보기로 확인 후 착수.**
