#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AR 원본 UI 에셋(가방·도감)을 "타이틀 화면의 차분한 파스텔 톤"으로 리컬러한다.

왜 이렇게 하나:
  - UI의 구조(프레임·격자·슬라이더·탭·질감)는 원본이 압도적으로 완성도가 높다 → 그림은 손대지 않는다.
  - 대신 색만 바꾼다. 원본은 DS 정품 채도(쨍한 빨강/주황)라 우리 타이틀(연하늘·라벤더·연분홍·크림)과 안 어울린다.
  - 픽셀 배치는 1픽셀도 안 건드리므로 좌표 재현(UI_Bag/UI_Pokedex 좌표)이 그대로 유효하다.

변형 3종:
  pastel — 원본 색상(hue)은 유지하고 채도만 낮추고 밝기를 올린다(쨍한 빨강 → 은은한 로즈).
  sky    — 타이틀의 하늘/라벤더 계열로 색상까지 통일하고, 커서만 연분홍으로 남겨 눈에 띄게 한다.
  cream  — 바탕은 따뜻한 크림, 포인트는 어나더레드 특유의 빨강(톤다운한 벽돌빨강). 커서·슬라이더·헤더 띠가 빨강.

출력: public/assets/ui/bag/{pastel,sky,cream}/*.png , public/assets/ui/pokedex/{pastel,sky,cream}/*.png
사용: cd myPokemon_AJ && python3 tools/ui-pastel.py
"""
import colorsys
import os

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "ui"))

# 리컬러할 파일 (그 외 아이콘·타입 아이콘은 원본 그대로 쓴다)
#  ⚠️ 가방 그림(bag_N)은 건드리지 않는다 — 리컬러했더니 배경에 묻히거나 갈색 가방이 돼서 이상해졌다(사용자 지적).
#     원본 흰·파란 백팩 그대로 둔다.
BAG_FILES = ["bg_1", "bg_2", "bg_3", "cursor", "icon_pocket", "icon_slider"]
DEX_FILES = ["bg_list", "bg_info", "cursor_list", "icon_slider"]

# sky 변형에서 파일별 목표 색상(hue, 0~1). None = 원래 색상 유지.
SKY_HUE = {
    "bg_1": 0.58, "bg_2": 0.58, "bg_3": 0.58,     # 가방 배경 = 연하늘
    "bg_list": 0.58, "bg_info": 0.58,             # 도감 배경 = 연하늘
    "cursor": 0.93, "cursor_list": 0.93,          # 커서만 연분홍(선택이 눈에 띄어야 함)
    "icon_slider": 0.62,                          # 슬라이더 = 라벤더
    "icon_pocket": None,                          # 포켓 탭은 포켓별 색 구분이 정보라 색상 유지
}


# cream 변형에서 "통째로 빨강 포인트"로 남길 파일 (선택 커서·슬라이더는 눈에 띄어야 한다)
CREAM_ALL_RED = {"cursor", "cursor_list", "icon_slider"}
CREAM_HUE = 0.135          # 파스텔 옐로우 쪽 크림 (0.105=주황기 아이보리 → 0.135=노란기)
RED_HUE = 0.005            # 어나더레드 특유의 빨강(살짝만 눌러 진하게 남긴다)
# ⚠️ 회색기가 사라지지 않던 진짜 이유 = **어두운 픽셀(외곽선·격자선·그림자)이 무채색 회색으로 남아** 있었기 때문.
#    아무리 밝은 면을 노랗게 해도 선이 회색이면 화면 전체가 회색으로 읽힌다.
#    → cream 모드에선 어두운 선까지 '따뜻한 갈색'으로 물들인다(검정 대신 브라운 라인 = 파스텔의 기본).
CREAM_SAT_LIGHT = 0.18     # 밝은 면(패널 안쪽) — 파스텔 옐로우
CREAM_SAT_MID = 0.24       # 중간 밝기(격자선·음영)
CREAM_SAT_DARK = 0.45      # 어두운 선(외곽선) → 갈색
# ⚠️ 회색기가 계속 남던 이유(3번째 수정): 채도만 올리고 밝기를 '비율'로 올리면 원본의 중간 회색(하단 설명바·
#    선반)이 v≈0.55 → 결과 v≈0.75 + 채도 0.36 = **카키/올리브**가 된다. 노란색이 아니라 '탁한 회녹색'으로 읽힘.
#    → 밝기를 아예 위쪽 구간(0.74~1.0)으로 **압축**한다. 모든 면이 밝은 파스텔 옐로우가 되고 회색기가 사라진다.
CREAM_LIFT = (0.26, 0.74)  # v2 = v*0.26 + 0.74


def is_reddish(hh: float) -> bool:
    return hh < 0.035 or hh > 0.955


# ── cream 모드의 도감 규칙 (사용자 확정) ─────────────────────────────
#  가방 = 파스텔 옐로우 크림.  도감 = **AR처럼 흰 바탕 + 빨강 포인트**.
#  ⚠️ 빨강 포인트를 '자리별로 절반은 브라운'으로 바꿨더니 화면이 좌=브라운 / 우=빨강으로 갈려 촌스러웠다(사용자 지적).
#     → 빨강은 원본처럼 **일관되게 전부 빨강**으로 두고, 크림·브라운은 '면과 선'으로 섞는다:
#        · 흰 면(패널·격자) → 아주 옅은 크림(아이보리)
#        · 검정 외곽선·격자선 → 따뜻한 브라운 (검정을 쓰면 차갑고, 이게 빨강과 크림을 이어준다)
BROWN_HUE, BROWN_SAT = 0.075, 0.42     # 선(외곽선·격자)에 쓰는 브라운
DEX_CREAM_SAT = 0.11                   # 흰 면에 얹는 크림기(아주 옅게 — 바탕은 '흰색'이어야 한다)


def recolor(im: Image.Image, mode: str, name: str, folder: str = "bag") -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    target = SKY_HUE.get(name) if mode == "sky" else None
    dex_cream = mode == "cream" and folder == "pokedex"    # 도감 = 흰 바탕 + 빨강/브라운 포인트
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if dex_cream:
                # 도감 = AR처럼 흰 바탕 + 빨강 포인트. 크림/브라운은 '면과 선'으로만 섞는다.
                if vv <= 0.35 and ss <= 0.25:                    # 검정 외곽선·격자선 → 따뜻한 브라운
                    hh2, ss2, vv2 = BROWN_HUE, BROWN_SAT, min(1.0, vv * 0.85 + 0.16)
                elif vv <= 0.35:
                    hh2, ss2, vv2 = hh, ss, vv
                elif ss <= 0.12:                                 # 흰 면·격자 → 아주 옅은 아이보리(바탕은 흰색 유지)
                    hh2, ss2, vv2 = 0.11, min(DEX_CREAM_SAT, ss * 0.4 + 0.08), min(1.0, vv * 0.97 + 0.04)
                elif is_reddish(hh) or name in CREAM_ALL_RED:    # 빨강 = AR 그대로, 전 화면 일관되게
                    hh2, ss2, vv2 = RED_HUE, min(0.85, ss * 0.95), vv
                else:
                    hh2, ss2, vv2 = hh, ss, vv                   # 그 외(아이콘 등)는 원본 그대로
            elif vv <= 0.35 and mode == "cream" and name != "icon_pocket" and ss <= 0.25:
                # 어두운 무채색 선(외곽선·격자·그림자) → 회색으로 두면 화면이 회색으로 읽힌다. 따뜻한 갈색으로.
                hh2, ss2, vv2 = CREAM_HUE - 0.02, CREAM_SAT_DARK, min(1.0, vv * 0.8 + 0.22)
            elif vv <= 0.35:
                # 어두운 외곽선 — 완전 검정 대신 살짝 띄운 슬레이트로(파스텔은 검정 대비가 강하면 튄다)
                hh2, ss2, vv2 = hh, ss * 0.35, min(1.0, vv * 0.9 + 0.14)
            elif mode == "cream" and name != "icon_pocket":   # 포켓 탭 아이콘은 색이 곧 정보 → 크림으로 덮지 않고 아래 파스텔 처리
                # 크림 + 빨강 포인트.
                #  - 원래 빨간 픽셀(도감 헤더 띠·커서 등) → 채도만 낮춘 벽돌빨강으로 남긴다(= AR의 인상).
                #  - 파랑/초록 등 '차가운' 픽셀 → 크림으로 덮지 않는다. 이 색은 대개 아이콘(가방 배경에 구워진
                #    포켓 탭 아이콘이 대표) = 정보다. 크림으로 칠하면 아이콘이 배경에 묻혀 사라진다.
                #  - 나머지 따뜻한 면(주황·분홍 배경 등) → 크림으로 갈아끼운다.
                #  - 회색/흰색(패널 안쪽·격자)은 살짝 따뜻하게만.
                if ss <= 0.12:      # 무채색(패널 안쪽 흰 면·격자·회색 띠) → 밝은 아이보리로
                    hh2 = CREAM_HUE
                    ss2 = CREAM_SAT_LIGHT if vv > 0.80 else CREAM_SAT_MID
                    vv2 = min(1.0, vv * CREAM_LIFT[0] + CREAM_LIFT[1])
                elif name in CREAM_ALL_RED or is_reddish(hh):   # 빨강 = 포인트. 파스텔이라도 이건 살려야 인상이 남는다
                    hh2, ss2, vv2 = RED_HUE, min(0.78, ss * 0.85), min(1.0, vv * 0.9 + 0.07)
                elif 0.35 < hh < 0.75 and ss > 0.35:         # '진짜' 파란 아이콘(포켓 탭 등)만 색상 유지 = 정보
                    hh2, ss2, vv2 = hh, ss * 0.75, min(1.0, vv * 0.9 + 0.06)
                    # ⚠️ 예전엔 채도 조건이 없어서 회청색(슬라이더 화살표 같은 '거의 회색')까지 파랑으로 남았다.
                    #    그게 크림 화면에서 회끼로 읽혔다. 채도 낮은 차가운 색은 아래 크림 분기로 내려간다.
                else:                                        # 따뜻한 면(주황·분홍 배경) → 크림
                    hh2, ss2, vv2 = CREAM_HUE, min(0.30, ss * 0.3 + 0.14), min(1.0, vv * 0.45 + 0.50)
            else:
                ss2 = ss * 0.42                       # 채도 확 낮춤 = 파스텔의 핵심
                vv2 = min(1.0, vv * 0.72 + 0.30)      # 밝기 올림
                # sky 변형: 색이 있는 픽셀만 목표 색상으로 끌어온다(회색 픽셀은 그대로)
                hh2 = target if (target is not None and ss > 0.12) else hh
            r2, g2, b2 = colorsys.hsv_to_rgb(hh2, ss2, vv2)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return im


def run(folder: str, files: list[str]) -> None:
    src_dir = os.path.join(ROOT, folder)
    for mode in ("pastel", "sky", "cream"):
        out_dir = os.path.join(src_dir, mode)
        os.makedirs(out_dir, exist_ok=True)
        for name in files:
            src = os.path.join(src_dir, name + ".png")
            if not os.path.exists(src):
                print("  (없음)", src)
                continue
            recolor(Image.open(src), mode, name, folder).save(os.path.join(out_dir, name + ".png"))
        print(f"  → {folder}/{mode}/ ({len(files)}장)")


if __name__ == "__main__":
    print("AR UI 에셋 파스텔 리컬러:", ROOT)
    run("bag", BAG_FILES)
    run("pokedex", DEX_FILES)
    print("완료. (새 폴더를 만들었으니 dev 서버 재시작 필요 — 안 그러면 png가 text/html로 응답한다)")
