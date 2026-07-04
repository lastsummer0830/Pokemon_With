# 0704 PokemonWith 작업일지

## 오늘 한 일 (크게 2덩어리)

### A. 집 내부 맵/충돌/계단 대대적 수정 (rooms.json + InteriorScene)
파일: `myPokemon_AJ/public/assets/house/rooms.json`, `myPokemon_AJ/src/scenes/InteriorScene.ts`

- **근본원인**: 지금까지 충돌격자를 게임 실행화면 눈대중으로 찍어서 매번 어긋났음(몇 주째 반복된 문제). → **원본 PNG(640×480=20×15칸×32px)에 정확히 32px 격자를 얹어서** 셀↔가구를 1:1로 맞추는 방식으로 전환. 스크립트: scratchpad의 `grid.py`(오버레이), `build_grid.py`(격자생성), `compact_json.py`(rooms.json 압축). **눈대중 금지, 앞으로 이 방식.**
- 이 방식으로 잡은 것: ①거실 문워프를 도어매트(8,11·9,11) 위치로(내가 중간에 10,11로 잘못 옮겼다 원복) ②침실 주황"카펫"을 옷장으로 착각해 막았던 것 → 밟게 풀기 ③주방 아래 바닥 과도차단 해제 ④가구(TV·침대·욕조·주방·소품 7,8) 충돌 재정렬.
- **계단 규칙(사용자 확정, 중요)**: 계단 그림에서 **파란 난간은 밟으면 안 됨(막기), 노란 발판만 밟아야 층이동.** 그리고 **카펫에서 계단으로 들어가는 게 정답 루트.**
  - 침실: 카펫=(11,3)(11,4), 계단 발판칸=(10,3) 하나만 워프. 난간(9,3)(9,4)(10,4) 막음. 카펫(11,3)→왼쪽→(10,3) 밟으면 거실로.
  - 거실: 카펫=(5,3)(5,4), 발판칸=(4,3) 하나만 워프. 난간(4,4) 막음. 카펫(5,3)→왼쪽→(4,3) 밟으면 침실로.
  - 계단은 **밟으면 즉시 전환**(정통 포켓몬식). 대각선 climb 연출은 방향 시비만 나서 없앰(InteriorScene handleWarp: climb 있으면 그거, 없으면 즉시). 도착지는 상대방 카펫 위(침실11,3 / 거실5,3).
- **가구 뒤로 지나가게 하려던 전경 오버레이는 철회**: 캐릭터가 가구 근처만 가면 머리가 잘려 보여서(책장 밑=대가리 사라짐) 사용자 격노 → 껐음(`overImg setVisible(false)`). 캐릭터를 그냥 앞에 그리는 게 표준. (오버레이 PNG `*_over.png` 2개는 안 쓰임 — 지워도 됨. InteriorScene preload에서 아직 로드만 함.)
- **"고쳐도 똑같다" 2대 함정**: ①브라우저 HTTP 캐시가 rooms.json/이미지 물음 → `this.load` URL에 `?v=`+Date.now() 붙임 + `cache.json.remove`. ②vite dev서버는 켠 뒤 새로 만든 public 파일을 안 잡음(text/html 폴백) → **새 에셋 만들면 dev서버 재시작 필수**. HUD에 `★맵수정판★` 표식 박아 새코드 로드 여부 즉시 판별하게 함(나중에 떼야 함).

### B. 첫 마을 + 스타팅 선택 흐름 신규 구현
파일: `src/scenes/WorldScene.ts`(재작성), `src/scenes/LabScene.ts`(신규), `src/main.ts`(등록), `src/scenes/DebugMenuScene.ts`(9번 추가)

- **첫 마을 = 어나더레드 실제 '태초마을'(Map55) 추출 맵.** 처음엔 내가 건물을 손으로 그림(졸라맨) → 사용자 격노 → 소스에서 뽑음.
  - AR소스: `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829` (이 PC 데스크톱에 있음).
  - `tools/ar-map` 파이프라인(rubymarshal로 rxdata→타일렌더 + passages에서 충돌격자) 이용. 렌더 스크립트: `scratchpad/render_town.py`.
  - 산출물: `public/assets/world/pallet_town.png`(52×20칸, 1664×640) + `pallet_town.json`(blocked). MapInfos에서 태초마을=Map55 확인.
  - WorldScene: 이 맵 SCALE=2로 깔고 **격자이동 + 카메라 추적**(setBounds+startFollow). 워프: 연구소문(28,14)→LabScene, 우리집문(17,7)→InteriorScene(거실). 스폰=우리집앞(17,8).
