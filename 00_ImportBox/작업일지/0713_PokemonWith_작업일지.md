# 0713 PokemonWith 작업일지

> 이 문서만 보고 다른 PC의 Claude가 이어받을 수 있게 작성. 규칙 정본=리포 `AGENTS.md`/`myPokemon_AJ/AGENTS.md`, 진행상황=memory `starter-lab-flow`.

## 오늘 한 것 — **집 꾸미기 → 컨디션 → 배틀** 고리 완성 (이 게임의 차별점)

### 0. 착수 전 조사 (0711 일지의 "다음 스텝" 재검증)
- 0711 일지가 "즉시 처리"로 남긴 `verify_wiring_tmp.mjs` 제거는 **이미 커밋 `399a51c`에 반영**돼 있었고 워킹트리도 깨끗했다. 밀린 뒤처리 없음.
- 실제 코드로 재확인한 남은 구멍: 메뉴 5항목 중 도감/가방/설정이 스텁·지도 없음 / 가방·도감 시스템 자체 부재 / **집꾸미기 링크 4군데 전부 끊김** / 야생 인카운터·1번도로 없음.
- 사용자가 그중 **집꾸미기(차별점)** 선택. 분기 2개도 사용자 확정: ① 꾸미기 무대 = **별도 화면 아니라 내 방(2F, InteriorScene) 안에서 직접** ② 컨디션 상승 계기 = **침대에서 잠자기**.

### 1. 끊겨 있던 4군데 (착수 전 상태)
- `HouseScene.ts` = 22줄 TODO 스텁(들어가면 검은 화면). 디버그 7번이 여기로 갔음.
- `applyHomeBonus` = 정의만 있고 **호출처 0곳**(dead code).
- `condition` = 생성 시 0에서 **아무도 안 올림** → `battle.ts:56`의 데미지 배율이 항상 1.0.
- **타입 문자열 버그**: `homeBonus.ts`가 `pokemon.type === "불꽃"`(한글)로 비교하는데 실제 종족 타입은 `"FIRE"`(대문자 영어, species.json) → **호출해도 조건이 절대 참이 안 됨.**

### 2. 바꾼 파일 / 무엇을 / 왜
- **`src/data/furniture.ts`** — 카탈로그 재정의. `affinity`를 **대문자 영어 타입**("FIRE"/"WATER"/"GRASS")으로 고침(위 타입 버그 원인). 가구마다 `w·h`(칸 수, **그림 크기와 반드시 일치**), `comfort`, `affinityBonus`, **`walkable`**(러그=밟고 지나감), **`wallOnly`**(정면 각도 그림 = 벽에 등 대야만 자연스러움) 추가.
- **`src/systems/homeBonus.ts`** — 재작성. 규칙: **방 구성이 컨디션 '상한'을 정하고, 침대에서 잘 때마다 상한까지 오른다.**
  - `conditionCap(p, house)` = 기본 20 + Σ comfort + (속성 맞는 가구의 affinityBonus), 최대 100.
  - `applyHomeBonus(p, house)` = 잠 1회 +10(상한까지) + HP/PP/상태이상 회복. `sleepAtHome(party, house)` = 파티 전원.
  - `emptyHouse()`(빈 방 20×15), `furnitureHint()`(꾸미기 화면 설명용).
- **`src/data/HouseLayout.ts`** — `cellsOf`/`furnitureAt`/`canPlace` 헬퍼 추가(가구가 w×h 칸을 점유).
- **`src/scenes/InteriorScene.ts`** (대부분의 작업) — 내 방(2F)에서:
  - **F키 = 꾸미기 모드**(방향키 커서 · Q/E 가구 변경 · Space 놓기 · R 치우기 · F/Esc 종료). 하단에 가구 설명 + **이 방의 컨디션 상한이 파티별로 실시간 표시**.
  - 가구 렌더(러그 depth 1=바닥, 덩치 가구 depth 5=주인공 아래 — 전경 오버레이 금지 규칙 준수) + `walkable()`에서 가구 충돌(러그는 통과).
  - **침대 앞 Space = 잠자기** → 페이드 연출 → 파티 회복 + 컨디션 상승 대사 + 방이 허전하면 힌트.
  - 배치 유효성 3중 검사: `canPlace`(빈 칸) + `againstWall`(벽면 가구) + `keepsRoomConnected`(BFS).
