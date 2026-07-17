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

## 11. 🔴 다음 세션 **첫 작업** — 배틀 대화창에 ▼ 화살표가 없다 (사용자 지적, 2026-07-17)
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
