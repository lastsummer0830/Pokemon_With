# 0717 PokemonWith 작업일지

> 이 PC = **집PC / C드라이브** — 리포 `/mnt/c/Users/ONE/Documents/GitHub/Pokemon_With`,
> AR 원본 `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829`.
> (0714 일지는 회사PC/D드라이브 기준이었다 — 절대경로 그대로 믿지 말 것.)

---

# ▣ 세션 1 — 마감 계획 확정 + **틀 1: 야외 다중맵 리전** (커밋 `ee6e8d3`)

## 0. 착수 전 재검증 (일지의 주장은 매번 확인 — 이번에도 틀려 있었다)
- 0714 일지 곳곳에 "커밋 안 함(승인 대기)"라고 적혀 있으나 **실제로는 전부 커밋됨**(HEAD `f1c086e`, 워킹트리 clean).
  **여섯 세션 연속 같은 오기록** — 일지의 커밋 여부는 절대 믿지 말고 `git log`/`git status`로 볼 것.
- 서브에이전트로 코드 전수 감사 → 아래 §1이 그 결과(문서가 아니라 **코드 기준**).

## 1. 실제 구현 상태 (2026-07-17 코드 기준)
**되는 것:** 타이틀→인트로→집→마을→연구소(스타터)→네모 라이벌전까지 1회차가 끊김 없이 돎.
턴제 배틀(기술·가방·도망), 데미지/상성/급소/자속, 경험치·레벨업·기술습득, 저장·이어하기,
파티·가방·도감 UI(AR 에셋), 집 꾸미기 F키 + 잠자기 → 컨디션 → 배틀 데미지 보너스.

**남은 구멍:**
| 항목 | 상태 |
|---|---|
| 포획 `capture.ts` | **아예 없음** (볼은 가방에 있는데 "지금 쓸 수 없다"로 막힘) |
| 파티 교체 | 스텁 (`BattleScene.ts:172`) |
| 상대 팀 복수 | 없음 — `enemy`가 단수 필드, 1마리 쓰러지면 즉시 승리 |
| 야생 조우 | 없음 — **B키 디버그만** (`WorldScene.ts:126`) |
| **affinity(속성) 가구** | **0개** ⚠️ 게임의 차별점이 발동 안 함 (plant/rug/cushion만 남음) |
| 난이도 | `difficulty.ts` 수치만, 호출부 0 = 데드코드 |
| 상태이상 | 필드·치료약은 있는데 **거는 코드가 없어** 치료제는 영원히 "효과가 없었다" |
| 뱃지·상금 | 저장만 되고 쓰는 곳 0 |
| BedroomScene | 137줄 고아 씬 (진입 경로 0, 실제 침실은 InteriorScene) |

## 2. 마감 계획 (사용자: 일요일까지, "되는대로 끝까지 · 디버그에 넣어두면 내가 보고 수정")
큰 틀 → 세부. **블록마다 디버그 메뉴 등록 + 검증물 + 일지 + `/clear`.**
1. **틀 1 — 맵 5장 추출 + 다중맵 연결** ✅ **이 세션 완료**
2. **틀 2 — 야생 조우 + 포획** (B키 디버그 제거, `capture.ts`)
3. **틀 3 — 트레이너전** (상대 팀 복수 + 파티 교체 + 1번도로 트레이너 2명)
4. **틀 4 — 상록시티 + 체육관 + 첫 뱃지** (BuildingScene: PC·마트)
5. 그 뒤 세부 — affinity 가구 · 와이드 대응 · 난이도 화면 · 스텁 문구 제거

## 3. ★ AR 원본에서 확인한 사실 (추측 아님 — 다음 세션이 다시 안 캐도 되게)
- **`map_connections.dat`**: `55(태초) N ↔ 10(1번도로) S`, `56(상록) S ↔ 10 N`, **셋 다 오프셋 0**, 폭 52
  → **정확히 수직 스택 52×100.** 이음새 아트를 실제로 붙여 눈으로 확인함 — **중복 행 없고 흙길·울타리가 이어진다.**
- **`map_metadata.dat`**: 태초/상록 `battle_background=town`, 1번도로 `route`, 체육관 `gym`. 한글 이름(real_name)도 여기 있음.
- **각 맵 `@bgm`**: 태초 `KM_Pallet` / 1번도로 `KM_Route1` / 상록 `KM_Pewter` → **AR Audio/BGM에 .ogg로 존재**(mid 아님, 그냥 복사 가능).
- **Tilesets `@terrain_tags`**: **2 = 풀숲.** 1번도로에 **178칸**(로드맵 수치와 일치).
- **`encounters.dat` Map10**: `step_chances Land=21`(100보당 21%), 14종 가중치 합 100 —
  기본 10종 각 8(L2~4) / FLETCHLING·SCATTERBUG·STARLY 각 6 / **EEVEE 2(L3)**. 14종 전부 `species.json`에 있음(1463종).
- **AR 맵 번호**: 1번도로=10 / 상록시티=56 / 상록체육관=194 / 상록PC=158 / 상록마트=159.
- ⚠️ **실내 맵은 방이 맵 좌상단 일부만 쓴다**(마트 20×15 중 11×8만, 나머지는 빈칸=막힘). 255/300 막힘은 버그 아님.

## 4. 바꾼 파일
**새 도구**
- `tools/ar-map/extract-map.py` — AR 맵 → PNG + `{cols,rows,blocked,grass?}`. `--map/--out` CLI, AR 경로 자동탐색.
  ⚠️ **집 전용 `extract.py`는 안 건드렸다**(그건 `rooms.json`을 덮어씀 — 로드맵의 "extract.py를 CLI로" 대신 별도 스크립트로 감).
- `tools/ar-data/extract-encounters.py` — 인카운터 표 → `encounters.json`. `--maps` 화이트리스트(리포 오염 방지).

**새 에셋** — `route1` / `viridian_city` / `viridian_gym` / `viridian_pc` / `viridian_mart` (png+json),
`bgm_route1.ogg`(KM_Route1) · `bgm_viridian.ogg`(KM_Pewter), `encounters.json`
→ **gym/pc/mart 3장은 아직 안 쓴다**(틀 4에서 씀). 재추출 안 하려고 미리 커밋해둠.

**`src/data/region.ts` (신설)** — 맵 배치·좌표변환의 정본.
- `REGION_COLS/ROWS`는 **맵 목록에서 계산**(손으로 안 적음 — 맵 추가 시 같이 안 고쳐지는 사고 방지).
- `assertRegionMatches()` — 맵 JSON 크기 ≠ region.ts 선언이면 **즉시 에러**(조용히 격자 깨지는 것보다 낫다).
- `toGlobal`/`toLocal`/`mapAtGlobal`.

**`src/scenes/WorldScene.ts`** — 단일 맵 → 리전.
- 맵 3장 로드 → blocked를 오프셋대로 이어붙임. **안 덮인 칸은 막힘으로 남겨** 리전 밖으로 못 나감.
- 맵 바뀌면 이름 배너 + **BGM 교체**. 배틀 배경도 `curMap.battleBg`가 정함(야생·라이벌 둘 다).
- **⚠️ 좌표 규칙(제일 중요):** `map`을 주면 **그 맵 로컬**, 안 주면 **리전 글로벌**.
  저장은 **맵이름+로컬**로 남긴다(글로벌로 남기면 나중에 맵 끼워넣을 때 옛 세이브가 전부 어긋남).

**`LabScene.ts`·`MainMenuScene.ts`** — 로컬 좌표를 넘기므로 `map`을 함께 전달(안 하면 **상록시티에 떨어짐**).
**`DebugMenuScene.ts`** — `5`=태초마을 / **`E`=1번도로 / `R`=상록시티**, 가방·도감에 `Q`·`W` 키 부여(숫자 10개가 모자라 알파벳 확장).
**`src/game/sfx.ts`** — `BGM.route1`/`BGM.viridian` 추가.

## 5. 검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)
스크립트 = 스크래치패드(리포 밖), 캡처 = `<repo>/.claude/.verify/`
- 리전 격자 52×100, 스폰 로컬(17,8)→글로벌(17,88), 워프 연구소(28,94)·집(17,87), 카메라 3328×6400
- **이음새 양방향 통행 OK**, 리전 밖(`walkable(25,-1)`)은 막힘
- **태초에서 북상 → route1 진입 + BGM이 `bgm_town`→`bgm_route1`로 실제 교체** (`region_2_crossed.png`)
- **연구소 퇴장 → (28,95) 태초마을** = 좌표변환 회귀 없음 (이게 최대 위험이었다)
- 디버그 `E`/`R` → 각 맵 정위치 스폰 + 맵별 BGM (`debug_route1.png`·`debug_viridian_city.png`)
- `npx tsc --noEmit` 통과 (⚠️ **반드시 `myPokemon_AJ/`에서**)