- **`src/systems/save.ts`** — `SaveData`에 **`houseLayout`** 추가, **SAVE_VERSION 1 → 2**. v1 세이브는 로드 시 빈 방으로 채워 그대로 이어하게(마이그레이션).
- **`public/assets/house/rooms.json`** — bedroom에 **`bed: [3,9,3,2]`**(침대 사각형). 눈대중 아님: 원본 PNG에 32px 격자 얹어 확인 + 그 6칸이 `blocked=1`임을 스크립트로 재검증.
- **`src/scenes/DebugMenuScene.ts`** — 7번을 빈 `HouseScene`(검은 화면) → **내 방 2F + 테스트 파티**(파이리/꼬부기/이상해씨 = 불꽃/물/풀)로. `data.testParty` 플래그.
- **`.claude/skills/pokemon-asset-pipeline/references/asset-sources.md`** — 사용자 요청으로 **itch.io 무료 pokemon 태그**(`https://itch.io/game-assets/free/tag-pokemon`) 추가. 위치는 **F(보조 무료 에셋)** — AGENTS §4의 A~D 우선순위(AR/PokeAPI/pokemondb/PokeRogue) 정본은 **일부러 안 건드림**(팬메이드·라이선스 제각각이라 우선순위가 흐려짐).

### 3. 신규 에셋 — 가구 6종 `public/assets/house/furniture/`
AR 타일셋에서 추출(칸 수 = 그림 크기/32):
| 파일 | 칸 | 출처 | 속성 |
|---|---|---|---|
| `fireplace.png` | 2×2 | **합성**(아래) | FIRE, wallOnly |
| `aquarium.png` | 2×2 | `Interior general.png` (192,7584,256,7648) | WATER |
| `plant.png` | 1×2 | `Interior general.png` (64,5536,96,5600) | GRASS |
| `rug.png` | 3×3 | `Interior general.png` (0,3136,96,3232) | 범용, **walkable** |
| `cushion.png` | 1×1 | `Interior general.png` (192,5120,224,5152) | 범용 |
| `bookshelf.png` | 2×3 | `Interior general.png` (0,5088,64,5184) | 범용, wallOnly |

- **⚠️ 벽난로는 에셋 풀에 없다.** `Interior general` / `All Inner Extended` / `Indoor` / `DP_Intérieur` / Mansion·Gyms 등 + AR `Graphics/Characters` 이벤트 스프라이트까지 **전수 조사했으나 "불이 타는 벽난로" 없음**(불 꺼진 회색 벽 아치, 체육관 용암벽뿐).
  → **합성으로 제작**: `All Inner Extended.png` (48,11246)-(112,11296) 벽난로 프레임에서 벽 배경색 `(184,192,184)`를 투명 처리 + AR `Graphics/Animations/**Flames.png**` 첫 프레임(장작불 모양)을 화구에 얹음. 후보 3안(합성 벽난로 / 램프 / 가스레인지) 스샷 비교 후 **사용자가 A(합성 벽난로) 선택.**

### 4. 사용자 지적 2건 → 그 자리에서 시스템으로 승격
1. **"가구 위치 개판"** — 내가 만든 첫 배치 미리보기가 가구를 빈 칸에 흩뿌려 벽을 안 썼고, 게다가 **벽난로가 유일한 좌우 통로(y=5줄)를 막아 방이 두 조각**이 됐다(침대·계단 도달 불가). 예시만의 문제가 아니라 **시스템이 그런 배치를 허용**하는 게 진짜 결함 → `keepsRoomConnected`(BFS) 도입.
2. **"벽난로가 위쪽에만 붙일 수 있는 각도의 그림이라 이상해"** — 정확한 지적. **그림 각도가 곧 배치 제약**인데 코드에 없었음 → `wallOnly` 도입(윗줄이 전부 벽인 자리에만 놓임, 아니면 빨간 커서 + "※ 벽에 등을 붙여야 놓을 수 있다").

## 검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)
- 빈 방 상한 **20** → 꾸민 뒤 **파이리 65 / 꼬부기 65 / 이상해씨 40** (벽난로=FIRE +25, 수조=WATER +25, 이상해씨는 풀 가구 없어 comfort만) → **타입별로 정확히 갈림.**
- 잠자기 1회 **+10**, 2회 **20** (상한까지).
- 러그 위 `walkable(4,7)=true`, 벽난로/수조 위 `false`. 치우기(R) → 재배치 정상.
- **갇힘 버그 재현 테스트**: 시작칸(8,9) 사방을 쿠션으로 막으려 하면 **4번째에서 거부** → 시작칸에서 계단 도달 유지.
- **벽면 규칙**: 벽난로/책장 방 한가운데 → 거부, 벽 앞 → 놓임. 수조(벽면가구 아님) → 자유롭게 놓임.
- 저장: **version 2**, `houseLayout`에 배치 3개 + 파티 condition 보존.
- **배틀 반영 확인**: 같은 난수 고정 시 컨디션 0 → 데미지 4, 컨디션 100 → **5** (배율 +10%가 실제로 먹음).
- `tsc --noEmit` 통과.

