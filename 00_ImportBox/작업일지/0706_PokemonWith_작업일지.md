# 0706 PokemonWith 작업일지 (2026-07-06)

작업 PC: 학원/현재 PC(user) = `D:\dev\Pokemon_With` (WSL `/mnt/d/dev/Pokemon_With`).
커밋: **안 함**(사용자 요청 없었음). tsc(`npx tsc --noEmit`) 통과 확인.

---

## ⭐ 오늘 가장 중요한 교훈 (다음 PC Claude 필독 — 이거 때문에 몇 시간 날림 + 사용자 격노)

**정적 디스크 파일(맵 PNG·rooms.json)이 "라이브 실행 게임"과 다를 수 있다.**
- 이번에 침실 이미지(`red_room_2f.png`)/`rooms.json`을 그냥 PIL로 렌더해 좌표를 잡았더니, **라이브 화면(TV·PC·파란계단 있는 침실)과 전혀 다른 이미지**가 나와서 엉뚱한 좌표로 계속 헛발질함. (충돌격자 눈대중 금지 규칙과 같은 맥락 — 정적 파일도 못 믿음)
- **정답: playwright로 라이브 씬 속성을 직접 뽑아서 작업한다.** 추측/정적파일 금지.

### 라이브 씬 직접 제어·검사 방법 (검증됨)
- `window.__game` 이 노출돼 있음(`main.ts`).
- **연구소 바로 진입**(인트로 스킵): `window.__game.scene.start('LabScene',{preview:'card',pick:-1})` → 맵만 뜨고 방향키로 주행 가능(`update()`가 preview에서도 이동 허용).
- **침실 인트로 처음부터**: `registry.set('playerName','테스트'); registry.set('playerGender','boy'); registry.set('houseIntroDone',false);` 후 `scene.start('InteriorScene')`.
- 씬 인스턴스에서 직접 읽기: `s.roomKey, s.tx, s.ty, s.facing, s.def.blocked, s.origin, s.tile, s.nemona?.x/y, s.nemona?.frame?.name, s.boxText.text`.
  - 네모 프레임→방향: `<4 down, <8 left, <12 right, else up` (idleFrame: down0/left4/right8/up12).
  - 타일 변환: `tx=round((sprite.x-origin.x)/tile-0.5)`, `ty=round((sprite.y-origin.y)/tile-1)` (cy는 발밑=칸 아래끝).
- playwright launch args(WSL): `--no-sandbox --use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. headless OK.
- 대사 넘기기: `keyboard.press('Enter')`. `askYesNo`는 커서 기본 idx0("예"), **Enter=예**.
- 주행 스크립트들은 이 PC의 세션 scratchpad에 있었음(임시). 위 내용만 알면 재작성 쉬움.

---

## A. 침실 인트로 — 네모 등장/대화/퇴장 (`myPokemon_AJ/src/scenes/InteriorScene.ts`)

### 문제 (사용자 지적)
- 네모가 플레이어(스폰 **8,9**)와 **멀리 떨어진 (10,7)**에서 멈춤 → 안 붙음.
- 서로 **다른 방향 보고 대화**(네모 down, 플레이어 up인데 위치가 어긋나 마주보지 않음).
- 퇴장 시 계단에서 **마지막 프레임만 "위(=계단 위 벽)"**를 봄(계단을 안 봄).

### 수정 (`runHouseIntro` 안 `walkNemona` 2곳)
1. **진입**: `[[10,3],[11,3],[11,7],[10,7]]`,"down" → **`[[10,3],[11,3],[11,8],[8,8]]`,"down"**.
   네모가 계단서 내려와 **플레이어 바로 위 (8,8)**까지 와서 **아래(플레이어)** 봄. 직후 `this.facing="up"`(플레이어 위 봄) → **정면으로 마주봄**.
2. **퇴장**: `[[10,7],[11,7],[11,3],[10,3]]`,"up" → **`[[8,8],[11,8],[11,3],[10,3]]`,"left"**.
   계단이 **아래-왼쪽으로 내려가는** 그림이라, 마지막 걸음(왼쪽=계단 방향) 그대로 **"left"**로 서서 계단 본 채 사라짐. (예전에 "up"으로 잘못 되돌렸던 것 → 다시 "left"로 확정)

### 검증 (playwright 라이브)
- 진입 후: 네모 (8,8) dir=down / 플레이어 (8,9) facing=up → 스샷으로 마주보는 것 확인.
- 퇴장: 경로 `(8,8)→(11,8)→(11,3)→(10,3)`, **최종 (10,3) dir=left**(alpha 페이드 중 캡처), 이후 destroy, `houseIntroDone=true`.

### 라이브 침실(bedroom) 충돌격자 (cols 0~13, 실제는 20폭) — 참고용
```
row3 ########.##..#   row7 ###....##....#
row4 ###......##..#   row8 ###....#.....#
row5 ###..........#   row9 ######.......#
row6 ###....##....#   row10 ######.......#
```
스폰=(8,9). 계단 warp=(10,3)→living. TV=(7-8,6-7)+(7,8). 침실 그림=TV·PC(Mr)·책장·파란계단(9-11,3-4)·침대(bottom-left).

---

## B. 연구소 책장 충돌 (`myPokemon_AJ/public/assets/world/oak_lab.json`) + LabScene 원복

### 문제
- 책장(수납장) **위로 올라가짐**.

### 최종 결론 = **책장 솔리드(walk-around)**
- `oak_lab.json` blocked: **중앙 책장 rows 8·9 = `#####...#####`**(cols 0-4·8-12 막음), **우상단 책장 row 2 = cols 9-12 막음**.
- 플레이어는 책장을 **돌아서** 다니고, 아래에서 **앞에** 섬. 위에서 접근하면 row7(책장 바로 위)에서 멈춤.
- 상단 좌측 기계/카운터(row2 cols0-8)는 **안 막음**("앞에 서는" 가구, 사용자 미지적).

