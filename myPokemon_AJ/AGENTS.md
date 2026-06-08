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

## 2. 기술 스택 / 실행
- **Phaser 3** (게임 엔진) · **TypeScript** · **Vite** (개발 서버/빌드).
- 실행: 프로젝트 폴더에서 `npm run dev` → 브라우저로 **http://localhost:5180** (포트 고정).
- 빌드: `npm run build` · 에셋 다운로드: `npm run fetch [도감번호...]`

### ⚠️ 반드시 기억할 함정 (이것 때문에 몇 시간 날림)
- 이 프로젝트는 **D 드라이브(`/mnt/d`)** 에 있다. WSL에서 윈도우 드라이브는 **파일 변경 감지(inotify)가 안 됨.**
- 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`** 설정이 들어가 있다. **절대 지우지 말 것.**
  이게 없으면 코드를 고쳐도 브라우저에 반영이 안 되고, 서버 curl로는 새 코드가 보여서 디버깅이 미궁에 빠진다.
- 코드 수정 후 화면이 안 바뀌면 → 브라우저에서 **`Ctrl+Shift+R`** (강력 새로고침) 한 번.
- `localhost`는 윈도우에서 `wslrelay.exe`가 WSL 서버로 포워딩해준다 (정상).

## 3. 폴더 구조 & 사용 규칙
```
myPokemon_AJ/
├─ index.html              게임이 열리는 첫 페이지
├─ public/                 ★ 정적 에셋은 전부 여기. (string 경로로 로드하는 파일은 반드시 여기 둬야 build에 포함됨)
│  └─ assets/
│     ├─ sprites/          캐릭터/트레이너 도트 스프라이트시트 (예: trainers.png)
│     ├─ tilesets/         맵 타일셋
│     ├─ audio/            효과음/BGM
│     └─ pokemon/<도감번호>/  다운로드한 고화질 포켓몬 에셋 (artwork.png / home.png / anim.gif)
├─ src/
│  ├─ main.ts              진입점. Phaser 게임 설정(해상도/스케일/씬 등록).
│  ├─ api/                 외부 데이터/이미지 소스 (pokeapi.ts = PokeAPI 헬퍼)
│  ├─ scenes/              화면 단위. Phaser.Scene 상속. (Title/World/Battle/House)
│  ├─ data/                "정보"만 담는 타입/데이터 (Pokemon, Player, HouseLayout, furniture)
│  └─ systems/             계산·규칙 로직 (battle 데미지, homeBonus 집보너스, save 저장)
├─ tools/                  개발용 스크립트 (fetch-pokemon.mjs = 에셋 다운로더)
└─ vite.config.ts          ★ usePolling 설정 (위 함정 참고)
```
**규칙:**
- 화면/장면 = `src/scenes/`, 데이터 타입 = `src/data/`, 계산 로직 = `src/systems/`, 외부 소스 = `src/api/`. 섞지 말 것.
- 에셋 파일(png/gif/mp3 등)은 **무조건 `public/assets/` 아래.** `src/`에 두지 않는다.
- 코드에서 로드할 땐 `"assets/..."` 경로 (앞에 `/` 없이). 예: `this.load.image("tiles","assets/tilesets/town.png")`.

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

### 공통 규칙
- **GIF는 Phaser가 첫 프레임만 읽는다.** 움직이는 도트가 필요하면 GIF → 스프라이트시트로 변환 후 로드. (TODO 도구)
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
- [ ] **진짜 마을 맵** (FRLG/HGSS 타일셋으로 Tiled 타일맵) ← 다음 우선순위
- [ ] 칸(격자) 단위 이동 + 충돌
- [ ] 스타팅 선택 → 배틀(PokeAPI 스탯/애니 스프라이트) → 집 꾸미기 → homeBonus 연결
