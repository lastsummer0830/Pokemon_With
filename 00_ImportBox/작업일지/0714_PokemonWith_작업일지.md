# 0714 PokemonWith 작업일지

# ▣ 세션 1 — 오늘 계획 확정 + **STEP 3 블록1: 배틀 커맨드 4개 + 가방 연동**

> 이 PC = **회사/메인 PC (D드라이브)** — `/mnt/d/dev/Pokemon_With`, AR 원본 `/mnt/d/Pokemon Another Red_PWT_250829`.
> (0713 세션5는 **집PC/C드라이브** 기준이었다. 그 세션의 "크롬 흰 화면(WebGL)"은 집PC 크롬 문제 — **이 PC에선 재현 안 됨**, dev 5180 정상.)

## 0. 착수 전 재검증 (일지의 사실 주장은 매번 확인)
- 0713 일지 세션5는 "**커밋 안 됨**"이라 적혀 있었으나 **실제로는 `bb887b4`에 전부 커밋됨**(HouseScene 삭제·pastel/sky 에셋 삭제 반영, 워킹트리 clean). **네 세션 연속 같은 오기록 — 일지의 커밋 여부는 믿지 말고 `git log`/`git status`로 확인할 것.**
- 실제 코드 확인: `BattleScene`은 커맨드 2개(싸운다/도망), 적 1마리 고정, `capture.ts` 없음 → **STEP 3 미착수 확정.**

## 1. 오늘 계획 — STEP 3(배틀 확장)을 3블록으로
| 블록 | 내용 | 상태 |
|---|---|---|
| **블록1** | 커맨드 4개 + 가방(회복약) 연동 = 턴 소비 | ✅ **완료(이 세션)** |
| **블록2** | 파티 교체 + 상대 팀 복수(트레이너 다음 포켓몬) | 다음 |
| **블록3** | 포획(`systems/capture.ts` 3세대 공식, 볼 연출, `markOwn`, 6마리 만석 거절) | 그 다음 |

## 2. ★ 조사 = 배틀 가방을 어떻게 할 것인가 (사용자 질문 → 지어내지 않고 원본 확인)
AR의 `Data/Scripts.rxdata`(루비 406개)를 rubymarshal로 덤프해 직접 읽음 + 본가/pret 디컴파일 대조.

| | 배틀 중 가방 | 아이템 제한 | 턴 |
|---|---|---|---|
| **AR / 에센셜즈** | **필드 가방 씬 그대로 재사용**(`pbItemMenu` → `PokemonBag_Scene.new` + `choosing=true`) | 포켓 구조는 필드와 동일, `battle_use > 0` 아이템만 필터 | 소비 |
| **3세대(FRLG·에메랄드)** | **필드 가방 재사용**(`CB2_BagMenuFromBattle` → 같은 화면) | 제한 없음(배틀용 아니면 "취소"만) | 소비 |
| **HGSS(4세대)** | **배틀 전용 화면** | 포켓이 아니라 용도별 **4카테고리**만 | 소비 + 마지막 쓴 아이템 단축 |

- **HGSS가 전용 화면을 쓴 이유 = DS 하단 터치스크린이 따로 있어서**(Bulbapedia: "a completely different menu **on the touch screen**"). 우리는 PC 단일화면이라 그 전제가 없음.
- **→ 사용자 확정: AR/3세대식 "필드 BagScene 재사용".** (배틀 전용 가방 배경 png는 AR에도 존재하지 않는다.)
- AR 커맨드 배치 = **2×2 (위: 싸운다·가방 / 아래: 포켓몬·도망)**. 우리 `menu()`가 2열이라 배열 순서가 곧 그 배치.

## 3. 바꾼 파일 (2개)
**`src/scenes/BagScene.ts`**
- `mode: "field" | "battle"` + `onResult` 콜백 추가. 배틀에서 열면 **결과(`BagResult{used,text,item}`)를 배틀에 돌려준다.**
- `BATTLE_POCKETS = [2]`(회복약) — 배틀에선 쓸 수 있는 포켓만 노출(볼·일반 안 보임). **볼(3)은 블록3에서 이 배열에 추가.**
- 포켓이 1개면 좌우 화살표를 그리지 않는다(AR 원본도 동일).
- 배틀에서 아이템을 **쓰는 데 성공하면 즉시 가방을 닫고**, 결과 문장은 **배틀 텍스트박스**가 말한다. 효과가 없으면(HP 가득 등) 가방에 머물고 **턴도 안 지나간다**(본가와 동일).
- `closing` 잠금 추가 — `scene.stop()`이 다음 프레임에 처리돼서, Enter를 누르고 있으면 **키 리피트로 confirm이 한 번 더 들어와 아이템이 2개 소비될 수 있었다**(`/code-review`가 잡음).

