#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
텍스트박스 후보 미리보기 — 인게임 1:1 재현.

게임 IntroScene.layout()/drawBox()/applySpeaker() 의 실제 수치를 그대로 박는다.
( 박스: min(창*0.92,1100) x max(창*0.24,140), font=max(18,round(h*0.16)),
  모서리 18/14/11 고정, 이름탭 plateH=round(font*1.7) ... )

따라서 결과 박스 비율·폰트크기·테두리 두께가 실제 화면과 동일하다.
박스는 ×3 슈퍼샘플로 모서리만 부드럽게, Galmuri11 픽셀폰트는 1x로 또렷하게.

usage: python3 render.py [out.png]
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT_DIR = os.path.join(ROOT, "public", "assets", "fonts")
OUT_DEFAULT = os.path.abspath(os.path.join(
    ROOT, "..", "01_Resources", "Pick", "_적용미리보기", "텍스트박스후보_실제렌더.png"))

# --- 인게임 기준 창 크기(1280x720 가정) 기준 실제 박스 수치 ---
WIN_W, WIN_H = 1280, 720
BOX_W = min(int(WIN_W * 0.92), 1100)          # = 1100
BOX_H = max(int(WIN_H * 0.24), 140)           # = 172
PAD   = round(BOX_H * 0.16)                    # = 28
FONT  = max(18, round(BOX_H * 0.16))          # = 28  (본문/이름 동일)
SS = 3                                         # 박스 슈퍼샘플
SCALE_OUT = 0.6                                # 최종 몽타주 축소(가독성)

BODY = "…! 드디어 깨어났구나!"
NAME = "오박사"

def C(hexv):
    h = hexv.lstrip("#")
    if len(h) == 6: h += "ff"
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4, 6))

# 게임 drawBox 색을 일반화한 후보들.
#   border=외곽, fill=채움, inner=내부스트로크, text=본문색, nameTxt=이름색
#   tab=(이름탭 border, fill)  None이면 (border, fill) 사용
#   r=(외곽,채움,스트로크) 반경  / innerW=스트로크 두께
GAME_R = (18, 14, 11)
CANDS = [
    ("1. 현재(크림+남색)  ★적용중", dict(
        border="#f6efd8", fill="#21314f", inner="#4a6aa5", text="#ffffff",
        nameTxt="#ffe27a", r=GAME_R, innerW=2)),
    ("2. 각진 픽셀테두리", dict(
        border="#1a2740", fill="#2a3c5e", inner="#5878b0", text="#ffffff",
        nameTxt="#ffe27a", r=(2, 2, 1), innerW=3)),
    ("3. HGSS풍 밝은박스", dict(
        border="#3b5a98", fill="#eaf2ff", inner="#9fc0ef", text="#21314f",
        nameTxt="#21314f", tab=("#3b5a98", "#cfe0fb"), r=(16, 12, 9), innerW=2)),
    ("4. 모던 반투명 검정", dict(
        border="#d8d8d8", fill="#262830", inner="#7a7d88", text="#ffffff",
        nameTxt="#ffe27a", r=(14, 10, 8), innerW=2)),
    ("5. 이중 금테 크림", dict(
        border="#c98a3c", fill="#21314f", inner="#f3e4c8", text="#ffffff",
        nameTxt="#ffe27a", r=GAME_R, innerW=3)),
    ("6. 진남색+금테 얇게", dict(
        border="#e7c46a", fill="#1b2a47", inner="#e7c46a", text="#ffffff",
        nameTxt="#ffe27a", r=(14, 10, 8), innerW=2)),
]

def font(px):
    return ImageFont.truetype(os.path.join(FONT_DIR, "Galmuri11.ttf"), px)

