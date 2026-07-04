# myPokemon — 프로젝트 규칙 & 기본 틀

> 이 파일이 이 프로젝트 규칙의 **단일 원본(source of truth)** 이다.
> Claude / Codex / Cursor 등 **모든 AI 도구가 읽는 공통 표준 파일**이다. (CLAUDE.md 는 이 파일을 불러올 뿐)
> 어떤 AI든 이 폴더에서 작업을 시작하기 전 이 규칙을 먼저 읽고 따른다.

## 1. 이 게임이 뭔가
- **2D 탑다운 포켓몬 팬게임.** 하트골드(HGSS) 같은 맵 이동 + 턴제 배틀.
- **차별점(내 색):** "집 꾸미기"가 단순 장식이 아니라 포켓몬 **컨디션**을 올리고 그게 **배틀**로 이어진다.
  (예: 불꽃 포켓몬을 벽난로 옆에서 재우면 컨디션 ↑ → 배틀에서 더 강함)
- **목표 퀄리티: 포켓몬 팬게임 "어나더 레드(Another Red)" 수준.** 즉 어설픈 프로토타입이 아니라
  제대로 된 고화질 도트/UI/맵을 갖춘 완성도. → **에셋은 항상 고화질로, 손으로 그리지 말 것.**

## 1.5 확정 디자인 결정 (사용자 지정 — 임의 변경 금지)
> 사용자가 직접 정한 절대 규칙. 다른 걸 제안하거나 바꾸지 말 것. 새 대화에서도 이걸 기본으로 따른다.
- **화풍 = 픽셀(도트) 전용.** 매끈한 일러스트(공식 아트워크, PokeAPI HOME 512 등)는 **인게임 에셋으로 금지.**
  "고화질/최품질/공식에 가까운"이라고 해도 = **"최고 품질의 픽셀"**을 뜻함 (일러스트 아님).
- **남자 주인공 = 1세대 RED.**
- **여자 주인공 = 4세대 DAWN(4세대).**
- **라이벌 = 네모(Nemona, 9세대 SV).** 어나더레드 픽셀 사용(오버월드 `characters/trainer_NEMONA.png` 32x48 4방향, 배틀 `Trainers/NEMONA.png`). 어나더레드의 CHAMPION/LEADER_Nemona는 NEMONA와 동일 복제본이라 디자인은 1종뿐.
- **이름창 공개 규칙:** 캐릭터 이름은 **본인이 처음 자기소개할 때부터** 뜨고, 그 전엔 `???`. 단 배틀 안 하는 일반 NPC(엄마·간호순·오박사 등)는 처음부터 이름 그대로(예: `반바지 꼬마`).
- 트레이너 픽셀 자동 소스 최고 = Another Red HD 128px. 더 위(공식 원본)는 The Spriters Resource인데 봇 차단이라 수동 다운로드만 가능.
- **대화 UI 규칙:** 말하는 사람이 있는 대사는 대화박스 위에 **이름창(작은 박스)** 을 붙인다. 상황 설명·나레이션(예: "…", "여기는 어디지…?")은 **이름창 없이** 박스만. (구현: `IntroScene`의 `setSpeaker`/`applySpeaker`)
- **인트로 진행 = 성별 선택 → 이름 입력 순서.** 성별·이름 입력은 각각 **대화 위 오버레이가 아닌 전용 화면**으로 분리(오박사·박스 숨김). 이름 화면엔 선택한 성별 카드를 같이 띄우고, 이름 확정 시 **예/아니오** 확인(아니오면 다시 입력).

## 2. 기술 스택 / 실행
- **Phaser 3** (게임 엔진) · **TypeScript** · **Vite** (개발 서버/빌드).
- 실행: 프로젝트 폴더에서 `npm run dev` → 브라우저로 **http://localhost:5180** (포트 고정).
- 빌드: `npm run build` · 에셋 다운로드: `npm run fetch [도감번호...]`
- **데스크톱 앱(Electron) 실행:**
  - 🟢 가장 쉬움: 폴더의 **`게임실행.bat` 더블클릭** (Windows. 최초엔 자동 npm install 후 실행)
  - 한 줄 명령: **`npm run app`** = dev서버 + 창을 한 번에 (wait-on으로 서버 뜬 뒤 electron 실행, 창 닫으면 둘 다 종료)
  - 수동(2터미널): `npm run dev` + `npm run electron`
  - 진입점(main) = `electron/main.cjs`.
