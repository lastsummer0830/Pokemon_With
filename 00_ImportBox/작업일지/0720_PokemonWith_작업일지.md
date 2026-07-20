# 0720 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC 포함)이 **이 문서만 보고** 이어가게 쓴다.
> 이 세션 = "포획 볼 시스템 + AR 배틀 애니 활용" 착수. 사용자 스코프 선택 = **기술 애니까지 전부**(단, 이번엔 Phase A까지 + 파티 표시만 완료).

---

## ✅ 완료·검증 — 작업일지 0719 우선순위 #1 (상태이상 수치 in-game)
0719 세션8이 "로직·무크래시만 통과, 수치 눈확인 남음"으로 남긴 것 마무리.
- 실제 BattleScene에서 afterTurn/doTurn을 playwright로 구동(say는 즉시-resolve 몽키패치). 전부 통과:
  - 독 잔뎀=maxHp/8(20/20)·화상=maxHp/16(10/10)·맹독 누적(10→20, 카운터 2→3)·난이도 easy4/normal5/insane11·혼란 자기공격(HP감소+"자신을 공격")·회복기 RECOVER(1→14). 콘솔0.
- 검증 스크립트: 스크래치패드 `verify_status_ingame.mjs`(이 PC 세션 스크래치, git 아님).

## ✅ 감사 — 오늘 4건 현황 (서브에이전트 병렬)
1. **포획 볼:** 배틀서 가방 열어 볼 선택→던지기 흐름은 작동했으나 볼 2종(몬스터·슈퍼)뿐, 던지는 볼 스프라이트 없음(연출=상대 페이드만), 잡은볼 기록·표시 전무.
2. **맵 건물 크기:** WorldScene에 개별 스케일/카메라 zoom **없음**(균일 SCALE=2). "작아 보임"은 추출 PNG + **리전 여백**(태초 실폭 ~19칸인데 리전 52칸 → 좌우 큰 공백). 원본 픽셀대조 흔적 없음.
3. **건물 진입:** 워프는 코드 하드코딩(`WorldScene.ts:68-76 warpDefs`). 집(17,7)·연구소(28,14)는 정상. **라이벌 집 문(27,7)은 walkable인데 워프 미등록 = 확정 누락.** "전면 막힘"이면 PNG 문위치 vs blocked 격자 어긋남 → 격자 대조 필요.
4. **잡은볼 표시:** Pokemon에 필드 없었음, 파티 볼은 AR **선택커서**(종족 무관). Summary 씬 자체가 없음.

## ✅ 사용자 지적 + 스코프 — AR 배틀 애니 미활용
- `/mnt/d/Pokemon Another Red_PWT_250829/Graphics/Battle animations` = **볼 37종(±_open) + 포획터짐(ballBurst) 13종**. `Graphics/Animations` = **기술 애니 705시트**. `Data/move2anim.dat`(기술→애니id) + `PkmnAnimations.rxdata`(프레임/셀/타이밍, **셀=RPG::Table라 기본 rubymarshal 'C'토큰서 실패 → `myPokemon_AJ/tools/ar-map/rxrender.py`(Table처리 有) 확장 필요**).
- 우리 배틀은 이 자산 거의 미사용(기술연출=플래시+HP바+SFX, 등장=단순 트윈).
- **사용자 확정 스코프 = 기술 애니까지 전부**(705 전량은 수 세션 → 이번엔 엔진+대표기술 데모까지가 현실적).

