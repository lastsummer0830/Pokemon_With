# 0722 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC 포함)이 **이 문서만 보고** 이어가게 쓴다.
> 이 세션 = 0721에서 미결로 남긴 **건물 크기(카메라 프레이밍)** 결정 → 적용, 그리고 사용자 지적으로 발견한
> **AR 맵 오토타일 렌더 버그** 수정.

---

## 1. 카메라 프레이밍 확정 — "건물이 작아 보인다" 최종 해결

### 원인 (0721에 확정된 것 재확인)
- 원본 Another Red = 내부해상도 512×384 / 타일 32px → **창 크기와 무관하게 항상 16×12칸**.
- 우리 = `WorldScene.ts`의 `SCALE=2`(타일 64px 고정) + 캔버스가 창 전체(`main.ts` `Phaser.Scale.RESIZE`)
  → 창이 클수록 보이는 칸이 늘어남(1280창 20칸 / 1920창 30칸) = 같은 건물이 원본의 0.8배·0.53배.
- 즉 **개별 건물 스케일이 아니라 카메라 프레이밍 문제.**

### 사용자 결정 = **B안(세로맞춤)**
16:9 창에서는 가로·세로를 동시에 16×12로 맞출 수 없어 둘 중 하나를 골랐다.
- A) 가로맞춤 16×9칸 — 가로가 원본과 같음, 건물 최대. 세로 9칸이라 답답.
- **B) 세로맞춤 21.3×12칸 ← 채택.** 세로 칸수가 원본과 정확히 같고, 같은 화면높이에서 원본과 타일
  픽셀크기도 동일(1080 → 타일 90px). 원본이라면 좌우에 검은 여백이 생길 자리를 맵으로 채운다.
  사용자 평: "어나더레드 B 저게 훨씬 괜찮은데".

### 구현 (`src/scenes/WorldScene.ts`)
- `const SCALE=2` → `let SCALE` + `fitScale(w,h) = clamp(min(w/(16*32), h/(12*32)), 1, 8)`.
  `create()` 맨 앞에서 창 크기로 계산하고 `this.tile = 32*SCALE`을 다시 잡는다.
  ⚠️ `this.tile`의 필드 초기화는 씬 생성 때 한 번뿐 + Phaser는 재시작해도 같은 인스턴스 → create에서 매번 재계산 필수.
- 창 리사이즈 대응 `reframe()` 추가: 월드 좌표는 전부 tile의 배수라 **비율만 곱하면** 된다.
  `children.list`에서 `scrollFactorX===0`(HUD·대사창)은 건너뛰고 나머지만 x/y·scale 갱신 + 카메라 bounds 재설정.
- 🚫 **카메라 zoom으로 하면 안 된다** — `setScrollFactor(0)`인 UI(DialogBox·HUD)까지 같이 확대되고 화면 밖으로 나간다.
  그래서 zoom은 1로 두고 **월드 스케일 자체**를 바꾸는 방식을 택했다. (`InteriorScene`은 원래부터 적응형 zoom 방식.)

### 후보 제시 위치 (⚠️ 이번에 규칙 위반해서 혼남)
- 고르라고 내미는 것은 **반드시 `01_Resources/Pick/<카테고리>/`** (AGENTS §3). `.claude/.verify`는 내 검증용 폴더다.
- 처음에 `.verify`에 넣고 고르라 해서 사용자가 분노 → `01_Resources/Pick/14_카메라프레이밍/`으로 이동(README + `_미리보기/AB_비교몽타주.png`).
- 감사 결과 다른 후보들(가방·도감 4안, 메뉴 시안, 배틀화면 A/B, 인트로 후보)은 Pick에 정상 배치돼 있었다. 이번 건만 예외.

---

## 2. 🔴 AR 맵 **오토타일(물) 렌더 버그** — 원본과 달랐던 진짜 부분

사용자가 "타일셋·크기·도로 그런 것도 네 맘대로 넣은 거 아니냐"고 물어 **말 대신 픽셀로 대조**했다(ar-compare 절차).

### 대조 방법 (재현 가능)
1. AR `.rxdata`에서 **오토타일 48변형을 원본 규격대로 조립**하는 정답 렌더러를 따로 짜서 정답 PNG 생성.
2. 우리 파일(ground+over 합성)과 `node tools/imgdiff.mjs`로 diff.