**`src/scenes/BattleScene.ts`**
- `Command` 타입(`move|item|switch|run`) + 커맨드 4개 메뉴.
- `openBag()` — 배틀을 **pause**하고 BagScene을 launch(안 하면 키 입력이 두 씬에 동시에 먹는다), 결과를 Promise로 받는다.
- 아이템 사용 = **턴 소비**: 내 기술은 못 쓰고 **적만 공격**. 그냥 닫으면 턴 안 지나감.
- "포켓몬" 커맨드는 지금 **"지금은 포켓몬을 교체할 수 없다!" 안내만** 하는 임시 스텁 → **블록2에서 교체로 대체.**

## 4. 검증 (playwright 실주행 — 통과, 콘솔 에러 0)
스크립트: 스크래치패드 `verify-battle-bag.mjs` (리포 밖). 캡처: **`<repo>/.claude/.verify/`** (게임 폴더 아님)
- `battle_cmd4.png` — 커맨드 4개 2×2 배치 확인(싸운다·가방 / 포켓몬·도망친다)
- `battle_bag_open.png` — **배틀 가방 = 버터 크림 필드 가방 그대로**, 회복약 포켓만, 좌우 화살표 없음, 볼 안 보임
- `battle_after_item.png` — 배틀 텍스트박스에 "파이리의 HP가 9 회복됐다!"
- 수치: HP 9 → **18(회복)** → 적 공격 후 14 / 상처약 3 → **2** / **적 HP 15/15**(내가 공격 안 했으니 만피 = 턴 소비 증명)
- `npx tsc --noEmit` 통과(⚠️ **반드시 `myPokemon_AJ/`에서** 실행 — 리포 루트에서 돌리면 엉뚱한 tsc가 잡힌다).

## 5. 함정 / 메모
- **디버그 6번(배틀)으로 바로 들어가면 `create()`가 `await loadArDb()`라 비동기** → playwright는 `scene.getScene("BattleScene").ally`가 생길 때까지 **waitForFunction으로 기다려야** 한다(고정 sleep이면 실패).
- 조우 대사 넘길 때 Enter를 **정해진 횟수만큼 누르면 안 된다** — 커맨드 메뉴("싸운다" 텍스트)가 뜰 때까지 폴링. 아니면 기술 선택으로 새어 들어가 엉뚱한 공격을 한다(1차 검증 때 실제로 걸림).
- 디버그 배틀은 registry에 bag이 없다 → 검증 스크립트가 상처약을 심어준다. 실게임 흐름(IntroScene)은 START_BAG이 들어간다.

## 6. 다음 세션 시작 지점
1. **커밋 대기** — 워킹트리 = `BagScene.ts`·`BattleScene.ts` 2개(tsc 통과, 실주행 통과). **아직 커밋 안 함(승인 대기)** — ⚠️ 이 문장 믿지 말고 `git status`로 확인할 것.
2. **블록2 = 파티 교체 + 상대 팀 복수.** 함정(0713 세션2 §B STEP3 그대로):
   - `HpBox`에 `destroy()`가 없다 → 교체 시 박스 재생성하려면 먼저 추가해야 한다.
   - 스프라이트 텍스처는 `preload()`에서만 로드된다 → 교체하려면 **런타임 `load.image` + `textures.remove()`** 경로 필요(안 하면 "포켓몬 바뀌었는데 그림 그대로").
   - `BattleScene.ally`는 registry 파티 선두와 **같은 참조**라는 전제가 곳곳에 깔려 있다(경험치·회복). 교체하면 이 전제가 깨지므로 `ally`를 "현재 필드에 나온 파티 인덱스"로 바꿔야 한다.
3. `battle.ts`/`exp.ts`/`homeBonus.ts`는 **불가침**.

## 7. 새 지침/skills/memory 요지
- 새 훅·규칙·skill 추가 없음.
- memory `starter-lab-flow` 갱신 필요: **STEP3 블록1 완료 / 다음 = 블록2(교체·상대팀)**.

---

# ▣ 블록 1.5 (같은 세션) — **배틀 화면을 AR 원본 에셋으로 재구축** (사용자 지적 4건)

> 사용자가 실제로 켜보고 지적: ① 배틀에서 가방 누르면 "닫는다"만 ② 전체화면에서 좌우 검정 ③ 가방 화살표 개판 ④ **"배경이랑 퀄리티 장난하니, 소스 안 찾아봤지 / 니가 만들지 말고 배경 소스 써라"**
> → ④가 정당한 지적. 배경·HP박스·커맨드창을 **내가 도형으로 그리고 있었다**. AR에 원본이 다 있는데 안 찾았다.

