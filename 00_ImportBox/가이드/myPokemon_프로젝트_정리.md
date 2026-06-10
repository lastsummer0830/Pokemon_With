# myPokemon_AJ — 프로젝트 정리

> 지금까지 잡아둔 틀(상황·목적·컨셉·기술·진행상황)을 한 곳에 정리한 문서.
> 규칙의 **단일 원본(source of truth)** 은 `myPokemon_AJ/AGENTS.md` 이며, 이 문서는 그 요약/개요다.

---

## 🎮 한눈에

**한 줄 정의:** 하트골드(HGSS) 감성의 **2D 탑다운 포켓몬 팬게임** — 맵 이동 + 턴제 배틀.

---

## 1. 왜 / 어떤 목적으로 만들었나

- **포트폴리오용 게임.** (package.json 설명에도 "포트폴리오 게임"으로 명시)
- 게임 개발 입문 중 — 예전 Java 스윙 경험이 있는 상태에서 제대로 된 결과물 하나를 만드는 게 목표.
- 그래서 **목표 퀄리티 = 팬게임 "어나더 레드(Another Red)" 수준.**
  어설픈 프로토타입이 아니라 고화질 도트/UI/맵을 갖춘 완성도를 지향한다.

---

## 2. 컨셉 / 차별점 (= 내 색)

- **"집 꾸미기"가 핵심 차별화 요소.** 단순 장식이 아니라 포켓몬 **컨디션**을 올리고, 그 컨디션이 **배틀**로 이어진다.
  - 예: 불꽃 포켓몬을 벽난로 옆에서 재우면 컨디션 ↑ → 배틀에서 더 강해진다.
- **핵심 게임 루프:** 스타팅 선택 → 배틀 → 집 꾸미기 → `homeBonus`로 배틀에 반영.
  (이 루프가 게임의 정체성)

---

## 3. 기술 스택 / 실행

| 항목 | 내용 |
|---|---|
| 엔진/언어 | **Phaser 3 + TypeScript** |
| 개발서버/빌드 | **Vite** |
| 개발 실행 | `npm run dev` → `http://localhost:5180` (포트 고정) |
| 빌드 | `npm run build` |
| 에셋 다운로드 | `npm run fetch <도감번호...>` (PokeAPI 다운로더) |
| 데스크톱 앱 | **Electron** — `게임실행.bat` 더블클릭 또는 `npm run app` (dev서버+창 한 번에) |
| .exe 패키징 | `npm run app:build` |

> Electron 진입점 = `electron/main.cjs`. `npm install` 시 Electron 본체(~216MB) 504 에러 나면 미러 사용:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

---

## 4. 폴더 구조 & 규칙

```
myPokemon_AJ/
├─ index.html              게임이 열리는 첫 페이지
├─ public/assets/          ★ 정적 에셋은 전부 여기 (build 포함되려면 필수)
│  ├─ sprites/             캐릭터 도트 시트 (FRLG 트레이너 등)
│  ├─ characters/          Another Red 오버월드 (boy_/girl_, NPC_*, berrytree_* 등)
│  ├─ tilesets/            맵 타일셋
│  ├─ audio/               효과음/BGM (현재 비움)
│  └─ pokemon/front,icons,<도감번호>/  배틀 스프라이트·아이콘·고화질
├─ src/
│  ├─ main.ts              진입점 (Phaser 게임 설정)
│  ├─ api/pokeapi.ts       외부 데이터/이미지 소스 헬퍼
│  ├─ game/pokemonSprite.ts Another Red 애니 스프라이트 로더
│  ├─ scenes/              Title / World / Battle / House
│  ├─ data/                Pokemon / Player / HouseLayout / furniture
│  └─ systems/             battle(데미지) / homeBonus(집보너스) / save(저장)
├─ tools/                  fetch-pokemon.mjs / import-from-anotherred.mjs
└─ vite.config.ts          ★ usePolling 설정 (아래 함정 참고)
```

**규칙 (섞지 말 것):**
- 화면/장면 = `src/scenes/`, 데이터 타입 = `src/data/`, 계산 로직 = `src/systems/`, 외부 소스 = `src/api/`.
- 에셋 파일(png/gif/mp3 등)은 **무조건 `public/assets/` 아래.** `src/`에 두지 않는다.
- 코드에서 로드할 땐 `"assets/..."` 경로 (앞에 `/` 없이).

---

## 5. 에셋 소스 정책 (가장 중요) — 직접 그리지 말고 항상 고화질

