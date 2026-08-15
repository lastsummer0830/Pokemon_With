# Reference Role Contract

참조 이미지는 역할이 셋이고 서로 섞이지 않는다. 어떤 파일이 어느 역할인지 작업 시작 시 문서에 적는다.

## DESIGN
사용자가 원하는 대상 자체.

- 얼굴, 머리 실루엣, 옷과 색 배치, 표정, 체형, 포즈, 가방·소품, 신발.
- 출처는 사용자가 지정한 이미지 또는 설명이다. 감독이 임의로 고르지 않는다.
- DESIGN은 픽셀 규칙을 정의하지 않는다. DESIGN이 매끈한 그림이어도 그 해상도·색 수를 목표로 삼지 않는다.

## STYLE
Another Red 원본 **한 장**.

- 논리 픽셀 격자, cluster 리듬, contour 계단, 명암 단계 수, 팔레트 운용, 네이티브 마감.
- 큐레이트된 원본 루트는 `/mnt/c/Users/ONE/Desktop/각폴더별참조`이며 읽기 전용이다. 원본을 수정하지 않는다.
- 고른 파일 하나가 그 작업의 style family를 정의한다. 두 장을 섞거나 평균 내지 않는다.
- 선택 근거는 포즈·실루엣·픽셀 family 적합성이다.

## TECHNICAL
정확한 출력 규격.

- canvas, frame/cell, alpha class, bbox, baseline/anchor, 좌우, crop, 배치.
- 출처는 STYLE로 고른 exact 파일의 실측값이다. `scripts/analyze_native_pixel.py` 결과에서만 만든다.
- TECHNICAL 자료는 생성 입력에 넣지 않는다. 필요할 때만 최소로 쓴다.

## 금지 규칙

- 대상이 여성이라 Leaf를, 남성이라 Red를 STYLE로 고르는 자동 매핑을 하지 않는다. 성별·이름은 근거가 아니다.
- STYLE 캐릭터의 정체성(머리·옷·색·시그니처 포즈)이 결과에 들어오는 identity leakage는 실패다. 치수가 맞아도 실패다.
- 서로 다른 family의 canvas·팔레트·alpha·bbox를 평균 내지 않는다.
- 고해상도 이미지를 축소·양자화한 결과를 네이티브 픽셀이라고 부르지 않는다.
- 한 작업에 subtype 하나, style family 하나를 넘기지 않는다.
- 실패한 산출물을 STYLE·최종 에셋·편집 기반으로 승격하지 않는다.

## 생성 입력 경계

- 생성 입력은 DESIGN + STYLE 한 장이다.
- provider별 생성 구현은 이 Skill에 없다. 어떤 provider를 쓰든 위 역할 분리와 시도 한도는 동일하다.
- 게임 loader 변경과 runtime 쓰기는 이 Skill의 동작이 아니다.