## 6. `/code-review`(high) 8건 → 고친 것
맵크기 이중관리(assert 추가) · `REGION_ROWS` 손계산 제거 · **BGM 교체가 주석만 있고 미구현이던 것**
· 라이벌전 배경 하드코딩(`"town"`) → `curMap.battleBg` · **`cache.json.remove` 누락**(maps-collision 규칙 5번)
· HUD의 "연구소 문으로 들어가기" 오안내(3장이 되면서 틀림) → "Enter: 메뉴" · `toGlobal` 조용한 폴백 → console.warn

## 7. ⚠️ 함정 (이번에 실제로 걸린 것)
- **새 public 에셋 추가 후 dev서버 재시작을 안 하면 ogg가 `text/html` 993바이트로 응답** →
  브라우저 `Unable to decode audio data` → **BGM이 통째로 안 나온다.** 파일·코드는 멀쩡한데 소리만 없으면 이걸 의심.
  확인법: `curl -s -o /dev/null -w '%{content_type}' http://localhost:5180/assets/audio/bgm_route1.ogg` → `audio/ogg`여야 함.
  (`.claude/rules/maps-collision.md` 5번의 png 판이 ogg에도 똑같이 적용된다.)
- **playwright 스크립트를 스크래치패드에서 돌리려면** `ln -sfn <repo>/myPokemon_AJ/node_modules <scratchpad>/node_modules` 필요.
- 게임 전역 핸들은 **`window.__game`** (`window.game` 아님 — `main.ts`에서 dev 전용 노출).
- `LabScene.tryExit()`는 `chosen`이 false면 오박사가 막는다 → 검증 스크립트는 `s.chosen = true` 세우고 부를 것.
- 서버 재시작 시 `pkill -f vite` 뒤 같은 명령줄에서 `nohup npm run dev &` 하면 같이 죽는다 → `setsid nohup ... & disown`.

## 8. 다음 세션 시작 지점 = **틀 2 (야생 조우 + 포획)**
1. **풀숲 인카운터** — 재료는 이미 다 있다: `route1.json`의 `grass` 격자(178칸) + `encounters.json`(21%/14종/가중치).
   - `WorldScene.onEnterTile()`이 이미 한 칸마다 불린다 → **여기에 풀숲 판정만 얹으면 된다.**
   - `WorldScene.ts`의 **B키 임시 디버그(`keydown-B`)는 이때 제거.**
   - 배경은 `curMap.battleBg`가 이미 넘어간다(1번도로 = route). 별도 작업 불필요.
2. **포획 `systems/capture.ts`** — 3세대 공식, `species.json`에 `catchRate` 이미 있음. `markOwn`, 6마리 만석 거절(박스 없음).
   - `BagScene.BATTLE_POCKETS = [2]`에 **볼 포켓(3) 추가**해야 배틀에서 볼이 보인다(`BagScene.ts:30`).
3. 그 다음 = 틀 3(상대 팀 복수 + 파티 교체). 함정(0714 일지에서 여전히 유효):
   - 스프라이트 텍스처는 `preload()`에서만 로드 → 교체하려면 **런타임 `load.image` + `textures.remove()`** 필요.
   - `BattleScene.ally`가 registry 파티 선두와 **같은 참조**라는 전제가 경험치·회복 코드에 깔려 있다 → `ally`를 파티 인덱스로.
   - `battle.ts`/`exp.ts`/`homeBonus.ts`는 **불가침**.

## 9. 새 지침/skills/memory 요지
- 새 훅·규칙 추가 **없음**.
- ⚠️ **스킬 `tiled-map-grid-movement`에 틀린 서술이 있다**: "AR `Data/*.rxdata`는 맵 배열·로직을 직접 못 가져옴 →
  타일셋 그림만 쓰고 맵은 Tiled로 재구성". **틀렸다** — rubymarshal로 다 읽히고, 이 세션의 맵 5장이 전부 그렇게 나왔다.
  `myPokemon_AJ/AGENTS.md` §4-C가 이미 "예전 '못 가져옴'은 틀린 서술"이라고 정정해뒀다(AGENTS가 정본). **스킬 파일을 고쳐야 함(미처리).**
- memory `starter-lab-flow` 갱신 필요: **틀1 완료(다중맵 리전) / 다음 = 틀2(야생조우+포획)**.

## 10. 사용자가 직접 볼 곳
**http://localhost:5180** → 타이틀에서 **D** → **`5`=태초마을 / `E`=1번도로 / `R`=상록시티**
태초마을에서 **위로 계속 걸으면** 암전 없이 1번도로로 넘어가고 좌상단에 맵 이름 + BGM이 바뀐다.

---

# ▣ 세션 2 — **틀 2: 야생 조우 + 포획** (커밋 `3c568fa`)

## 1. 착수 전 재검증 (또 일지가 틀렸다)
- 세션1 §8이 "포획 = **3세대 공식**"이라 적어뒀는데 **틀렸다.** AR 원본 `pbCaptureCalc`를 직접 열어보니 **5세대식**이다
  (상태이상 잠듦/얼음 **×2.5**(3세대는 ×2), 흔들림 임계 **y = 65536 / (255/x)^0.1875**(3세대는 1048560/√√(16711680/x))).
  → **일지·계획의 "공식" 주장은 그대로 믿지 말 것.** 원본이 로컬에 있으니 여는 게 항상 빠르다.
- 세션1 §9의 "스킬 `tiled-map-grid-movement` 미처리"는 이미 **커밋 `4a30db8`에서 정정됨**(지금 스킬 파일은 올바름).
- 서브에이전트로 ① 코드 갭 조사 ② AR 원본 Ruby 추출을 **병렬**로 돌려 시작(메인 컨텍스트에 파일 덤프 안 쌓음).

## 2. ★ AR 원본에서 확인한 사실 (추측 아님 — 코드 인용까지 확인)
> 추출법: `Data/Scripts.rxdata`(+`PluginScripts.rxdata`)를 rubymarshal로 로드 → 항목별 zlib 해제 = Ruby 전문.
> 스크립트 406개 + 플러그인 220개 전부 덤프해 grep함(스크래치패드, 리포 밖).

**조우 (`Overworld_WildEncounters.rb`)**
- `encounter_triggered?`: 확률 = `step_chances[:Land]` **퍼센트 그대로**(1번도로 = **21**).
- **21%/보가 전부가 아니다:** `min_steps_needed = (8 - 21/10).clamp(0,8)` = **5.9보**의 유예 구간이 있고,
  그 동안은 `rand(100) >= chance*5/(step_chance + accum/200)` → 보정 없는 우리 게임에선 **95%가 즉시 false**(실효 ≈1%/보).
- 허탕 걸음마다 `@chance_accumulator += step_chance`, 확률엔 `+ @chance_accumulator / 200`으로 들어간다.
  ⚠️ **Ruby 정수 나눗셈** — 허탕 10보마다 +1%p씩 **계단식**(실수로 나누면 조금씩 더 잘 나온다 → `Math.floor` 필수).
- 조우하면 `reset_step_count`. **제자리에서 방향만 돌려도 판정이 돈다**(`on_player_change_direction`) — 우리는 안 넣음.
- `choose_wild_pokemon`: 가중 룰렛(합이 100일 필요 없음) + `level = rand(min..max)`.

**포획 (`Battle_CatchAndStoreMixin.rb` · `Battle_PokeBallEffects.rb`)**
- `x = ((3·maxHP − 2·HP) × catchRate) / (3·maxHP)` → 상태이상 ×2.5(잠듦/얼음) / ×1.5(그 외) → floor, 최소 1.
  `x >= 255`면 **확정 포획**. 아니면 `y = floor(65536 / (255/x)^0.1875)`, 흔들림 4회 각각 `rand(65536) < y`.
- **볼 배율:** 슈퍼볼 `×1.5`(핸들러 등록됨) / **몬스터볼 = 핸들러 자체가 없다 = ×1**(미등록 = 원본 rate 그대로 반환).
  → "못 찾음"이 아니라 **없는 게 정답**(플러그인까지 grep해 확인).
- **크리티컬 캡처**는 원본에 켜져 있으나 `dex_modifier`가 **잡은 종족 30종 초과**부터 0이 아니다 → 지금은 항상 0 → **안 넣었다**(넣으면 절대 안 도는 코드).
- 파티 만석이면 원본은 **박스로 전송**(`@sendToBoxes = 1`, 묻지 않음). 우리는 박스가 없어 **거절**하되 문장은 원본 것을 쓴다.

