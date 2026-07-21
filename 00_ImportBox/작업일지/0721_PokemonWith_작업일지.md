# 0721 PokemonWith 작업일지

> 이어받는 다음 세션(다른 PC 포함)이 **이 문서만 보고** 이어가게 쓴다.
> 이 세션 = 사용자 지시 "슬슬 **전체 배선·큰 틀·맵**을 끝내라. 그 다음에 우리 게임만의 독창성을 붙인다.
> **화면 띄워 확인 안 하면 불통과**, 어색한 부분 수정까지 계획에 넣을 것."

---

## ✅ 커밋 `405d46e` — 이번 세션 전량 (tsc 훅 통과)

### 배선(큰 틀) — 고아 기능을 본류에 연결
1. **파티창 ENTER → SummaryScene** (`MenuScene.confirm()` party 분기 → `scene.pause()+launch("SummaryScene",{party,index,from})`).
   - 0720에 만든 Summary가 **DebugMenu O키로만** 열리는 고아 상태였음 → 정식 진입 경로 생김.
   - ⚠️ 키 이름 함정: SummaryScene은 **`index`**(not `idx`)를 받는다.
   - **쓰다듬기(pet=유대↑)를 MenuScene 인메뉴 detail → SummaryScene으로 이식**(ENTER/Z/SPACE). 인메뉴 detail은 도달 불가가 되어 데드코드 111줄 제거.
2. **Phase B 등장 연출** — 내 포켓몬이 **잡은 볼에서 나옴**(`playBallSendOut`). 배틀시작(`runBattle`)·교체·기절교체(`switchAlly`) **전 경로** 커버. ally 스프라이트는 적처럼 **숨겨서 생성 후 볼 연출로 공개**.
3. **라이벌집 실내 신규 + 워프** — 태초마을 (27,7) 문은 walkable인데 **워프도 실내도 아예 없었음**(문 앞에서 아무 일도 안 남).
   - **AR Map156 "그린의집"** 추출 → `public/assets/house/rival_house_1f.png`(640×480, Indoor 타일셋 = 기존 방과 동일 규격).
   - `rooms.json`에 `rival` 방(문=(6,11), 시작=(6,10)), `InteriorScene` 텍스처 매핑, `WorldScene.warpDefs`에 `{map:"pallet",x:27,y:7,to:"house",room:"rival",dir:"up"}`.
   - 퇴장 시 `spawn:[27,8]`로 **라이벌집 앞** 복귀(없으면 자기 집 앞으로 튐).

### 버그·어색한 부분 수정 (코드리뷰+통합검증이 잡은 것)
- 🔴 **집 재입장 영구 프리즈 (크리티컬, 런타임 재현)** — `InteriorScene`의 `busy=true`가 월드로 나갈 때 안 풀림. Phaser는 씬을 **같은 인스턴스**로 재사용해 클래스 필드가 재초기화 안 됨 → 재입장 시 이동·F·Space 전부 먹통. `init()`에 `busy=false; moving=false;` 추가(= `WorldScene.init()`에 이미 있던 관용구).
  **기존부터 있던 버그**인데 라이벌집(=들락날락 기능)이 이를 드러냄.
- **볼 스프라이트 슬라이싱 버그** — `ball_*.png`는 **256×64 = 32×64 8프레임**인데 64×64/end:3로 잘라 **볼이 2개로 보이고** 스트립 왼쪽 절반만 씀. 32×64/end:7로 교정(포획·등장 연출이 텍스처 키를 공유하므로 양쪽 동시 정상화).
- **배틀 인트로에 필드가 텅 빔** — `sendOutEnemy`가 대사(`say`, 키입력 대기) **후에** 적을 등장시키는 순서라, Phase B가 ally를 숨기자 인트로 중 화면이 완전히 빔. 적을 **대사 전에** 등장(await)시켜 해소 + 적 페이드와 볼 던지기 겹침 제거.
- **쓰다듬기 유대 파밍** — 가드(`petted`)가 SummaryScene `init()`에 있어 **X→ENTER 재오픈마다 초기화** → 40회 반복이면 파티 전원 bond 만렙(배틀 보너스). `registry`로 옮겨 **메뉴 세션 단위** 유지.
- **파티창 잡은볼 마커가 가려짐** — 패널 PNG·실렌더 픽셀로 빈 구역(x82~108/y64~90) 측정해 이동 + 아이콘 위로 그림. **선두 포함 6칸 전부 판독 가능**(볼 색 구분됨).
- **Summary 빈 칸** — 기술 페이지 아래 2칸 = **위력/명중**(`MoveData.power/accuracy`, 0이면 `—`), 정보 페이지 빈 행 = **트레이너/상태**. ⚠️특성·성격·만난장소는 `Pokemon.ts`에 **없어서 지어내지 않음**.
- **실내 HUD 문구** — 라이벌집인데 `침대 앞 Space: 잠자기 | F: 방 꾸미기`(내 방 전용)가 떴음 → 방별 분기(`hintFor()`).
- **`tools/ar-map/extract.py`** — ①세션 임시경로 하드코딩으로 **재실행 불가**(다른 PC/세션에서 죽음, 그것도 PNG 덮어쓴 뒤 merge 전에) ②`rival` 손튜닝 데이터 덮어씀. 둘 다 수정(경로 repo-상대+makedirs, rival은 `--force-rival` 없으면 스킵).
  ⚠️ **원본 extract.py는 rooms.json을 통째 덮어써서 손튜닝된 침실·거실(계단·침대·워프)을 날릴 뻔했다** — 병합식으로 바꿔 회피함. 이 스크립트 다시 손댈 때 주의.