- **LabScene(연구소, 신규)**: 오박사(trainer_PROFESSOR)+네모(trainer_NEMONA) 대사 → 스타팅 3마리 선택(냐오하/파이리/개구마르, `frontPath`+`makeAnimatedFront`로 어나더레드 Front 애니) → 선택 시 `createPokemon`으로 만들어 **registry `playerParty`(Pokemon[])** 에 추가, `starterChosen` 저장 → 마을 복귀(연구소앞 28,15).
- 스프라이트 함정: 캐릭터 png는 128×192=32×48 4방향 시트 → **spritesheet로 불러와 프레임0(정면)** 써야 함. 처음 오박사를 `load.image`로 통짜 로드해서 시트 전체 나온 것 고침.
- 전체 흐름 연결됨: 침실→계단→거실→아래 문(`to:"world"`)→마을→연구소 문→스타팅→마을.

## ⚠️ 사용자가 자기 전 지적한 것 (다음 작업 1순위 — 반드시 고칠 것)
연구소(LabScene)에 대한 3가지 정당한 지적:
1. **텍스트박스가 집이랑 다르다** → LabScene에 대화창을 새로 짜서 스타일 불일치. **집/인트로의 HGSS 대화창을 공통 컴포넌트로 빼서 재사용**할 것.
2. **캐릭터·박스 둘 다 너무 크다** → 캐릭터 scale `(H/480)*2.4`(≈4배), 박스 92%×20%로 대충 키움. 오버월드 SCALE=2 기준·집 대화창 크기에 맞춰 **줄일 것.**
3. **연구소 내부가 좆같다(손으로 그린 사각형)** → 마을 졸라맨 실수 반복. **어나더레드 실제 오박사 연구소 내부 맵을 추출**해서(태초마을처럼 tools/ar-map) 넣을 것. 연구소 내부 맵 ID는 태초마을 연구소문 이벤트의 transfer 대상 맵을 찾거나 MapInfos에서 "Oak"류 이름 검색.

## 그 외 남은 것
- 마을 출구(1번도로 등) 연결 안 됨. 마을 위(24,1)/좌우 가장자리가 route로 이어짐.
- 배틀(BattleScene)은 아직 데모. 스타팅 파티→실제 배틀 연결 필요.
- 저장(save.ts)에 playerParty/진행 반영 안 됨(현재 registry에만).
- HUD의 `★맵수정판★` 임시표식·안 쓰는 `*_over.png` 정리.

## 새로 추가/변경된 메모리 (~/.claude/.../memory/) — 다른 PC로 이관 필요
1. `collision-grid-from-raw-png.md` (신규) — 충돌격자는 원본PNG 32px격자 1:1. 계단=난간막고 카펫서 노란발판만. HTTP캐시·vite재시작 함정. playwright+libnss 우회 실행법.
2. `starter-lab-flow.md` (신규) — 태초마을 실제맵 추출 + LabScene 스타팅 흐름 위치·상태.
3. `launch-via-bat-only.md` (갱신) — 이 경로 OneDrive 아님, build_win으로 통일, 바로가기(.lnk) 규칙.
4. `MEMORY.md` (색인 갱신).
→ **이관 자료는 바탕화면 `PokemonWith_이관_0704/`에 사본 넣어둠.** (memory는 홈 `.claude`라 깃 동기화 안 됨.)

## 플레이 검증 환경(이 PC, WSL)
playwright 로컬설치됨(myPokemon_AJ/node_modules). chromium 시스템lib 없어서 `apt-get download libnss3 libnspr4`→dpkg-deb -x 추출→`LD_LIBRARY_PATH` 로 실행(경로는 scratchpad/sodir.txt). `window.__game`으로 씬 조작(scene.start), 키보드 주행. 자세히는 `collision-grid-from-raw-png` 메모리.
> **추가(0704 두번째 세션):** playwright는 `chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})` 로 headless 실행됨(WebGL swiftshader). `window.__game.scene.getScene('LabScene')` 로 씬 인스턴스의 tx/ty/busy/selecting 등 런타임 필드 직접 읽어 주행 검증. 키는 홀드 말고 `press`+240ms 간격으로 한 칸씩(홀드는 오버슛). 대화창은 타이핑식이라 Space 두 번(완료+넘김).

---

# 0704 (두번째 세션 · dev PC=user) — 환경정리 + 검증셋업 + 연구소(LabScene) 완성