### 결과
| 대상 | 원본과 차이 | 판정 |
|---|---|---|
| 맵 크기(태초 52×20, 상록 52×40, 1번도로 52×40) | — | AR `@width/@height` 그대로 ✅ |
| 타일셋(KANTO50S_OUT) | — | AR PNG에서 32px 그대로 크롭, 직접 그린 것 없음 ✅ |
| `red_room_2f.png`(내 방) / `rival_house_1f.png` / `red_living_154.png` | **0%** | 픽셀 완전 일치 ✅ |
| `red_living_1f_stairs.png`(실제 로드되는 거실) | 47% | **의도된 손수정**(계단 구워넣음, InteriorScene.ts:586 주석) |
| `pallet_town.png` / `viridian_city.png` | **0.77% / 1.14%** | ❌ **틀렸었음** |

### 버그의 정체
RPG Maker XP는 타일ID 1~383을 오토타일로 쓴다: `id//48` = 오토타일 번호, **`id%48` = 모양 변형 48종**
(한가운데 / 왼쪽 물가 / 안쪽 모서리 …). 오토타일 원본 PNG(96×128)를 16px 조각 6×8=48개로 나눠
변형마다 정해진 네 조각(좌상·우상·좌하·우하)을 붙여 32×32 한 칸을 만든다.
→ **우리 추출기는 이 변형을 통째로 무시하고 "채움 타일" 한 종류만 찍고 있었다.**
결과: 태초마을 남쪽 연못 12칸, 상록시티 연못 30칸이 **파란 물 대신 갈색 격자 덩어리**로 나와 있었다.
(맵 대부분은 일반 타일셋 타일이라 영향 없음 — 그래서 diff가 1% 안팎이었고 눈에만 걸렸다.)

### 수정
- `tools/ar-map/extract-map.py`(월드맵 추출기) — `AUTOTILE_PARTS`(XP 표준 48변형 조립표) + `build_autotile()` 추가,
  `tile()`이 `tid%48`을 써서 네 조각으로 조립하게 변경.
- 맵 3장 재추출(`--map 55/56/10`) → **원본과 diffPct 0%**. 충돌·풀숲 JSON은 **바이트 단위로 동일**(게임 로직 무영향).
- `tools/ar-map/extract.py`(집 추출기) — 같은 버그가 있어 함께 수정. **표를 복사하지 않고** `importlib`로
  extract-map.py의 `build_autotile`을 빌려 쓴다(조립표 단일 원본 유지. 파일명 하이픈 때문에 일반 import 불가).
  ⚠️ **이 스크립트는 실행하지 않았다** — 실행해야만 PNG가 바뀐다. 지금 집 3장은 이미 원본과 0% 일치.

---

## 검증
- `tsc --noEmit` EXIT=0.
- headless playwright 실주행: 태초마을 연못 자리(로컬 20,15 스폰)에서 **모래 물가까지 원본대로 나오는 것 확인**, **콘솔에러 0**.
- 카메라: 1280·1920 두 뷰포트 모두 **21.3×12칸**으로 동일(창 크기 무관), 카메라 zoom=1 유지 → UI 영향 없음.
- 픽셀 대조: pallet/viridian 재추출본 vs 원본 정답 렌더 = **diffPct 0**.

## ⏳ 남은 것 (다음 세션)
1. **Phase C 기술 애니 엔진** (이번 세션에서 착수 못 함, 사용자가 다음 작업으로 지정).
   `rxrender.py` 확장(RPG::Table) → `PkmnAnimations.rxdata`+`move2anim.dat` → 애니 JSON → `Graphics/Animations/*.png`(705시트)
   → Phaser 재생기(셀 좌표는 target/user 상대) → `performMove`/`doTurn` 연결. **수 세션짜리 큰 작업.**
2. **라이벌집 마감** — NPC 없음(빈 집), DebugMenu 진입 항목 없음, 현관 매트가 바닥 아래 검은 영역에 걸침.
3. **잔여 소소한 것** — Summary 4번째 빈 기술칸 우하단만 빨강, 도감번호 `———`(디버그 파티 데이터 문제).
4. **exe 미반영** — 이번 검증도 전부 dev서버(5180). `npm run app:bake` 필요.
5. **HUD 상대크기** — 타일이 커져서(1080창 90px) 좌상단 HUD 글자가 상대적으로 작아 보인다. 필요하면 조정.

