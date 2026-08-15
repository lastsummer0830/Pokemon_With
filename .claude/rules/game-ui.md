---
paths:
  - "**/src/scenes/TitleScene.ts"
  - "**/src/scenes/IntroScene.ts"
  - "**/src/scenes/LabScene.ts"
  - "**/src/scenes/GymScene.ts"
  - "**/src/scenes/BattleScene.ts"
  - "**/src/scenes/battleView.ts"
  - "**/src/scenes/MenuScene.ts"
  - "**/src/scenes/MainMenuScene.ts"
  - "**/src/scenes/BagScene.ts"
  - "**/src/scenes/PokedexScene.ts"
  - "**/src/scenes/SummaryScene.ts"
  - "**/src/scenes/OptionsScene.ts"
  - "**/src/scenes/KeyConfigScene.ts"
  - "**/src/scenes/SaveSlotScene.ts"
  - "**/src/ui/*.ts"
  - "**/public/assets/ui/**"
---

# 게임 UI 규칙

- 메뉴·HUD·배틀 대화창·저장 UI는 `game-ui-hud-polish` Skill을 사용한다.
- 기억으로 지어내지 말고 승인된 AR/HGSS 에셋·좌표와 실제 Phaser 렌더를 근거로 한다.
- 사용자가 작성한 대사·이름·선택 순서를 요청 없이 바꾸지 않는다.
- look이 갈리면 같은 상태의 renderer 후보 2~3개를 보여주고 선택을 받는다.
- 완료 전 정상 입력, resize, renderer, reference 차이, console, build를 확인한다.
- 비활성 archive hook이나 캡처 파일 존재가 실제 검증을 대신하지 않는다.