- **⭐ 실행본(exe) 굽기 = 사용자가 더블클릭하는 본체 (2026-07 확정, 자세히는 memory `launch-via-bat-only`):**
  - 사용자 본체 = `build_win/win-unpacked/PokemonWith.exe` (어나더레드 Game.exe 격). **코드 고치면 다시 굽기 전까진 exe에 반영 안 됨** — 굽기 빼먹으면 "안 바뀐다" 분노 발생.
  - **평상시 굽기(코드만 변경) = `npm run app:bake`** (= `tools/bake-exe.sh`: build로 dist 굽고 기존 app.asar 안 dist만 교체 — 빠름).
  - ⚠️ **`npm run app:build`(= 그냥 electron-builder)는 WSL에서 리눅스 타겟을 굽는 헛수고.** 전체 재빌드(electron/네이티브 의존성 변경)만 **`npx electron-builder --win --x64`** 사용.
  - 굽기 전 **게임(PokemonWith.exe) 먼저 종료** (dll 잠기면 `unlinkat input/output error`로 실패): `powershell.exe -NoProfile -Command "Get-Process -Name 'PokemonWith' -EA SilentlyContinue | Stop-Process -Force"`.
  - 출력 폴더 = **`build_win`** 으로 통일(package.json `directories.output`과 일치). 우회용 `build_new`는 폐기.
  - 최상위·바탕화면 실행은 **바로가기(`.lnk`)** 로 제공(`Pokemon_With\PokemonWith.lnk`, `Desktop\PokemonWith.lnk` → build_win exe). exe는 옆 dll·app.asar와 같이 있어야 하니 **혼자 옮기면 깨짐.** `*.lnk`는 .gitignore. 폴더명 바꾸면 .lnk 재생성.
  - 자주 굽지 말 것: 패키징(~200MB)은 변경량 무관 매번 일정시간 → 여러 수정 모아 dev로 확인 후 **체크포인트마다 1회만** 굽기.
  - WSLg에서 WebGL 막히면 `electron/main.cjs`의 `ignore-gpu-blocklist`/`enable-unsafe-swiftshader` 플래그가 풀어줌(실제 윈도우엔 영향 없음). WSL 실행 시 `--no-sandbox` 필요할 수 있음.
  - ⚠️ `npm install` 시 Electron 본체(~216MB)를 GitHub에서 받는데 `504` 뜨면 미러 사용:
    `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install` (윈도우 CMD는 `set ELECTRON_MIRROR=...`)

