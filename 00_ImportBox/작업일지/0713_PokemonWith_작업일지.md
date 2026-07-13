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

## 다음 이어서 할 스텝 (오전 세션 기준 — **아래 "세션 2"에서 갱신됨**)
1. ~~커밋~~ → **완료**(`c6b1558`).
2. 가구 세트 최종 확정 → **세션 2에서 문제 가구 3종 제거함. 대체 가구 재선정은 보류(사용자: "나중에").**
3. 메뉴 나머지(가방/도감) → **세션 2에서 착수. STEP1 완료.**
4. 야생 인카운터 + 1번도로 → 세션 2 계획의 STEP 5.

---

# ▣ 세션 2 (같은 날, `/clear` 이후) — 가구 버그 정리 + **전체 설계 확정** + 데이터 계층(STEP 1)

> **다음 세션은 이 섹션만 읽으면 이어받을 수 있다.** (계획 원본은 `~/.claude/plans/fizzy-napping-flask.md`에 있으나 **PC-로컬이라 git 동기화 안 됨** → 그래서 계획 전문을 아래에 박아둔다.)

## A. 사용자 지적으로 고친 것 (가구)

사용자가 스샷과 함께 지적: "맵 밖 벗어난다 / 벽난로는 위쪽 벽에만 붙는데 놓을 데가 없다 / 두 개 마주 붙은 소파는 포켓몬센터 같다 / 이 화분은 건물 밖에 두는 것".
→ **가구 PNG를 6배 확대해 직접 확인한 결과 지적이 전부 사실. 어제 내가 이름을 잘못 붙였다:**

| 파일 | 어제 붙인 이름 | **실제 그림** | 조치 |
|---|---|---|---|
| `aquarium.png` | 수조(WATER) | **길가 화단/플랜터** (파란 상자 + 나무 3그루, 야외 조경물) | **제거** |
| `bookshelf.png` | 책장 | **등받이 맞댄 파란 소파 2인석** (포켓몬센터 대기의자) | **제거** |
| `fireplace.png` | 벽난로(FIRE) | 합성 벽난로. 정면 각도 → 위쪽 벽 전용인데 이 방엔 그런 자리가 사실상 없음(회전 불가) | **제거** |
| `plant.png` | 관엽식물(GRASS) | 야자수 화분 | **유지**(사용자 판단) |

- **"맵 밖 벗어남"의 진짜 원인**: 꾸미기 커서가 `Clamp(0, cols-1)` 즉 **격자 전체(0~19, 0~14)를 돌아다녔다**. 이 방의 실제 바닥은 **x=3~12, y=3~10뿐**(나머지는 벽·집 밖)이라 커서가 검은 공간까지 나갔다.
  → `InteriorScene.onRoomFloor(x,y)` 신설(= `blocked==0`). 바닥이 아닌 칸으론 **아예 이동하지 않는다**. (가구 놓인 칸은 true — 그 위에서 R로 치워야 하니까.)
- **세이브 안전장치**: 카탈로그에서 뺀 가구가 옛 저장에 남아 있으면 그림 없이 칸만 막는 **'보이지 않는 벽'**이 된다(`cellsOf`가 1×1 폴백) → `save.ts` 로드 시 `findFurniture`로 **필터**.
- ⚠️ **남은 문제**: 속성 가구가 **풀(GRASS)뿐**이다. 불꽃·물 포켓몬은 지금 comfort 보너스만 받는다. 대체 실내 가구를 AR에서 다시 뽑아 Pick에 올려야 함(사용자가 "나중에"로 보류). 안 쓰는 png 3장(`fireplace/aquarium/bookshelf`)은 **삭제 안 하고 그대로 둠**(삭제는 승인 필요).

## B. ★ 전체 설계 확정 (사용자 결정 3건)

