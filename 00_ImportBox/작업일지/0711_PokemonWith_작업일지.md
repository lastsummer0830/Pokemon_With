# 0711 PokemonWith 작업일지

> 이 문서만 보고 다른 PC의 Claude가 이어받을 수 있게 작성. 규칙 정본=리포 `AGENTS.md`/`myPokemon_AJ/AGENTS.md`, 진행상황=memory `starter-lab-flow`.

## 오늘 한 것 (무엇 / 왜 / 어느 파일)

### 1. 오박사 연구소 스타팅 "설명 카드" 전면 재설계 — `myPokemon_AJ/src/scenes/LabScene.ts`
- **문제(사용자 지적):** 볼 앞에서 Space→뜨는 카드가 **포켓몬 스프라이트만 덩그러니** 있고(이름·타입·설명 없음), 게다가 AR 나오하 스프라이트가 뭉툭·복잡해 "이상"해 보임. "설명 카드"답지 않음.
- **결정(사용자 선택):** 가로형 크림 **A2 레이아웃** — 스프라이트(좌) + `No/이름/타입칩/키·무게`(우) + `분류·도감설명`(하단 전폭). 팔레트=인트로 성별카드(테두리 `#c98a3c`, 크림 `#f3e4c8`). 후보 3안(A/B/C)+개선(A1/A2) 스샷은 `01_Resources/Pick/09_스타팅선택/설명카드_변형3안/`.
- **카드 스프라이트 = PokeRogue 정지컷으로 교체.** AR 나오하가 별로여서 §4D 폴백(PokeRogue) 사용. 사용자가 "포켓로그 소스 확인했냐"고 짚어줘서 확인 → AR보다 깔끔. 애니 대신 **정지("가만히 있는 픽셀")**.
  - 신규 에셋: `myPokemon_AJ/public/assets/pokemon/card/{SPRIGATITO,CHARMANDER,FROAKIE}.png`
  - 출처: PokeRogue 에셋리포 `pagefaultgames/pokerogue-assets`(branch **beta**) `images/pokemon/{906,656,4}.png`(+`.json` 아틀라스)의 frame0 추출→tight크롭. 아틀라스 형식 2종: `{textures:[{frames:[]}]}`(906·4) / `{frames:[]}`(656). 906=프레임1장(정지), 656=78프레임·4=108프레임(애니라 frame0만 씀).
  - LabScene preload가 `card_<key>`로 로드, `bakeCardSprite("card_"+key, dispPx)`가 콘텐츠 꽉 차게 캔버스로 구움(NEAREST). AR front(frontPath) 로드/의존 제거.
