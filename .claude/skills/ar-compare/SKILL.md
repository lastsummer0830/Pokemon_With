---
name: ar-compare
description: 원본(Another Red) 에셋·화면과 내 게임 캡처를 픽셀 단위로 자동 대조한다. "원본이랑 비교", "AR이랑 똑같은지", "픽셀 비교", "시각 대조", 에셋 이식·타일·스프라이트·UI 재현 검증 요청 시 발동. 눈대중 비교 금지 — 반드시 이 파이프라인으로.
---

# AR 원본 자동 대조 파이프라인

"똑같다/재현됐다"는 **이 절차의 수치+합성이미지를 본 뒤에만** 말할 수 있다.

## 절차
1. **내 화면 캡처**: dev 서버(`npm run dev`, :5180) 켠 상태에서 `tools/shot-*.mjs`(내부적으로 `tools/_snap.mjs`의 headed+렌더러 snapshot 사용. page.screenshot 금지=검은 화면).
2. **원본 준비**: `D:\Pokemon Another Red_PWT_250829`(WSL: `/mnt/d/Pokemon Another Red_PWT_250829`)의 에셋 PNG, 또는 조아진이 준 원본 스크린샷.
3. **대조 실행**:
   node tools/imgdiff.mjs <내캡처.png> <원본.png> ../.claude/.verify/compare_<이름>.png
   출력 JSON: diffPct(차이 픽셀 %), avgBrightness(15 미만이면 무효 캡처), sizeMatch, 합성 PNG(왼쪽=내것 | 가운데=원본 | 오른쪽=차이 히트맵·빨강=다름).
4. **합성 PNG를 Read로 직접 보고** 어디가 다른지 구체적으로 나열(색·위치·크기·빠진 요소).
5. 보고 형식: diffPct N% / 주요 차이 1,2,3 / 다음 수정. captureValid:false면 결과 무효 → 캡처부터 다시.

## 주의
- 크기가 다르면(sizeMatch:false) 겹치는 영역만 비교됨 — 스케일 차이인지 먼저 확인.
- 스프라이트 등 투명 배경 PNG는 알파 차이도 diff에 잡힘(의도된 동작).
- 도구는 의존성 0(순수 node), 2026-07-09 RGB·팔레트·그레이 PNG로 정확성 검증됨.