**한국어 대사 (스크립트 하드코딩 + `messages_kor_core.dat` 번역)**
| 상황 | 원문 |
|---|---|
| 던질 때 | `레드는 몬스터볼을 던졌다!` (`\j[{1},은,는]` = 조사 자동선택 태그) |
| 흔들림 0/1/2/3 | `아이고! 포켓몬이 빠져나왔다!` / `앗! 잡힌 줄 알았는데!` / `으윽! 거의 잡았는데!` / `으악! 정말 아슬아슬했다!` |
| 성공 | `좋았어! OO를 잡았다!` |
| 파티 편입 | `OO이(가) 파티에 추가되었습니다.` |
| 더 못 잡음 | `더는 잡을 수 없습니다...` (원본은 박스까지 만원일 때) |

## 3. 바꾼 파일 (커밋 `3c568fa`)
**신설**
- **`src/systems/encounter.ts`** — 조우 판정 + 종족/레벨 추첨. 위 원본 공식 그대로.
  상태(`stepCount`/`chanceAccumulator`)는 **모듈 수준** — 배틀 다녀와 WorldScene이 새로 생겨도 유지된다(저장엔 안 넣음).
  원본에서 **일부러 뺀 것**을 파일 주석에 명시: 자전거·리펠·피리·특성·지닌도구·시간대별 조우표·제자리 방향전환.
- **`src/systems/capture.ts`** — `captureShakes()`(0~4 반환, 4=성공) + `SHAKE_FAIL_TEXT`.

**수정**
- **`WorldScene.ts`** — 맵 JSON의 `grass`를 `blocked`처럼 리전에 이어붙임(route1만 있음 → **optional**).
  `onEnterTile()` → `maybeWildEncounter()`. **임시 B키 디버그 제거.** `startWildBattle(species, level)`로 시그니처 변경.
  ⚠️ 조우가 걸리면(busy) **워프를 건너뛴다** — 지금은 풀숲/워프 칸이 안 겹치지만 겹치면 두 씬이 동시에 start된다.
- **`BattleScene.ts`** — `throwBall()`: 만석 거절 → 볼 소비 → 대사 → 흔들림 → 성공 시 `markOwn`+파티 편입, 실패 시 복귀.
  `outcome`에 `"catch"` 추가(복귀는 승리와 같음). 상대 자리 `ENEMY_VY = 176` 상수화(등장/복귀가 같은 값을 써야 함).
- **`BagScene.ts`** — 야생전에만 볼 포켓(3). `BagResult.ball` 추가. **볼은 가방이 소비하지 않는다**(만석 거절이 있어서 배틀이 소비).
- **`region.ts` / `data/ar/index.ts`** — `RegionMap.arMapId`(1번도로=10) → `encounters.json` 키 연결, `loadArDb()`가 조우표도 받음.
- **`DebugMenuScene.ts`** — `testParty` 주는 항목(E=1번도로)에도 **가방 지급**. 안 그러면 조우해도 던질 볼이 없었다.

## 4. 검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)
스크립트 = 스크래치패드(리포 밖), 캡처 = `<repo>/.claude/.verify/t2_*.png`
- 풀숲 178칸이 리전에 결합 + 스폰(25,79)이 풀숲 → **23~25보 만에 실제 조우**(탐리스 Lv.2 / 파르빗 Lv.4 / Lechonk Lv.3 = **고정 구구 아님**), 배경 `route`.
- 포획 **성공**(파티 편입 + 도감 own 등록) / **실패**(상대 alpha=1 복귀 + 반격 진행) **두 경로 모두** 실측. 볼 정확히 1개 소비.
- **공식 실측**(브라우저에서 모듈 직접 import): 포획률 **43.7%**(손계산 43.9%) · 슈퍼볼 59.4% · HP1+잠듦 **500/500 확정** ·
  유예 첫 보 **0.9%** · 이브이 **2.05%**(표 2%) · 레벨범위 위반 0 · 14종 전부 등장.
- 가방 UI: 필드 화면과 **픽셀 대조** → 차이 bbox가 화살표 애니 영역과 정확히 일치 = **위상 차이뿐**(몽타주 `t2_10_비교_*.png`).
- `npx tsc --noEmit` 통과 (⚠️ **반드시 `myPokemon_AJ/`에서** — 스크래치패드에서 돌리면 tsconfig가 없어 도움말만 뜨고 "통과"로 착각한다).

## 5. `/code-review`(high) → 스스로 고친 것 2건
- 누산기 `/200`을 실수로 나누던 것 → **`Math.floor`**(원본은 정수 나눗셈).
- 상대 스프라이트 Y좌표 `176`이 등장·복귀 두 곳에 흩어짐 → `ENEMY_VY` 상수(한쪽만 고치면 포획 실패 시 엉뚱한 높이로 복귀).

## 6. ⚠️ 함정 (이번에 실제로 걸린 것)
- **AR DB 로드 레이스:** `getEncounters()`는 `loadArDb()`(main.ts에서 **비동기** fire-and-forget) 완료 전엔 `undefined`
  → **조우가 조용히 안 걸린다.** 디버그 `E`로 1번도로에 바로 점프하면 실제로 걸렸다(2초 시점 `isArDbLoaded()===false`).
  실플레이(타이틀→걸어서 도착)에선 이미 로드 끝나 문제없어 **코드는 안 바꿨다.** 검증 스크립트는 `isArDbLoaded()`를 먼저 기다릴 것.
- **검증 스크립트가 앱을 오염시킨다:** playwright에서 `await import("/src/systems/encounter.ts")`는 **앱이 쓰는 바로 그 모듈 인스턴스**다
  (Vite dev). 공식 실측(2만 회 루프)을 먼저 돌리면 조우 누산기가 오염된다 → **실주행 먼저, 공식 실측 나중.**
- **키 입력:** `keyboard.press`(순간)로도 걷기는 됐다. 단 **대사를 과하게 넘기면 '싸운다'가 눌린다**(야생 조우 대사는 **1줄**).
- **스크린샷을 안 열어보면 틀린 증거를 남긴다:** 가방 비교 B컷이 ESC 조작이 메뉴로 흘러 **포켓몬 상세화면**을 찍고 있었고
  스크립트가 읽은 값도 `mode:"field"`였다(=배틀 가방 아님). 눈으로 열어보고 페이지 새로 띄워 다시 찍었다.
- Bash 도구는 **작업 디렉터리가 유지된다** — 스크래치패드에서 `node` 돌린 뒤 `npx tsc`가 거기서 돌아 헛돌았다.

## 7. 다음 세션 시작 지점 = **틀 3 (트레이너전: 상대 팀 복수 + 파티 교체)**
1. `BattleScene.enemy`가 **단수 필드** → 팀 배열로. `cmd.kind === "switch"`는 아직 `"지금은 포켓몬을 교체할 수 없다!"` 스텁(`BattleScene.ts`).
2. 함정(0714·0717에서 계속 유효):
   - 스프라이트 텍스처는 `preload()`에서만 로드 → 교체하려면 **런타임 `load.image` + `textures.remove()`**.
   - **`BattleScene.ally`가 registry 파티 선두와 같은 참조**라는 전제가 경험치·회복 코드에 깔려 있다 → `ally`를 파티 인덱스로.
     ⚠️ 이번에 포획도 이 전제를 쓴다(`party.push(this.enemy)` 후 `registry.set`).
   - `battle.ts`/`exp.ts`/`homeBonus.ts`는 **불가침**.
3. 그 다음 = 틀4(상록시티 + 체육관 + 첫 뱃지). 맵 png/json은 세션1에서 이미 추출해둠(`viridian_gym/pc/mart`).

## 8. 사용자가 정할 것 (내가 임의로 안 정한 것)
- **볼 던지는 전용 연출 없음** — 볼 스프라이트가 없어 "상대가 사라졌다 흔들림 횟수만큼 대기"로 냈다. AR 볼 그래픽을 가져오면 제대로 만들 수 있다.
- **잡을 때 경험치 안 줌**(5세대까지 규칙). **AR은 9세대라 주는 게 원본에 맞다** — 바꿀지 사용자 결정 대기.
- **9세대 종족 한글 이름 없음** → `Lechonk`처럼 영문 표시(기존 데이터 이슈, `species.json`이 `nameEn` 폴백).
- 별명 짓기 없음(원본엔 `{1}에게 별명을 지어줄까요?`가 있다).