### A. PokeAPI/sprites (github raw) — **1순위**
- CORS 열림 → Phaser에서 URL로 바로 로드 가능.
- 베이스: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon`

  | 경로 | 크기 | 용도 |
  |---|---|---|
  | `/other/home/{id}.png` | **512×512 (최고화질)** | 메뉴/도감/타이틀 1순위 |
  | `/other/official-artwork/{id}.png` | 475×475 | 공식 일러스트 |
  | `/versions/generation-v/black-white/animated/{id}.gif` | 움직이는 도트 | 배틀(애니) |
  | `/versions/generation-iv/heartgold-soulsilver/{id}.png` | 80×80 | HGSS 인게임 도트 |

- 헬퍼: `src/api/pokeapi.ts` (`homeUrl/artworkUrl/animatedGifUrl/hgssUrl/spriteUrl`).

### B. pokemondb.net
- **CORS 없음 → Phaser 직접 로드 불가.** 반드시 다운로드해서 `public/`에 넣고 사용.
- 애니 도트·게임별 도트·고화질 아트워크(JPEG)에 유용.

### C. Another Red (RPG Maker XP 팬게임, 로컬 원본) ⭐ 9세대 픽셀의 핵심
- 원본: `D:/Pokemon Another Red_PWT_250829/`.
- **쓸 수 있는 것:** `Graphics/`(PNG) + `Audio/` + `Fonts/` → public/assets로 복사.
- **못 쓰는 것:** `Data/*.rxdata`(RPG Maker 바이너리 = 맵 배치·Ruby 스크립트) → 타일셋 "그림"만 쓰고 맵 배열·로직은 Phaser로 재구성.
- 포켓몬 Front = 가로로 이어붙인 정사각 프레임 애니 시트 (9세대 전부 애니 포함). 파일명 대문자.
  로더: `src/game/pokemonSprite.ts` 의 `frontPath(name)` + `makeAnimatedFront(...)`.
- 더 필요 시: `node tools/import-from-anotherred.mjs "<AR경로>" <back|followers|trainers|battlebacks|ui>`.
- ⚠️ 팬게임 에셋 → **개인 포트폴리오·비상업 한정.** 재배포/상업화 금지.

### 공통
- **GIF는 Phaser가 첫 프레임만 읽음** → 움직이는 도트는 스프라이트시트로 변환 후 로드.
- 새 고화질 소스 OK, 단 **CORS 여부 먼저 확인** (없으면 다운로드 방식), 화질은 최대로.

---

## 6. ⚠️ 치명적 함정 (이것 때문에 시간 날림)

- 프로젝트가 **`/mnt/d`(윈도우 드라이브)** 에 있어서 WSL inotify(파일 변경 감지)가 안 됨.
- 그래서 `vite.config.ts`에 **`server.watch.usePolling: true`** 가 들어가 있다. **절대 지우지 말 것.**
  없으면 코드를 고쳐도 브라우저에 반영 안 되고, 서버 curl로는 새 코드가 보여서 디버깅이 미궁에 빠진다.
- 코드 수정 후 화면이 안 바뀌면 → 브라우저에서 **`Ctrl+Shift+R`** (강력 새로고침).
- `localhost`는 윈도우 `wslrelay.exe`가 WSL 서버로 포워딩 (정상).

---

## 7. 코드 컨벤션

- 주석은 **한국어로, 초보자도 이해할 수 있게** (게임 개발 입문자, 예전 Java 스윙 경험 있음).
- 도트 스프라이트는 또렷하게: 해당 텍스처에 `setFilter(Phaser.Textures.FilterMode.NEAREST)`.
  (전역 `pixelArt`는 끄기 — 부드러운 일러스트가 깨지므로 도트만 개별 NEAREST 처리)
- 화면은 `Scale.RESIZE`로 창 꽉 채움. 좌표는 `this.scale.width/height` 기준 비율 배치.

---

## 8. 진행 상황 / 다음 할 일

**완료 ✅**
- [x] 기본 골격(폴더/씬/타입) + 타이틀 화면(스타팅 3마리 일러스트) + 맵 이동(FRLG 트레이너 4방향)
- [x] PokeAPI 연동 + 에셋 다운로더 + 고화질 소스 정리
- [x] Electron(데스크톱 앱/.exe) 설정
- [x] Another Red 에셋 도입(9세대 포함) + 배틀 데모(맵에서 B키 → 9세대 애니 스프라이트 2마리)

**다음 (우선순위 순) ⬜**
- [ ] **진짜 마을 맵** — Another Red 타일셋으로 Tiled 타일맵 ← **다음 우선순위**
- [ ] 칸(격자) 단위 이동 + 충돌, 주인공을 Another Red 오버월드(boy_)로 교체
- [ ] 배틀 제대로 — 내 포켓몬 Back 스프라이트(import back) + PokeAPI 스탯 + 데미지 계산
- [ ] 스타팅 선택 → 배틀 → 집 꾸미기 → homeBonus 연결 (핵심 루프 완성)