## 검증 (전부 화면 실주행 — 사용자 요구 게이트)
- `.claude/.verify/`(**repo 루트**) 몽타주: `party_to_summary_비교.png`·`sendout_ball_비교.png`·`rival_house_비교.png`·`awkward_fix_비교.png`·`통합검증_비교.png`·`수정검증_비교.png`.
- 통합검증 5항목 전부 PASS, **콘솔에러 0**, `tsc --noEmit` EXIT=0.
- 오케스트레이터가 **보고 요약만 믿지 않고 직접** tsc 재실행·git diff·크리티컬 수정 코드 실독·몽타주 육안 확인함.

## ⏳ 남은 것 (다음 세션 우선순위)
1. **건물 크기 "작아 보임"** — 보류 중. 조사 결론: **크롭 가능한 리전 여백 문제가 아님**(pallet 52칸 전부 walkable, 좌우 blocked 여백 없음). 원인은 `WorldScene.ts:23 SCALE=2` + 카메라 `zoom=1` + 건물별 프레이밍 없음 = **전체 화풍 사안**. → `ar-compare` 스킬로 원본 픽셀대조 후 **사용자와 판단**(추측 편집 금지).
2. **Phase C 기술 애니 엔진** — `rxrender.py` 확장(RPG::Table 처리) → `PkmnAnimations.rxdata`+`move2anim.dat` → 애니 JSON(프레임/셀 x,y,zoom,rot,opacity,blend/타이밍/SE) → `Graphics/Animations/*.png`(705시트) 복사 → Phaser 재생기(셀 좌표는 target/user 상대) → `performMove`/`doTurn` 연결 → 대표기술 데모. **큰 작업 = 수 세션.**
3. **라이벌집 마감** — NPC 없음(빈 집), DebugMenu 진입 항목 없음. AR 기준 의자 타일은 walkable(원본 충실, 막고 싶으면 말할 것). 현관 매트 스프라이트가 바닥 아래 검은 영역에 걸침.
4. **잔여 소소한 것** — Summary 4번째 빈 기술칸 플레이스홀더 4칸 중 우하단만 빨강(강조색 샘). 도감번호 `———`(디버그 파티 데이터 문제로 보임, UI 아님).
5. **exe 미반영** — 이번 검증은 전부 dev서버(5180). 사용자 실행본(PokemonWith.exe)엔 아직 안 구움.

## 함정 (이번에 실제로 걸림)
1. **Vite는 서버 시작 후 추가된 `public/` 파일을 안 내보낸다**(SPA fallback으로 text/html) → 새 에셋 넣었으면 **dev 서버 재시작 필수**. (0720에도 걸린 반복 트랩. 이번엔 별도 포트 프리뷰로 우회 후 재시작.)
2. **집 안 이동은 마을보다 느려** playwright 키입력 300~340ms 간격이면 **씹힌다**(큐잉 안 됨) → 600ms.
3. **`git status`가 깨끗해도 작업일지의 "미커밋" 기록은 틀릴 수 있다** — 0720 일지는 Summary를 "미커밋"이라 적었지만 실제론 같은 커밋(`f4f6ebe`)에 들어가 있었음. **말하기 전 실제 git 확인**(0순위 계약 #1).
4. **타이틀에서 `D`만 DebugMenu行**(다른 키·Enter는 MainMenu).
5. **승인창 폭탄 = 툴호출 수 × 동시 서브에이전트 수.** 이번에 병렬 4개를 돌려 30초에 30개 이상 승인창이 떠 사용자가 크게 분노함. 권한 모드가 `default`면 Bash도 전부 물어본다(`acceptEdits`는 Edit/Write만 해제). **권한 모드는 세션 시작 때 읽혀서 설정 파일을 고쳐도 진행 중 세션엔 적용 안 됨** → 즉시 적용은 `shift+tab`뿐.

## 설정 변경 (이번 세션)
- `.claude/settings.json`에서 **`guard-map-edit`·`guard-ui-edit` PreToolUse 훅 제거**(편집마다 ask 유발). 스크립트 파일은 `.claude/hooks/`에 남겨둠 → 되돌리려면 settings에 다시 등록.
  ⚠️ **눈대중 방지 안전장치가 사라진 상태** — 맵 충돌격자·UI 좌표는 이제 **사람/에이전트가 스스로** PIL 격자·실측으로 검증해야 한다.
- 커밋 전 `tsc --noEmit` 차단 훅은 **유지**(정상 동작 확인됨).

## 다음 세션 첫 프롬프트 제안
"작업일지 0721 읽고 이어서. 우선 **건물 크기**를 `ar-compare`로 원본 픽셀대조해서 SCALE/zoom을 어떻게 할지 같이 정하자(추측 편집 금지). 그 다음 **Phase C 기술 애니 엔진** 착수(rxrender.py의 RPG::Table 확장부터). 배선·라이벌집·어색한 부분은 0721에 완료·커밋(`405d46e`)됨."