## `/code-review`(high) 결과 — 진짜 버그 3개 잡아서 고침
1. **[치명] 재입장 시 영구 갇힘** — `keepsRoomConnected`가 **'지금 서 있는 자리'** 기준으로만 BFS해서, 플레이어가 방 반대편에 서서 **시작칸(8,9) 사방을 둘러싸면 검사를 매번 통과**. 저장 후 다시 들어오면 시작칸에 갇혀 계단·침대 어디도 못 감. → 도달 목표에 **방 `start`와 계단 도착칸(ax,ay)** 추가.
2. 꾸미기 모드 중 Enter/X로 **메뉴가 겹쳐 열림** → `openMenu()`에 `decorating` 가드.
3. 가구 이미지 로드에 **캐시버스터(`?v=`) 누락** → png 교체 시 옛 그림이 캐시에서 나옴(`.claude/rules/maps-collision.md` 5번이 경고하는 함정) → 추가.
- (미수정, 경미) `drawDecorate`가 매 프레임 BFS 수행 / `furnitureAt`이 호출마다 배열 할당 / `HouseScene.ts` 스텁이 이제 도달 불가한 dead code로 남음(**파일 삭제는 승인 필요해 그대로 둠**).

## Pick (사용자 확인용) — `01_Resources/Pick/11_집가구/`
- `_미리보기/내방_배치예시.png` — **실제 내 방에 놓았을 때** (벽면 규칙 반영본)
- `_미리보기/가구후보_비교.png` — 후보 11종 확대 비교
- `_미리보기/불꽃가구_3안_방배치.png` — 벽난로 3안(합성/램프/가스레인지)
- `README_고르는법.md` — 칸 수·속성·불꽃 가구 부재 문제 기록
- ⚠️ **가구 세트는 추천 6종으로 넣어둔 상태**(사용자 최종 확정 못 받음). Pick엔 소파·인형·러그 3색·화분 2종 등 11종이 있으니 교체 가능.

## 주의사항 / 함정 (다음 세션)
- **새 public 폴더(`house/furniture/`) 만들면 dev서버 재시작 필수** (안 하면 png가 `text/html`로 응답). 이번에도 재시작함. `curl -w '%{content_type}'`로 `image/png` 확인할 것.
- **가구 그림 크기 = 칸 수**(32px 배수). `furniture.ts`의 `w·h`와 png 크기가 어긋나면 렌더가 늘어난다.
- **Galmuri11 폰트엔 `⚠` 등 기호가 없다** → 깨진 네모(▮)로 보임. `※` 사용.
- 벽난로 놓을 수 있는 자리는 방 구조상 **(3,4)~(6,4) + 계단 밑 (9,5)** 뿐(원본 AR 방 위쪽이 이미 가구로 꽉 참).
- playwright는 **python 모듈이 없고 node 쪽에만 있다**(`myPokemon_AJ/node_modules`). 검증 스크립트는 `.mjs`로 짜고, **리포 밖(scratchpad)에 둘 것**(0711에 임시 테스트가 실수로 커밋된 전례).

## 다음 이어서 할 스텝
1. **커밋** (아직 안 함 — 승인 대기). `tsc` 훅 통과 상태, `/code-review` 완료.
2. **가구 세트 최종 확정** (Pick 보고 교체할지).
3. 메뉴 나머지: 가방/도감 화면(look 변형 스샷 → 사용자 선택 필요), 설정·지도 항목.
4. 야생 인카운터 + 1번도로(AR 추출).
5. (선택) `HouseScene.ts` 삭제 + `main.ts` 등록 제거.

## 새 지침/skills/memory 요지
- 새 훅·규칙 추가 없음. skills 변경 = `pokemon-asset-pipeline` 소스 카탈로그에 itch.io 1줄 추가.
- **memory `starter-lab-flow` 갱신 필요**(집꾸미기 링크 완성 반영) — PC-로컬이라 git 동기화 안 됨. 다른 PC는 이 문서로 대체 가능.
