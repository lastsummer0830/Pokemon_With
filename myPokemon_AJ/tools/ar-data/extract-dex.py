#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Another Red의 지역도감 순서(regional_dexes.dat)를 뽑는다.

  Data/regional_dexes.dat → public/assets/data/ar/dex_kanto.json

도감 화면은 "번호순 목록"이 필요한데 species.json에는 도감번호가 없다(종족 id만).
regional_dexes.dat = [[Symbol(SPECIES), ...], ...] 형태의 '지역별 종족 나열'이고,
배열 인덱스+1이 곧 그 지역의 도감번호다. 0번 = 칸토(151).

사용법:
  cd myPokemon_AJ && python3 tools/ar-data/extract-dex.py
"""
import os, sys, json, glob

try:
    from rubymarshal.reader import loads
    from rubymarshal.classes import Symbol
except ImportError:
    sys.exit("rubymarshal 필요: pip install rubymarshal")


def find_ar():
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        return sys.argv[1]
    env = os.environ.get("AR_PATH")
    if env and os.path.isdir(env):
        return env
    roots = ["/mnt/d"] + glob.glob("/mnt/c/Users/*/Desktop")
    for root in roots:
        for p in glob.glob(os.path.join(root, "*Another*Red*")):
            if os.path.isdir(os.path.join(p, "Data")):
                return p
    return None


AR = find_ar()
if not AR:
    sys.exit("AR 원본을 못 찾음. 인자나 AR_PATH로 경로를 주세요")

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "data", "ar")
os.makedirs(OUT, exist_ok=True)


def sym(v):
    return v.name if isinstance(v, Symbol) else v


def main():
    print(f"AR 원본: {AR}")
    dexes = loads(open(os.path.join(AR, "Data", "regional_dexes.dat"), "rb").read())
    print(f"  지역도감 {len(dexes)}개: " + ", ".join(f"[{i}]={len(d)}종" for i, d in enumerate(dexes)))

    kanto = [sym(s) for s in dexes[0]]   # 0번 = 칸토
    path = os.path.join(OUT, "dex_kanto.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(kanto, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → {os.path.relpath(path, ROOT)}  ({len(kanto)}종)")
    print(f"     1={kanto[0]}  2={kanto[1]}  ...  {len(kanto)}={kanto[-1]}")


if __name__ == "__main__":
    main()
