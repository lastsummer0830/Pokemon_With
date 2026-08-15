# Subtype Technical Contracts

TECHNICAL 계약은 **그 작업에서 고른 exact STYLE 파일의 실측값**으로만 만든다. 아래에 만능 기본값은 없다.

## 만드는 순서

1. subtype 하나와 STYLE 파일 하나를 확정한다.
2. 그 파일을 측정한다. 측정할 항목은 호출자가 명시한다.

```text
python3 scripts/analyze_native_pixel.py <STYLE.png> \
  --block-size <N> --frames <N> --fragment-max-size <N> \
  --baseline-row <Y> --anchor <X>,<Y>
```

3. 출력 JSON의 값을 그대로 계약 JSON에 옮긴다. 반올림하거나 "보기 좋은 수"로 바꾸지 않는다.
4. 측정하지 않은 항목은 계약에 넣지 않는다. 계약에 없는 항목은 검증기가 `UNVERIFIED`로 남긴다.

## 계약 JSON 형태

```json
{
  "schema": "native-pixel-technical-contract/1",
  "canvas": {"width": 0, "height": 0},
  "alpha": {"family": "binary"},
  "visible_bbox": {"left": 0, "top": 0, "right": 0, "bottom": 0},
  "frames": {"count": 1, "columns": 1, "rows": 1,
             "slice_width": 0, "slice_height": 0,
             "min_visible_pixels_per_frame": 1},
  "logical_grid": {"block_size": 0, "min_uniform_ratio": 1.0},
  "baseline": {"row": 0, "max_offset_from_lowest_visible": 0},
  "anchor": {"x": 0, "y": 0, "must_be_visible": true},
  "preview_scaling": {"factor": 1, "filter": "nearest", "width": 0, "height": 0},
  "fragments": {"max_size": 0, "max_count": 0}
}
```

모든 키는 선택이다. 넣은 키만 판정되고 최소 하나는 있어야 한다.

## subtype별로 최소한 채우는 항목

| subtype | 계약에 반드시 들어가는 항목 |
|---|---|
| `character-overworld` | `canvas`, `frames`(grid), `alpha`, `logical_grid` |
| `trainer-front` | `canvas`, `visible_bbox`, `alpha`, `logical_grid`, `baseline` |
| `trainer-back` | `canvas`, `frames`, `alpha`, `logical_grid`, 프레임별 anchor |
| `item` | `canvas`, `visible_bbox`, `alpha` |
| `vs-bar` | `canvas`, `frames`, 색 매핑 표(별도) |
| `vs-portrait-left` / `vs-portrait-right` | `canvas`, `visible_bbox`, `anchor` |
| `vs-composition` | 레이어별 `canvas`와 배치 좌표, 합성 `canvas` |
| `background-removal` | 변경 전후 `canvas`, `visible_bbox`, `alpha` |
| `format-conversion` | `canvas`, `frames`, `alpha`, `preview_scaling` |

## 감사된 표본 (근거이지 기본값 아님)

PWH-006 원본 감사에서 나온 실측값이다. **다른 파일에 적용하지 않는다.**

| 파일 | canvas | alpha | 비고 |
|---|---|---|---|
| Trainer front `Red` | 160×160 | binary | bbox (42,14)–(110,150), 불투명 27색, 정확히 2× 격자 |
| Trainer front `Leaf` | 160×160 | binary | bbox (42,12)–(116,150), 불투명 26색, 정확히 2× 격자 |
| Trainer front `Cynthia` | 128×164 | binary | 18색, 정확히 2× 격자 |
| Trainer front `Bea` | 128×158 | binary | 27색, 정확히 2× 격자 |
| Trainer front `ILLA` / `ILLA2` | 128×145 | soft | 3,456색. Red/Leaf와 평균 내거나 같은 family로 쓰지 않는다 |
| Character 계열 | 128×192 | binary 9 / soft 1 | 10장 중 정확히 2× 격자는 5장뿐 |
| Transitions 계열 | 192×128 / 256×128 / 512×128 | binary | 전부 정확히 2× 격자 |

`Ash`, `NNN`, `Raihan`은 1px/2px가 섞인 family다. 같은 subtype이라는 이유로 한 family로 묶지 않는다.
중복 파일(`ILLA` = `ILLA2` 등)은 독립 표본으로 세지 않는다.

## 권위를 버린 숫자

다음은 **강제 사실이 아니다**. 계약에 상속하지 않는다.

- 모든 Trainer front가 160×160이고 2px라는 규칙.
- Trainer back이 800×160이라는 규칙.
- Item이 48×48이라는 규칙.
- 이전 파이프라인의 팔레트·프레임 수·통계·매니페스트와 그 PASS/승인 라벨.

새 계약을 만들 때마다 실제 파일을 다시 측정한다.