## ✅ 완료·검증 — Phase A: 포획 볼 시스템 (커밋함)
- **`src/systems/capture.ts`**: `BALL_RATE`에 `ULTRABALL:2` 추가, `MASTERBALL`=`UNCONDITIONAL_BALLS`(captureShakes 맨 위에서 4 반환=확정포획). isBall이 이 표를 봄 → **볼 추가 = 이 표+items.json+스프라이트만** 넣으면 됨(데이터 주도).
- **`public/assets/data/ar/items.json`**: 하이퍼볼(ULTRABALL, price1200)·마스터볼(MASTERBALL, price0) 추가. ⚠️AR items.dat엔 영어명뿐 → 공식 KR명(하이퍼볼/마스터볼) 사용.
- **`src/data/Pokemon.ts`**: `caughtBall?: string` 필드 + `caughtBallOf(p)`(기본 POKEBALL) 헬퍼.
- **`src/systems/save.ts`**: SAVE_VERSION 3→**4**, load 시 옛 파티 caughtBall 없으면 POKEBALL로 채움.
- **`src/scenes/BattleScene.ts`**: `playBallCapture(ballId,shakes)` 신규 = 선택 볼이 포물선으로 날아가→열림→상대 흡수(축소·페이드)→닫혀 낙하→흔들림→**성공 시 ballBurst 터짐 / 실패 시 볼 열리며 상대 복구**. `ballBurst()`, `ensureBattleSheet()`, `tweenP()` 헬퍼. 잡을 때 `this.enemy.caughtBall = itemId` 기록. (기존 "페이드만" 블록 대체.)
- **에셋:** `public/assets/battle/`(신규) = ball_POKEBALL/GREATBALL/ULTRABALL/MASTERBALL(±_open) + ballBurst_*. 닫힘=64x64 4프레임 스핀, 열림=32x64.
- **`src/scenes/DebugMenuScene.ts`**: 디버그 가방에 ULTRABALL·MASTERBALL 지급(테스트용).
- **검증(playwright, 실난수):** 성공=포획+caughtBall저장+볼잔존0 / 실패=상대복귀+볼잔존0 / 마스터볼=확정. 콘솔0. (앞선 콘솔에러 2건은 테스트가 Math.random을 상수로 덮어써 Phaser UUID 깨진 부작용 — 실플레이 무관.) tsc통과.

## ✅ 완료·검증 — Phase A-5: 파티창 잡은볼 표시 (태스크4 일부, 커밋함)
- 사용자 결정 = **둘 다(파티 + Summary)**. 이번엔 파티만.
- **`src/scenes/MenuScene.ts`**: `drawPartySlot` 볼 마커를 `pui_icon_ball`(AR 선택커서) → **`item_<caughtBall>`**(AR Items 48x48 아이콘)로 교체. 선택표시는 패널색(swap_sel2)이 담당. preload에서 `item_<ball>` 로드, NEAREST 필터에 `item_` 추가. 아이콘 없으면 옛 볼로 폴백.
- **에셋:** `public/assets/items/ULTRABALL.png`·`MASTERBALL.png` 신규(AR Graphics/Items 복사. POKE·GREAT는 기존).
- **검증(UI 하드게이트 충족):** `.claude/.verify/party_ball_비교.png`(before|after 몽타주). BEFORE=6칸 동일볼, AFTER=볼별 구분(마스터볼 보라·슈퍼볼 파랑·하이퍼볼 노랑·몬스터볼 빨강). 콘솔0.
- **미흡점(정직):** 볼이 포켓몬 아이콘 뒤로 작게만 드러나 **선두 칸은 거의 가림**(색구분 어려움). 볼 실루엣이 AR 파티볼(44x56)→아이템볼(48x48)로 살짝 변함. 원하면 바깥으로 빼거나 확대.

---

## ⏳ 남은 것 (다음 세션, 우선순위)
1. **Summary(상세) 씬 신규** — 태스크4 "둘 다" 중 나머지. AR `Graphics/UI/Summary/` 에셋으로. 잡은볼+스탯+기술 표시. 파티에서 포켓몬 선택→상세. ⚠️**game-ui.md STOP 준수**(AR UI 얹기·side-by-side·`.claude/.verify` 하드게이트). `phaser-scene-builder`+`game-ui-hud-polish`.
2. **Phase B 등장 연출** — 내 포켓몬 '내보내기'(sendOut)도 잡은볼에서 튀어나오게(Phase A 볼 자산 재사용). "몬스터볼 나오는 모든 곳" 커버 확장.
3. **Phase C 기술 애니 엔진** — `rxrender.py` 확장으로 `PkmnAnimations.rxdata`(+`move2anim.dat`) → 애니 JSON(프레임/셀 x,y,zoom,rot,opacity,blend/타이밍/SE) 추출 → `Graphics/Animations/*.png` 시트 복사 → Phaser 재생기(RMXP 셀 좌표는 target/user 상대) → performMove/doTurn에 연결 → 대표기술(Ember/Tackle/Water Gun 등) 데모. **큰 작업 = 수 세션.**
4. **맵 태스크 2·3** — 건물 크기(추출PNG/리전여백·카메라 zoom 검토·NEAREST 확인)·진입(라이벌집 (27,7) 워프 추가 + "전면막힘"이면 PNG 문위치 vs blocked 격자 PIL 대조). ⚠️맵 편집은 `guard-map-edit` ask + 눈대중 금지.