## 9. 새 지침/skills/memory 요지
- 새 훅·규칙·스킬 추가 **없음**.
- memory `starter-lab-flow` 갱신함: **틀1·틀2 완료 / 다음 = 틀3**, ⚠️**포획은 5세대 공식**(3세대 아님) 명시,
  AR DB 레이스·검증 모듈 오염 함정 기록. `MEMORY.md` 인덱스 줄도 갱신.

## 10. 사용자가 직접 볼 곳
**http://localhost:5180** → 타이틀에서 **D** → **`E`**(1번도로) → **풀숲을 걸어다니면** 야생 포켓몬이 나온다
→ 배틀에서 **가방 → 오른쪽 화살표(볼 포켓) → 몬스터볼**로 잡는다. (디버그 **`6`** = 야생 배틀 데모 = 포획만 바로 시험)

---

# ▣ 세션 3 — **틀 3: 트레이너전** (상대 팀 복수 + 파티 교체 + 트레이너 그림 + 상금)

## 1. 착수 전 재검증
- 워킹트리 clean, HEAD `210f458`. (이번엔 일지의 커밋 서술이 실제와 맞았다.)
- 서브에이전트 2개 **병렬**: ① 배틀 코드 전수 감사 ② AR 원본 트레이너 데이터 추출 → 메인 컨텍스트에 파일 덤프 안 쌓음.
- 사용자 결정: **"그림까지 통째로"** (트레이너 배틀 그림 포함).

## 2. ★ AR 원본에서 확인한 사실 (추측 아님 — 원본 .dat/.rxdata 직접 판독)
**1번도로(Map10) 트레이너 = 2명** (이벤트명 `Trainer(4)` = 시야 4칸, trigger=2)

| | 반바지꼬마 **한주** | 짧은치마 **유정** |
|---|---|---|
| 좌표(맵 로컬) | (25,13) `dir=6` 오른쪽 | (33,6) `dir=4` 왼쪽 |
| 팀 | RATTATA L3 + PIDGEY L3 | SKWOVET L3 + STARLY L3 |
| 먼저 | `내 첫 포켓몬 배틀이야!` | `눈이 마주치면 배틀!` |
| 지면(`real_lose_text`) | `이건 없던 거로 칠래!` | `내가 졌네?` |
| 이긴 뒤(page1) | `어린 아이 상대로 부끄럽지도 않아?` | `이제 눈 안 마주칠게...` |

- **타입 한글명** = `messages_kor_core.dat[13]`: `Youngster→반바지꼬마`, `Lass→짧은치마`. 표시 = `full_name` = `"타입명 이름"`.
- **base_money=16, skill_level=50** (둘 다). **상금 = 상대 팀 최고레벨 × base_money** = 3×16 = **48원**(`pbGainMoney`).
- **패배 시** = 내 최고레벨 × `multiplier[뱃지수]`, `multiplier=[8,16,24,36,48,64,80,100,120]` (`pbLoseMoney`).
- **기술 지정 없음** → 원본도 `reset_moves`(레벨업 학습표)로 채운다 → 우리도 `createFromSpecies`에 맡긴다(= trainers.json에 기술 안 적음).
- **시야 공식**(`pbEventFacesPlayer?` 0241_Overworld.rb:340): dir=6일 때 `x_min=ex+1`, `x_max=ex+distance` → **1 ≤ 거리 ≤ 시야**. 사이 칸이 전부 통행가능해야 함(`pbEventCanReachPlayer?` — 막히면 시야 차단).
- **대사 원문**(전부 `messages_kor_core.dat[24]`에서 확인, 지어낸 것 0):
  - 거둬들이기(`pbMessageOnRecall`, HP·턴수로 갈림): `잘했어, {1}! 돌아와!`(HP≤1/4) / `좋아, {1}! 돌아와!`(≤1/2) / `{1}, 잘했어! 돌아와!`(5턴+) / `{1}, 돌아와!`(2턴+) / `{1}, 교체야! 돌아와!`
  - 교체로 내보내기(`pbMessagesOnReplace`, **상대 HP로 갈림** — `가랏!`이 아니다): `네 차례야, {1}!`(상대 만피/기절) / `힘내, {1}!`(≥1/2) / `조금 남았어! 힘내, {1}!`(≥1/4) / `상대가 약해져 있어! 가랏, {1}!`
  - `{1}에게 승리했다!` · `승부에서 {1}원을 얻었다!` · `상대에게 {1}원을 상금으로 주었다...` · `더 이상 싸울 수 있는 포켓몬이 없습니다!` · `\j[{1},은,는] 이미 배틀에 나가 있다!` · `\j[{1},은,는] 기절해서 나갈 수 없다!`
- **AI 교체**: skill 50 → `ConsiderSwitching` 플래그가 붙어 **원본은 교체 경로가 열려 있다**. 다만 L3 2마리라 조건이 거의 안 걸림 → **우리는 미구현(순서대로 냄)**. 코드 주석에 명시.

## 3. 바꾼 파일
**새 도구** — `tools/ar-data/extract-trainers.py`
- `--maps 10` → `public/assets/data/ar/trainers.json` = `{defs, placements}`.
- **맵에 실제로 서 있는 트레이너만** 뽑는다(585명 중 2명) — `--maps` 화이트리스트, extract-encounters.py와 같은 철학.
- 좌표·대사·팀을 **손으로 안 베낀다**(원본이 정본). 함정: `@pokemon` 항목 키가 Symbol이라 `p["species"]`로 안 잡힘 → `sym()` 필요. species도 Symbol이라 `str()` 쓰면 `:RATTATA`가 된다.

**새 에셋** — `public/assets/trainers/{YOUNGSTER,LASS,NEMONA}.png` (AR `Graphics/Trainers/` 128px 원본)

**`src/data/ar/index.ts`** — `TrainerDef`/`TrainerMon`/`TrainerPlacement` 타입 + `getTrainer`/`getMapTrainers`/`trainerFullName`, `loadArDb`가 trainers.json도 받음.

**`src/scenes/BattleScene.ts` (대공사)**
- `ally`/`enemy` 단수 필드 → **`party`+`allyIdx` / `enemyTeam`+`enemyIdx`** + getter. → 0714부터 적혀 있던 *"ally는 파티 선두와 같은 참조"* 전제를 없앰.
- **스프라이트 런타임 로드**: 텍스처 키를 **종족별**(`bsp_front_<종족>`)로 → 예전 `battle_enemy` 한 키 돌려쓰기 + `textures.remove()` 해킹 **제거**(교체·다음 상대는 preload 시점에 종족을 알 수 없다).
- 상대 기절 → 경험치 → 다음 마리(`sendOutEnemy`) / 아군 기절 → 강제 교체(취소 불가) / 전멸 → 패배. 판정은 `resolveFaints()` 한 곳으로 모음.
- `switch` 스텁 제거 → **파티 교체**(턴 소비). 트레이너 그림 등장·퇴장·재등장, 상금 획득/상실, `trainersDefeated` 기록.
- `BattleInit`에 `enemyTeam`/`trainerId`/`trainerSprite` 추가. **`trainerId`만 주면 팀·대사·상금·그림을 전부 AR 정의에서 가져온다.**

**`src/scenes/MenuScene.ts`** — `mode:"switch"` 추가. 배틀 교체는 **필드 파티 화면을 그대로 재사용**(가방(BagScene) 재사용과 같은 방침 — UI 새로 안 지어냄). 못 내보내는 선택의 사유 안내는 배틀이 원본 문장으로 한다.

**`src/scenes/WorldScene.ts`** — 1번도로 트레이너 2명 배치(좌표·방향·시야·대사 전부 trainers.json). `sightPath()`=원본 공식, 발견 "!"→걸어옴→대사→배틀. 트레이너 칸은 막음. 라이벌 네모도 `trainerSprite:"NEMONA"`로 그림이 뜬다.

**`src/scenes/DebugMenuScene.ts`** — **`T` = 트레이너전 데모(반바지꼬마 한주)**. keyNames에 `T` 추가.

## 4. ⚠️⚠️ 이번 세션 최대 발견 — **기존 버그: 배틀 후 플레이어가 얼어붙는다**
- **증상:** 야생 배틀에서 이기고 월드로 돌아오면 **방향키가 아예 안 먹는다.** 틀2(커밋 `3c568fa`)부터 있던 버그 — 내 트레이너 코드와 무관.
- **원인:** **Phaser는 `scene.start`로 다시 시작해도 같은 인스턴스를 재사용한다 → 클래스 필드 초기화식(`private busy = false`)이 다시 안 돈다.**
  `startWildBattle`/`handleWarp`/컷신이 켠 `busy=true`를 **되돌리는 코드가 어디에도 없었다** → 돌아오면 켜진 채 → `update()`가 입력을 통째로 무시.