## 함정 (이번에 걸린 것)
1. **고르라고 내미는 파일은 `01_Resources/Pick/<카테고리>/`.** `.claude/.verify`는 내 검증용. 헷갈리면 사용자가 분노한다.
2. **"원본과 같냐"는 말로 답하지 말고 `imgdiff.mjs`로 수치를 낸다.** 이번에 0.77%가 실제 버그였다.
3. **`tools/*.mjs`는 `tools/` 안에서 실행**해야 `./_snap.mjs` import가 된다(스크래치패드에 두고 절대경로 import하면 ERR_MODULE_NOT_FOUND).
4. **캡처는 headless로.** `chromium.launch({headless:true})` + `_snap.mjs`(renderer.snapshot)로 정상 캡처된다 —
   0721에 "headless 될지 미검증"이라 적었는데 **이번에 검증됨.** `shot-worldscale.mjs`도 headless로 고쳐뒀다(`SHOT_OUT` 환경변수로 출력경로 지정).
5. `pkill -f vite` 하면 그 Bash 호출 자체가 죽을 수 있다(exit 144) — 서버 재시작은 별도 호출로 나눌 것.

## 다음 세션 첫 프롬프트 제안
"0722 일지 읽고 이어서. 카메라 프레이밍(B안)·오토타일 물 버그는 끝났다. **Phase C 기술 애니 엔진** 착수 —
`rxrender.py`의 RPG::Table 확장부터. 캡처는 headless, 서브에이전트 병렬 금지, 창 띄우기 전엔 먼저 물어볼 것."

---
---

# 0722 (2부) — Phase C 기술 애니메이션 엔진 착수·1차 완성

> 같은 날 두 번째 세션. 위 1부(카메라 프레이밍 B안 · 오토타일 물 버그)는 커밋 `d91415e`로 끝났고,
> 이 세션은 "남은 것 1번"인 **Phase C 기술 애니 엔진**을 실제로 굴러가는 데까지 만들었다.

## 0. ⚠️ 계획이 틀렸던 부분 (다음 세션이 헷갈리지 않게 먼저 적는다)
1부 일지·다음세션 프롬프트에 적었던 **"`rxrender.py`의 RPG::Table 처리 확장부터"는 잘못된 전제였다.**
- `PkmnAnimations.rxdata`는 **RPG::Table이 아니다.** 포켓몬 에센셜즈의 `class PBAnimation < Array`
  (그냥 숫자 배열의 배열)이고, RPG::Table은 맵 데이터에만 쓰인다. `rxrender.py`는 손댈 필요가 없었다.
- **진짜 막힌 지점은 따로 있었다:** rubymarshal이 Ruby marshal의 **`C` 토큰(UserClass = Array를 상속한 클래스)**
  을 몰라 파일이 아예 안 열린다(`ValueError: token b'C' is not recognized`).
  → `Reader`를 상속해 `C <클래스심볼> <실제객체>`만 직접 처리하는 리더를 새로 만들었다.
  (링크(`@`) 참조가 껍데기를 가리키도록 `self.objects[idx]`를 갈아끼우는 게 핵심.)

## 1. 포맷은 짐작하지 않고 AR 루비 소스에서 읽었다 (재현 방법)
`Data/Scripts.rxdata` = [마법수, 이름, zlib압축된 루비소스] 배열 → 풀어서 406개 .rb로 뽑아 직접 읽었다.
확인한 정본(전부 여기서 나온 값이다):
- `class AnimFrame` (228_BattleAnimationPlayer.rb) — 셀 27칸의 의미
  `0 X · 1 Y · 2 ZOOMX · 3 ANGLE · 4 MIRROR · 5 BLENDTYPE · 6 VISIBLE · 7 PATTERN · 8 OPACITY ·
   11 ZOOMY · 12~15 COLOR(RGBA) · 16~19 TONE · 20 LOCKED · 21~24 FLASH(에디터전용) · 25 PRIORITY · 26 FOCUS`
   (9·10번은 원본도 안 쓰는 빈칸)
- `pbSpriteSetAnimFrame` — 시트 한 칸 **192×192, 가로 5칸 고정**(`pattern%5`, `pattern/5`).
  **폭이 960이 아닌 시트도 있는데 원본은 폭과 무관하게 5칸으로 계산**한다 → Phaser `load.spritesheet`
  자동 슬라이스를 쓰면 칸 번호가 어긋난다. 그래서 프레임을 직접 등록한다(`ensurePatternFrame`).
- `PBAnimationPlayerX#update` — **20fps 고정**(`(경과초 * 20)`), 셀 **0번 = 사용자 스프라이트 / 1번 = 상대 스프라이트**
  (그래서 기술 애니가 포켓몬 본체를 움직인다), pattern **-1 = 사용자 그림 / -2 = 상대 그림**.
- `focus`(26번): 1=상대기준 2=사용자기준 3=둘을 잇는 선 기준(아핀 변환) 4=화면 절대좌표.
  화면 기준점 `Battle::Scene::FOCUSUSER=(128,224)` / `FOCUSTARGET=(384,96)` (AR 내부해상도 512×384).