- **여백 조정:** "너무 꽉 차 보인다"는 피드백 → 카드 키우고(cw≤660, ch≤510) 패딩28·요소간격·줄간격 늘림.
- **대화창 겹침 수정:** 카드를 화면중앙에 두니 하단 대화창·이름표와 겹침 → **대화창 위 공간에 anchor**(DialogBox.layout()·applySpeaker와 동일 계산: dialogTop=H-dh-여백, plateH=dlgFont*1.7 만큼 이름표가 위로 튀어나옴 반영). 공간 부족하면 카드 자동 축소.
- **데이터:** `STARTERS`에 `height`/`weight` 추가(공식 SV: 나오하 0.4m/4.1kg·파이리 0.6m/8.5kg·개구마르 0.3m/7.0kg). 타입색 `TYPE_COLOR`(풀#78c850·불꽃#f08030·물#6890f0).
- **제거된 죽은 코드:** `frameStyle`(cream/lavender/card 3종)·`FrameStyle` 타입·`frontMetrics`·`bakeStill`·잠깐 넣었던 `ensureCardAnim`(애니). `PreviewData.preview`는 **boolean**으로 변경(옛 문자열 스타일 아님). `frontPath` import 제거.
- **오박사 나레이션 대사는 안 건드림**(§1.5: 기존 멘트 유지) — 카드가 정보표시, 대사흐름 그대로.

### 2. 랩 충돌 버그 수정 — `myPokemon_AJ/public/assets/world/oak_lab.json`
- **문제:** 왼쪽 **회복기계 위로 캐릭터가 올라가짐**(사용자 스샷).
- **원인:** 기계가 (1,3)(2,3)(1,4)(2,4)(1,5)(2,5) 6칸 점유인데 윗칸 **(1,3)(2,3)이 안 막혀** 있었음.
- **수정:** 맵 PNG에 32px 격자 얹어 확인(눈대중 금지 규칙) → `blocked[3][1]=blocked[3][2]=1`. playwright `walkable(1,3)=false`·`(2,3)=false` 검증.

## 검증 (한 것)
- **webapp-testing(playwright)**로 `window.__game` 통해 LabScene 직접 제어 → 3종 카드 인게임 캡처(정상), `walkable()` 충돌 확인, 대화창 겹침 없음(1100×1030·1280×720 둘 다), **콘솔 에러 0**.
- **`tsc --noEmit` 통과**(커밋 훅 통과 가능).
- ⚠️ 아직 **커밋 안 함**(사용자 승인 필요). `/code-review`도 아직 — 커밋 전 돌릴 것.

## 주의사항 / 함정 (다음 세션 꼭 기억)
- **새 public 폴더(`card/`) 만들면 dev서버 재시작 필요.** 안 하면 새 png가 `text/html`로 응답(SPA 폴백). `curl -w '%{content_type}'`가 `image/png` 아니면 재시작. (이번에 재시작함.)
- **PokeRogue Sprigatito(906)는 프레임 1장뿐 + 포즈가 활동적**(완전 차분한 정면 포즈 아님). 더 차분한 걸 원하면 box 아이콘(`images/pokemon_icons_9.png`+json) 또는 다른 소스 검토. 파이리·개구마르는 정갈함.
- PokeRogue에 **한글 타입 뱃지** `images/types_ko.png`(+json) 있음 — 카드 타입칩을 실제 아이콘으로 교체할 때 소스.
- 카드 위치는 DialogBox 계산에 의존 → **DialogBox.layout() 값 바뀌면 카드 anchor도 재확인**.
- 캡처가 좀 어둡게 나오는 건 카메라 `fadeIn(400)`/preserveDrawingBuffer 타이밍 — 실제 게임은 밝음(사용자 스샷 기준). jitter 오인 주의.

## 다음 이어서 할 스텝 (사용자와 상의된 후보)
1. **메뉴 실전 배선**(`src/scenes/MenuScene.ts`): 이미 있는 `systems/save.ts`를 `저장` 항목에 연결 + `지도` 항목 추가 + 실내(집·랩)에서도 메뉴 열리게. 현재 도감/가방/저장/설정 4/5가 "준비중" 스텁. (⚠️ MenuScene은 guard-ui-edit 훅 대상)
2. **가방/도감 화면**: 카드처럼 레퍼런스 조사 → look 변형 스샷 → 사용자 선택(맘대로 만들지 말 것 — 사용자 강조).
3. **카드 타입칩 → 실제 타입 아이콘**(PokeRogue `types_ko.png` 또는 AR `Graphics/UI/types.png`) 옵션.
4. **나오하 포즈** 더 손보기(원하면 box아이콘 등).

## 새 지침/skills/memory 요지
- **memory `starter-lab-flow` 업데이트됨**(설명카드 v3·PokeRogue 정지·랩 충돌수정 반영). memory는 PC-로컬(git 동기화 X) → 아래 이관 참고.
- 새 규칙/훅 추가 없음. skills 변경 없음.

## 이관 (git 동기화 안 되는 것)
- memory(`~/.claude/.../memory/starter-lab-flow.md` 등)는 이 PC(ONE) 바탕화면 `PokemonWith_이관_0711/`에 사본. 다른 PC는 그 내용을 자기 memory에 반영하거나 이 작업일지로 대체 가능.

---

# 0711 (오후 이어서) — 라이벌 첫 배틀 연결 + 메뉴/배틀 배선

> 게임이 처음으로 "타이틀→스타터→첫 배틀(경험치·레벨업)→저장→이어하기"까지 끊김없이 돈다. 커밋 `28e036f "0711"`에 아래 전부 포함.

## A. 라이벌(네모) 첫 배틀 연결
- **문제:** 스타터 선택이 마을에서 막다른 길(첫 배틀 없음). 배틀 엔진은 완성됐으나 디버그 B키로만 진입(고립).
- **한 것:**
  - `LabScene.ts` — 스타터 확정 후 **오박사 컨셉 멘트 3줄 추가**(포켓몬을 아껴라·예전 같지 않다·왠지 널 맘에 들어함 = 유대/컨디션 떡밥, 사용자 지시) + **네모 "지금 바로 한 판! 밖에서 기다릴게"**로 수정("언젠가…약속이야" 대체). `rivalCounter()`(SV 네모식: 내가 유리한 상성)로 상대 예약 → registry `rivalBattlePending`/`rivalEnemySpecies`.
  - `WorldScene.ts` — 연구소에서 나오면 네모가 다가와 라이벌 트레이너전 발동(`maybeStartRivalBattle`→`startRivalBattle`, `wild:false, trainer:"네모"`).
  - `BattleScene.ts` — `trainer` 필드 추가(트레이너 인트로/승리 대사, 도망 불가) + **텍스처 캐시 버그 수정**(preload에서 `battle_ally/enemy(+__still)` 제거 → 2번째 배틀부터 적 스프라이트 안 바뀌던 잠재버그 해소).
- 검증(playwright): 실제 스타터 선택→registry 정확, 마을 나감→트레이너전 발동, 카운터 3종 앞모습 정상 렌더(5088px 나오하도 안 깨짐), 콘솔에러 0.

## B. 배틀 보상 — 경험치·레벨업
- `Pokemon.ts` — `exp` 필드 추가(생성 시 level³). `recomputeStats(p)` export(레벨 바뀌면 종족값으로 6스탯 재계산, maxHp 증가분만큼 currentHp↑).
- `systems/exp.ts` **(신규)** — `expForLevel(L)=L³`, `battleExpYield(enemy)=enemy.level×7`, `gainExp(p,amt)`(임계 넘을 때마다 level++·recompute·해당 레벨 신기술 학습, 4칸차면 최고참 교체) → `{gained,levels[],learned[]}`.
- `BattleScene.win()` — 승리 시에만 exp 지급 + "N 경험치 얻었다!"·"Lv.X 됐다!"·"△△ 배웠다!" 대사. `this.ally===party[0]` 동일참조라 파티에 반영.

## C. 저장/이어하기/실내 메뉴 (메뉴 코어 배선)
- `systems/save.ts` **재작성** — 옛 `{player,house}`(런타임과 불일치) 폐기. registry 단일원천 versioned `SaveData`(name/gender/party/starterChosen/rival예약/houseIntroDone/loc). `hasSave()`·`saveGame(reg)`·`loadGame(reg)`·`clearSave()`. 위치(loc)는 메뉴 연 씬이 registry `saveLoc`에 기록(월드=정밀 tx/ty/facing, 실내=room 단위).
- `MenuScene.ts` 저장 항목 → `saveGame` + "저장했다!"(스텁 제거). ⚠️ guard-ui 훅 대상이나 레이아웃 무변경(동작만).
- `MainMenuScene.ts` 이어하기 → `hasSave`/`loadGame` → registry 복원 → 저장 씬·위치로 start.
- `InteriorScene.ts` — Enter/X로 메뉴 열기(WorldScene.openMenu 패턴 이식, busy/moving 가드=대사중 안 열림) + RESUME 시 입력복구.
- `WorldScene.openMenu` — 열기 직전 `saveLoc` 기록.

## D. F1 수정 (직전 리뷰 지적) — 라이벌전 패배해도 재대결
- `WorldScene.maybeStartRivalBattle` — 트리거 때 `rivalBattlePending` 소비하던 줄 제거.
- `BattleScene.win()` — 트레이너전은 **이겼을 때만** `rivalBattlePending=false`. 지면 pending 유지 → 집→마을 재진입 시 라이벌 다시 대기.

## 검증 (playwright 실주행, 전부 ✅ / 콘솔에러 0)
- [A] 야생배틀 승리 → exp 213→234, **레벨업 5→6** ✅
- [B] 메뉴 저장 → localStorage에 party·loc(WorldScene,20,15,left)·name 정확 ✅
- [C] 이어하기 → registry 복원 + 저장 위치(WorldScene) 복귀 ✅
- [D] 실내(InteriorScene) Enter→메뉴 열림(interior paused)→취소로 닫힘(interior active·입력복구) ✅
- [E] F1: 라이벌전 트리거 시 pending 유지 → **승리 후 pending=false** ✅
- `tsc --noEmit` 통과. ⚠️ `/code-review`는 배틀 연결분(A)만 돌림 — 배선분(B~D)은 미실행(다음 세션 커밋 전 권장).

## ⚠️ 다음 세션 즉시 처리
- **`myPokemon_AJ/verify_wiring_tmp.mjs` 레포에서 제거할 것** — 임시 playwright 테스트(god-mode 해킹 포함)가 `28e036f`에 **실수로 커밋**됨. 현재 워킹트리에서 삭제해둠(uncommitted). `git rm` 후 커밋 or `.gitignore`에 `verify_*_tmp.mjs` 추가 권장.
- 작업일지(이 파일)도 아직 uncommitted.

## 알려진 한계 / 다음 후보 (범위 밖이었음)
- **가방**: 아이템 시스템 자체가 없음(신설 필요). **도감/설정**: look 결정(§6 변형스샷→사용자선택) 필요. → 다음 세션.
- **야생 인카운터**: 태초마을=풀숲 없음. 1번도로 맵 AR 추출(`tools/ar-map`, extract.py의 AR경로가 ONE PC 하드코딩=user PC면 수정) 필요.
- **집꾸미기→컨디션→배틀**(차별점): 전 링크 끊김 — HouseScene 스텁, `applyHomeBonus` 미호출, condition 항상 0, **타입문자열 버그**(homeBonus는 "불꽃/물" 비교하나 종족타입은 "FIRE/WATER" 대문자영어). 집 세션에서 함께 정리.
- 배틀: 단일 포켓몬만(파티>1·교체·잡기·아이템·상태이상 미구현). 실내 저장 복원은 방 단위(정밀 타일 아님).

## 계획 파일
- `~/.claude/plans/transient-floating-sunset.md`(이번 배선 계획 정본, plan mode 승인본).
