# 03. 어나더레드 맵(.rxdata) 추출 파이프라인 + 미완 작업 체크포인트

> ⭐ **이게 오늘(2026-06-24) 새로 한 작업이다.** 집 PC에서 이걸 이어서 해야 한다.
> 메모리 `ar-map-rxdata-pipeline.md`와 같은 내용 + 더 자세히.

---

## 0. 한 줄 요약

예전엔 "어나더레드 `.rxdata` 맵은 못 가져온다"(AGENTS.md §4-C)고 적혀 있었는데, **틀렸다 — 읽을 수 있다.** `rubymarshal`로 파싱해서 실제 맵 그림 + 충돌 격자 + 워프 정보를 뽑아냈다. 그걸로 **주인공 시작 집(2F 방 ↔ 1F 거실)**을 만드는 중이고, **마지막 한 조각(`InteriorScene.ts`)이 아직 안 됐다.**

> ⚠️ 그래서 `myPokemon_AJ/AGENTS.md` §4-C의 "맵/스토리 로직은 직접 못 가져옴"은 **타일셋 그림 한정으로 맞고, 맵 배열/충돌/워프는 이제 가져올 수 있다**로 이해하면 된다.

---

## 1. 필요 환경 (집 PC 체크)

- `pip install --user --break-system-packages rubymarshal` (+ Pillow). → `01_작업환경_OS_도구.md` §4
- 어나더레드 원본 폴더: `/mnt/d/Pokemon Another Red_PWT_250829` (= `D:\...`). git에 없으니 따로 있어야 함.
- 파싱 스크립트: `myPokemon_AJ/tools/ar-map/extract.py`, `rxrender.py` — **git로 따라옴(tracked).** 단 스크립트 안의 `AR=` / `PUB=` 경로가 학원 PC 절대경로로 박혀 있으니 **집 PC 경로로 고쳐야 한다.**

---

## 2. .rxdata 구조 (검증된 파싱 규칙)

`.rxdata` = Ruby Marshal 바이너리. `from rubymarshal.reader import loads`로 읽음. 맵 총 388개.

- **`Map###.rxdata`** → attributes: `@tileset_id`, `@data`(Table), `@events`, `@width`/`@height`.
- **Table `_private_data`** 디코드: 앞 20바이트 `struct '<5i'` = (dim, xs, ys, zs, total), 이어서 `int16 * xs*ys*zs`. 인덱스 = `x + xs*y + xs*ys*z`. (z = 레이어 0/1/2)
- **`Tilesets.rxdata[id]`** → `@tileset_name`(→ `Graphics/Tilesets/<name>.png`), `@autotile_names`(7개 → `Graphics/Autotiles/`), `@passages`(Table 1D = 통행/충돌).
- **타일 렌더 규칙:**
  - `tid >= 384` → 타일셋 PNG의 `(tid-384)`번 타일 (가로 **8칸**, 타일 **32px**).
  - `tid < 384`, `n = tid // 48` → 오토타일 n의 대표타일 = 그 autotile PNG의 `crop(0,32,32,64)`.
  - `tid == 0` → 빈칸.
- **충돌:** `(passages[tid] & 0x0f) == 0x0f` 이면 **막힘**(벽/가구), `0`이면 바닥. (검증됨: 바닥0 / 가구15)
- **이동(계단/문):** event `@code == 201`(Transfer)의 `(@x,@y)` = 계단/문 위치, `@parameters[1]` = 대상 맵 ID.

---

## 3. 주요 맵 ID (검증됨)

| Map ID | 정체 |
|---|---|
| **Map155** | "레드의방" = 2F 침실 (계단 (10,3)) |
| Map154 | "레드의집" 1F (※ 시작 거실로는 **안 씀** — 아래 주의) |
| **Map067** | ⭐ **사용자가 정한 시작 거실(1F)** (154 아님!) |
| Map055 | 태초마을 (바깥) |
| Map156 | 그린(라이벌) 집 |

---

## 4. 이미 만들어진 산출물 (`myPokemon_AJ/public/assets/house/`, git로 따라옴)

| 파일 | 내용 |
|---|---|
| `red_room_2f.png` | Map155(2F 방) 렌더 이미지 |
| `red_living_1f.png` | Map067(1F 거실) 렌더 이미지 |
| `rooms.json` | ⭐ **데이터 드리븐 정의** — 방별 `img`, `cols/rows`(20×15), `blocked`(충돌격자 1=막힘/0=바닥), `start`(시작칸), `warps`(계단 좌표 + 대상방 + 도착칸) |
| `bedroom_dp.png` | 이전 시안(참고) |

`rooms.json` 핵심 구조(이미 채워져 있음):
- `bedroom`: start `[9,6]`, warp `{x:10,y:3 → living, 도착 (9,10)}`
- `living`: start `[9,10]`, warp `{x:9,y:11 → bedroom, 도착 (10,4)}`

---

## 5. 🔴 진행중 — 미완 작업 (집 PC에서 여기부터)

**목표:** 시작 집 = 2F방(Map155) + 1F거실(Map067)을, **계단 전환(페이드 + 문소리)**으로 왕복하게.

남은 일(순서대로):
1. **`src/scenes/InteriorScene.ts` 작성** — `rooms.json`을 읽어 동작하는 **데이터 드리븐** 씬:
   - 방 배경 이미지 그리기 + **칸(격자) 이동** + `blocked` 기반 **충돌** + `warps`로 **방 전환**.
   - 방 전환은 **페이드 + 문소리**(`Door enter.ogg` → `assets/audio/door.ogg`로 넣기).
   - ⚠️ **정수배 스케일**로 주인공을 또렷하게(이전 `BedroomScene`은 소수배라 주인공이 뭉갰음). 도트는 `setFilter(NEAREST)`.
2. **`src/main.ts`에 `InteriorScene` 등록.**
3. **`IntroScene` / `DebugMenuScene`이 `BedroomScene` 대신 `InteriorScene`(room:'bedroom')을 호출**하도록 교체.
4. **exe 재빌드** — `cd myPokemon_AJ && npm run build && npx electron-builder --win --x64` (메모리 `launch-via-bat-only` 규칙).

> 현재 `BedroomScene.ts`는 있지만 소수배 스케일 문제가 있어 `InteriorScene`로 대체하려는 것. InteriorScene.ts는 **아직 없음(미작성)** — 이게 마지막 조각.

---

## 6. 재추출이 필요할 때 (다른 맵 뽑기)

`tools/ar-map/extract.py`가 `process(mid, outpng)`로 맵을 PNG + 격자로 뽑는다. 다른 방/건물을 추가하려면:
1. 스크립트 상단 `AR`/`PUB` 경로를 집 PC에 맞게 수정.
2. 원하는 Map ID로 `process()` 호출(스크립트 끝부분), `rooms.json`에 방/워프 추가.
3. `rxrender.py`는 단일 맵 빠른 렌더/검증용(`RED=1 python3 rxrender.py` 식으로 썼음).