조사로 드러난 현실:
- 배틀 시스템(데미지·타입상성·급소·경험치·레벨업 기술)은 **거의 완성인데 놀고 있다** — 정상 플레이 중 배틀 진입로가 라이벌전 1회와 디버그 B키뿐. **야생 인카운터 0**.
- 메뉴 5항목 중 **동작하는 건 포켓몬·저장 2개뿐**. 도감·가방·설정은 "준비 중" 토스트. 가방·도감은 **데이터 계층부터 전무**였다.
- **차별점이 이름뿐**: 컨디션 100을 다 채워도 데미지 **+10%**(`battle.ts:56`) — 체감 불가.

**사용자 결정:**
1. **스코프 = 세로 슬라이스** — 첫 체육관 뱃지까지 한 바퀴 도는 최소 완성품.
2. **첫 체육관 = AR 순서 그대로 상록체육관(관장 그린)**. ⚠️ **AR은 원작과 순서가 다르다** — AR에서 첫 뱃지는 회색(웅)이 아니라 **상록(그린, Lv10~13)**. 회색(웅)은 **8번째 뱃지(Lv53~56)**, 상록숲은 **Lv50대 지역**. 원작 순서를 고집하면 맵 6개+레벨 전면 재설계.
3. **컨디션 강도 재설계 = 보류**("나중에 결정"). 단 새로 만드는 것이 이 고리를 죽이면 안 됨.
4. **UI look을 먼저 확정한다**(사용자 지시) — "가방 디자인도 안 정해졌는데 그런 걸 먼저 해야 하는 거 아니냐". 포획하려면 몬스터볼(가방)이 필요하므로 **가방이 인카운터보다 앞**이 맞다.
5. **레벨 = AR 레벨 스케일링 이식 + 난이도 5단계** / **관장 팀 3버전 = 원본처럼 랜덤** (아래 B-2 참조).

## B-2. ★★ AR 난이도 시스템 — **내가 처음에 틀리게 보고했던 것 정정** (사용자가 지적해서 재조사)

> 처음에 "그린 팀 3버전 = **스타터 선택**에 따라 갈린다"고 보고했는데 **틀렸다.** 사용자가 "AR은 난이도가 여러 개인데 어떻게 가져올 거냐"고 물어 재조사한 결과:

### (1) `trainers.dat`의 version(1/2/3) = **난이도도 스타터도 아닌 "랜덤 파티 변형"**
- 증거: `Data/Map194.rxdata`(상록체육관) 이벤트 커맨드 31~33 — `[122] [100,100,0,2,1,3]` = **`var100 = random(1..3)`** → 그 값으로 `TrainerBattle.start("LEADER_Green","그린", N)` 분기. `var100`의 이름은 System.rxdata에서 **`랜덤파티`**.
- 전수조사: `TrainerBattle.start` 호출 428건 중 version이 0이 아닌 것을 감싸는 조건분기 변수는 **오직 100(65회)과 99(5회)**. **난이도 변수(51)나 스타터로 분기하는 케이스는 0건.**
- 보강: 그린 v1/v2/v3 **전부 L10~13**, 웅 v1/v2/v3 **전부 L53~56** — 레벨대는 같고 종 구성만 완전히 다르다(난이도 티어면 레벨이 달라야 함).
- **결정: 원본처럼 배틀 진입 시 1~3 균등 랜덤. 3버전 데이터를 전부 보관한다.**

### (2) AR 난이도가 실제로 바꾸는 것 = **상대 트레이너 레벨뿐**
- 플러그인 **"Automatic Level Scaling"**(`Data/PluginScripts.rxdata` idx 27). 난이도 값 = **`$game_variables[51]`**(System.rxdata 변수명 `TRAINERLV`).
- **게임 시작 인트로(`Data/Map072.rxdata` EV001)에서 5단계 중 1회 선택 → 이후 변경 불가.** 게임 대사: *"한 번 설정하면 인게임 내에서 바꿀 수 없는 설정들입니다."*

| 난이도 | fixed | random |
|---|---|---|
| 이지 | −4 | 0 |
| 노말 | −3 | +0~2 |
| 하드 | 0 | 0 |
| 익스트림 | +1 | +0~2 |
| 인새인 | +3 | +0~2 |