## A. 원인 (전부 실측으로 확인 — 추측 아님)
1. **배틀 가방이 비어 있던 이유** = 버그 아님. `DebugMenuScene`이 가방 내용물을 **"가방"·"도감" 항목으로 들어갈 때만** 심었다(`:67`). `D→6(배틀)` 직행은 가방이 빈 상태. 실게임(IntroScene)은 START_BAG이 들어간다. → **디버그 배틀에도 심도록 수정함.**
2. **좌우 검정** = UI가 **512×384(4:3) 고정**이라 와이드 화면에서 비율 유지 확대(contain) → 1920×950에서 s=2.47, 폭 1267만 쓰고 653px이 검정. (잘린 건 아님.) 가방·도감·메뉴 전부 같은 구조 → **공통 방침 필요.**
3. **화살표** = `left/right_arrow.png`는 **40×224 = 28px짜리 8프레임 애니 시트**인데 **프레임0만 정지컷으로** 박아놨다. 확대되니 계단현상. (**아직 안 고침** — 다음 세션)
4. **배경·HP박스·커맨드창** = 전부 코드로 그린 도형이었다. AR 원본 존재: `Battlebacks/town_bg·route_bg`(512×288) + `_message`(512×96), `UI/Battle/databox_normal`(260×84)·`databox_normal_foe`(260×62)·`overlay_command`·`cursor_command`·`overlay_fight`·`cursor_fight`·`overlay_message`·`overlay_hp`·`overlay_lv`·`icon_numbers`.

## B. ★ AR 배틀 화면 좌표 (Scripts.rxdata 덤프에서 직접 추출 — 지어내기 없음)
| 요소 | 파일 | 좌표(512×384 기준) |
|---|---|---|
| 배경 | `<bd>_bg` | (0,0) |
| 하단 바 | `<bd>_message` | (0,288) |
| 내 포켓몬(back) | — | **(128,304)** 하단중앙 |
| 상대(front) | — | **(384,176)** 하단중앙 |
| 내 HP박스 | `databox_normal` | (268,192) · 이름(310,204) Lv(442,208) HP바(404,232) HP숫자(382,244) |
| 상대 HP박스 | `databox_normal_foe` | (-16,36) · 이름(8,48) Lv(140,52) HP바(102,76) |
| 커맨드 | `overlay_command` + `cursor_command` | 오버레이(0,288) · 버튼 130×46 → (252,294)(378,294)(252,336)(378,336) |
| 대사창 | `overlay_message` | (0,288), 글자 시작 (32,306) |

- **커맨드 버튼 시트에 "싸운다/가방/포켓몬/도망" 한글이 이미 그려져 있다**(AR 한글판) → 글자를 얹지 않는다. 좌열=기본 / **우열(x=130)=선택**. 행: 싸운다0 · 포켓몬1 · 가방2 · 도망3.
- **HP바**: 96px 시트를 hp 비율로 자르되 **2px 단위**, 색 행(각 6px) = 초록0 / 노랑1(hp ≤ 1/2) / 빨강2(hp ≤ 1/4).
- **스프라이트 확대 = 2배.** AR 원본 프레임이 44~48px로 작고 SpeciesMetrics 보정치가 전부 ×2 → 배틀에선 2배로 그린다(1배로 그렸더니 눈에 띄게 작았다).
- 텍스트 색: 이름 `#484848`/그림자 `#b8b8b8`, 대사 `#505058`/`#a0a0a8`.

## C. 바꾼 파일
- **`src/scenes/battleView.ts` (신규)** — AR 좌표계(512×384) 변환 + `DataBox`(AR HP박스) + `josa()`. **직접 그리는 도형 0개.**
- `src/scenes/BattleScene.ts` — 배경/스프라이트/HP박스/커맨드/대사창을 전부 AR 에셋으로 교체. `HpBox`(직접 그린 남색 박스)·`DialogBox` 사용 제거. `BattleInit`에 `backdrop`("town"|"route")·`fit`("cover"|"contain") 추가.
- `src/scenes/DebugMenuScene.ts` — 배틀에도 가방·소지금·도감 시드(위 A-1).
- 신규 에셋: `public/assets/battlebacks/`(town·route의 bg+message 4장), `public/assets/ui/battle/`(10장). **139장 전부 복사 안 함**(리포 오염 방지).

## C-2. ★ 내가 한 번 더 틀린 것 (사용자 지적 — 반복 금지)
1. **"양 끝 잘리고 튀어나온다"** — 맞다. **AR 레이아웃은 화면이 딱 512px인 걸 전제**로 HP박스를 화면 밖으로 흘려보낸다(상대 x=-16, 내 것은 오른쪽으로 넘침) → **화면 가장자리에서 잘려서 '붙어 있는' 디자인**이다. 그 512짜리 판을 와이드 화면 **한가운데 띄워** 그렸더니 그 흘림이 **허공에서 잘려** 보였다.
   → **수정: UI를 화면 가장자리에 앵커**한다. `BattleView.XL`(화면 왼쪽 기준=상대 박스·대사 글자) / `XR`(오른쪽 기준=내 박스·커맨드 버튼) / `XC`(비율 기준=포켓몬 스프라이트). 하단 바(배틀백 message·overlay)는 **화면 폭 전체**로.