- `class PBAnimTiming` — 0=SE재생 1=배경설정 2=배경변화 3=전경설정 4=전경변화.
- `pbFindMoveAnimDetails` — **상대가 쓸 때는 `move2anim[1]`(OppMove)을 먼저 보고, 없으면 `[0]`**.
  OppMove를 쓸 때는 원본이 사용자/상대 인자를 **바꿔서** 재생한다(그 애니는 플레이어 자리 기준으로 그려져 있다).
- `pbFindMoveAnimation`의 `typeDefaultAnim` — 애니 없는 기술의 타입별 대타표(최후 폴백 = TACKLE). 그대로 옮겼다.

## 2. 만든 것
### (1) 추출기 `myPokemon_AJ/tools/ar-anim/extract-animations.py` (신규)
```
python3 tools/ar-anim/extract-animations.py            # JSON만
python3 tools/ar-anim/extract-animations.py --sheets    # + 시트 PNG 복사
python3 tools/ar-anim/extract-animations.py --se        # + 효과음(ffmpeg로 ogg 변환)
```
- 출력: `public/assets/data/ar/anim/index.json`(기술→애니번호·상수·대타표) + `<번호>.json`(애니 1개당 1파일).
  **애니마다 파일을 나눈 이유** = 전부 합치면 11MB라 통짜로 받으면 배틀 시작이 늦다. 지금은 쓸 때만 fetch(1개 ~9KB).
- 셀은 27칸 → 쓸 20칸만 남기고 뒤쪽 0은 잘라 저장(`CELL_ORDER`).
- **실제 뽑힌 것: 애니 1261개 · 기술 매핑 859개 · Common 81개 · 시트 568장(11.7MB) ·
  효과음 1253개(원본 wav 38MB → ogg 11.6MB, ffmpeg `-c:a libvorbis -q:a 2`).**
- 원본에 아예 없는 파일: 시트 4개 · 효과음 6개(그 애니만 그림/소리 생략).
- ⚠️ **리포가 약 36MB 늘었다**(public/assets/animations · audio/anim · data/ar/anim).

### (2) 재생기 `myPokemon_AJ/src/game/battleAnim.ts` (신규)
- `playMoveAnimation(scene, view, {user,target}, moveId, byAlly, moveInfo?)` — 끝날 때까지 await.
- 좌표: 우리 화면은 512보다 넓다(가로 21.3칸) → focus 1·2는 **실제 스프라이트 중심**에 붙이고,
  focus 3은 원본과 같은 아핀 변환, focus 4(화면)는 **화면 중앙 기준 + 원본 픽셀 간격(view.s배)**.
- 포켓몬 본체는 애니 동안 원점을 (0.5,0.5)로 바꿔 다루고(원본이 중심 기준), 끝나면 **스냅샷으로 완전 복구**.
- 셀 0·1번에 시트 그림이 오는 애니는 본체 텍스처를 바꾸지 않고 그 프레임만 숨긴다(안전한 근사).
- 깊이: 원본 z(10/20/80)를 우리 배틀 깊이로 옮김(파티클 100 = 포켓몬 위·HP박스 150 아래).
- `registry.animFps` = **검증용 느린 재생 스위치**(비어 있으면 원본 20fps). 캡처 도구가 쓴다.

### (3) 배틀 연결 `myPokemon_AJ/src/scenes/BattleScene.ts`
- `doTurn`에서 "OO의 기술!" 대사 뒤, 빗나감이 아닐 때 `playMoveAnim(slot.id, isAlly)` → 그 다음 데미지 연출.
- `create`에서 `loadAnimIndex()` 미리 호출(첫 기술에서 멈칫하지 않게).

### (4) 검증 도구 (신규)
- `tools/shot-moveanim.mjs [출력폴더] [기술id...]` — 애니를 한 프레임씩 캡처. `foe:TACKLE`처럼 쓰면 상대쪽.
  ⚠️ 메뉴를 키로 더듬으면 타이밍이 어긋난다 → **dev서버 ESM(`import("/src/game/battleAnim.ts")`)으로 재생기를 직접 호출**한다.
- `tools/dbg-anim.mjs` — 실제 배틀 흐름에서 `playMoveAnim` 호출 여부·셀 스프라이트 수를 숫자로 확인.