- ⚠️ **트레이너 레벨은 고정값이 아니다.** `trainers.dat`의 Lv10·Lv13 같은 값은 **'팀 평균 대비 오프셋'으로만** 쓰인다. 실제 레벨:
  `실제 = (내 파티의 균형평균) − 2 + 난이도보정 + (관장 +3 / 챔피언 +5) + (그 포켓몬 원본레벨 − 원본팀 평균)`
  → **초반에 파티가 약하면 상대도 약해진다.** (연구소 NPC 크리스 대사로도 확인: *"트레이너 파티의 평균 레벨을 계산해 상대 트레이너의 레벨이 자동으로 계산돼!"*)
  → **우리가 trainers.dat의 절대 레벨을 그대로 박으면 원본과 다른 밸런스가 된다.**
- **야생 포켓몬은 난이도 무관** (AR이 `var53`을 항상 1로 고정 = 항상 같은 스케일).
- **난이도로 안 바뀌는 것**: 트레이너 팀 구성·기술(`update_moves: false`)·아이템 / 야생 인카운터 테이블(`encounters.dat` 키가 전부 `_0`) / 경험치·상금·AI·레벨캡.
- ✅ **따라서 `species.json`·`moves.json`·`types.json`은 난이도 중립** — STEP1에서 뽑은 데이터 **그대로 유효, 재추출 불필요.**
- ⚠️ **memory `ar-extraction`의 "트레이너레벨 고정"은 틀린 기록** → 정정함.

**결정: AR 레벨 스케일링을 그대로 이식 + 난이도 5단계.** 구현은 공식 하나라 부담이 작고, 레벨 노가다로 체육관을 뭉개는 일이 없어진다. 난이도 선택 화면은 인트로에 추가(STEP 2~3 사이).
- 지금 넣어둔 것: `src/systems/difficulty.ts`(5단계 테이블 + 공식 주석), `SaveData.difficulty`(v3에 포함), 인트로에서 기본값 `normal` 세팅. **선택 화면과 실제 스케일링 계산은 아직 미구현.**
- ⚠️ 스케일링 구현 시 Essentials `pbBalancedLevel()`의 정확한 정의를 먼저 조사할 것(파티 평균을 어떻게 '균형' 잡는지 — 크리스 대사에 *"너무 레벨이 동떨어지게 낮은 포켓몬은 예외로 계산되지 않는다"*는 힌트가 있다).

### 목표 루프
`태초마을 → 1번도로(야생·트레이너 2명) → 상록시티(포켓몬센터·마트) → 상록체육관(그린) → 첫 뱃지`
포획·가방·도감·집꾸미기가 전부 한 번씩 물린다. 이게 돌면 그 뒤는 맵·체육관 복제.