2. **"풀숲에서 나왔는데 도시 배경을 썼다"** — 맞다. **배경은 싸우는 장소가 정한다**(AR도 map_metadata의 `battle_background`). 마을=`town`, 도로·풀숲=`route`.
   → **수정: 디버그 야생 데모 = `route`(풀숲), 월드(태초마을)에서 시작하는 배틀 = `town`.** `BattleScene` 기본값도 `route`.

## D. ★ 미해결 = 사용자 결정 대기 (화면 비율)
**`01_Resources/Pick/13_배틀화면/`** 에 시안 2장 + `_미리보기/배틀화면_시안비교.png`:
- **A안 `cover`** — 배경을 화면 가득(비율 유지, 위아래 살짝 잘림). **검은 여백 없음.** UI는 원본 비율로 가운데.
- **B안 `contain`** — 원본 4:3 그대로, 좌우 검은 여백.
→ 고른 뒤 `fit` 옵션의 진 쪽 분기를 지우고, **같은 방침을 가방·도감·메뉴에도 적용**한다.

## E. 검증
- playwright 1600×900 실주행으로 두 시안 렌더 — **콘솔 에러 0**, `tsc --noEmit` 통과.
- ⚠️ **아직 실플레이 검증 못 한 것**: 기술 선택 → 데미지 → 승리까지의 전체 흐름(새 대사창·HP바 애니로 갈아엎었으므로 **한 판 끝까지 돌려봐야 한다**). 다음 세션 첫 할 일.

## F. 남은 것 / 다음 세션 시작 지점 (우선순위 순)
1. **화면 비율 A/B 결정** — `01_Resources/Pick/13_배틀화면/_미리보기/배틀화면_시안비교.png`를 사용자에게 보여주고 고르게 한다. 고른 뒤 **진 쪽 `fit` 분기를 제거**하고, **같은 방침을 가방·도감·메뉴에도 적용**(지금 이 UI들이 와이드에서 좌우 검은 여백 나는 것과 같은 문제).
2. **배틀 한 판 끝까지 실주행 검증** (기술 선택 → 데미지 → HP바 애니 → 승리 → 경험치 → 월드 복귀 / 패배 → 집). **이번 세션엔 렌더만 확인했다 = 전투 흐름 미검증.** 대사창·HP박스를 통째로 갈아엎었으므로 여기서 깨질 수 있다.
3. **기술 선택 메뉴가 아직 옛날 남색 패널**(직접 그린 도형)이다 — AR `overlay_fight`(512×96) + `cursor_fight`(384×874 = 192×46 버튼, 19행)로 교체.
   - ⚠️ 버튼 행 = **타입의 `icon_position`**인데 우리 `types.json`엔 그 값이 없다(키 20개 vs 시트 19행이라 인덱스로 추정하면 틀린다). → **AR `types.dat`에서 `icon_position`을 추출**해야 정확하다(`tools/ar-data/` 스크립트 패턴 재사용).
   - 기술명 글자색은 AR이 **버튼 그림의 픽셀 (10, row*46+34)를 샘플링**해서 쓴다.
4. **가방 좌우 화살표** = `left/right_arrow.png`가 40×224(28px 8프레임 애니 시트)인데 프레임0 정지컷으로 박혀 있다 → 애니메이션으로.
5. 배틀 기존 대사의 조사 하드코딩(`구구이(가)`, `파이리은(는)`) — `battleView.josa()`가 생겼으니 정리 가능. **단 사용자가 설정한 멘트는 임의 수정 금지 → 조사만 고칠지 물어볼 것.**
6. 그 다음 = **블록2(파티 교체 + 상대 팀 복수)** → **블록3(포획)**. 함정은 위 §7(0713 세션2 §B STEP3) 그대로.

## G. 워킹트리 (`git status`로 실제 확인 — HEAD = `5c04f5d`, **전부 미커밋**)
- `M` `myPokemon_AJ/src/scenes/BagScene.ts` (배틀 모드 + closing 잠금)
- `M` `myPokemon_AJ/src/scenes/BattleScene.ts` (커맨드 4개 + 가방 + AR 화면 재구축)
- `M` `myPokemon_AJ/src/scenes/DebugMenuScene.ts` (배틀에 가방 시드 + 야생 데모 배경 route)
- `M` `myPokemon_AJ/src/scenes/WorldScene.ts` (배틀 시작 시 backdrop 전달)
- `??` `myPokemon_AJ/src/scenes/battleView.ts` (신규 — AR 좌표계·DataBox·josa)
- `??` `myPokemon_AJ/public/assets/battlebacks/` (4장) · `myPokemon_AJ/public/assets/ui/battle/` (10장)
- `??` `01_Resources/Pick/13_배틀화면/` (시안 A/B + 미리보기)
- `??` 이 일지
- **`tsc --noEmit` 통과 · playwright 렌더 검증 콘솔 에러 0.** 커밋은 사용자 승인 대기.