def rrect(draw, box, r, fill=None, outline=None, width=1):
    if r <= 0:
        draw.rectangle(box, fill=fill, outline=outline, width=width)
    else:
        draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def render_tile(c):
    """이름탭 오버행 포함, 인게임 1:1 박스 타일(RGBA)."""
    overhang = round(FONT * 1.7)               # 이름탭이 박스 위로 솟는 높이
    W = BOX_W + 12
    H = BOX_H + overhang + 12
    bx, by = 0, overhang                        # 박스 좌상단(타일 내)

    s = SS
    lyr = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(lyr)
    ro, rf, ri = (v * s for v in c["r"])
    x, y, w, h = bx * s, by * s, BOX_W * s, BOX_H * s

    # 게임 drawBox 와 동일한 레이어/오프셋
    rrect(d, [x+4*s, y+6*s, x+4*s+w, y+6*s+h], ro, fill=(0, 0, 0, 90))           # 그림자
    rrect(d, [x, y, x+w, y+h], ro, fill=C(c["border"]))                          # 외곽
    rrect(d, [x+5*s, y+5*s, x+w-5*s, y+h-5*s], rf, fill=C(c["fill"]))            # 채움
    rrect(d, [x+9*s, y+9*s, x+w-9*s, y+h-9*s], ri,                               # 내부 스트로크
          outline=C(c["inner"]), width=c["innerW"] * s)

    # 이름탭(applySpeaker: plateH=round(font*1.7), px=x+18, py=y-plateH+8)
    f_name = font(FONT)
    nfit = ImageFont.truetype(os.path.join(FONT_DIR, "Galmuri11.ttf"), FONT)
    name_w = ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(NAME, font=nfit)
    padX = round(FONT * 0.7)
    plateH = round(FONT * 1.7)
    plateW = round(name_w + padX * 2)
    px = bx + 18
    py = by - plateH + 8
    pxs, pys, pwS, phS = px*s, py*s, plateW*s, plateH*s
    tb, tf = c.get("tab") or (c["border"], c["fill"])
    rrect(d, [pxs+3*s, pys+4*s, pxs+3*s+pwS, pys+4*s+phS], 10*s, fill=(0, 0, 0, 80))
    rrect(d, [pxs, pys, pxs+pwS, pys+phS], 10*s, fill=C(tb))
    rrect(d, [pxs+4*s, pys+4*s, pxs+pwS-4*s, pys+phS-4*s], 7*s, fill=C(tf))

    lyr = lyr.resize((W, H), Image.LANCZOS)

    # --- 픽셀 폰트는 1x ---
    d2 = ImageDraw.Draw(lyr)
    # 본문 (게임: x+pad, y+pad)
    d2.text((bx + PAD, by + PAD), BODY, font=f_name, fill=C(c["text"]))
    # 이름 (세로 중앙)
    asc, desc = f_name.getmetrics()
    d2.text((px + padX, py + (plateH - (asc + desc)) / 2), NAME,
            font=f_name, fill=C(c["nameTxt"]))
    # 진행 화살표 ▼ (게임: x+w-pad, y+h-pad*0.4 부근)
    ax = bx + BOX_W - PAD - 6
    ay = by + BOX_H - PAD - 2
    d2.polygon([(ax, ay), (ax + 14, ay), (ax + 7, ay + 11)], fill=C(c["text"]))
    return lyr

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT_DEFAULT
    titleH = 30
    gapY = 26
    margin = 30
    tiles = [(t, render_tile(c)) for t, c in CANDS]
    tw = tiles[0][1].width
    cellH = titleH + tiles[0][1].height
    W = margin * 2 + tw
    H = margin * 2 + len(tiles) * cellH + (len(tiles) - 1) * gapY

    canvas = Image.new("RGBA", (W, H), C("#cdd5e0"))
    d = ImageDraw.Draw(canvas)
    tfont = font(20)
    y = margin
    for title, tile in tiles:
        d.text((margin + 4, y), title, font=tfont, fill=C("#1f2937"))
        canvas.alpha_composite(tile, (margin, y + titleH))
        y += cellH + gapY

    if SCALE_OUT != 1.0:
        canvas = canvas.resize((round(W * SCALE_OUT), round(H * SCALE_OUT)), Image.LANCZOS)
    canvas.convert("RGB").save(out)
    print("saved:", out, canvas.size, "| box %dx%d font %d" % (BOX_W, BOX_H, FONT))

if __name__ == "__main__":
    main()