### 실행 계획 (STEP 1 완료 / **다음 = STEP 2**)
- **STEP 1 — 데이터 계층 + 세이브 v3** ✅ **완료** (아래 C)
- **STEP 2 — 가방·도감 UI: 시안 → 사용자 선택 → 구현** ← **여기부터 시작**
  - AR `Graphics/UI/Bag/`·`UI/Pokedex/`에 **512×384 풀세트가 이미 있다**(가방: 9포켓 배경·탭 시트 `icon_pocket.png` 224×48·커서·슬라이더 / 도감: `bg_list`·`bg_info`·`icon_seen`·`icon_own` 28×28·`icon_types.png` 96×640=20타입).
  - **UI 지어내기 금지**(`.claude/rules/game-ui.md`) → AR 에셋을 `public/assets/ui/`로 import(`node tools/import-from-anotherred.mjs "<AR경로>" ui`)해 그 위에 한글 텍스트만 얹는다.
  - **시안 2~3안**을 playwright 실스샷으로 `01_Resources/Pick/12_가방도감UI/_미리보기/`에 비교 몽타주 → **사용자가 고른 뒤 구현**(사용자가 "시안 2~3개 만들어 비교" 선택함).
    - A안: AR 원본 에셋 그대로 / B안: 기존 메뉴·파티창과 같은 남색+크림 HGSS 톤
  - 구현: `src/scenes/BagScene.ts`, `src/scenes/PokedexScene.ts` 신설 → `MenuScene.ts:151-152`의 "준비 중" 토스트를 `scene.launch`로 교체 + `main.ts` 등록 + `DebugMenuScene` 바로가기.
  - **범위**: 가방=3포켓(회복약·볼·일반)+필드 회복약 사용. 도감=목록+상세 2뷰. (판매·정렬·TM·서식지·검색 없음)
  - **메뉴 접근 — 조사로 확정**: AR은 **`Z`키**로 메뉴, **화면 상시 HUD 없음**, 안내는 연구소 조수 NPC(크리스)에게 말 걸고 선택지를 골라야만 나오는 **옵트인**(지나치면 알 방법 없음). 본가도 GB/GBA는 START 버튼 하나에 안내 없음, DS(HGSS)만 하단 터치스크린 상시 메뉴(화면 2개라 가능). → **우리 결정: Enter/X 유지 + 상시 HUD 없음**(PC 단일화면이라 상시 바는 화면을 잡아먹음). 단 **초반 필수 동선의 기존 대사(엄마/오박사)에 조작 안내 한 줄을 추가**한다. ⚠️ `AGENTS.md` §1.5 — **사용자가 설정한 기존 멘트는 수정 금지, 새 문장 추가만.**
- **STEP 3 — 배틀 확장**: 커맨드 2개 → **4개**(싸운다/가방/포켓몬/도망). 상대 팀(복수)·교체·포획. `systems/capture.ts`(3세대 공식 — `species.json`에 `catchRate` **이미 있음**). 6마리 꽉 차면 거절(**박스 안 만듦**).
  - ⚠️ 함정: 교체 시 `HpBox`에 `destroy()`가 없어 재생성 필요. 스프라이트 텍스처는 `preload()`에서만 로드되므로 **런타임 `load.image` + `textures.remove()`** 경로 필요(안 하면 "포켓몬 바뀌었는데 그림 그대로").
  - `battle.ts`/`exp.ts`/`homeBonus.ts`는 **불가침**.
- **STEP 4 — 맵 추출 일반화**: `tools/ar-map/extract.py`가 **집PC 절대경로 하드코딩 + 집 맵 전용**이라 `rooms.json`을 덮어씀 → `--map <id> --out <name>` CLI로. **terrain tag 파싱 추가**(AR 태그 **2=풀숲**, Route1에 178칸) → 맵 json 스키마 `{cols,rows,blocked}` → `{cols,rows,blocked,grass?}` **선택 필드 확장**(기존 `pallet_town.json`·`oak_lab.json` 재추출 불필요).
  - 추출 대상: **Route1=Map10(52×40) / 상록시티=Map56(52×40) / 상록체육관=Map194 / 상록PC=158 / 마트=159**.
- **STEP 5 — 다중맵 WorldScene + 야생 인카운터**: 맵 전환은 **이어붙여 스크롤**(암전 없음). 세 맵 모두 폭 52, `map_connections.dat` 오프셋 0 → **정확히 수직 스택(52×100)**. 큰 PNG 새로 굽지 말고 **PNG 3장을 오프셋 배치**, blocked/grass는 런타임 오프셋 조회.
  - `region.json`(맵3+워프) 신설. **씬 키 `WorldScene`은 유지**(세이브·DebugMenu·BattleScene 복귀가 전부 이 키 참조).
  - 인카운터: Route1 = **100보당 21%**, 14종 L2~4(피죤·꼬렛·캐터피…·이브이 2%). 배틀 배경: `map_metadata`의 `@battle_background`(마을=town/도로=route/체육관=gym) → `node tools/import-from-anotherred.mjs "<AR>" battlebacks`.