## H. 이번 세션에서 얻은 재사용 지식 (다음에 또 걸린다)
- **AR UI 좌표를 그대로 쓰려면 "화면 = 512×384"라는 전제까지 같이 봐야 한다.** AR은 박스를 화면 밖으로 흘려보내 가장자리에서 잘리게 만든다 → 와이드에선 **화면 가장자리 앵커**(XL/XR)로 옮겨야 원본처럼 보인다. 가운데 4:3 박스에 그대로 그리면 "허공에서 잘림".
- **배경은 맵이 정한다**(AR `map_metadata.battle_background`). 마을=town / 도로·풀숲=route / 체육관=gym.
- **AR 배틀 스프라이트는 2배 확대**해서 그린다(원본 프레임 44~48px, SpeciesMetrics 보정이 전부 ×2).
- **AR 커맨드 버튼(cursor_command)에 한글이 이미 그려져 있다** — 글자를 얹지 말 것. 좌열=기본/우열=선택, 행=싸운다0·포켓몬1·가방2·도망3.
- **새 public 폴더(`battlebacks`·`ui/battle`)를 만들면 dev 서버 재시작 필수** — 안 하면 png가 text/html로 응답(이번에도 그대로 걸릴 뻔했다). 확인: `curl -s -o /dev/null -w "%{content_type}" http://localhost:5180/assets/battlebacks/town_bg.png` → `image/png`.
- **AR 루비 스크립트는 `Data/Scripts.rxdata`에서 rubymarshal로 덤프해 읽을 수 있다** — UI 좌표를 지어내지 말고 여기서 뽑을 것(이번 세션의 좌표표 §B가 그렇게 나온 것).

---

# ▣ 세션 2 — **블록 1.5 남은 것 전부 마무리** (화면비율 확정 · 기술선택 메뉴 AR화 · 가방 화살표 · 배틀 완주 검증)

> 이 PC = **회사/메인 PC (D드라이브)** — `/mnt/d/dev/Pokemon_With`, AR 원본 `/mnt/d/Pokemon Another Red_PWT_250829`.
> 이 세션은 위 "블록 1.5 §F(남은 것)"를 위에서부터 순서대로 처리한 것이다.

## 0. 착수 전 재검증 (또 틀려 있었다 — 일지의 커밋 여부는 절대 믿지 말 것)
- 세션1 §G는 "**전부 미커밋**(HEAD=`5c04f5d`)"이라 적혀 있었으나, **실제로는 `33f58ed`에 전부 커밋돼 있었고 워킹트리는 clean**이었다.
- **다섯 세션 연속 같은 오기록.** → 일지를 읽는 다음 사람은 반드시 `git log --oneline -3` + `git status --short`로 먼저 확인할 것. (이 세션의 §G도 마찬가지로 믿지 말고 직접 볼 것.)

## 1. ★ 사용자 결정 — 화면 비율 = **A안 `cover` 확정**
`01_Resources/Pick/13_배틀화면/_미리보기/배틀화면_시안비교.png`를 보여주고 고르게 함.
- **A안(cover)**: 배경이 화면을 가득 채움(비율 유지, 위아래만 잘림). **검은 여백 없음.** HP박스·커맨드는 화면 좌우 끝에 붙어 AR 원본처럼 보인다.
- → `battleView.ts`에서 **`Fit` 타입과 `contain` 분기를 코드에서 제거**하고 cover 고정. `BattleInit.fit` 옵션도 삭제(시안 비교용 임시 옵션이었음).
- ⚠️ **이 방침을 가방·도감·메뉴에 그대로 적용하는 건 아직 안 했다** — 아래 §F-1 참조(단순 cover를 쓰면 그 UI들은 위아래가 잘려 못 쓴다).

## 2. ★ 사용자 지적 (세션 중 받음 — 반드시 지킬 원칙)
> "**모든 에셋은 그에 맞는 환경에서 쓰여야 한다. 배틀도 NPC나 장소 같은 거에 따라 구현해야 할 게 다 다르다. 그냥 막 넣으면 안 된다.**"

- 지금 **트레이너전이 야생전 레이아웃을 그대로 재사용**하고 있다(트레이너 등장 연출·남은 포켓몬 볼 표시가 없음). AR 원본엔 `UI/Battle/overlay_lineup`·`icon_ball`·`icon_ball_faint` 등 **트레이너전 전용 요소가 따로 있다.**
- 배경도 지금은 호출부(`WorldScene`)가 `backdrop: "town"|"route"`를 직접 넘기는데, **AR은 맵 메타데이터(`map_metadata.battle_background`)가 정한다.** 이쪽으로 옮기는 게 맞다.
- → **다음 세션 최우선 후보.** 아무 에셋이나 끼워넣지 말고 `Scripts.rxdata`에서 트레이너전 흐름을 읽고 구현할 것.