### 시도했다 버린 것 (중요 — 다시 하지 말 것)
- row9만 막기 → 아래에서 한 칸 gap("앞쪽 막혀 못 붙는다" 불만).
- row7 버퍼(위 한 칸 더 막기) → 위쪽도 gap.
- **Y정렬 전경 오버레이**(`LabScene.ts`에 책장 칸만 크롭해 캐릭터 앞에 겹쳐 Y정렬): 캐릭터가 책장 **뒤로 들어가면 2칸 책장에 거의 다 가려져 "모자 끝만 삐져나온 빨간 뭉텅이"**가 됨 → 사용자 격노 → **전부 원복**.
  - `LabScene.ts`는 원래대로 되돌림(SHELF_FG_RECTS/PLAYER_DEPTH_BASE 상수, shelfFg 필드, 오버레이 생성, layout/onComplete의 동적 depth 전부 제거. 플레이어 depth=고정 7).

### 근본 제약 (기억)
- **맵 = 통짜 이미지 1장(depth0) + 캐릭터 48px(칸 32px의 1.5배) + Y정렬 불가** → "책장에 **딱 붙기** + **안 겹치기**"가 **동시에 불가능**. 전경오버레이는 2칸 책장에선 캐릭터를 거의 다 가려 부적합.
- AGENTS.md의 "전경오버레이 금지(머리 잘림)"와 같은 이유. → **솔리드 walk-around가 이 엔진에선 최선.**

### 검증
- preview 주행: 위에서 접근 시 (3,7)/(4,7)에서 멈춤(책장 안 못 들어감), **빨간 뭉텅이 사라짐**, 캐릭터 온전히 보임. 아래에서 (x,10)에서 앞에 섬. 스샷 확인.
- tsc 통과.

---

## 오늘 바뀐 파일
- `myPokemon_AJ/src/scenes/InteriorScene.ts` — 네모 진입/퇴장 경로·최종방향(walkNemona 2곳 + 주석).
- `myPokemon_AJ/public/assets/world/oak_lab.json` — 책장 충돌(rows 2·8·9).
- `myPokemon_AJ/src/scenes/LabScene.ts` — Y정렬 오버레이 넣었다가 **전부 원복**(net: 세션 전 상태).

## 남은 것 / 다음 스텝
- **커밋 안 함.** 사용자 확인 후 커밋할 것(tsc 훅 통과 확인). 다른 수정들(BGM/SFX·ar-data 등)도 미커밋 상태 다수.
- 연구소 책장: 위에서 접근 시 발이 책장 윗줄에 살짝 걸치는 미세 겹침은 엔진 한계로 남음(솔리드로 확정, 더 원하면 논의).
- (제안) 위 "정적파일≠라이브, playwright 라이브 검사" 교훈은 반복 지적된 유형이라 `myPokemon_AJ/AGENTS.md` 또는 `.claude/rules`에 정식 규칙으로 승격 고려. 오늘은 일지에만 기록.

## 메모리/스킬/규칙 변경
- 오늘 **메모리·skills 변경 없음** → 바탕화면 이관 폴더 불필요(코드/일지 모두 git 동기화). 커밋만 하면 다른 PC 반영됨.