- **STEP 6 — 트레이너 + 상록시티 + 체육관**: Route1 트레이너 2명(`YOUNGSTER 한주`@(25,13), `LASS 유정`@(33,6)). `BuildingScene.ts`로 PC·마트·체육관 데이터 구동(LabScene 패턴 일반화).
  - ⚠️ **포켓몬센터는 HP/PP/상태만 회복 — 컨디션은 건드리지 말 것**(여기서 컨디션까지 회복시키면 집 잠자기의 존재 이유가 사라진다 = 차별점 사망).
  - ⚠️ 체육관 그린 팀은 `starterChosen`에 따라 3버전 → **DebugMenu 직행 시 null이므로 v1 폴백 필수.**

## C. STEP 1 완료 — 데이터 계층 + 세이브 v3 (화면 변화 없음)

**새 파일**
- `tools/ar-data/extract-items.py` — AR `items.dat`(842개) + `messages_kor_*.dat` → **화이트리스트 10종만** `public/assets/data/ar/items.json` + 아이콘 `public/assets/items/<ID>.png` 10장. (⚠️ 아이콘 792장 전부 복사 금지 — 리포 오염. 아이템 추가하려면 스크립트의 `WHITELIST`에 id 한 줄 넣고 재실행.)
  - 뽑힌 것: 몬스터볼(200)·슈퍼볼(600)·상처약(200)·좋은상처약(700)·해독제·마비치료제·잠깨는약·화상치료제·얼음상태치료제·기력의조각(2000). **한글명·설명·가격·포켓 전부 정상.**
- `tools/ar-data/extract-dex.py` — `regional_dexes.dat` → `dex_kanto.json`(칸토 **151종**, 1=BULBASAUR … 151=MEW).
- `src/data/Bag.ts` — `BagEntry{itemId,count}`, `addItem`/`removeItem`/`countItem`/`itemsByPocket`/`getMoney`/`addMoney`. 포켓: **2=회복약 3=몬스터볼 1=일반**(탭 순서 `POCKETS`).
- `src/data/Pokedex.ts` — `markSeen`/`markOwn`/`isSeen`/`isOwn`/`dexEntries`(151칸 번호순)/`dexCounts`.
- ⚠️ Bag·Pokedex 둘 다 **registry를 단일 원천**으로 쓴다(파티·이름과 같은 방식). 저장은 `save.ts`가 registry를 통째로 직렬화.

**바꾼 파일**
- `src/data/ar/index.ts` — **별도 로더를 새로 만들지 않고 기존 `loadArDb()`를 확장**(items.json·dex_kanto.json 추가). `ItemData` 인터페이스 + `getItem`/`allItems`/`dexKanto` 추가.
- `src/systems/difficulty.ts` **(신규)** — AR 난이도 5단계 테이블(이지 −4 / 노말 −3+r2 / 하드 0 / 익스트림 +1+r2 / 인새인 +3+r2) + 레벨 스케일링 공식을 주석으로 기록. **선택 화면·계산은 아직 미구현**(다음 스텝).
- `src/systems/save.ts` — **SAVE_VERSION 2 → 3**. `SaveData`에 `difficulty·money·bag·dexSeen·dexOwn·badges·trainersDefeated` 추가, `SaveLoc`에 `map?` 추가. `START_MONEY=3000`, `START_BAG=[몬스터볼×5, 상처약×3]` export.
  - **v2→v3 마이그레이션**: 없는 필드는 기본값. 도감이 없던 저장은 **현재 파티를 '잡은 것'으로 인정**. `loc.map`이 없으면 `"pallet"` 부여(**v2의 tx,ty는 이미 태초마을 로컬 좌표라 그대로 유효** — 그래서 world 단일좌표로 안 바꿨다. 바꿨으면 옛 세이브 전부 깨짐).
- `src/scenes/IntroScene.ts` — 새 게임 시작 시 money·bag·dex·badges 초기화.
- `src/scenes/LabScene.ts` — 스타터 수령 시 `markOwn`.
- `src/scenes/BattleScene.ts` — 배틀 시작 시 상대 종족 `markSeen`.

