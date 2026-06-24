---
name: home-bonus-system
description: 집 꾸미기와 포켓몬 컨디션·배틀 보너스 연결을 만들 때 사용. house, furniture, decoration, condition, homeBonus, battle bonus, HouseScene 관련 작업. "집 꾸미기랑 배틀 보너스 연결해줘", "가구 효과", "컨디션 올리기" 같은 요청에 발동.
---

# 집 꾸미기 → 컨디션 → 배틀 보너스 (이 게임의 차별점)

> 작업 전 `myPokemon_AJ/AGENTS.md` §1(차별점)을 먼저 읽는다. 이게 이 프로젝트의 "내 색"이다.

## 핵심 개념
집 꾸미기는 단순 장식이 아니라 포켓몬 **컨디션**을 올리고, 그게 **배틀**로 이어진다.
예: 불꽃 포켓몬을 벽난로 옆에서 재우면 컨디션 ↑ → 배틀에서 더 강함.

## 역할 분리
- **가구/배치 데이터**: `src/data/furniture.ts`, `src/data/HouseLayout.ts`.
- **보너스 계산**: `src/systems/homeBonus.ts` (가구 + 포켓몬 타입/성격/컨디션 → 보너스 값).
- **화면**: `src/scenes/HouseScene.ts` — 배치·표시·입력 중심. 계산은 systems에서.

## 연결 절차
1. 가구 ↔ 효과 매핑을 `furniture.ts`에 데이터로 정의(가구 종류, 영향 주는 포켓몬 타입/성격, 컨디션 증가량).
2. `homeBonus.ts`에서 현재 배치(`HouseLayout`) + 파티 포켓몬을 읽어 컨디션/보너스를 계산하는 **순수 함수**로 작성.
3. 배틀 시스템(`turn-battle-system`)은 이 보너스를 **읽기만** 한다 — 어떤 필드를 어떻게 읽는지 인터페이스를 명확히.
4. 보너스 결과는 저장 대상이면 `save-state-system`의 `houseLayout`/progress에 반영.

## 체크리스트 / 검증
- 가구 효과는 데이터로(하드코딩 분기 최소화), 새 가구 추가가 쉬워야 함.
- 타입/성격/컨디션 → 보너스 규칙을 한국어 주석으로 설명.
- `npx tsc --noEmit` 후 HouseScene에서 배치 변경 → 배틀에서 보너스 반영되는지 플레이 확인.
