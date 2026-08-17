#!/usr/bin/env python3
"""
움직이는 오토타일(물결)을 우리 게임용 스프라이트시트 + 좌표표로 뽑는다.

    python3 tools/ar-map/extract-water.py

왜 필요한가 (2026-08-03 원본 대조):
  `extract-map.py`는 오토타일을 **첫 프레임만** 구워 평면 PNG에 넣는다(주석에도 적혀 있다).
  그래서 우리 물은 완전히 멈춰 있었다.

⭐ 원본 실측 — "물 애니"의 실제 범위는 생각보다 좁다:
  · 태초마을(Map55) 물 12칸 = 오토타일 **`NOANIMSEA.png` (96x128 = 1프레임)** → **원본도 안 움직인다.**
  · 상록시티(Map56) 물 30칸 = 오토타일 **`STILL.png` (1056x128 = 11프레임)** → 움직인다.
  · 1번도로(Map10)엔 물이 없다.
  즉 우리가 붙일 것은 상록시티 30칸뿐이다. (이름이 STILL이라 안 움직일 것 같지만 11프레임짜리다.)

⭐ 갱신 속도도 원본 값 그대로:
  `TilemapRenderer.rb`: `AUTOTILE_FRAME_DURATION = 5`  # 1/20초 단위
  → 프레임당 **5/20 = 0.25초(4fps)**. 파일명이 `[x]`로 끝나면 x/20초지만 STILL엔 없다.

출력:
  public/assets/world/<맵>_anim.png    프레임을 가로로 이어붙인 시트(칸 32x32, 줄 = 서로 다른 타일 모양)
  public/assets/world/<맵>_anim.json   {"frameMs":250,"frames":11,"cells":[{"x":..,"y":..,"row":..}]}
"""
import json, os, struct, sys
from PIL import Image
from rubymarshal.reader import loads

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]
# ⚠️ 22번도로(Map49)도 상록시티와 같은 `STILL`(11프레임)을 쓴다 — 원본 실측이라 여기 넣어야 물이 움직인다.
MAPS = {10: "route1", 55: "pallet_town", 56: "viridian_city", 49: "route22"}
OUT_DIR = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets", "world"))

# 오토타일 48가지 변형의 조각 배치(extract-map.py와 같은 표 — 원본 RMXP 규칙).
AUTOTILE_PARTS = [
    [26, 27, 32, 33], [4, 27, 32, 33], [26, 5, 32, 33], [4, 5, 32, 33],
    [26, 27, 32, 11], [4, 27, 32, 11], [26, 5, 32, 11], [4, 5, 32, 11],
    [26, 27, 10, 33], [4, 27, 10, 33], [26, 5, 10, 33], [4, 5, 10, 33],
    [26, 27, 10, 11], [4, 27, 10, 11], [26, 5, 10, 11], [4, 5, 10, 11],
    [24, 25, 30, 31], [24, 5, 30, 31], [24, 25, 30, 11], [24, 5, 30, 11],
    [14, 15, 20, 21], [14, 15, 20, 11], [14, 15, 10, 21], [14, 15, 10, 11],
    [28, 29, 34, 35], [28, 29, 10, 35], [4, 29, 34, 35], [4, 29, 10, 35],
    [38, 39, 44, 45], [4, 39, 44, 45], [38, 5, 44, 45], [4, 5, 44, 45],
    [24, 29, 30, 35], [14, 15, 44, 45], [12, 13, 18, 19], [12, 13, 18, 11],
    [16, 17, 22, 23], [16, 17, 10, 23], [40, 41, 46, 47], [4, 41, 46, 47],
    [36, 37, 42, 43], [36, 5, 42, 43], [12, 17, 18, 23], [12, 13, 42, 43],
    [36, 41, 42, 47], [16, 17, 46, 47], [12, 17, 42, 47], [0, 1, 6, 7],
]


def b2s(x):
    return x.decode("utf-8", "replace") if isinstance(x, (bytes, bytearray)) else str(x)


def parse_table(ud):
    raw = ud._private_data
    _dim, xs, ys, zs, _tot = struct.unpack("<5i", raw[:20])
    return xs, ys, zs, struct.unpack("<%dh" % (xs * ys * zs), raw[20:20 + 2 * xs * ys * zs])


def build(frame: Image.Image, variant: int) -> Image.Image:
    """오토타일 한 프레임(96x128)에서 변형 하나(32x32)를 조립한다."""
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for i, piece in enumerate(AUTOTILE_PARTS[variant % 48]):
        c, r = piece % 6, piece // 6
        out.paste(frame.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), ((i % 2) * 16, (i // 2) * 16))
    return out


def find_ar():
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본 폴더를 못 찾았다.")


def find_png(ar, folder, name):
    for ext in (".png", ".PNG"):
        p = os.path.join(ar, "Graphics", folder, name + ext)
        if os.path.exists(p):
            return p
    return None


def extract(ar: str, mid: int, out_name: str):
    ts_all = loads(open(f"{ar}/Data/Tilesets.rxdata", "rb").read())
    m = loads(open(f"{ar}/Data/Map%03d.rxdata" % mid, "rb").read()).attributes
    ts = ts_all[int(str(m["@tileset_id"]))].attributes
    xs, ys, zs, vals = parse_table(m["@data"])
    names = [b2s(a) for a in ts["@autotile_names"]]

    # 어떤 오토타일이 몇 프레임인가(프레임 = 그림 너비 / 96).
    frames_of, img_of = {}, {}
    for i, nm in enumerate(names):
        if not nm:
            continue
        p = find_png(ar, "Autotiles", nm)
        if not p:
            continue
        im = Image.open(p).convert("RGBA")
        img_of[i + 1] = im
        frames_of[i + 1] = max(1, im.width // 96)

    # 맵에서 **여러 프레임짜리** 오토타일이 쓰인 칸만 모은다.
    cells, patterns = [], {}
    for z in range(zs):
        for y in range(ys):
            for x in range(xs):
                t = vals[x + y * xs + z * xs * ys]
                if not t or t >= 384:
                    continue
                a = t // 48
                if frames_of.get(a, 1) <= 1:
                    continue
                key = (a, t % 48)
                if key not in patterns:
                    patterns[key] = len(patterns)
                cells.append({"x": x, "y": y, "row": patterns[key]})

    if not cells:
        print(f"{out_name}: 움직이는 물 없음 — 원본도 정지 오토타일이다(건너뜀)")
        return

    nframes = max(frames_of[a] for a, _ in patterns)
    sheet = Image.new("RGBA", (nframes * 32, len(patterns) * 32), (0, 0, 0, 0))
    for (a, var), row in patterns.items():
        im = img_of[a]
        for f in range(frames_of[a]):
            frame = im.crop((f * 96, 0, f * 96 + 96, im.height))
            sheet.paste(build(frame, var), (f * 32, row * 32))
    png = os.path.join(OUT_DIR, f"{out_name}_anim.png")
    sheet.save(png)
    meta = {"frameMs": 250, "frames": nframes, "rows": len(patterns), "cells": cells,
            "autotiles": sorted({names[a - 1] for a, _ in patterns})}
    with open(os.path.join(OUT_DIR, f"{out_name}_anim.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    print(f"{out_name}: {len(cells)}칸 · 모양 {len(patterns)}종 · {nframes}프레임 "
          f"({', '.join(meta['autotiles'])}) → {os.path.basename(png)}")


if __name__ == "__main__":
    ar = find_ar()
    for mid, nm in MAPS.items():
        extract(ar, mid, nm)