**검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)**
- **옛 v2 세이브를 심고 로드**: money 3000 / bag=[볼5, 상처약3] / dexSeen·Own=[CHARMANDER](파티) / badges=[] / `loc.map="pallet"` 자동 부여 → **크래시 없이 이어하기 성공**.
- **제거한 가구가 옛 세이브에서 걸러짐**: `houseLayout.furniture`에 `fireplace`를 넣어둔 v2 세이브 → 로드 후 `rug`만 남음(**보이지 않는 벽 예방 확인**).
- AR DB: `getItem("POKEBALL")` → 몬스터볼/pocket3/200원. `dexKanto()` → 151종.
- 가방 조작: 볼 5+2=**7**, 상처약 3−1=**2**. 저장 → **version 3**.
- `tsc --noEmit` 통과.

## D. 함정 / 주의 (다음 세션 필독)
- ⚠️ **새 public 폴더(`assets/items/`)를 만들면 dev 서버 재시작 필수.** 안 하면 png·json이 **`text/html`로 응답**한다(이번에도 그대로 걸림). `curl -s -o /dev/null -w "%{content_type}" http://localhost:5180/assets/items/POKEBALL.png` → `image/png` 나와야 정상.
- ⚠️ **playwright는 python 쪽에 없고 node 쪽(`myPokemon_AJ/node_modules`)에만 있다.** 검증 스크립트는 `.mjs`로 짜되 **`import { chromium } from "/mnt/d/dev/Pokemon_With/myPokemon_AJ/node_modules/playwright/index.mjs"`처럼 절대경로 import**해야 하고, **리포 밖(스크래치패드)에 둔다**(0711에 임시 테스트가 실수로 커밋된 전례).
- ⚠️ `pkill -f vite` 후 같은 명령줄에서 `nohup npm run dev &`로 재기동하면 **같이 죽는다.** 백그라운드 실행 도구로 따로 띄울 것.
- AR 원본 경로(이 PC) = **`/mnt/d/Pokemon Another Red_PWT_250829`**. 추출 스크립트들은 인자·`AR_PATH`·자동탐색 순으로 찾으므로 인자 없이 그냥 실행하면 된다.
- 이 방(red_room_2f) **실제 바닥 = x 3~12, y 3~10**. 그 밖은 벽·집 밖.

## E. 다음 세션 시작 지점
1. **커밋 안 함** (승인 대기). 지금 워킹트리: `furniture.ts`·`InteriorScene.ts`·`save.ts`·`ar/index.ts`·`IntroScene.ts`·`LabScene.ts`·`BattleScene.ts` 수정 + `Bag.ts`·`Pokedex.ts`·`extract-items.py`·`extract-dex.py`·`items.json`·`dex_kanto.json`·`assets/items/` 신규. **tsc 통과 상태.**
2. **STEP 2 착수** = AR UI 에셋 import → **가방·도감 시안 2~3안 실스샷 → `01_Resources/Pick/12_가방도감UI/`에 몽타주 → 사용자에게 고르라고 제시.** (사용자가 고르기 전엔 구현 확정 금지 — `AGENTS.md` §6.5)
3. UI 씬을 고치면 **`.claude/.verify/*.png` 캡쳐 증거 없이는 Stop 훅이 턴을 막는다**(`.claude/rules/game-ui.md` 5번).

## 새 지침/skills/memory 요지 (세션 2)
- 새 훅·규칙·skill 추가 없음.
- **memory `starter-lab-flow` 갱신 필요**(세로 슬라이스 계획 + STEP1 완료 반영) — PC-로컬이라 git 동기화 안 됨. **다른 PC는 이 문서(§B~E)로 대체 가능.**

---

# ▣ 세션 3 (같은 날, `/clear` 이후) — STEP 2: 가방·도감 UI 구현 + 색 시안

> 세션 2의 §E "STEP 2 착수"를 실제로 함. **기능은 다 됨. 색(look)만 사용자 확정 대기.**
> ⚠️ 착수 전 재검증: 세션 2가 "커밋 안 함"이라 했지만 **실제로는 커밋돼 있었다**(`344019e`). 워킹트리 clean이었음. 일지의 사실 주장은 항상 git으로 재확인할 것.