## 함정·메모 (이번에 실제로 걸림)
1. **새 public 에셋(battle/·items/*)은 dev서버 재시작 전까지 text/html** → 재시작 후 `curl -w '%{content_type}'`가 image/png 확인(반복 트랩).
2. **vite 백그라운드 실행:** Bash에서 `npm run dev &`는 툴 종료 시 SIGTERM으로 죽음 → **`run_in_background:true`로 띄워야** 유지됨.
3. **playwright에서 Math.random 상수 덮어쓰기 금지** — Phaser UUID가 깨져 "Texture key already in use"·null context 유령에러. 결정성이 필요하면 마스터볼(무난수) 쓰거나 실난수로 반복.
4. `say()`는 ENTER/Z/SPACE 대기 → afterTurn/doTurn/throwBall 검증 시 `scene.say`를 즉시-resolve로 몽키패치. box.animateTo도 즉시-resolve.
5. **MenuScene 메인=아이콘 바**(도감/볼/가방/저장/설정), 파티 패널은 '볼' 아이콘 확인(Enter) 후 열림.
6. ⚠️**UI 검증 png는 repo 루트 `.claude/.verify/`에 저장**(enforce-ui-verify 훅이 CLAUDE_PROJECT_DIR=repo루트 기준으로 검사). `myPokemon_AJ/.claude/.verify/`가 아님. 파일명에 '비교'.
7. ⚠️**실수 기록:** `myPokemon_AJ/.claude/.verify/`를 내가 만든 줄 알고 `rm -rf` → 7/18 검증물(status_databox_*·일부 bond_*) 소실(gitignore라 복구불가). **`.claude/.verify`는 세션간 공유 폴더 → 통째 삭제 금지, 지우기 전 내용 확인.** 소실=스샷뿐(작업은 커밋됨), 재생성 가능.

## 검증물 위치
- git: `myPokemon_AJ/.claude/.verify/party_ball_비교.png`.
- 스크래치패드(git 아님, 이 PC): `verify_status_ingame.mjs`·`verify_capture2.mjs`·`verify_party_compare.mjs`·`cap_ok_*`·`party_caught_balls.png`.

## memory 갱신
- `capture-ball-animations.md` 신규(스코프·Phase A/A-5 완료·남은 Phase B/C·맵). MEMORY.md 인덱스 추가.

## 다음 세션 첫 프롬프트 제안
"작업일지 0720 읽고 이어서. **Summary(상세) 씬**부터 — AR Graphics/UI/Summary 에셋으로 잡은볼+스탯+기술, game-ui.md STOP 준수(side-by-side 검증). 그다음 Phase B(내보내기 볼 연출) → 맵 태스크2·3 → Phase C(기술 애니 엔진). Phase A(볼 시스템)·파티 표시는 0720에 완료·커밋됨."

---

# 0720 (세션2) — Summary(상세) 씬 신규 ✅ 검증완료 / ⚠️미커밋

## 한 것 (태스크4 "둘 다" 중 나머지 = Summary)
- **신규 `src/scenes/SummaryScene.ts`** — AR `Graphics/UI/Summary/bg_{info,skills,moves}.png`(각 512×384) 원본 3페이지 위에 데이터를 얹음. **PokedexScene과 동일 관용구**(가상 512×384 + contain 스케일, `X/Y/img/txt/crop` 헬퍼, `layer` 컨테이너 rebuild, resize 재렌더). NEAREST는 `sum_*`·`sumfront_*` 키에만.
  - 조작: **← → 페이지**(정보/능력치/기술), **↑ ↓ 파티 내 포켓몬**, **X/ESC 닫기**(from 씬 resume/start).
  - 좌측 공통: 초상(`makeStillFront`) + 이름/성별(♂파랑♀분홍, 이름 텍스트 실제 width 뒤에 배치=겹침방지) + Lv + **잡은볼 아이콘(`icon_ball_<BALL>`) + 볼 한글명**.
  - 정보(파랑): 종족명·도감번호·**타입 뱃지**(types.png 행=`TYPE_POS`, PokedexScene과 동일표)·지닌도구·성별 + 경험치/다음레벨 + **EXP 바**(`expForLevel`=L³로 현재레벨 진행도, Lv100은 "최고 레벨"·바 가득).
  - 능력치(초록): **HP 바**(잔량색, 수치는 바 위 y72=스탯행 겹침회피) + 공격/방어/특공/특방/스피드(회색 라벨칸↔흰 값칸) + **유대 하트**(bond, 이 게임 차별점).
  - 기술(빨강): 4칸 각 **타입+분류 뱃지**(category.png 행 물리0/특수1/변화2, AR 상자쌍 x248/x281·슬롯중심 y=142+i·64) + 기술명 + PP(잔량색).
- **에셋**: `public/assets/ui/summary/`(신규) = AR bg 3장·overlay_hp/exp·category·icon_ball_×4. 타입아이콘은 기존 `ui/types.png` 재사용.
- **`src/main.ts`**: 씬 등록. **`src/scenes/DebugMenuScene.ts`**: `O키` 진입 항목 + keyNames에 U·I·O 추가(겸사 기존 미바인딩이던 센터U/마트I도 키 동작하게 됨).

## 검증 (game-ui.md 하드게이트 충족)
- Playwright로 3페이지 실제 렌더 캡처 → **콘솔 에러 0**. AR 원본↔내게임 **side-by-side 몽타주 = `.claude/.verify/summary_비교.png`**(3행, 좌AR/우내게임). 레이아웃·뱃지·바 정렬 일치 확인. tsc 통과.
- `/code-review` medium 지적 2건 수정: ①Lv100 EXP 표시 오류(→"최고 레벨"), ②경계 헛움직임 SFX(→무변화시 early return).

## ⚠️ 안 한 것 · 결정 대기 (다음 세션 먼저 처리)
1. **파티창(MenuScene)→Summary 배선 안 함(의도적).** 이유: §6.5 "look은 사용자 승인 먼저" + 기존 MenuScene 인메뉴 detail의 **쓰다듬기(pet=유대↑) 회귀 방지**. 현재 Summary는 **DebugMenu O키로만** 접근. → 승인 시: 파티 ENTER→`scene.pause()+launch("SummaryScene",{party,index,from})`, 인메뉴 pet을 Summary로 이식(Space=쓰다듬기)할지 결정.
2. **커밋 안 함(승인 필요).** git status: main.ts·DebugMenuScene.ts 수정 / SummaryScene.ts·public/assets/ui/summary/ 신규.
3. **기술 페이지**: AR 상자가 슬롯당 2×2인데 위 2칸(타입·분류)만 채우고 **아래 2칸 비움**(원본 템플릿 여백). / **정보**: bg 행슬롯이 내용보다 많아 성별↔경험치 사이 빈 행. → 그냥 둘지 결정.

## 이어서 (우선순위 그대로)
- (Summary look 승인·커밋 후) **Phase B 등장 연출**(sendOut도 잡은볼에서 튀어나오게, Phase A 볼자산 재사용) → **맵 태스크 2·3**(라이벌집(27,7) 워프 + 건물크기) → **Phase C 기술 애니 엔진**(rxrender.py 확장).

## 함정 (이번에 실제로 걸림)
- **타이틀에서 D키만 DebugMenu行**(다른 키·Enter는 MainMenuScene로 감) → playwright 네비 첫 키를 Enter로 하면 메뉴로 새서 Summary 못 감. **D 먼저**.
- **AR bg_moves 슬롯 상자는 2×2**(4칸), 슬롯 중심 y≈142+i·64 (첫 시도서 뱃지가 ~14px 위로 떠 상자와 어긋남 → 8px격자 재측정으로 교정).
- Stop훅(enforce-ui-verify)은 **UI 씬 편집 이후 시점**의 .verify png를 요구 → 마지막 코드수정 뒤 재캡처·몽타주 갱신 필요(리뷰 수정 후 한번 더 캡처함).

## memory 갱신
- `capture-ball-animations.md`에 Summary 완료 반영 예정(다음 세션). MEMORY.md 인덱스는 유지.