## 3. 검증 (전부 headless)
- 프레임 캡처로 눈 확인: **EMBER**(불덩이가 커지며 날아가 명중) · **THUNDERSHOCK**(번개가 내리꽂힘) ·
  **SCRATCH** · **상대가 쓰는 TACKLE**(구구가 돌진 → 파이리에 충돌 별). 좌우가 원본 규칙대로 뒤집힌다.
- 애니 후 포켓몬 복구 정확: 위치Δ(0,0)·크기Δ0·원점 (0.5,1) 원상복구.
- 실제 배틀: `playMoveAnim`이 내쪽(GROWL)·상대쪽(TACKLE) 모두 호출·완료, 동시 셀 스프라이트 최대 3(누수 없음).
- `tsc --noEmit` 0 · `npm run build` 성공 · **콘솔에러 0**.
- 효과음은 캐시 적재·디코드까지 확인. **실제 소리는 못 들어봤다(headless).**

## 4. 남은 것 (다음 세션)
1. **애니 도중 대사창이 사라진다** — 하단이 빈 바로 보인다(원본은 창 유지). 기존 `say()`가 키 입력에 창을 destroy하는 구조.
2. **타이밍 2·4번(배경 서서히 변화) 미구현** — 즉시 설정(1·3)만 반영.
3. **근사한 부분:** 색 보정=틴트 근사 / 감산 블렌드→곱셈 / 시트 hue 회전 무시.
4. **Common 애니 미연결** — `playCommonAnimation`은 만들어 뒀지만 HP회복·명중 연출에 아직 안 붙임.
5. 1부에서 남은 것 그대로: 라이벌집 마감 · Summary 빈 기술칸 · 도감번호 `———` · **exe 미반영(`npm run app:bake`)**.

## 5. 함정 (이번에 걸린 것)
1. **`public/`에 새 파일을 넣으면 dev서버를 재시작해야 한다.** 안 하면 그 URL이 `text/html`(index.html)로 200을 준다.
   확인: `curl -s -o /dev/null -w '%{content_type}' http://localhost:5180/assets/data/ar/anim/index.json` → `application/json`.
2. **`snap()`(renderer.snapshot) 한 장에 0.5초 넘게 걸린다.** 20fps 애니를 캡처하려면
   ① `registry.animFps`로 늦추고 ② 캡처 사이에 대기를 넣지 말 것. 처음에 이걸 몰라 "애니가 안 나온다"고 착각했다.
3. **메뉴를 스페이스 연타로 더듬지 말 것** — 대사 개수가 상황마다 달라 엉뚱한 기술이 나간다(실제로 EMBER 대신 GROWL이 나갔다).
   검증은 재생기를 직접 호출하는 쪽이 확실하다.
4. AR 애니 시트는 **폭이 제각각인데 칸 번호는 항상 5열 기준**이다(위 1번 참조).

---
---

# 0722 (3부) — 애니 마감 3종 + exe 반영

> 같은 날 세 번째 세션. 2부(Phase C 기술 애니 엔진 1차 완성, 커밋 `35a3912`)가 남긴 "4. 남은 것" 중
> 1·2·4번을 처리했다. 전부 dev(5180) headless 검증 + `npm run app:bake`로 exe까지 반영.

## 1. 한 것

### ① 애니 도중 대사창이 사라지던 것 — 고침 (`src/scenes/BattleScene.ts`)
- **원인:** `say()`가 호출될 때마다 대사창 컨테이너를 새로 만들고, 키를 누르면 `layer.destroy()` 했다.
  → 대사가 끝나고 기술 애니가 도는 동안 하단이 텅 빈 바로 보였다(원본은 창이 계속 떠 있다).
- **고친 구조:** 창 **한 벌만 만들어 배틀 내내 살려 둔다.**
  - `msgLayer`/`msgText`/`msgArrow` 필드 + `ensureMsgBox()`(lazy 생성) · `showMessage(text)`(글자만 교체) · `hideMessage()`.
  - `say()` = showMessage → 화살표 켬 → 키 대기 → 화살표 끔. **창은 안 부순다.**
  - 창을 감추는 곳은 **커맨드/기술/가방/파티 메뉴가 열릴 때뿐**(같은 자리를 쓴다).
  - ⚠️ Phaser는 씬을 재시작해도 같은 인스턴스라 `create()` 맨 앞에서 세 필드를 `undefined`로 리셋한다
    (안 하면 지난 배틀의 파괴된 컨테이너를 계속 붙잡는다).

### ② 타이밍 2·4(배경/전경 서서히 변화) 구현 (`src/game/battleAnim.ts`)
- 원본 정본 = 추출해 둔 AR 루비 `228_BattleAnimationPlayer.rb`의 `playTiming`.
  (스크립트 추출본 위치는 세션 스크래치라 사라진다 — 필요하면 `Data/Scripts.rxdata`에서 다시 뽑을 것.)