## 3. ★ 기술 선택 메뉴를 AR 원본으로 교체 (직접 그린 남색 패널 제거)
지어낸 값 0개 — 전부 `Data/Scripts.rxdata`의 `Battle_Scene_Menus`(class `Battle::Scene::FightMenu`)에서 뽑았다.

**AR FightMenu 좌표 (512×384 기준, 메뉴 원점 = (0,288))**
| 요소 | 값 |
|---|---|
| 배경 | `overlay_fight`(512×96) → (0,288). ★**커맨드창과 반대로 왼쪽이 어두운 버튼칸 / 오른쪽이 흰 정보칸** |
| 버튼 시트 | `cursor_fight`(384×874) = **192×46 버튼 × 19행** |
| 버튼 위치 | (4,294) (192,294) (4,336) (192,336) — `button.x = 4 (+188 if 홀수)`, `button.y = 294 (+42 if i≥2)` |
| 버튼 행 | **그 기술 타입의 `icon_position`** |
| 버튼 열 | 좌열(x=0)=기본(흰 바탕+타입색 테두리) / **우열(x=192)=선택(타입색 채움)** |
| 기술명 | 버튼 중앙 정렬, (button.x+96, button.y+14) |
| 타입 아이콘 | `Graphics/UI/types.png`(64×560 = 28px×20행) → (416,308), 행 = `icon_position` |
| PP | (448,344) 중앙정렬. 색 = `PP_COLORS`, 단계 = `min(ceil(4*pp/maxPp), 3)` → 0:빨강 1:주황(1/4↓) 2:노랑(1/2↓) 3:기본색 |

**★ 이번에 새로 안 것 (다음에 또 필요)**
1. **버튼 행은 `icon_position`이지 타입 키 순서가 아니다.** 타입 키는 **20개**인데 버튼 시트는 **19행** — 순서로 추정했으면 전부 틀렸다.
   → `tools/ar-data/extract-battle-data.py`의 `extract_types()`에 **`iconPosition` 추출을 추가**하고 `types.json`을 재생성했다(`src/data/ar/index.ts`의 `TypeData`에도 필드 추가). 재실행해도 species/moves는 diff 없음 — types.json만 바뀐다.
2. **스텔라(STELLAR) = `icon_position` 19인데 `cursor_fight`엔 19행이 없다**(0~18). 그대로 자르면 시트 바깥을 잘라 **버튼이 통째로 안 보인다.** → `battleView.fightRow()`로 19 이상은 노말(0)로 떨군다. (타입 아이콘 시트는 20행이라 그건 원래 값 그대로 써도 된다.) 지금 moves.json에 STELLAR 기술은 0개라 잠복 버그였다 — `/code-review`가 잡음.
3. **기술명 글자색 = 버튼 그림의 타입 테두리색을 픽셀에서 직접 샘플링한다**(AR도 그렇게 한다 — `GET_MOVE_TEXT_COLOR_FROM_MOVE_BUTTON`). 색표를 지어내지 말 것.
   ⚠️ 단 **AR이 지정한 좌표 `(10, row*46+34)`는 이 그림에선 투명**이다(버튼 왼쪽 모서리가 사선이라 빗나감 — AR 주석도 "그래픽을 바꾸면 이 줄을 고치라"고 적혀 있다). **같은 테두리가 지나가는 `(12, row*46+23)`**(버튼 세로중앙)에서 뽑으면 같은 색이 나온다. 확인값: 노말0=(96,80,112) / 불꽃10=(152,32,40) / 풀12=(48,120,16) / 페어리18=(224,112,200).
   `textures.getPixel()`은 호출마다 시트(384×874) 전체를 캔버스에 다시 그리므로 **행별로 캐시**한다.

## 4. ★ 가방 좌우 화살표 = 애니메이션 (정지컷 아니었다)
- `left/right_arrow.png` = **40×224**. AR `UI_Bag`: `AnimatedSprite.new("Graphics/UI/left_arrow", 8, 40, 28, 2, viewport)` → **40×28 프레임 8장이 세로로 쌓인 시트**, `frameskip 2`.
- **`frameskip`은 1/20초 단위**(`@time_per_frame = frameskip / 20.0`) → **100ms/프레임 = 10fps 무한반복.**
- ⚠️ **함정:** AR의 `PngAnimatedBitmap`은 **파일명이 `[8]` 같은 대괄호로 시작할 때만** 프레임을 쪼갠다. `left_arrow.png`는 그냥 이름이라 AnimatedBitmap으로는 안 쪼개지고, **`AnimatedSprite`가 프레임 크기를 직접 받아** 쪼갠다. 파일명만 보고 "애니 아님"이라 판단하면 틀린다.
- ⚠️ **함정 2 (`/code-review`가 잡음):** `BagScene.render()`가 **키 입력마다 `layer`를 통째로 destroy/재생성**한다 → 화살표 스프라이트도 같이 죽어 **애니가 매번 0프레임부터 다시 시작**한다(= 키를 누르고 있으면 첫 프레임에 얼어붙음). → 화살표 스프라이트는 **필드(`this.arrows`)에 들고 재사용**하고, render에서 `layer.remove()`로 **꺼낸 뒤** destroy한다. 그리는 순서(배경 다음, 목록 앞)는 `layer.add()`로 그대로 유지.
- ⚠️ **함정 3:** Phaser는 **씬 인스턴스를 재사용**한다 → `init()`에서 `this.arrows = []`로 비우지 않으면 다음에 가방을 열 때 **이미 파괴된 스프라이트를 다시 쓰려 한다.**

