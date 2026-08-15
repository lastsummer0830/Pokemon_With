# QA Contract

## 네 가지 상태는 서로 다르다

| 상태 | 누가 판정 | 근거 |
|---|---|---|
| 기술 PASS | `scripts/validate_asset.py` | 계약된 항목의 측정 결과 |
| 시각 PASS | 사람 | 1× 크기 육안 확인 |
| 사용자 채택 | 사용자만 | 명시적 채택 발언 |
| runtime 검증 | 실제 실행 | 게임 렌더·콘솔·빌드 결과 |

하나를 다른 하나의 근거로 쓰지 않는다. 기술 PASS는 "치수가 계약과 같다"는 뜻일 뿐이다.
검증기는 시각 유사도, DESIGN 정체성 유지, STYLE identity leakage, 사용자 채택, runtime 검증을 절대 PASS로 말하지 않는다. 이 항목들은 항상 `UNVERIFIED`로 나온다.

## 상태 전이

```text
UNAPPROVED_DRAFT → GAME_READY_UNAPPROVED_DRAFT → APPROVED_ASSET → RUNTIME_VERIFIED
```

- `UNAPPROVED_DRAFT`: 생성만 된 결과.
- `GAME_READY_UNAPPROVED_DRAFT`: 기술 PASS + 1× 시각 PASS. 아직 채택 아니다.
- `APPROVED_ASSET`: 사용자가 채택했다. 별도 승인 전에는 runtime에 넣지 않는다.
- `RUNTIME_VERIFIED`: 실제 실행 화면에서 확인했다.

단계를 건너뛰지 않는다. 되돌아간 결과를 다음 시도의 참조·편집 기반으로 쓰지 않는다.

## 시도 한도

- 재료가 실질적으로 다른 생성 시도는 **최대 2회**.
- 2회 실패하면 멈춘다. 새 reference·구도·논리 픽셀 전략을 정하기 전에는 재시도하지 않는다.
- 실패 산출물은 STYLE도 최종 에셋도 편집 기반도 아니다.

## 기술 검증 절차

```text
python3 scripts/analyze_native_pixel.py <candidate.png> [측정 옵션] > analysis.json
python3 scripts/validate_asset.py --analysis analysis.json --contract contract.json
```

- 종료 코드 `0`은 기술 PASS, `1`은 기술 FAIL, `2`는 입력·계약 오류다.
- 계약에 있는 항목인데 측정 JSON에 그 재료가 없으면 오류(`2`)다. 검증기는 재료 없이 PASS를 만들지 않는다.
- 검증기는 이미지와 참조 원본을 열지도 고치지도 않는다. 측정 JSON과 계약 JSON만 읽는다.

## 기계로 확인하는 것

- canvas와 visible bbox.
- alpha family(`opaque` / `binary` / `soft`)가 고른 원본 family와 같은지. binary family에서 반투명 테두리는 실패다.
- frame 수·칸 크기와 프레임별 가시 픽셀.
- 명시한 block size의 논리 격자 균일도.
- 명시한 baseline/anchor.
- 정수배 nearest 미리보기 메타데이터. X·Y 배율이 같아야 한다.
- 명시한 임계값 이하 isolated fragment 수.

## 사람이 확인하는 것

- 1× 크기에서 실루엣·얼굴·손·신발·포즈가 읽히는지.
- DESIGN 잠금: 얼굴 방향과 표정, 머리 실루엣, 비율, 옷과 색 배치, 손, 자세, 신발 방향, 가방·소품 위치.
- STYLE identity leakage 여부.
- 확대 이미지로 판단하지 않는다. 반드시 1×를 본다.

## runtime 검증 (별도 승인 후)

1. 채택된 파일 하나만 `myPokemon_AJ/public/assets/trainers/<KEY>.png` 형태의 현재 loader 경로에 넣는다.
2. 현재 `myPokemon_AJ/src/scenes/BattleScene.ts`의 loader key, 원점, 배율, 클리핑, NEAREST 필터를 확인한다.
3. 음소거 dev 서버로 실제 배틀 또는 DebugMenu에서 재현한다.
4. Phaser renderer 스냅샷을 찍고 console/page error와 `npm run build` 결과를 기록한다.
5. 원본과의 픽셀 대조가 필요하면 `ar-compare`를 쓴다.

이 절차 전에는 `RUNTIME_VERIFIED`라고 보고하지 않는다.