- **실증:** 인스턴스에 표식을 심고 재시작 → `sameInstance:true, busy:true`. 야생전 실주행 → 복귀 후 좌표 안 변함.
- **수정:** `WorldScene.init()`에서 `busy=false; moving=false`(init은 scene.start마다 도는 유일한 자리).
- **같은 부류로 3건 더 나옴(전부 수정):**
  1. `WorldScene.trainers` 배열을 안 비워 **파괴된 스프라이트**를 걷게 하려다 크래시(`t.sprite.play` → undefined). ← 시야 검증에서 실제로 터짐
  2. `BattleScene.trainerImg` 미초기화 → 트레이너전 다음 **야생전**이 파괴된 그림을 물고 감
  3. `setupTrainers`의 `isActive()` 가드가 '이전 실행'을 못 거름(재시작해도 active) → 실행번호(`setupRun`)로 교정
- **교훈(다음 세션):** 이 리포의 씬은 **인스턴스가 재사용된다.** 씬에 상태 필드를 추가하면 **반드시 `init()`에서 리셋**할 것. 배열은 `push` 전에 비울 것. `async` 작업은 실행번호로 옛 실행을 걸러낼 것.

## 5. 검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)
스크립트 = 스크래치패드(리포 밖) `t3_trainer.mjs` / `t3_sight.mjs` / `t3_rematch.mjs`, 캡처 = `<repo>/.claude/.verify/t3_*.png`
- **트레이너전 데모(T):** 이름 `반바지꼬마 한주` · 팀 **2마리** · 트레이너 그림 등장 → 포켓몬 내면 퇴장 · 라타→(교체)→구구 · **상금 정확히 +48원** · `trainersDefeated=['YOUNGSTER:한주']`
- **파티 교체:** 배틀 위에 AR 파티 화면(`mode:"switch"`) → 꼬부기 선택 → `allyIdx 0→1`, 뒷모습 텍스처가 `bsp_back_SQUIRTLE`로 바뀜
- **시야:** 5칸=안 걸림 / **4칸=걸림**(원본 공식과 일치) → 걸어와서 `내 첫 포켓몬 배틀이야!`(이름창 `한주`) → 배틀
- **재도전 방지:** 이기고 복귀 → `defeated:true` → 시야 안을 다시 걸어도 트레이너전 재발 없음(그 자리 풀숲이라 **야생 조우**는 걸리는데, 테스트가 둘을 구분하게 고침)
- **얼어붙음 수정 확인:** 야생전 승리 후 복귀 → (25,79)→(25,82) 실제 이동
- **파티 UI 픽셀 대조**(`t3_12_비교_파티_필드vs배틀.png` — MenuScene을 고쳤으므로 game-ui.md 5번 게이트):
  필드 파티 화면(레퍼런스, 안 건드린 경로) vs 배틀 교체 파티 화면(`mode:"switch"`)을 **같은 파티로 고정**(파이리/꼬부기/이상해씨 L5 male, 풀피)해 대조.
  ⚠️처음엔 23% 달라 놀랐는데 **디버그 `0`은 6마리·`T`는 3마리를 넣어서**였다(렌더 차이 아님. 성별도 랜덤이라 갈렸다) → 파티를 고정해 재측정.
  결과 **차이 0.59%, 덩어리 딱 3개(각 ~72×72px)** = 파이리(x222~296,y141~212)·꼬부기(x682~756,y175~238)·이상해씨(x214~285,y316~387) **아이콘 자리와 정확히 일치**
  = 64×64 2프레임 까딱 애니의 **위상 차이뿐**(세션2 가방 대조와 같은 결론).
  **나머지는 전부 동일:** 2열 스태거드 패널 기하 · 선택표시(파랑 패널+빨강 테두리, 둘 다 슬롯0) · HP바/HP숫자/Lv 태그/성별기호 · 하단 "포켓몬을 선택하세요."+취소 버튼 · 벽지.
  → **내 변경은 진입경로·반환만 바꿨고 그림은 안 건드렸다**는 게 픽셀로 확인됨.
- `npx tsc --noEmit` 통과 (⚠️ **반드시 `myPokemon_AJ/`에서** — Bash 작업디렉터리가 스크래치패드에 남아 헛돌았다)

## 6. `/code-review`(high) 5건 → 고친 것 3건
`trainerImg` 미초기화 · `setupTrainers` 실행번호 가드 · **쓰러진 상대의 HP박스가 화면에 남던 것**(스샷으로 발견 → `onEnemyFainted`에서 `destroy`, `sendOutEnemy`가 매번 새로 만듦).
**안 고친 2건(의도):** ① 같은 턴에 서로 쓰러지면 기절한 내 포켓몬이 경험치를 받는다(원본은 안 줌 — 엣지) ② MenuScene switch모드의 detail 분기는 도달 불가(죽은 코드).

## 7. ⚠️ 함정 (이번에 실제로 걸린 것)
- **playwright에 문자열로 함수를 넘기면 '평가'만 되고 호출이 안 된다** — `page.evaluate("() => {...}")`는 함수 객체를 반환(→ undefined)하고 **본문이 안 돈다.** HP 세팅이 조용히 무시돼 한참 헤맴. **반드시 `(() => {...})()`**.
- **검증 스크립트가 기술 0번을 골라 아무 일도 안 일어남** — 파이리 기술 0번이 **울음소리(변화기, 위력 0)**. 위력>0인 기술을 골라야 한다(`ar.getMove(id).power`).
- 새 public 에셋(`trainers/*.png`) 추가 후 **dev서버 재시작 필수** — `NEMONA.png`가 `text/html`로 응답했다.
- **`pkill -f vite`를 같은 명령줄에서 쓰면 그 뒤 `nohup npm run dev`도 같이 죽는다**(exit 144). 별도 명령으로 `setsid nohup ... & disown`.
- 타이틀에서 키가 안 먹으면 **`page.click("canvas")`로 포커스**부터.

## 8. 다음 세션 시작 지점 = **틀 4 (상록시티 + 체육관 + 첫 뱃지)**
- 맵 png/json은 세션1에서 이미 추출해둠(`viridian_gym`/`viridian_pc`/`viridian_mart`). BuildingScene(PC·마트) + 체육관 그린 + 뱃지.
- **틀3이 깔아준 것:** `trainerId`만 주면 배틀이 완성된다 → 체육관 트레이너는 `extract-trainers.py --maps 194`로 뽑아 배치만 하면 됨. `badges`는 세이브에 이미 있고 `LOSE_MONEY_MULT`가 이미 뱃지수를 읽는다.
- **남은 구멍(틀3 범위 밖):** 트레이너에게 **말 걸기 없음**(`afterText`를 뽑아뒀지만 WorldScene에 A버튼 상호작용 자체가 없어 미사용) · AI 교체 미구현 · 경험치 참전 분배 없음 · 별명 짓기 없음.
- 그 뒤 세부: **affinity 가구 0개 = 차별점 미발동(제일 아픔)** · 와이드 대응 · 난이도 화면(데드코드) · 상태이상 거는 코드 없음 · `BedroomScene` 고아 씬.

## 9. 새 지침/skills/memory 요지
- 새 훅·규칙·스킬 추가 **없음**.
- memory `starter-lab-flow` 갱신: **틀3 완료 / 다음 = 틀4**, ⚠️**씬 인스턴스 재사용 → init()에서 상태 리셋** 함정 추가.

## 10. 사용자가 직접 볼 곳
**http://localhost:5180** → 타이틀에서 **D**
- **`T`** = 트레이너전 데모(반바지꼬마 한주) — 그림 등장 → 팀 2마리 → **`포켓몬`으로 교체** → 이기면 상금 48원
- **`E`** = 1번도로 → **위로 걸어가면** 반바지꼬마 한주(오른쪽을 봄)·짧은치마 유정과 **눈이 마주쳐** 승부가 걸린다

## 11. ✅ **완료** (2026-07-17 세션4) — 배틀 대화창에 ▼ 화살표가 없다 (사용자 지적)
> 아래는 착수 전 기록. 실제 조사·수정 결과는 이 절 맨 끝 **"§11 처리 결과"** 참조.
- **증상:** 필드 대화창(`src/ui/DialogBox.ts`)엔 오른쪽 아래 **▼가 있는데**, **배틀 대화창엔 없다.**
  → `BattleScene.say()`(`overlay_message` 위에 텍스트만 얹음)에 화살표를 안 그린다. 같은 게임인데 두 대화창이 따로 논다
  = 배틀에서 "키를 눌러 넘겨라"는 신호가 아예 없다.