## 5. 바꾼 파일
| 파일 | 내용 |
|---|---|
| `src/scenes/battleView.ts` | `Fit`·contain 분기 제거(cover 고정) · `FIGHT_SLOTS`/`FIGHT_BTN_*`/`TYPE_ICON_*`/`PP_COLORS`/`ppStage()`/`fightRow()`/`moveNameColor()`(행별 캐시) 추가 |
| `src/scenes/BattleScene.ts` | `fit` 옵션 제거 · **`selectMove()`를 AR `overlay_fight`+`cursor_fight`로 재작성** · 직접 그리던 `menu()`(남색 패널)와 CREAM/NAVY/BLUE/GOLD 상수 **삭제** · `bt_overlay_fight`/`bt_cursor_fight`/`bt_types` preload |
| `src/scenes/BagScene.ts` | 화살표를 `load.spritesheet`(40×28×8) + 10fps 애니로 · 스프라이트 재사용(`this.arrows`) |
| `src/data/ar/index.ts` | `TypeData.iconPosition` 필드 추가 |
| `tools/ar-data/extract-battle-data.py` | `extract_types()`에 `iconPosition` 추출 추가 |
| `public/assets/data/ar/types.json` | 재생성(=`iconPosition` 추가. species/moves는 diff 없음) |
| `public/assets/ui/types.png` | **신규** (타입 아이콘 시트 64×560) |

- ⚠️ `cursor_fight.png`·`overlay_fight.png`는 **세션1에서 이미 `public/assets/ui/battle/`에 복사·커밋돼 있었다**(그때 10장 통째로 복사). 이번에 새로 추가된 에셋은 `types.png` 한 장뿐.

## 6. 검증 (playwright 실주행 — 전부 통과, 콘솔 에러 0)
스크립트는 스크래치패드(리포 밖), 캡처는 **`<repo>/.claude/.verify/`**.
- **배틀 승리 경로**: 할퀴기 → 급소 → "상대 구구을(를) 쓰러뜨렸다!" → "21 경험치를 얻었다!" → **WorldScene 복귀**. (`w1_command` `w2_fight_move1` `w3_fight_move2` `w4_attack` `w5_win` `w6_after_battle`)
- **배틀 패배 경로**: 울음소리(변화기)만 쓰게 하면 진다 → "쓰러졌다..." → "눈앞이 깜깜해졌다..." → **집(InteriorScene) 복귀**. (`f1~f6`)
- **기술 메뉴 동작**: 커서 이동 시 PP가 `40/40`(울음소리) → `35/35`(할퀴기)로 갱신, 타입 아이콘·버튼색도 그 타입으로 바뀜.
- **가방 화살표**: 프레임이 실제로 흐름(3→4→5→6→7…), **커서를 계속 눌러 리렌더되는 중에도** 8→2→5→7→2→4로 계속 돎. 원본 시트와 나란히 놓은 몽타주 = `.claude/.verify/가방화살표_원본비교.png`.
- `npx tsc --noEmit` 통과 (⚠️ **반드시 `myPokemon_AJ/`에서** — 리포 루트에서 돌리면 "This is not the tsc command you are looking for"가 뜬다. 이번에도 걸렸다).
- `/code-review`(medium) 5건 → 실제 버그 2건(스텔라 행 오버플로 · 화살표 애니 리셋) + 효율/구조 3건 수정. 남긴 것 1건: `ally.moves`가 0개면 `selectMove()`가 죽는다 — `createFromSpecies`가 항상 기술을 1개 이상 주므로 도달 불가 + 기존 `menu()` 경로에도 있던 구멍이라 손대지 않음.

