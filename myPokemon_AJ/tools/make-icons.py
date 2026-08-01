#!/usr/bin/env python3
"""
실행프로그램(PokemonWith.exe)·창·브라우저 탭 아이콘을 로고 PNG 한 장에서 굽는다.

  01_Resources/Title/Logo/Program_Logo_Transparent.png
      → electron/assets/icon.ico   (exe·창 아이콘. 16~256px 7종을 한 파일에)
      → electron/assets/icon.png   (Electron BrowserWindow용 512px)
      → public/favicon.png         (브라우저 탭 512→256px)

사용법: cd myPokemon_AJ && python3 tools/make-icons.py
아이콘을 새로 구운 뒤 exe에 박으려면: bash tools/set-exe-icon.sh

⚠️ `build/`는 .gitignore(**/build/) 대상이라 아이콘 원본을 거기 두면 다른 PC로 안 넘어간다
   → electron/assets/ 에 둔다(package.json의 win.icon도 그 경로를 본다).
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.normpath(os.path.join(PROJ, "..", "01_Resources", "Title", "Logo", "Program_Logo_Transparent.png"))
ICO = os.path.join(PROJ, "electron", "assets", "icon.ico")
PNG = os.path.join(PROJ, "electron", "assets", "icon.png")
FAV = os.path.join(PROJ, "public", "favicon.png")

im = Image.open(SRC).convert("RGBA")
im = im.crop(im.getbbox())          # 투명 여백 제거 — 안 하면 작은 크기에서 그림이 더 작아 보인다
s = max(im.size)
sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))   # 정사각으로 맞춤(아이콘이 찌그러지지 않게)
sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))

os.makedirs(os.path.dirname(ICO), exist_ok=True)
sizes = [256, 128, 64, 48, 32, 24, 16]
sq.resize((256, 256), Image.LANCZOS).save(ICO, format="ICO", sizes=[(n, n) for n in sizes])
sq.resize((512, 512), Image.LANCZOS).save(PNG)
sq.resize((256, 256), Image.LANCZOS).save(FAV)
print(f"원본 {SRC}\n  → {ICO}\n  → {PNG}\n  → {FAV}")