## A. 먼저 한 조사 (지어내기 금지 — `.claude/rules/game-ui.md`)
- AR `Graphics/UI/Bag`·`UI/Pokedex` 에셋을 `public/assets/ui/{bag,pokedex}/`로 복사(각 ~120KB). 512×384 풀세트.
- **레이아웃 좌표는 눈대중이 아니라 AR 루비 스크립트에서 뽑았다.** `Data/Scripts.rxdata`를 rubymarshal+zlib로 풀면 `UI_Bag` / `UI_Pokedex_Main` / `UI_Pokedex_Entry` 소스가 나온다. 거기서 실제 그리기 좌표를 그대로 옮김:
  - 가방: bg(0,0) · 가방그림(30,20) · 포켓아이콘 28×28 →(2+(p−1)*22, 226) [나머지 탭은 bg에 구워져 있음] · 목록 **7줄·줄높이 32** · 커서(184, 8+j*32) · 이름(200, 32+j*32) · 개수 우측 x=450 · 아이템아이콘 중심(48,336) · 설명문(88,311) 폭 384 · 슬라이더 x=470(트랙 54~228)
  - 도감 목록: 창 contents (222,46) · **10줄·32px** · seen/own 아이콘(232, 54+j*32) · 번호(274,·) 이름(322,·) · 스프라이트 중심(112,196) · 본/잡은 수(42,312 / 42,348, 값 우측 182) · 슬라이더 x=468(트랙 78~346)
  - 도감 상세: 스프라이트 중심(104,136) · 번호+이름(246,48) · 분류(246,80) · own 아이콘(212,44) · **타입 아이콘 96×32 프레임** →(296,120)·(396,120) · 발자국(226,138) · 신장(314,164/값 470 우측) · 체중(314,196/값 482 우측) · 설명문(40,246, 폭 432)
  - 타입 아이콘 행 번호 = `types.dat`의 `icon_position`(NORMAL 0 … STELLAR 19).

## B. 새 파일
- **`src/scenes/BagScene.ts`** — 포켓 3개(회복약/볼/일반) ←→ 전환, ↑↓ 선택, **회복약 Enter → 파티 선택 → 실제 회복**(상처약 20 / 좋은상처약 60 / 기력의조각 절반부활 / 상태이상 치료제 5종), 하단 설명, 7줄 초과 시 원본 공식 그대로의 슬라이더, "닫는다" 줄.
- **`src/scenes/PokedexScene.ts`** — 칸토 151칸 목록(미발견 `----------`, seen=흰 원/own=몬스터볼) ↔ Enter로 상세(스프라이트·분류·타입 아이콘·신장·체중·**한글 도감설명**·발자국).
- **`tools/ui-pastel.py`** — AR UI 원본 PNG를 색만 리컬러(픽셀 배치는 1px도 안 건드림). 변형 3종 폴더 생성: `pastel` / `sky` / `cream`.

## C. 바꾼 파일
- `tools/ar-data/extract-battle-data.py` — species에 **height·weight·dexEntry(한글 도감설명)** 추가(원본 `@height`/`@weight`/`@real_pokedex_entry` + 한글 메시지 카테고리 3). → `species.json` 재생성(2.1MB).
- `src/data/ar/index.ts` — `SpeciesData`에 위 3필드.
- `src/scenes/MenuScene.ts` — 메뉴의 "도감·가방 준비 중" 토스트 → **실제 씬 launch**(메뉴는 pause, 돌아오면 resume).
- `src/main.ts` — BagScene·PokedexScene 등록.
- `src/scenes/DebugMenuScene.ts` — 가방/도감 시안 바로가기 8개(look별) + 테스트용 가방·도감 데이터 시딩.
- 신규 에셋: `public/assets/ui/{bag,pokedex}/`(+리컬러 폴더), `ui/left_arrow.png`·`right_arrow.png`, `public/assets/pokemon/footprints/`(칸토 151).

