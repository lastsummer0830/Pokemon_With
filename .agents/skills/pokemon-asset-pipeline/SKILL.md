---
name: pokemon-asset-pipeline
description: 픽셀 게임 에셋을 근거와 라이선스를 확인해 이식한다.
version: 1.0.0
platforms: [linux, windows]
metadata:
  hermes:
    tags: [pokemon-with, assets, pixel-art, provenance]
---

# Pokemon Asset Pipeline

게임에 실제 사용할 픽셀 에셋을 출처·용도·라이선스·렌더 결과와 함께 선택하고 최소 범위로 이식한다.

## When to Use
- 포켓몬·트레이너·맵·UI·애니메이션·오디오 에셋을 추가하거나 교체할 때.
- 후보 소스를 비교하거나 CORS·atlas·sprite sheet 문제를 고칠 때.
- 원본과 픽셀 차이만 비교할 때는 `ar-compare`를 사용한다.

## Required Inputs
- `usage`: 인게임, UI, 타이틀, reference 중 용도.
- `subject`: 필요한 종·캐릭터·맵·효과.
- `sources`: 사용자 제공 경로 또는 조사할 승인된 소스.
- `acceptance`: 크기·프레임·팔레트·라이선스·화면 조건.

## Procedure
1. `myPokemon_AJ/AGENTS.md`와 현재 loader를 읽어 픽셀 전용 범위와 실제 파일 형식을 확인한다.
2. `references/asset-sources.md`를 시작점으로 최대 3개 실물 후보를 비교하고 출처·라이선스·용도를 기록한다.
3. 외부 설치 경로를 추정하지 말고 사용자 제공 경로나 검색으로 확인한다.
4. 선택 전 후보는 `01_Resources/Pick/<category>/`에 설명 파일명과 몽타주로 둔다.
5. 승인된 파일만 `public/assets/`의 현재 loader 경로에 넣고 대량 import 결과를 그대로 남기지 않는다.
6. GIF·atlas·sprite sheet의 frame 규칙과 WebGL 최대 texture 크기를 실제 이미지 치수로 확인한다.
7. 도트 텍스처에만 `NEAREST`를 적용하고 현재 loader에서 HTTP 200과 올바른 content type을 확인한다.
8. `build-run-debug`으로 실제 scene 렌더와 console을 검증한다.

## Cost Limits
- 후보 최대 3개, 적용 에셋 1종 또는 한 묶음.
- 대량 다운로드·전체 원본 import·패키지 설치는 별도 승인 대상.
- 캡처 최대 3장.

## Verification
- 출처 URL/경로, 라이선스, 선택 이유와 파일 목록을 기록한다.
- 이미지 치수·프레임 수·대소문자와 loader key를 확인한다.
- renderer에서 흐림·깨짐·잘못된 crop·누락을 직접 확인한다.
- console/page error와 `npm run build` 결과를 기록한다.

## Pitfalls
- Data 추출 가능 여부와 Graphics 에셋 사용 가능 여부를 섞지 않는다.
- 매끈한 공식 artwork를 인게임 픽셀 대체물로 사용하지 않는다.
- 사용자가 고르기 전 후보를 runtime 에셋으로 확정하지 않는다.