## 7. 함정 / 메모 (이번에 실제로 걸린 것)
- **dev 서버가 새 에셋을 text/html로 응답** → 5180에 **예전 vite 프로세스가 살아 있었다**(새 파일 복사 전에 뜬 것). `npm run dev`는 "Port 5180 is already in use"로 죽는데 curl은 200이라 헷갈린다. → `ss -ltnp | grep 5180`으로 PID 찾아 kill 후 재기동. 확인: `curl -s -o /dev/null -w "%{content_type}" http://localhost:5180/assets/ui/types.png` → `image/png`.
- **이 PC의 playwright는 node 쪽에만 있다**(python `playwright` 모듈 없음). 스크립트를 스크래치패드에 두면 `import { chromium } from "playwright"`가 안 먹는다 → **절대경로 import**: `from "/mnt/d/dev/Pokemon_With/myPokemon_AJ/node_modules/playwright/index.mjs"`.
- **키를 고정 sleep 뒤에 누르면 허공에 먹힌다.** 타이틀→D→6 진입은 **각 씬이 active인지 `waitForFunction`으로 확인하고** 눌러야 한다. (`page.waitForFunction(fn, arg, options)` — 2번째 인자가 arg다. `{timeout}`을 2번째에 주면 무시되고 기본 30초가 된다.)
- **디버그 메뉴에서 가방으로 바로 가려면 "가방" 바로가기 텍스트를 클릭**한다(숫자키 아님). 그 경로가 가방 내용물·소지금·도감까지 시드해 준다. Phaser에서 `Text` 객체의 `getBounds().centerX/Y`를 읽어 `mouse.click`.

## 8. 워킹트리 (`git log`+`git status`로 실제 확인 — HEAD = `33f58ed`, 아래는 **미커밋**)
```
 M myPokemon_AJ/public/assets/data/ar/types.json
 M myPokemon_AJ/src/data/ar/index.ts
 M myPokemon_AJ/src/scenes/BagScene.ts
 M myPokemon_AJ/src/scenes/BattleScene.ts
 M myPokemon_AJ/src/scenes/battleView.ts
 M myPokemon_AJ/tools/ar-data/extract-battle-data.py
?? myPokemon_AJ/public/assets/ui/types.png
```
- **tsc 통과 · 배틀 승/패 실주행 통과 · 콘솔 에러 0 · /code-review 반영 완료. 커밋은 사용자 승인 대기.**
- ⚠️ **이 문장 믿지 말고 `git status`로 직접 확인할 것**(§0 참조 — 다섯 세션 연속 틀렸다).

## 9. 다음 세션 시작 지점 (우선순위 순)
1. **트레이너전을 야생전과 분리** (§2 사용자 지적). AR `Scripts.rxdata`에서 트레이너전 흐름(트레이너 스프라이트 등장 → 볼 던지기 → `overlay_lineup`/`icon_ball`로 남은 포켓몬 표시)을 읽고 구현. **배경도 맵 메타데이터가 정하도록** 옮긴다. → 이건 **블록2(상대 팀 복수)와 맞물리므로 같이 하는 게 낫다.**
2. **블록2 = 파티 교체 + 상대 팀 복수.** 함정(0713 세션2 §B STEP3 그대로, 여전히 유효):
   - 스프라이트 텍스처는 `preload()`에서만 로드된다 → 교체하려면 **런타임 `load.image` + `textures.remove()`** 경로 필요(안 하면 "포켓몬 바뀌었는데 그림 그대로").
   - `BattleScene.ally`가 registry 파티 선두와 **같은 참조**라는 전제가 경험치·회복 코드에 깔려 있다 → 교체하면 `ally`를 "현재 필드에 나온 파티 인덱스"로 바꿔야 한다.
   - (`HpBox`는 이제 없다 — `DataBox`에 `destroy()`/`setMon()`이 이미 있으니 그건 해결됨.)
3. **블록3 = 포획**(`systems/capture.ts` 3세대 공식, 볼 연출, `markOwn`, 6마리 만석 거절). `BagScene.BATTLE_POCKETS`에 볼 포켓(3) 추가.
4. **가방·도감·메뉴 와이드 대응** — 지금도 512×384 contain이라 좌우 검은 여백이 크다. ⚠️ **배틀처럼 단순 cover를 쓰면 안 된다**(1920×950에서 배율 3.75 → 세로 1440이라 UI가 33% 잘려나간다). 배틀처럼 **"배경만 채우고 UI는 가장자리 앵커"** 방식을 각 화면 레이아웃을 보고 따로 설계해야 한다.
5. **조사 하드코딩 정리** (`파이리은(는)`, `구구을(를)`) — `battleView.josa()`가 있으니 가능. **사용자 확인 대기** (설정한 멘트 임의 수정 금지 규칙 때문에 "조사만 고칠지" 물어봤고 아직 답 못 받음).

## 10. 새 지침/skills/memory 요지
- 새 훅·규칙·skill 추가 **없음**.
- **AGENTS.md에 올릴 만한 원칙(사용자 지적)**: "에셋은 그 환경에 맞게 — 배틀도 NPC/장소마다 구현이 다르다. 막 넣지 말 것." (§2)
- memory `starter-lab-flow` 갱신 필요: **블록1.5 완료(화면비율 cover 확정·기술메뉴 AR화·가방 화살표·배틀 완주 검증) / 다음 = 트레이너전 분리 + 블록2**.
