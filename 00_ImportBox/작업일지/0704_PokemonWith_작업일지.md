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