- **증거:** `.claude/.verify/t3_8_시야걸림_대사.png`(필드 = ▼ 있음) vs `t3_1_트레이너그림.png`·`probe_2_after_move.png`(배틀 = 없음).
- **⚠️ 착수 방법(눈대중 금지 — game-ui.md):** 필드 DialogBox의 ▼를 **복사하지 말 것.**
  AR 원본이 배틀 메시지창 화살표를 **어떤 그래픽으로, 어디에, 어떻게(깜빡임/위아래 움직임)** 그리는지 먼저 확인한다:
  - `Graphics/UI/` 아래 화살표 에셋(예: `pause`/`arrow` 계열) 존재 여부 확인
  - 원본 스크립트에서 메시지 대기 표시를 그리는 부분(`Window_AdvancedTextPokemon`/`MessageWindow` 계열) 판독
  - 우리 배틀 UI는 이미 AR 원본 `assets/ui/battle/overlay_message.png`를 쓰므로, 화살표도 원본 에셋으로 맞춰야 톤이 안 깨진다.
- 고친 뒤 **반드시 캡처해 눈으로 확인**하고 `.claude/.verify/`에 '비교' 몽타주를 남길 것(enforce-ui-verify 훅이 막는다).

### §11 처리 결과 (세션4, 2026-07-17)

**★ AR 원본에서 확인한 사실 (추측 아님 — `Data/Scripts.rxdata`를 zlib로 풀어 535개 스크립트 직접 판독)**
- 그래픽 = **`Graphics/UI/pause_arrow.png` (80x28 = 20x28 4프레임)**. 필드 DialogBox의 `▼`(텍스트)와 **완전히 다른 물건** — 복사하지 않았다.
- 움직임 = **깜빡임이 아니라 위아래 까딱임.** 프레임마다 삼각형이 그려진 세로위치가 다르다(top = 8→12→14→10) → 프레임만 돌리면 원본처럼 흔들린다.
- 속도 = `allocPause`: `AnimatedSprite.create("Graphics/UI/pause_arrow", 4, 3)` + `AnimatedSprite` 주석 `"frameskip is in 1/20ths of a second"` → **3/20초 = 150ms/프레임, 4프레임 한 바퀴 600ms.**
- 위치 = `MessageConfig::CURSOR_POSITION = 1`("Lower right") → `moveCursor`:
  `x = 창.x + 창.width - 40 + 프레임폭/2 = 482` · `y = 창.y + 창.height - 60 + 프레임높이/2 = 338`
  그 창 = `pbBottomLeftLines(msgwindow, 2)` → x0 / w512 / h(borderY 32 + 2*32)=96 / y(384-96)=288
  = **우리 `overlay_message`(512x96 @ 0,288)와 정확히 같은 사각형** → 좌표를 그대로 쓸 수 있었다.

**바꾼 파일**
- `public/assets/ui/pause_arrow.png` (신규) — AR 원본 복사. ※ `assets/ui/`인데 키는 `bt_` 접두(= `bt_types`와 같은 관례) → BattleScene의 NEAREST 루프(`bt_`/`bb_`/`bsp_`)에 자동으로 걸린다.
- `src/scenes/battleView.ts` — `PAUSE_W/H/VX/VY/MS` 상수 + 위 근거를 주석으로 박음(다음 세션이 다시 안 캐도 되게).
- `src/scenes/BattleScene.ts` — preload에 스프라이트시트, `create()`에서 애니 1회 등록, `say()`에서 표시. 앵커는 `XR`(대사창이 화면 폭을 꽉 채우므로 — 커맨드 버튼과 같은 관례).

**검증 (playwright 실주행)**
- **픽셀 대조: 4프레임 전부 AR 원본과 464픽셀 중 불일치 0** → 그림·위치·NEAREST·프레임순서가 한 번에 증명됨.
- 속도 실측 **149.1ms/프레임 → 596ms/바퀴**(원본 150/600ms). 콘솔 에러 0. 와이드(1600x720)에서도 정상.
- 산출물: `.claude/.verify/0717_battle_pause_arrow_비교.png`(몽타주) · `_실화면.png`

**⚠️ 이번에 실제로 걸린 함정 (다음 PC/세션도 반드시 걸린다)**
1. **`curl`이 200을 줘도 png가 아닐 수 있다.** `public/`에 **새로 넣은 파일**은 dev서버가 모르고 `index.html`(993B, `content-type: text/html`)을 200으로 돌려준다 → Phaser `Failed to process file: spritesheet`. **상태코드 말고 `content_type`까지 확인**하고, 새 에셋을 넣었으면 **dev서버 재시작**(AGENTS의 "새 폴더" 함정이 새 *파일*에도 적용됨).
   `curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}" http://localhost:5180/assets/ui/pause_arrow.png`
2. **`/code-review`가 내가 넣은 버그를 잡았다** — 텍스처 로드 실패 시 `generateFrameNumbers`가 빈 배열 → 0프레임 애니 → `sprite.play()`가 throw → `runBattle().catch`는 콘솔만 찍고 **배틀이 첫 대사에서 통째로 멈춤**(위 1번 때문에 실제 발생). `say()`는 원래 에셋 의존이 0이었다. → **그림 없으면 화살표만 건너뛰도록** 고쳤고, png를 막아 재현해 **배틀이 커맨드 메뉴까지 정상 진행**하는 것까지 확인.

**남은 것 / 안 한 것**
- **필드 DialogBox는 그대로 `▼` 텍스트다**(요청 범위 밖이라 안 건드림). 원본 톤으로 통일하려면 같은 `pause_arrow` 에셋으로 바꾸면 된다 — 그때 이 절의 좌표계산(창 사각형 기준)을 필드 대화창 사각형에 다시 적용할 것.
- 배틀 창 리사이즈 중 화살표 재배치 없음(기존 UI 전부 동일 — `BattleView.measure()`가 생성자에서만 불림). 기존 한계지 이번 회귀 아님.

---

## 12. ✅ **완료** (2026-07-17 세션5) — 포트폴리오 README 신규 작성 (커밋 `99d1221`)

> 사용자 요청: "게임 작업 이어서 하기 전에 리드미부터. 취업 걸려있으니 잘 써주고 로고도 적극적으로." → 게임 완성되면 수정하는 전제로 **지금 완성본**을 만들었다.

**확인 후 진행한 사용자 결정 (2건만 물음)**
- 톤 = **기술 역량 쇼케이스**("포켓몬 팬게임"이 아니라 "Phaser3+TS 2D RPG 엔진 + AR 바이너리 추출 파이프라인"을 전면에).
- 라이선스 = **비상업·학습용 명시**(Nintendo/GF 권리 고지 + "본인 저작 = 코드와 타이틀 로고 아트").

**바꾼 파일 (전부 신규)**
- `README.md` — 개요 / 봐주셨으면 하는 것(4) / 주요기능 / 화면 / 스택 / 아키텍처(+추출 파이프라인 도식) / **트러블슈팅 4건** / 검증 수치표 / 실행 / 진행상황 / 규모 / 라이선스.
- `docs/logo.png` — **`myPokemon_AJ/public/assets/title/logo.png`**(TitleScene이 실제 로드하는 라이브 에셋, 투명배경 RGBA)를 560x420으로 축소(2.7MB → 387KB).
- `docs/screenshots/` 6장 — `.claude/.verify/`(untracked 스크래치)에서 선별해 **git에 올라가는 `docs/`로 복사**해야 GitHub이 렌더한다. 오버월드 2장은 좌상단 디버그 HUD(`테스트 | 방향키: 이동`)를 **상단 44px 크롭**으로 제거.

**트러블슈팅 4건 = 일지 0701~0717에서 선별** (①씬 인스턴스 재사용 얼어붙음+결함군 3건 ②흰화면=브라우저 WebGL, playwright 통과≠정상, 우회 원복 ③눈대중 UI 실패→guard-ui-edit/enforce-ui-verify 훅으로 승격 ④CRLF로 가드훅이 정반대 작동) + 보너스(텍스처 최대폭 초과).

**검증 (전부 실제로 함 — 일지 인용 안 믿고 재확인)**
- 수치 재검증: `species.json` **1463종** / `moves.json` **920개** / `types.json` **20종** / `dex_kanto.json` **151** / 1번도로 풀숲 **178칸** / 에셋 **122MB** — 전부 실측 일치. `npm run build` 설명도 package.json 실제값(`tsc && vite build`)에 맞춤.
- **README를 GitHub 실제 엔진으로 렌더해 전 구간 육안 확인** → 깨진 이미지 0건.
- 이미지 6장 상대경로 존재 + `.gitignore` 미포함 확인.