- **판 상태를 숫자로 들고 있다가 프레임마다 그린다:** `PlaneState{key,ox,oy,op,c}` ×(배경·전경) + 시작점 `old`.
  - 타이밍 **1·3 = 즉시 설정**(원본: `ox = -bgX`, 그림 없으면 색 판).
  - 타이밍 **2·4 = 보간**: `타이밍프레임 < 지금 <= 타이밍프레임+duration` 동안 `fraction = (지금-f)/dur`.
    시작 프레임에 지금 상태를 `old`로 스냅샷.
  - ⚠️ **스크롤만 원본이 뺄셈이다**(`ox = old - (bgX-old)*fr`). 이상해 보여도 원본 그대로 옮겼다
    → 배경이 한 방향으로 계속 흘러간다. **원본 실행화면과 대조는 아직 못 했다.**
- 곁들여 고친 것(같은 코드 경로):
  - 색 판 = 원본이 **검은 판 + color를 알파만큼 섞은 것** → 보이는 색 = RGB×(알파/255)로 정정.
  - 배경 그림은 화면 배율로 깔리게 `setTileScale(s,s)`(전엔 1:1이라 큰 화면에서 타일이 여러 번 반복됐다).
  - **프레임이 건너뛰어져도 타이밍은 빠짐없이 처리**(`for (f=last+1; f<fi; f++) fireTimings(f)`).
    안 그러면 페이드가 중간값(0.8 등)에 갇히고 효과음이 통째로 빠진다. 캡처 중 실제로 발생했다.
- **전에는 배경이 아예 안 보였다** — 타이밍 1이 opacity 0으로 깔고 2가 255로 올리는 구조라, 2를 구현 안 했으면 투명.

### ③ Common 애니 연결 (`BattleScene.ts`)
- `playCommonAnim(name, onAlly)` 헬퍼(원본 `pbCommonAnimation` — 한 마리에게 걸어 user=target).
- **HealthUp** = 회복기(`res.healed>0`) · 회복 아이템으로 나가 있는 포켓몬 HP가 실제로 늘었을 때.
- **HealthDown** = 독·화상 잔뎀(`afterTurn`). 원본 `pbHPChanged`와 같은 자리.
- ⚠️ **"명중" Common 애니는 AR에 없다.** 원본도 코드 연출(`Animation::BattlerDamage`)이라 그걸 옮겼다:
  `flash()` = 20fps 기준 **2프레임 숨김+2프레임 보임 ×4**(전엔 alpha 0.2 트윈). 원본처럼 기다리지 않는다(HP바와 동시).

### ④ 잡은 함정 — `tools/bake-exe.sh`가 CRLF로 체크아웃돼 있었다
- `npm run app:bake` → `set: pipefail: invalid option name`으로 즉사. `.gitattributes`엔 `*.sh text eol=lf`가
  이미 있는데 **작업트리 파일만 stale(CRLF)** 이었다(`git ls-files --eol`로 확인). `sed -i 's/\r$//'`로 정규화.
- **다른 PC에서도 같은 증상이 나면 먼저 `git ls-files --eol | grep '\.sh$'`로 w/crlf인지 볼 것.**

## 2. 검증 (전부 headless — `tools/shot-animpolish.mjs` 신규)
- ① **실제 배틀 흐름**(커맨드→기술→대사→애니)에서 애니 도중 샘플 6/6 대사창 표시 + 스샷으로 눈 확인.
- ② EARTHQUAKE: 배경 alpha `0→0.2→0.4→0.6→1` 페이드인 + 스크롤 연속 변화, 전경 모래폭풍 alpha 15단계·스크롤 17단계.
  **애니 후 판 누수 0.**
- ③ 실배틀에서 `HealthDown(내)`(독 잔뎀)·`HealthUp(내)`(회복기 HP 5→14) 호출 확인, 셀 스프라이트 실제 렌더 확인.
  피격 깜빡임은 스프라이트 alpha가 0/1로 토글되는 것 확인.
- `tsc --noEmit` 0 · `npm run build` 성공 · **콘솔에러 0**.
- **exe 반영 완료** — `npm run app:bake` 후 `app.asar` 안 번들이 이번 빌드(`index-CcmGOLeI.js`)와 일치.
- 못 한 것: **소리는 못 들어봤다**(headless, 호출·디코드까지만).