## D. ★ 미해결 = 색(look) 확정 (다음 세션 첫 할 일)
`BagScene`/`PokedexScene`은 `look` 값으로 색만 갈아끼운다: **`ar` | `pastel` | `sky` | `cream`**(그림·좌표는 전부 동일).
- 사용자 요구 변천: ① "원본보다 조잡" → 내가 그린 패널(HGSS 남색) 안 **폐기**, 원본 에셋 리컬러 방식으로 전환. ② 타이틀처럼 차분한 파스텔 → `pastel`/`sky`. ③ 크림+빨강 → `cream`. ④ "가방=파스텔 옐로우 크림 / 도감=흰 바탕+빨강 포인트(크림·브라운 섞어)" → 현재 `cream`이 그 구성.
- **결국 사용자는 지금 크림색에 만족하지 못했다(회색기·톤). 색은 미확정이고, 여기서 중단함.**
- 조정 지점은 전부 `tools/ui-pastel.py` 상수: `CREAM_HUE`(현 0.135) · `CREAM_SAT_LIGHT/MID/DARK` · `CREAM_LIFT`(밝기 압축) · `RED_HUE` · `DEX`쪽은 `BROWN_HUE`/`DEX_CREAM_SAT`.
- 지금까지 배운 것(반복 삽질 방지):
  - 회색기의 원인은 **배경이 아니었다.** 배경은 이미 H≈49°(노랑). 실제 원인은 ⓐ 설명문 **글자색이 슬레이트 그레이**, ⓑ **회청색 슬라이더 화살표**를 "아이콘"으로 분류해 색상 유지한 것. 둘 다 고침.
  - 채도만 올리고 밝기를 비율로 올리면 중간 회색(v≈0.55)이 **카키/올리브**가 된다 → 밝기를 위쪽 구간으로 **압축**해야 파스텔이 된다.
  - **가방 그림(bag_N)은 리컬러하지 말 것** — 크림으로 칠하면 배경에 묻히고, 탠/브라운으로 바꾸면 "이상해졌다"(사용자 지적). **원본 유지가 정답.**
  - 도감에서 빨강을 자리별로 절반만 브라운으로 바꾸면 **좌/우가 갈려 촌스럽다**(사용자 지적). 빨강은 전 화면 일관, 크림·브라운은 '면과 선'으로만 섞는다.

## E. 검증 (실주행)
- playwright로 4개 look × (가방·도감목록·도감상세) 실스샷 → **콘솔 에러 0**, `tsc --noEmit` 통과.
- 캡쳐: `.claude/.verify/*.png`, 비교 몽타주: `01_Resources/Pick/12_가방도감UI/_미리보기/{전체비교, 가방_4안, 도감목록_4안, 도감상세_4안}.png` + `README_고르는법.md`.
- **검증 못 한 것**: 메뉴 → 가방/도감 진입·복귀 실주행(코드만 연결), 아이템 사용 후 세이브, 파티창과의 톤 통일감.

## F. 함정 (또 걸림)
- **public 아래 새 폴더를 만들 때마다 dev 서버 재시작 필수**(안 하면 png가 `text/html`). 이번 세션에만 4번 걸렸다: `ui/bag`, `ui/*_arrow`, `pokemon/footprints`, `ui/*/{pastel,sky,cream}`.
- 텍스처 키에 look을 안 넣으면 다른 look을 열 때 **캐시된 이전 색 그림**이 나온다(키에 look 포함시켜 해결).

## G. 다음 세션 시작 지점
1. **커밋 안 함**(승인 대기). 워킹트리 = 위 B·C 전부. tsc 통과.
2. **색 확정**부터. 확정되면 나머지 look 분기·리컬러 폴더 삭제 → `/verify`(메뉴에서 실제 진입) → `/code-review` → 커밋.
3. 그다음 STEP 3(배틀 커맨드 4개·포획) — 세션 2 §B 계획 그대로.