**⚠️ 이번에 실제로 걸린 함정 (다음 세션도 걸린다)**
1. **README 프리뷰는 `python-markdown`으로 하면 안 된다 — GFM이 아니라 가짜 깨짐이 뜬다**(헤더 볼드·배지가 다 깨져 보였는데 실제 GitHub에선 정상). **정답: `pip install --target <scratchpad> cmarkgfm`**(= GitHub이 쓰는 cmark-gfm 그 엔진) + `Options.CMARK_OPT_UNSAFE`(raw HTML 통과). WSL엔 `ensurepip`이 없어 venv가 안 만들어지고 시스템 pip은 PEP668로 막히니 **`--target`으로 스크래치패드에 격리 설치**. 렌더 후 저장소 루트를 `python -m http.server`로 서빙해야 `docs/` 상대경로 이미지가 뜬다.
2. **★한국어 README의 GFM 볼드 함정 (실제 버그 2건 발견·수정)** — **볼드가 구두점으로 끝나고 바로 한글 조사가 붙으면 GFM이 볼드를 안 닫아 `**`가 화면에 그대로 노출된다.** (`**...10%**로`, `**\`*.sh text eol=lf\`**로`) 닫는 `**`의 right-flanking 규칙 때문. **해결: 조사를 볼드 안 letter로 흡수**(`**...최대 +10% 상승**으로`) 또는 볼드 해제. 검사법 = 렌더된 HTML에서 태그 제거 후 리터럴 `**` 검색 → 현재 **0건**.
3. **캡처 속 포켓몬이 영문명으로 나온다** — 버그 아니라 **AR 원본 데이터에 9세대 일부 종족의 한글명이 없다**(`LECHONK`→`Lechonk`, `TAROUNTULA`→`Tarountula`. 캐터피/꼬렛/구구 등은 정상 한글). → 캡처는 **한글명 있는 종족으로 찍으면 된다.**
4. **배틀 캡처 타이밍** — 등장 대사 직후엔 상대 스프라이트가 **`alpha: 0`**(대사 넘기면 `alpha:1` 페이드인). 너무 일찍 찍으면 상대가 없는 그림이 나온다(버그 아님). **Space로 대사 넘긴 뒤 캡처**해야 상대·HP박스·커맨드 메뉴가 다 나온다.
5. `/tmp`에 둔 playwright 스크립트는 `import { chromium } from "playwright"`가 **ERR_MODULE_NOT_FOUND** — 스크립트 위치 기준으로 node_modules를 찾기 때문. **절대경로로 import**(`.../myPokemon_AJ/node_modules/playwright/index.mjs`).

**재현용 캡처 방법 (README 스샷 갱신할 때 그대로 쓸 것)**
```js
// dev서버(5180) 띄운 뒤. DebugMenuScene "6. 배틀 - 야생 데모"와 동일 = 파이리 vs 구구(둘 다 한글)
g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
g.scene.start("BattleScene", { wild:true, testParty:true, backdrop:"route" });
// 3.5초 대기 → Space(등장대사 넘김) → 2초 대기 → tools/_snap.mjs 의 snap()
```

**남은 것 / 다음에 할 것**
- **게임 마무리 후 README 갱신**: ①"현재 진행 상황" 체크리스트(체육관·뱃지 완료 시 체크) ②스크린샷을 **실제 플레이 흐름(1번도로 인카운터)에서 한글 종족이 뜬 순간**으로 교체(지금은 디버그 데모라 정직하긴 하나 실플레이가 더 낫다).
- **박스(PC) 보관은 README 기능 목록에서 뺐다** — 조사해보니 **BoxScene이 실제로 없다**(`viridian_pc.json`은 스텁). "다음 할 일"로 내려놨으니 만들면 올릴 것.
- 다음 작업 = **§8 그대로 틀4 (상록시티 + 체육관 + 첫 뱃지).**

**사용자가 직접 볼 곳** — GitHub 저장소 첫 화면(push 후). 로컬 확인은 위 함정1 방법.

---

# ▣ 세션 6 — **틀 4: 상록체육관 + 첫 배지** (⚠️ 미완 — 커밋 안 함, /code-review 안 함)

> 이 PC = 집PC/C드라이브. 컨텍스트 한계로 중간에 끊었다. **아래 "남은 일"부터 이어서 하면 된다.**

## 1. ★ AR 원본에서 확인한 사실 (조사 에이전트 2개를 **각각 독립**으로 돌려 교차검증 — 둘이 일치했다)
**일지·계획의 틀4 가정이 여러 개 틀려 있었다:**
- **체육관에 잡몹 트레이너가 없다. 퍼즐도 없다.** Map194 이벤트는 **3개뿐** — 출구(10,11)·간판(10,2)·그린(10,5).
  → 세션3이 적어둔 "`extract-trainers.py --maps 194`로 뽑아 배치만 하면 됨"은 **안 통한다**(아래 3번).
- **그린은 `trigger=3` = 오토런** — 들어서면 자동 재생. → **말 걸기(A버튼) 시스템이 필요없어졌다**(계획엔 있었음).
- **상록체육관이 AR에선 1번째 배지다**(`$player.badges[0]`, 스위치 이름도 `Defeated Gym 1`). "원래라면 마지막 배지인 그린 배지를 먼저 따버렸다"가 AR의 설정.
- **그린 팀 = 랜덤 3버전**(이벤트가 `VAR100 = 랜덤(1~3)` 굴린 뒤 그 번호로 배틀). base_money **100** → 상금 = 최고레벨 13 × 100 = **1300원**.
  ⚠️ `trainers.dat`엔 **ver4(L24 재대결용)**도 있는데 **Map194는 안 부른다** → 넣으면 틀린다.
- 컷신 순서(원본 명령 그대로): 20프레임 대기 → `이런...` → **그린 아래로 2칸**(10,5→10,7) → `배지가 7개가 아니면...` → **플레이어 위로 3칸**(10,11→10,8) → 소개장 → 선택지 → `후딱 끝내버리자고요.` → 배틀.
- 입구/출구: 상록시티 **(35,9)** → 체육관 **(10,11)** / 체육관 (10,11) → 상록시티 **(35,10)**. (도착칸=출구칸이 같다.)
- **⚠️ 그린 그림 불일치 = AR 자체 결함:** 오버월드(`trainer_RIVAL2`)는 **연두머리 여성**인데 배틀 그림 `LEADER_Green.png`는 **주황머리 남성**이다. `LEADER_Green.png`·`GREEN.png`·`CHAMPION_Green.png` **md5가 전부 동일**(=바닐라 잔재), 338개 배틀그림 중 연두머리 대체본 **0개**.
  → **사용자 결정: "원본 그대로(주황머리 남성)"**. 비교 이미지 `01_Resources/Pick/07_그린_배틀그림/_미리보기_불일치.png`.

## 2. ★ 체육관 BGM — .mid뿐이라 못 쓴다던 문제 **해결됨**
- ffmpeg엔 MIDI 디코더가 **없다**(검색되는 mv30/mvdv는 무관한 영상코덱). fluidsynth·사운드폰트도 미설치.
- **결정적 단서:** `sfx.ts`의 주석 `lab: "bgm_lab", // Lab.mid → AR soundfont로 렌더` → **과거 세션이 이미 같은 문제를 풀었다.**
- **AR 원본 루트에 `soundfont.sf2`가 동봉돼 있다**(4.1MB). RPG Maker가 MIDI 재생에 쓰는 그 음색 = **이걸로 렌더하면 곧 원본 재현**이다.
- **신규 도구 `tools/ar-audio/render-mid.py`** — `tinysoundfont`로 렌더 → ogg. 시스템 무변경(스크래치패드에 `pip install --no-deps --target ... tinysoundfont`. **`--no-deps` 필수** — pyaudio는 실시간재생용이라 불필요한데 빌드가 깨진다).
  ```
  PYTHONPATH=<스크래치패드>/_pylibs python3 tools/ar-audio/render-mid.py --mid "Gym" --out ../../public/assets/audio/bgm_gym.ogg
  ```
- **파이프라인 검증:** 같은 방법으로 `Lab.mid`를 렌더해 **커밋된 `bgm_lab.ogg`와 대조** → **음량 포락선 상관 0.878, 시간차 0ms = 같은 곡·같은 템포.**
  (파형 상관은 0.130으로 낮은데 **음색이 달라서**다 — 과거 세션은 다른 신시사이저를 썼다. 내 쪽이 AR 동봉 폰트라 더 원본에 가깝다.)