## 3. ⭐ 사용자 지시 (2026-07-22, 다음 세션 1순위)
> "확인할 게 이렇게 많으면 **디버그 페이지에 잘 정리해놔야** 되는 거 알지? 나 학원이라 니가 작업 여러 건 하고 나면
> **하루 한 번 정도 몰아보는 수준**인데"

- 즉, **작업 결과 확인 동선을 DebugMenuScene에 모아야 한다.** 지금은 "D키 → 6번 배틀"처럼 씬 진입만 있고,
  이번처럼 "회복기 HealthUp / 잔뎀 HealthDown / 배경 애니 / 대사창 유지"를 보려면 매번 상황을 만들어야 한다.
- **다음 세션 첫 작업 = 디버그 페이지 정비.** 최소 요구:
  ① **최근 작업 확인 목록**(항목마다 "무엇을 고쳤나 + 한 방에 그 화면/연출로 가는 버튼") —
     예: `기술 애니 테스트(기술 골라 재생)` · `배경 애니(EARTHQUAKE)` · `HealthUp/HealthDown` · `잔뎀 턴 재현`.
  ② 하루치를 **순서대로 훑을 수 있게**(다음/이전) — 사용자가 한 번 앉아서 몰아보는 용도.
  ③ 새 작업을 하면 **그 확인 항목을 디버그 페이지에 추가하는 것까지가 작업 완료**(앞으로 기본 규칙).

## 4. 남은 것 (다음 세션)
0. **디버그 페이지 정비(위 3번) — 1순위.**
1. Common 애니 나머지 미연결: **StatUp/StatDown · 상태이상(독·화상·마비·잠듦·얼음·혼란) · UseItem.**
2. 애니 근사 유지분: 색 보정=틴트 / 감산 블렌드→곱셈 / 시트 hue 회전 무시.
3. 타이밍 2·4 스크롤 보간이 **원본 실행화면과 같은지 미대조**(원본 지진 애니와 눈으로 비교 필요).
4. 1·2부에서 남은 것 그대로: 라이벌집 마감(NPC 없음·워프 누락·현관 매트) · Summary 빈 기술칸 · 도감번호 `———`.

---
---

# 0722 (4부) — 디버그 "확인 항목" 페이지 (3부 지시 1순위 처리)