## A. 작업환경/규칙 정리 (커밋됨)
- **0704 신규 규칙이 memory에만 있어 PC 넘어가면 증발**하던 것 → git-synced **AGENTS.md에 박음**: 충돌격자=원본PNG 32px·계단규칙·캐시/vite함정(`myPokemon_AJ/AGENTS.md` §2), exe굽기(app:bake·build_win·.lnk, ⚠️`app:build`는 WSL 리눅스타겟 헛수고), AR소스 **PC별 경로표+find 탐색**(§4C), 루트 AGENTS.md §3에 "PC절대경로 맹신금지·find확인·규칙은 memory아닌 AGENTS.md에".
- **AR소스 경로 오판**: 작업일지의 ONE PC경로만 보고 "없다" 단정했다가 실제 `D:\Pokemon Another Red_PWT_250829`에 있음(user PC). → 규칙화.
- 정리: 사장코드 `overImg` 전경오버레이 제거 + 임시표식 `★맵수정판★` 제거 + 안쓰는 `*_over.png` 삭제.

## B. 검증 셋업 (커밋됨)
- **webapp-testing 스킬** 설치(`.claude/skills/`, 공식 anthropics/skills) + 자연어 트리거 연결(§8 라우팅표).
- **커밋 전 tsc 훅**(`.claude/settings.json` PreToolUse): `git commit` 시 `myPokemon_AJ`에서 `tsc --noEmit`, 타입에러면 커밋 차단(리포루트=`git rev-parse`라 PC무관).
- AGENTS.md §4에 검증 워크플로(변경→`/verify`→`/code-review`→커밋).

## C. 연구소(LabScene) 전면 재작성 — 오늘 핵심
- **Map157 실제 내부맵 추출**: `tools/ar-map` 로직 재사용(AR=D:)해 `public/assets/world/oak_lab.png`+`oak_lab.json`. 검정 void 여백 크롭→13×14. 스폰(6,12)/출구(6,13)→마을(28,15).
- **LabScene = 실내 타일맵+격자이동/충돌** 로 재작성(기존 사각형 배경 폐기). 오박사(8,3)·네모(11,3)·**스타팅 3마리를 초록탁자(8~9,4) 위에** 올림. 걸어가 탁자앞 Space→◀▶ 살펴보기(머리 위 `[타입]이름` 표)→예/아니오. **실제 포켓몬게임 방식(FRLG/SV 검색확인): 도감설명·박사낭독 없음.**
- **공용 대화창 `src/ui/DialogBox.ts` 신규** — 집/인트로와 텍스트박스 통일(그동안 LabScene만 자체구현이라 튀던 것). InteriorScene의 HGSS 대화창을 컴포넌트화.
- **공식 데이터 교정**(사용자 격노 반영): 물스타팅 **개구마르=Froakie #656**(내가 Sobble=울머기#816 넣었던 것 교체), 이름 **나오하**(냐오하 아님). 도감/분류 PokeAPI 공식.
- **스프라이트 정렬 함정**: Front 프레임크기 제각각(파이리42/나오하·개구마르96px) → 픽셀스캔(frontMetrics)으로 내용경계 측정해 크기통일+발정렬. `getBounds`는 투명여백 포함이라 이름표 위치엔 실측값 사용.
- **검증**: playwright 전구간 OK(개구마르 선택→파티 id656→출구→마을), 콘솔에러 0. DebugMenu 9번 진입.

## ⚠️ 다음 세션 1순위 (남은 것)
1. **집 거실이 잘못된 맵** — 현재 `Map67`('House'=화산섬 민가!)인데 진짜 주인공집은 **`Map154 레드의집`**(계단12,4↔방155·11,3 / 출구7,11→마을17,8). rooms.json+InteriorScene 교체. ⚠️충돌격자 재작성 주의(`collision-grid-from-raw-png` 규칙).
2. 정식 마을 타일맵 다듬기 · 건물 충돌.
3. 파티→배틀 연결(BattleScene 데모), save.ts에 playerParty 반영.
4. 연구소 폴리시 여지: 탁자 위 포켓몬 위치/크기·이름표 톤(사용자 피드백 대기).

## 이관/동기화
- 코드·에셋·AGENTS.md·작업일지 = **git 커밋**(다음 세션/PC는 pull). memory(홈 `.claude`, 깃X)는 바탕화면 `PokemonWith_이관_0704/memory/`에 최신 사본 갱신.
- 갱신 memory: `starter-lab-flow`(연구소 완성반영), `research-official-before-building`(신규·공식검증 교훈), `ask-check-with-localhost-url`(신규·확인요청시 주소동봉), MEMORY.md 색인.
