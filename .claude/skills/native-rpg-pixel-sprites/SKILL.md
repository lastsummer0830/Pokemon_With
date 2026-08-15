---
name: native-rpg-pixel-sprites
description: Another Red 원본 기준 네이티브 픽셀 에셋을 만들고 검증한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, pwh-006, pixel-art, native-sprites, verification]
---

# Native RPG Pixel Sprites

사용자가 요청한 새 디자인을 Another Red 계열 **네이티브 픽셀** 게임 에셋으로 만든다.
한 작업에는 subtype 하나와 exact style family 하나만 쓰고, 모든 수치는 그 작업에서 고른 원본에서 직접 측정한다.
이 Skill의 책임은 입력 계약·측정·기술 검증까지다. 이미지 생성 provider 구현, 게임 loader 수정, runtime 적용은 여기 포함되지 않는다.

- capability 전체: `references/capability-matrix.md`
- DESIGN/STYLE/TECHNICAL 역할 분리: `references/reference-role-contract.md`
- subtype별 TECHNICAL 계약 작성법: `references/subtype-contracts.md`
- 상태·시도 한도·검증 규칙: `references/qa-contract.md`
- 결정론적 측정기: `scripts/analyze_native_pixel.py`
- 결정론적 기술 검증기: `scripts/validate_asset.py`

## When to Use
- 새 캐릭터·트레이너·아이템·VS 연출을 네이티브 픽셀 에셋으로 만들 때.
- 기존 후보 이미지가 실제로 네이티브 픽셀인지 수치로 확인할 때.
- 원본과 게임 렌더의 픽셀 차이만 비교할 때는 `ar-compare`를 쓴다.
- 출처·라이선스·이식 경로가 주제일 때는 `pokemon-asset-pipeline`을 쓴다.
- 실제 실행·렌더 확인이 필요할 때는 `build-run-debug`을 쓴다.

## Required Inputs
- `subtype`: `references/capability-matrix.md`의 항목 **하나**.
- `design`: 사용자가 지정한 DESIGN 이미지 또는 설명. 성별로 자동 선택하지 않는다.
- `style`: 사용자·감독이 고른 exact 원본 파일 **하나**. 그 파일이 style family를 정의한다.
- `technical`: 위 style 파일을 `scripts/analyze_native_pixel.py`로 측정해 만든 계약 JSON.
- `authorization`: 이미지 생성·runtime 적용은 각각 별도 승인이며 기본값은 미승인이다.

## Procedure
1. subtype 하나를 확정하고 `references/capability-matrix.md`에서 그 항목의 산출물 형태를 확인한다.
2. `references/reference-role-contract.md`대로 DESIGN·STYLE·TECHNICAL을 분리하고, 어느 쪽에서 무엇을 가져오는지 문서에 적는다.
3. 고른 exact style 파일을 `scripts/analyze_native_pixel.py`로 측정한다. block size·frame·baseline·anchor·fragment 임계값은 호출자가 명시한다.
4. `references/subtype-contracts.md`대로 측정값에서 TECHNICAL 계약 JSON을 만든다. 다른 파일이나 과거 파이프라인의 숫자를 상속하지 않는다.
5. 생성 승인이 있을 때만 DESIGN + STYLE 한 장으로 후보를 만든다. 최대 2회이며 실패한 산출물은 참조·편집 기반이 되지 않는다.
6. 후보를 다시 `scripts/analyze_native_pixel.py`로 측정하고 `scripts/validate_asset.py`에 계약과 함께 넣어 기술 판정을 받는다.
7. 기술 PASS 후 1× 크기로 육안 확인하고, 사용자 채택 여부를 따로 묻는다.
8. runtime 적용은 별도 승인 뒤 `pokemon-asset-pipeline`과 `build-run-debug` 계약으로 진행한다.

## Cost Limits
- 한 작업에 subtype 1개, style family 1개, TECHNICAL 계약 1개.
- 재료가 다른 생성 시도는 최대 2회. 2회 실패면 멈추고 새 reference/구도/논리픽셀 전략을 다시 정한다.
- 1× 확인 이미지는 최대 3장, 확대 미리보기는 정수배 nearest만 쓴다.
- 대량 변환·전수 재생성·패키지 설치는 이 Skill의 범위가 아니다.

## Verification
- `scripts/analyze_native_pixel.py`로 canvas·alpha·bbox·색 수·논리 격자·run·cluster·contour·fragment·frame을 측정한다.
- `scripts/validate_asset.py`가 계약된 항목만 PASS/FAIL로 판정하고, 계약에 없는 항목은 `UNVERIFIED`로 남긴다.
- 기술 PASS, 1× 시각 PASS, 사용자 채택, runtime 검증은 서로 다른 네 가지 상태다. 하나를 다른 하나의 근거로 쓰지 않는다.
- 상태는 `UNAPPROVED_DRAFT` → `GAME_READY_UNAPPROVED_DRAFT` → `APPROVED_ASSET` → `RUNTIME_VERIFIED` 순서로만 올라간다.
- 판정 근거는 실제 파일 경로·측정 JSON·검증 JSON으로 남긴다.

## Pitfalls
- 여성이라서 Leaf, 남성이라서 Red를 style로 고르지 않는다. 성별·이름은 style 선택 근거가 아니다.
- STYLE 원본의 머리·옷·색·시그니처 포즈가 결과에 새어 들어오는 identity leakage는 치수가 맞아도 실패다.
- 서로 다른 family의 canvas·팔레트·alpha·bbox를 평균 내지 않는다. 고정된 만능 치수는 존재하지 않는다.
- 고해상도 그림을 축소·양자화한 결과를 네이티브 픽셀이라고 부르지 않는다.
- 측정하지 않은 값을 계약에 적지 않는다. 검증기가 재료 없이 PASS를 만들지 않는다.
- 기술 검증기의 PASS를 시각 승인·사용자 채택·runtime 검증으로 보고하지 않는다.