> 같은 날 네 번째 세션. 3부 §3 사용자 지시("확인할 게 많으면 디버그 페이지에 정리해놔야 한다 —
> 나는 하루 한 번 몰아보는 수준")를 그대로 구현했다. **커밋 = 이 세션 마지막 커밋 참조.**

## 1. 만든 것

### ① `src/data/debugChecks.ts` (신규) — 확인 항목 정본
- 항목 하나 = `date`(작업일지 MMDD) + `title` + **`what`(뭘 고쳤나 한 줄)** + **`see`(화면에서 뭘 보나 한 줄)**
  + **그 연출로 한 방에 가는 `scene`/`data`** (+ `pickMove`면 기술 고르기 먼저).
- 0722 하루치 **8항목** 등록: 카메라 프레이밍 · 오토타일 물 · 기술 애니(기술 골라서) · 배경 애니(EARTHQUAKE)
  · 애니 중 대사창 유지 · HealthUp · HealthDown · 잔뎀 턴.
- 공용 헬퍼도 여기로 모았다: `primeDebugRegistry()`(디버그로 아무 씬이나 열어도 이름·파티·가방·소지금·도감이
  채워지게 — 전엔 DebugMenuScene 안에 인라인) · `startDebugCheck()` · `stepDebugCheck()`.

### ② `src/scenes/DebugCheckBarScene.ts` (신규) — 상단 확인바
- **별도 씬**이라 `scene.start`로 배틀→월드로 갈아타도 살아 있는다 → 하루치를 순서대로 훑는 핵심.
- `◀이전 [` · `다시` · `다음 ▶ ]` · `목록 \` (게임이 안 쓰는 키만 골랐다). 클릭도 됨.
- ⚠️ **바에서 `this.scene.start()`를 부르면 안 된다** — 바 자신이 죽고 옛 게임 씬이 남는다.
  `gameScene()`으로 "지금 도는 진짜 씬"을 찾아 그쪽 ScenePlugin으로 이동한다.
- `main.ts` scene 배열 맨 뒤에 등록(위에 그려지게) + `create`에서 `bringToTop()`.

### ③ `src/scenes/DebugMenuScene.ts` — 2단 구성
- 왼쪽 = 기존 씬 바로가기(그대로, 좌표만 좁힘). 오른쪽 = **"✅ 이번 작업 확인"** 패널
  (↑↓ 커서 · Enter/클릭 실행 · 날짜 ◀▶ · 항목마다 제목+`what` 한 줄).
- **기술 고르기 오버레이**: 애니 있는 기술 **859개**를 5×9 페이지(20p) + **알파벳 점프줄** + 프리셋 6개
  (불꽃세례·전기쇼크·할퀴기·몸통박치기·지진·울음소리) + **쓰는 쪽(내/상대) 전환**. 마우스오버하면 영문 id를 보여준다.
- ⚠️ ESC가 겹친다(오버레이 닫기 vs 타이틀로) → `pickerOpen` 플래그로 가로챈다. `once`가 아니라 `on`으로 바꿨다.
- 목록으로 돌아오면 **방금 본 항목에 커서**가 있다(이어서 다음 항목).

### ④ `src/scenes/BattleScene.ts` — 디버그 데모 모드
- `BattleInit`에 `demo: "move"|"common"|"residual"|"msgbox"` (+ `demoMove`/`demoCommon`/`demoByAlly`).
- `create()`에서 demo면 `runBattle()` 대신 `runDemo()` — **볼 던지기·조우 대사 없이 양쪽을 바로 세우고**
  확인할 연출만 재생, 끝나면 아무 키나 눌러 반복.
- **잔뎀은 가짜 연출이 아니라 실제 `afterTurn()`을 돌린다**(독=내 / 화상=상대를 걸고 턴 종료 처리).
  HP를 풀로 채워두므로 기절 경로는 안 탄다.
- 씬이 내려가면 `demoDead`로 루프를 멈춘다(파괴된 객체를 건드리지 않게).

## 2. 규칙 등록 (사용자 지시)
- **`myPokemon_AJ/AGENTS.md` §6**에 박았다: **"새 작업 = 확인 항목을 `debugChecks.ts`에 추가하는 것까지가 완료"**
  + 추가 방법(데모 모드·확인바·검증 스크립트).
- ⚠️ **리포 루트 `AGENTS.md`는 `.gitignore` 대상**(PC 로컬 — 다른 PC로 동기화 안 됨)이다.
  거기에도 같은 줄을 넣었지만 **정본은 추적되는 `myPokemon_AJ/AGENTS.md`**다. 규칙은 앞으로도 그쪽에 박을 것.

## 3. 검증 (전부 headless · `tools/shot-debugcheck.mjs` 신규)
실제 UI(마우스 클릭·키)로 몰아봤다. `node tools/shot-debugcheck.mjs <출력폴더>` (⚠️ `tools/` 안에서 실행).
- 확인 항목 8행 렌더 → 3번 항목 **마우스 클릭** → 기술 고르기 오버레이 → 프리셋(불꽃세례) 클릭 → 데모 재생.
- 애니 호출 로그: `move:EMBER:ally` · `move:EARTHQUAKE:ally` · `move:TACKLE:ally` ·
  `common:HealthUp:ally` · `common:HealthDown:ally` · 잔뎀 `common:HealthDown:ally`.
- **애니 중 대사창 표시**: EARTHQUAKE 29/29, 나머지도 전부 표시.
- 확인바 `]`로 4→5→6→7→8 순차 이동 OK, `\` 목록 복귀 시 **바 종료 + 커서 유지**(cursor=7) OK.
- 월드 항목(카메라·오토타일 물)도 바를 단 채로 진입 OK.
- `tsc --noEmit` 0 · **콘솔에러 0** · **`npm run app:bake` 완료**(app.asar 번들 = 이번 빌드 `index-DUxK7yhW.js`).
- 캡처 11장: **`.claude/.verify/0722_debugcheck/`** (`D:\dev\Pokemon_With\.claude\.verify\0722_debugcheck\`).
- ❗ 못 한 것: **소리는 못 들어봤다**(headless) · `/code-review`는 이 세션에서 못 돌렸다(슬래시 커맨드=사용자 트리거).

## 4. 남은 것 (다음 세션)
1. **Common 애니 나머지 미연결**: StatUp/StatDown · 상태이상(독·화상·마비·잠듦·얼음·혼란) · UseItem.
   → 붙일 때마다 `debugChecks.ts`에 확인 항목 추가(이제 규칙).
2. 애니 근사 유지분: 색 보정=틴트 / 감산 블렌드→곱셈 / 시트 hue 회전 무시.
3. 타이밍 2·4 스크롤 보간이 **원본 실행화면과 같은지 미대조**.
4. 앞부에서 남은 것: 라이벌집 마감(NPC 없음·워프 누락·현관 매트) · Summary 빈 기술칸 · 도감번호 `———`.
