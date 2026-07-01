---
name: phaser-scene-builder
description: Phaser Scene을 새로 만들거나 씬 구조·전환을 정리하는 스킬. TitleScene·WorldScene·BattleScene·HouseScene·IntroScene, preload·create·update, input·camera, scene transition, scale resize. 트리거 예: "새 씬 만들어줘", "씬 전환 붙여줘", "화면 넘어가게 해줘", "OO씬 추가해줘".
---

# Phaser Scene 빌더

> 작업 전 `myPokemon_AJ/AGENTS.md` §3·§5를 먼저 읽는다.

## 위치 & 등록
- Scene 파일: `src/scenes/` (`Phaser.Scene` 상속). 게임 설정/씬 등록은 `src/main.ts`.
- 현재 씬: Title / World / Battle / House.

## 규칙
- **데이터·계산 로직을 Scene에 과하게 넣지 않는다.** 계산은 `src/systems/`, 타입/데이터는 `src/data/`, 외부 소스는 `src/api/`. Scene은 화면·입력·연출 담당.
- 화면은 `Scale.RESIZE`로 창을 꽉 채운다. **좌표는 `this.scale.width/height` 기준 비율 배치**(절대 픽셀 하드코딩 지양).
- `preload`에서 에셋 로드(경로는 `"assets/..."`), `create`에서 배치, `update`에서 프레임 로직.
- 도트 텍스처는 필요 시 개별 `setFilter(Phaser.Textures.FilterMode.NEAREST)`. 전역 `pixelArt`는 켜지 않는다.
- 씬 전환은 `this.scene.start/launch`로. 리사이즈 대응은 `scale` resize 이벤트에서 좌표 재계산.

## 체크리스트
- 새 씬은 `main.ts`에 등록했는가.
- 입력 핸들러 정리(씬 종료 시 리스너 누수 없게).
- any 남발 금지, 한국어 주석.

## 검증
- `npx tsc --noEmit` → `npm run dev` → 씬 전환·리사이즈 직접 확인.
