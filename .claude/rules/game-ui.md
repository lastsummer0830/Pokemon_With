---
paths:
  - "**/scenes/MenuScene.ts"
  - "**/scenes/PartyScene.ts"
  - "**/scenes/BagScene.ts"
  - "**/scenes/BoxScene.ts"
  - "**/scenes/StorageScene.ts"
  - "**/scenes/SummaryScene.ts"
  - "**/scenes/PokedexScene.ts"
  - "**/ui/*.ts"
---

# ⛔ 포켓몬 UI(파티·박스·가방·메뉴·상세) — 지어내기 금지 (STOP 체크리스트)

> 정본: `myPokemon_AJ/AGENTS.md` §1·§4 · 운영계약 §0(단정 전 공식자료 재검증).
> 반복된 분노의 근본원인 = **실제 포켓몬/AR UI를 조사 안 하고 밋밋한 세로 리스트로 지어냄.** 이 파일을 건드리면 아래를 그대로 따른다. (하드 가드: `.claude/hooks/guard-ui-edit.sh` 가 Edit/Write 직전 ask로 세운다.)

1. **AR 실제 UI 에셋을 먼저 본다** — `/mnt/d/Pokemon Another Red_PWT_250829/Graphics/UI/`:
   - `Party/` — 파티 = **2열 스태거드 라운드 패널 그리드**(선두=좌상단 큰 패널) + 하단 취소바. (`bg.png`, `panel_round*`, `overlay_hp*`, 상태별 sel/faint/swap)
   - `Storage/` — 박스 = 상단 박스명(◀ ▶) + 벽지(`box_0~39`) 위 **6×5 아이콘 그리드** + 우측 정보패널 + 잡기 커서(`cursor_grab`).
   - `Bag/` — 가방 = 좌측 포켓(주머니) 탭 + 가방그림 + 우측 아이템 목록(스크롤) + 하단 설명.
   - `Summary/` — 상세 = 좌측 초상+Lv + 우측 스탯패널(HP바+스탯행) + 하단 설명, 상단 초록바.
   - `Ready Menu/` — 스타트/필드 메뉴 버튼.
2. **공식 게임(HGSS 등) 화면과 대조**한다. 기억·추측으로 레이아웃 만들지 말 것.
3. **직접 그리지 말고 AR UI 그래픽을 `public/assets/ui/`로 import해 그 위에 아이콘/텍스트를 얹는다**(§4 에셋규칙). 색만 바꿔 "통으로" 내지 말 것.
4. look이 갈리면 §6.5대로 **Pick에 실제 스샷 후보** 올려 사용자 결정.
5. **만든 뒤 반드시 실제 화면을 렌더링해 눈으로 본다**(추측 "됐다/똑같다" 금지):
   - webapp-testing으로 화면 캡쳐 → **`.claude/.verify/`에 png 저장**.
   - 따라 만들라던 **레퍼런스와 나란히(side-by-side 몽타주)** 놓고 **구체적 차이를 나열**한다. "비슷/똑같다"로 뭉개지 말 것 — 다른 점을 짚어라. (완전 다른데 "똑같다"가 반복 분노의 핵심.)
   - 시각적으로 확실치 않으면 **별도 시각으로 재확인**(fresh-eyes 에이전트에 두 이미지 차이 나열시키기).
   - ⚠️ **하드 게이트:** UI 씬을 고치고 위 캡쳐 증거(`.claude/.verify/*.png`) 없이 턴을 끝내려 하면 **Stop 훅(`enforce-ui-verify.sh`)이 차단**한다. 진짜 시각변화 없는 수정이면 `.claude/.verify/DISABLE` 생성(사유 남기고).
