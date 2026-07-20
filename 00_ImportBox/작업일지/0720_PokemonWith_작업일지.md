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

## 검증물 위치
- git: `myPokemon_AJ/.claude/.verify/party_ball_비교.png`.
- 스크래치패드(git 아님, 이 PC): `verify_status_ingame.mjs`·`verify_capture2.mjs`·`verify_party_compare.mjs`·`cap_ok_*`·`party_caught_balls.png`.

## memory 갱신
- `capture-ball-animations.md` 신규(스코프·Phase A/A-5 완료·남은 Phase B/C·맵). MEMORY.md 인덱스 추가.

## 다음 세션 첫 프롬프트 제안
"작업일지 0720 읽고 이어서. **Summary(상세) 씬**부터 — AR Graphics/UI/Summary 에셋으로 잡은볼+스탯+기술, game-ui.md STOP 준수(side-by-side 검증). 그다음 Phase B(내보내기 볼 연출) → 맵 태스크2·3 → Phase C(기술 애니 엔진). Phase A(볼 시스템)·파티 표시는 0720에 완료·커밋됨."