### ⚠️ 반드시 기억할 함정 (이것 때문에 몇 시간 날림)
- 이 프로젝트는 **D 드라이브(`/mnt/d`)** 에 있다. WSL에서 윈도우 드라이브는 **파일 변경 감지(inotify)가 안 됨.**
- 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`** 설정이 들어가 있다. **절대 지우지 말 것.**
  이게 없으면 코드를 고쳐도 브라우저에 반영이 안 되고, 서버 curl로는 새 코드가 보여서 디버깅이 미궁에 빠진다.
- 코드 수정 후 화면이 안 바뀌면 → 브라우저에서 **`Ctrl+Shift+R`** (강력 새로고침) 한 번.
- `localhost`는 윈도우에서 `wslrelay.exe`가 WSL 서버로 포워딩해준다 (정상).

### ⭐ 집 내부 맵 충돌격자 규칙 (눈대중 금지 — 2026-07 확정, 자세히는 memory `collision-grid-from-raw-png`)
- **충돌격자를 게임 실행화면 눈대중으로 찍지 말 것.** 매번 어긋난다(몇 주째 반복된 분노의 근본원인). 화면은 스케일·중앙정렬·스프라이트겹침으로 셀 경계를 착각하게 만든다.
- **정답: 방 원본 PNG(`public/assets/house/*.png`, 640×480 = 20×15칸 ×32px)에 PIL로 32px 격자+좌표라벨+blocked/warp 오버레이를 얹어 셀↔가구 1:1로 맞춘다.** 가구 사각형 좌표로 blocked를 **스크립트 생성**(눈대중 숫자 타이핑 금지) → 원본에 다시 얹어 검증 → 게임 주행 검증. 큰 가구뿐 아니라 **작은 소품 픽셀까지** 훑는다.
- **계단 규칙(사용자 확정):** 계단 그림의 **파란 난간은 밟기 금지(막음)**, **노란 발판만** 층이동. **카펫에서 계단으로 진입이 정답 루트.** rooms.json warp의 `climb`(=[[dx,dy],...] 경로)로 그림 계단방향대로 대각선 오르게 하고 도착점은 상대 계단 입구 아래로.
- **가구 뒤로 지나가게 하는 평면 전경 오버레이 금지** — 캐릭터 머리가 잘려 보임(사용자 격노). `overImg`는 `setVisible(false)`로 꺼둠. 캐릭터를 그냥 앞에 그리는 게 표준(넣으려면 per-가구 Y정렬 필요).
- **"고쳤는데 똑같다" 함정:** ①브라우저 HTTP 캐시 → `this.load` URL에 `?v=`+Date.now() + `cache.json.remove` ②vite dev서버는 켠 뒤 새로 만든 public 파일을 안 잡음(text/html 폴백) → **새 에셋 만들면 dev서버 재시작 필수**(`curl -w '%{content_type}'`가 image/png 아니면 재시작).

## 3. 폴더 구조 & 사용 규칙
```
myPokemon_AJ/
├─ index.html              게임이 열리는 첫 페이지
├─ public/                 ★ 정적 에셋은 전부 여기. (string 경로로 로드하는 파일은 반드시 여기 둬야 build에 포함됨)
│  └─ assets/
│     ├─ sprites/          캐릭터 도트 시트 (예: trainers.png = FRLG 트레이너)
│     ├─ characters/       Another Red 오버월드 (주인공 boy_/girl_, HGSS_trainer_*, NPC_*)
│     ├─ tilesets/         맵 타일셋 (town.png + Another Red 타일셋들, 이름에 공백/유니코드 있음)
│     ├─ audio/            효과음/BGM (현재 비움 — 필요시 import)
│     └─ pokemon/
│        ├─ front/         ★ Another Red 9세대 포함 "애니메이션" 배틀 스프라이트 (이름 대문자, 예: KORAIDON.png)
│        ├─ icons/         파티/박스 아이콘 시트 (128x64 = 64x64 2프레임)
│        └─ <도감번호>/    PokeAPI에서 받은 고화질 (artwork/home/anim.gif)
├─ src/
│  ├─ main.ts              진입점. Phaser 게임 설정(해상도/스케일/씬 등록).
│  ├─ api/                 외부 데이터/이미지 소스 (pokeapi.ts = PokeAPI 헬퍼)
│  ├─ game/                게임 공용 렌더 헬퍼 (pokemonSprite.ts = Another Red 애니 스프라이트 로더)
│  ├─ scenes/              화면 단위. Phaser.Scene 상속. (Title/World/Battle/House)
│  ├─ data/                "정보"만 담는 타입/데이터 (Pokemon, Player, HouseLayout, furniture)
│  └─ systems/             계산·규칙 로직 (battle 데미지, homeBonus 집보너스, save 저장)
├─ tools/                  스크립트 (fetch-pokemon.mjs = PokeAPI 다운로더 / import-from-anotherred.mjs = AR 추가복사)
└─ vite.config.ts          ★ usePolling 설정 (위 함정 참고)
```
**규칙:**
- 화면/장면 = `src/scenes/`, 데이터 타입 = `src/data/`, 계산 로직 = `src/systems/`, 외부 소스 = `src/api/`. 섞지 말 것.
- 에셋 파일(png/gif/mp3 등)은 **무조건 `public/assets/` 아래.** `src/`에 두지 않는다.
- 코드에서 로드할 땐 `"assets/..."` 경로 (앞에 `/` 없이). 예: `this.load.image("tiles","assets/tilesets/town.png")`.

### ⭐ 후보 고르기 규칙 (사용자 확정 워크플로)
사용자가 **"~ 후보 추려서 보여줘 / 정리해줘 / 내가 고를게"** 라고 하면:
1. 후보 에셋을 **`01_Resources/Pick/<카테고리>/`** 아래에 정리해 넣는다. (예: `06_인게임캐릭터/{남,여}`, `07_집/{내부,외부}`)
2. 성별·종류 등으로 **하위 폴더**를 나누고, 파일명에 **번호+설명**(예: `남_01_RED_정통.png`)을 붙여 고르기 쉽게.
3. 여러 개를 한눈에 비교할 땐 **미리보기 몽타주 PNG**(그리드+파일명 라벨)도 같이 만들어 같은 폴더에 둔다.
4. **사용자가 고른 뒤에야** 해당 에셋을 `public/assets/`로 옮기고 코드에 적용한다. (Pick은 "고르기 전 보관소")

## 4. 에셋 소스 규칙 (가장 중요) — 항상 고화질
직접 그리지 말고 **아래 소스에서 가져온다.** 항상 **가장 고화질** 버전을 쓴다.

### A. PokeAPI/sprites — github raw (https://github.com/PokeAPI/sprites)
- **CORS 열림(`*`) → Phaser에서 URL로 바로 로드 가능.** 1순위 소스.
- 베이스: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon`
- 화질/용도 (검증 완료, 레쿠자 384 기준):
  | 경로 | 크기 | 용도 |
  |---|---|---|
  | `/other/home/{id}.png` | **512×512** (최고화질) | 메뉴/도감/타이틀 1순위 |
  | `/other/official-artwork/{id}.png` | 475×475 | 공식 일러스트 |
  | `/versions/generation-v/black-white/animated/{id}.gif` | 움직이는 도트 | 배틀(애니) |
  | `/versions/generation-iv/heartgold-soulsilver/{id}.png` | 80×80 | HGSS 감성 인게임 도트 |
- 헬퍼: `src/api/pokeapi.ts` 의 `homeUrl/artworkUrl/animatedGifUrl/hgssUrl/spriteUrl`.

### B. pokemondb.net (https://pokemondb.net/sprites ← 이미지 브라우징용)
- **CORS 없음 → Phaser에서 직접 로드 불가(WebGL 텍스처 깨짐). 반드시 다운로드해서 `public/`에 넣고 쓴다.**
- 가치: 애니메이션 도트, 특정 게임별 도트 다양성, 고화질 아트워크(JPEG).
- URL 패턴: `https://img.pokemondb.net/sprites/{게임}/{normal|shiny}/{이름}.png`,
  애니 `.../{게임}/anim/normal/{이름}.gif`, HOME `sprites/home/normal/{이름}.png`, 아트워크 `artwork/large/{이름}.jpg`.

### C. Another Red (RPG Maker XP 팬게임, 로컬 원본) ⭐ 9세대 픽셀의 핵심
- 원본 위치는 **PC마다 다르다**(리포 밖 소스라 git 동기화 안 됨) — 절대경로를 맹신하지 말고 아래로 확인:
  - **학원/현재 PC(user)**: `/mnt/d/Pokemon Another Red_PWT_250829/` (= `D:\Pokemon Another Red_PWT_250829\`).
  - **집 PC(ONE)**: `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829/` (작업일지에 이 경로로 적힐 수 있음 — 이 PC 얘기 아님).
  - **못 찾으면 추측 말고 탐색**: `find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname "*Another*Red*" -type d`. (참고: MapInfos 기준 태초마을=Map055, 오박사 연구소 내부=Map157 "Pokémon Lab".)
- **쓸 수 있는 것:** `Graphics/`(PNG 이미지) + `Audio/`(음악·효과음) + `Fonts/`. → public/assets로 복사해서 사용.
- **못 쓰는 것:** `Data/*.rxdata` = RPG Maker 바이너리(맵 배치·Ruby 스크립트). **맵/스토리 로직은 직접 못 가져옴** → 타일셋 "그림"만 쓰고 맵 배열·로직은 Phaser로 재구성(참고용).
- **포켓몬 Front 스프라이트 = 가로로 이어붙인 정사각 프레임 애니메이션 시트** (프레임=이미지높이, 개수=너비/높이). 9세대 전부 애니 포함(KORAIDON/OGERPON/SPRIGATITO...). 파일명 **대문자**, 변형은 `_1`,`_female` 등.
  → 로더: `src/game/pokemonSprite.ts` 의 `frontPath(name)` + `makeAnimatedFront(scene, key, x, y, scale)`.
- 이미 복사된 핵심 세트: Front(전체) / Icons / Characters(Followers 제외) / Tilesets. **약 62MB.**
- 더 필요할 때(뒷모습·Followers·트레이너배틀·배경·UI): `node tools/import-from-anotherred.mjs "<AR경로>" <back|followers|trainers|battlebacks|ui>`.
- ⚠️ 팬게임 에셋 → **개인 포트폴리오·비상업 한정.** 재배포/상업화 금지. 무거우니 git엔 쓰는 것만 골라 넣는다.

### 공통 규칙
- **GIF는 Phaser가 첫 프레임만 읽는다.** 움직이는 도트가 필요하면 GIF → 스프라이트시트로 변환 후 로드. (Another Red Front는 이미 PNG 시트라 바로 애니됨)
- 자주 쓰는 에셋은 `npm run fetch <도감번호...>` 로 받아 `public/assets/pokemon/`에 두면 빠르고 오프라인 OK.
- 더 좋은 고화질 소스를 찾으면 써도 된다. **단 CORS 여부를 먼저 확인**하고(없으면 다운로드 방식), 화질은 최대로.
- 트레이너/오버월드·타일맵은 github의 phaser 포켓몬 클론 레포에서 가져옴
  (현재 트레이너: jvnm-dev/pokemon-react-phaser 의 FRLG 캐릭터 시트, 24×32 프레임).

## 5. 코드 컨벤션
- 주석은 한국어로, 초보자도 이해할 수 있게 (이 사람은 게임 개발 입문자, 예전 Java 스윙 경험 있음).
- 도트 스프라이트는 또렷하게: 해당 텍스처에 `setFilter(Phaser.Textures.FilterMode.NEAREST)`.
  (전역 `pixelArt`는 켜지 않음 — 부드러운 일러스트가 깨지므로. 도트만 개별 NEAREST 처리)
- 화면은 `Scale.RESIZE`로 창 꽉 채움. 좌표는 `this.scale.width/height` 기준으로 비율 배치.

## 6. 진행 상황 / 다음 할 일
- [x] 기본 골격(폴더/씬/타입), 타이틀 화면(스타팅 3마리 일러스트), 맵 이동(FRLG 트레이너 4방향)
- [x] PokeAPI 연동 + 에셋 다운로더 + 고화질 소스 정리
- [x] Electron(데스크톱 앱/.exe) 설정
- [x] Another Red 에셋 도입(9세대 포함) + 배틀 데모(맵에서 B키 → 9세대 애니 스프라이트 2마리)
- [ ] **진짜 마을 맵** (Another Red Tilesets 로 Tiled 타일맵) ← 다음 우선순위
- [ ] 칸(격자) 단위 이동 + 충돌, 주인공을 Another Red 오버월드(boy_)로 교체
- [ ] 배틀 제대로: 내 포켓몬 Back 스프라이트(import back) + PokeAPI 스탯 + 데미지 계산
- [ ] 스타팅 선택 → 배틀 → 집 꾸미기 → homeBonus 연결

## 7. 작업 일지 규칙 (항상 적용)
사용자가 **"오늘 작업 일지를 작성하자"**(또는 "작업일지 작성", "오늘 작업일지 써줘" 등 동일 의도)라고 하면 아래를 수행한다.

> **경로 처리(중요):** 사용자는 여러 PC를 오가며 작업한다.
> - **집 PC** = `C:\Users\ONE\Documents\GitHub\Pokemon_With` (WSL `/mnt/c/Users/ONE/Documents/GitHub/Pokemon_With`)
> - **학원/현재 PC** = `D:\dev\Pokemon_With` (WSL `/mnt/d/dev/Pokemon_With`)
> - 두 PC 모두 리포 루트 폴더명 = **`Pokemon_With`** 로 통일한다(집 PC를 `...\GitHub\AJ_Proj\vcPortfolio_AJ` → `...\GitHub\Pokemon_With` 로 이사, AJ_Proj 밖으로 단독 분리). 아직 옛 폴더명(`vcPortfolio_AJ`)으로 보이면 이사 미완인 PC다.
> - ⚠️ 폴더명·드라이브가 PC마다/이사 시점마다 다를 수 있으므로 **절대경로를 박지 말고 항상 리포 루트 기준 상대경로로 처리한다.** 리포 루트는 `git rev-parse --show-toplevel`로 잡는다.
> - **기준 폴더 = `<repo-root>/00_ImportBox/작업일지/`** (리포 안, git 추적되어 PC 간 동기화됨. 없으면 만든다). 날짜는 `MMDD` 형식(예: `0701`).

1. **작업일지는 항상 리포 안에 md 파일 하나로(날짜 하위폴더 만들지 않음):** `<repo-root>/00_ImportBox/작업일지/` 안에 바로 **`MMDD_PokemonWith_작업일지.md`** 파일을 만든다(예: `0701_PokemonWith_작업일지.md`). 이관 파일이 있든 없든 **`MMDD/` 같은 날짜 하위폴더는 만들지 않는다.** 일지는 깃으로 PC 간 동기화되므로 리포 안에 두면 된다. 같은 날 파일이 이미 있으면 덮어쓰지 말고 이어서 보강한다.
2. **다른 PC로 옮겨야 할 추가 이관 자료는 항상 바탕화면에 둔다(리포 안 X):** 다른 PC로 옮겨야 하는 것 = 대개 **깃에 안 잡히거나 잡히면 안 되는 것**(메모리·`~/.claude` skills 등. 애매하면 `git check-ignore <경로>`로 확인). 이런 자료가 있으면 **현재 PC의 바탕화면(Desktop)에 `PokemonWith_이관_MMDD/` 폴더**를 만들어 거기에 사본을 넣고, **작업 보고 때 그 절대경로를 사용자에게 알려** 사용자가 직접(USB/클라우드 등) 옮기게 한다. **리포 안에는 이관용 폴더를 만들지 않는다.** (집 PC Desktop = `/mnt/c/Users/ONE/Desktop`; 현재 PC Desktop = `/mnt/c/Users/user/Desktop`. 다른 PC는 그 PC의 실제 Desktop 경로를 확인해 사용. 깃으로 정상 동기화되는 파일은 이관 대상 아님 — 커밋만 하면 됨.)
3. **일지 내용(꼼꼼히):**
   - 오늘 작업한 내용(무엇을, 왜, 어떤 파일/경로에)
   - 특별 사항 / 주의사항 / 유의사항
   - 마무리되지 않은 작업이 있으면 **다음에 이어서 해야 할 작업**(구체적 다음 스텝·열어야 할 파일·미결정 사항)
   - **그날 새로 추가/변경된 "기억해야 할 지침·작업 방향·규칙"**(예: 이 `AGENTS.md`/`CLAUDE.md` 지침 변경, 합의된 작업 방향·결정)과 **새로 추가/변경된 skills**(이름·용도·언제 발동하는지)와 **중요 메모리(`~/.claude/.../memory/`) 추가·변경 요지**를, 다른 PC의 Claude가 즉시 파악할 수 있도록 **일지 본문에 요약**한다. (변경 자체의 사본 이관이 필요하면 아래 4번 이관 대상으로도 함께 처리)
   - **다른 PC의 Claude가 이 문서만 보고도 막힘없이 매끄럽게 이어 작업할 수 있도록** 충분한 맥락(경로, 명령, 결정 배경, 검증 방법)을 적는다.
4. **이관 자료 대상:** 그날 추가/변경된 **주요 메모리(`~/.claude/.../memory/`)나 skills 등 깃 동기화가 안 돼 다른 PC로 직접 옮겨야 하는 내용**의 사본(→ 바탕화면 `PokemonWith_이관_MMDD/`). 이관할 게 없으면 바탕화면 폴더도 만들지 않고 1번(일지 md 파일만)으로 끝낸다.

## 8. 스킬 자동 라우팅 (자연어 → 스킬)
> 사용자는 한국어 자연어로 말한다. 아래 의도가 보이면 **바로 코딩하지 말고 해당 스킬을 먼저 발동**해 그 절차/함정을 따른다(스킬 = 이 프로젝트의 검증된 작업법). 여러 개 걸치면 주된 것부터. 이 표는 스킬 `description` 자동매칭의 보조 리마인더다.

| 이런 말/의도가 보이면 | 발동할 스킬 |
|---|---|
| 실행·빌드·"왜 안 떠"·화면 안 바뀜·exe 다시 구워·스크린샷·플레이테스트 | `build-run-debug` |
| 배틀·전투·데미지 계산·타입 상성·기술/스탯 | `turn-battle-system` |
| 마을맵·타일맵·칸(격자) 이동·충돌·문/워프 | `tiled-map-grid-movement` |
| 스프라이트·에셋·타일셋·도감 받아·소스 비교·"후보 뽑아와" | `pokemon-asset-pipeline` |
| 새 씬·씬 전환·화면 넘어가게 | `phaser-scene-builder` |
| 저장·불러오기·이어하기·세이브 | `save-state-system` |
| 집 꾸미기·가구·컨디션·집↔배틀 연결 | `home-bonus-system` |
| UI·메뉴·HUD·텍스트박스·"예쁘게/간지나게/촌스러워" | `game-ui-hud-polish` |

- 에셋·디자인 관련은 §3의 ⭐후보 규칙, §1.5 확정 디자인을 함께 따른다. **추측 금지 — 의도 애매하면 인계문서/Pick 미리보기로 확인 후 착수**(반복 지적 사항).