- 음량도 기존 곡과 맞다(gym mean −20.7dB/max −4.0 vs 마을 −22.0/−5.3). ⚠️ **기존 `bgm_lab.ogg`는 max 0.0dB로 클리핑돼 있다**(과거 렌더가 과했음 — 언젠가 다시 뽑으면 좋다).
- **PC·마트 BGM(`Poke Center.mid`·`Poke Mart.mid`)도 이 도구로 그대로 뽑으면 된다** (틀4 다음 블록).

## 3. 바꾼 파일
**새 도구**
- `tools/ar-audio/render-mid.py` (신규, 위 2번)
- `tools/ar-data/extract-trainers.py` — **`--trainers "TYPE:이름:버전"`** 추가(오토런 관장은 맵 이벤트로 안 잡힌다). 같은 TYPE:이름의 버전 여러 개 → `teams`(복수)로 묶음.
  **잠재버그도 고침:** 배틀 호출의 버전번호를 버리고 있어서, 다버전 트레이너가 배치되면 **조용히 엉뚱한 팀**이 나왔다.
  ```
  python3 tools/ar-data/extract-trainers.py --maps 10 --trainers "LEADER_Green:그린:1,LEADER_Green:그린:2,LEADER_Green:그린:3"
  ```
- `tools/ar-map/extract-map.py` — **기존 손입력 키(img/spawn/exit) 보존**. 안 그러면 재추출 때 조용히 날아가 씬이 죽는다(실제로 그럴 뻔).

**새 에셋** — `bgm_gym.ogg` · `trainers/LEADER_Green.png` · `characters/trainer_RIVAL2.png` · `ui/icon_badges.png`(256x64, **AR 배지는 전부 흑백**. 그린배지 = 시트 (0,0,32,32)) · `battlebacks/gym_bg.png`+`gym_message.png`

**신규 코드**
- **`src/data/Badges.ts`** — `GREEN_BADGE`/`getBadges`/`hasBadge`/`giveBadge`/`badgeIconRect`. 배지 이름을 문자열로 흩뿌리지 않으려고 한 곳에 모음. 중복 지급 방지(배지 수가 틀어지면 `LOSE_MONEY_MULT`까지 어긋난다).
- **`src/scenes/GymScene.ts`** — LabScene 패턴. 오토런 컷신 → 배틀 → 배지 → 그린 퇴장. 원본 명령 순서를 주석에 근거까지 박아둠.

**수정**
- `src/data/region.ts` — **`Backdrop` 타입 신설**(`"town"|"route"|"gym"`), `battleBg`를 string → Backdrop. (타입은 data에 둔다 — data가 scenes를 import하면 계층이 거꾸로다.)
- `src/data/ar/index.ts` — `TrainerDef.team`을 optional로, **`teams?`** 추가 + **`trainerTeam(def)`** 헬퍼(여러 버전이면 무작위 1개 — 원본과 같은 동작). 호출부마다 분기하면 한쪽을 반드시 빠뜨린다.
- `src/ui/DialogBox.ts` — **`askChoice(opts)`** 신설(인덱스 반환), `askYesNo`는 이걸 쓰게 일반화. 상자 폭은 **실제 글자 너비에서 잰다**(긴 선택지가 삐져나오지 않게).
- `src/scenes/BattleScene.ts` — `returnScene`(실내 배틀이 그 씬으로 복귀) · **`lastBattleOutcome` registry 기록** · backdrop `gym` · `trainerTeam` 사용 · `getBadges` 사용.
- `src/scenes/WorldScene.ts` — 체육관 워프 `(35,9)→gym` + **모르는 `to`면 얼어붙던 것 방지**(busy=true·페이드아웃만 하고 씬을 안 켰다).
- `src/scenes/DebugMenuScene.ts` — **`Y` = 상록체육관**. `src/main.ts` — GymScene 등록. `src/game/sfx.ts` — `BGM.gym`.

## 4. ⚠️⚠️ 이번에 잡은 실제 버그 2건 (둘 다 내가 만든 게 아니라 기존/잠재)
1. **`BattleScene`이 트레이너 그림 파일명을 대문자로 바꿔 찾았다** (`assets/trainers/${tf.toUpperCase()}.png`).
   기존 3명(YOUNGSTER·LASS·NEMONA)이 **원래 대문자라 우연히 통했을 뿐** → `LEADER_Green.png`에서 404 → `Failed to process file` → **배틀이 아예 안 떴다.**
   → 파일명은 **대소문자 그대로** 쓴다(AR 파일명 = 트레이너 타입 id). 4명 전부 일치 확인함.
2. **체육관 배틀에서 지면 공짜 배지** — 지면 화이트아웃으로 집에 가는데 `gymGreenBattleDone` 표시가 registry에 남아, 다시 들어오면 **안 싸우고 뒷대사(=배지 지급)로 이어졌다.**
   → `BattleScene.endBattle`이 `lastBattleOutcome`을 남기고, GymScene이 **`=== "win"`일 때만** 잇는다.

## 5. 검증 (playwright 실주행, 캡처 = `.claude/.verify/t4_*.png`)
- **체육관 진입**: 스폰 (10,11) / 그린 (10,5) / 콘솔에러 0 (`t4_1_체육관_컷신시작.png` — 이름표 "그린" + `이런...`)
- **컷신 이동이 원본과 일치**: 그린 (10,5)→**(10,7)** / 플레이어 (10,11)→**(10,8)**
- **배틀 진입**(`t4_2_그린_배틀.png`): backdrop **gym** · 상대 **체육관 관장 그린** · 팀 **GROWLITHE L10+BRONZOR L11+YAMPER L12+RHYHORN L13**(= 원본 ver1) · 그린 배틀그림 표시
- **승리 → 배지**: `badges: ["그린 배지"]` · 그린 사라짐(`greenGone=true`) · 그 칸 통행가능으로 풀림 · **세이브에도 `["그린 배지"]`**(save.ts가 이미 badges를 직렬화 — 스키마 변경 불필요했다) · 뒷대사 29번째에 `busy=false`로 **정상 복귀(얼어붙지 않음)**
- 새 에셋 8개 전부 `content_type` 확인(200만 보면 안 된다 — text/html이 200으로 온다)
- `npx tsc --noEmit` 통과 (⚠️ **반드시 `myPokemon_AJ/`에서**)

## 6. ⚠️ 남은 일 (다음 세션 시작 지점 — 순서대로)
1. **미검증**: ① 상록시티 (35,9) 문 → 체육관 워프 ② 체육관 출구 → 상록시티 (35,10) 복귀 ③ 지고 나서 재입장 시 컷신이 다시 도는지 ④ 랜덤 3팀이 실제로 갈리는지(ver1만 봤다)
2. **`/code-review`(effort medium) 안 돌렸다.** → 돌리고 → 커밋. **지금 워킹트리는 커밋 안 된 상태**(`git status`로 확인).
3. **원본에 있는데 일부러 안 넣은 것**(GymScene 주석에도 박아둠): **TM92(트릭룸)** — 기술머신 시스템이 아예 없다(items.json 10개, TM 0개) / **포켓몬 도감 지급** — 원본은 `!has_pokedex`일 때만 주는데 우린 오박사가 이미 줌 = **안 도는 게 원본과 같은 동작** / 그 둘에 딸린 "선물 받아주세요" 선택지.
4. **경호(체육관 문지기) 미배치** — 원본은 **22번도로 트레이너 4명**을 다 이겨야 비켜준다. 그 맵이 리전에 없어 이번엔 **안 넣고 문을 열어뒀다**(사용자: "일단 문제없이 해"). **22번도로를 만드는 세션에 원본 조건 그대로 올릴 것.**
5. **배지 UI 표시 없음** — `icon_badges.png`는 넣었는데 보여주는 화면이 없다(트레이너카드 미구현). `badgeIconRect()`가 자를 사각형을 준다.
6. 그 뒤: PC·마트(BuildingScene, **BGM은 위 2번 도구로 뽑으면 됨**) · 아일라 스토리배틀 · affinity 가구 0개(차별점 미발동, 제일 아픔).

## 7. 새 지침/skills/memory 요지
- 새 훅·규칙·스킬 **없음**. memory `starter-lab-flow`는 **아직 갱신 못 했다** — 다음 세션이 "틀4 진행중(체육관 코어 완료·미커밋)"으로 갱신할 것.

## 8. 사용자가 직접 볼 곳
**http://localhost:5180** → 타이틀에서 **D** → **`Y` = 상록체육관** — 들어서면 그린 컷신이 자동으로 돌고 배틀까지 간다.
⚠️ **테스트 파티(L5 3마리)로는 그린(L10~13 4마리)을 절대 못 이긴다** → 배지 받는 장면까지 보려면 파티를 키우거나 검증 스크립트로 상대 HP를 낮춰야 한다.
