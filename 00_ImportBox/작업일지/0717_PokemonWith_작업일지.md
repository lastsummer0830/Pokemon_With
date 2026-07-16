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
