"""
AR(Another Red)의 HGSS "VS 트레이너" 전환 연출 그림을 우리 게임용으로 뽑는다.

쓰는 법:
    python3 tools/ar-vs/extract-vs.py

결과물 (public/assets/transitions/):
    vs_bar.png            — 가로로 흐르는 빨간 띠 (512x128)
    vs1.png / vs2.png     — VS 로고 본체 / 등장할 때 커졌다 줄어드는 변형 (각 128x128)
    vs_<키>.png           — 상대 초상 (원본은 전부 192x128)

⚠️ 원본 실측(2026-08-02):
  · `hgss_vsBar_*` 21장이 **픽셀까지 전부 동일**하다(그린·브록·로켓보스 다 같은 띠).
    → 트레이너별로 복사할 이유가 없어 **공용 1장(vs_bar.png)** 으로 뽑는다.
  · `black_half.png`는 512x192 **순수 검정 단색**이라 파일로 안 가져온다(코드에서 사각형으로 덮는다).
  · 팔레트(P) 모드 PNG가 섞여 있다 → **RGBA로 변환**해야 Phaser에서 투명이 안 깨진다
    (0801 날씨 이식 때 겪은 함정과 같다).

⚠️ 네모(라이벌)만 예외다:
  AR엔 네모용 hgss_vs 초상이 없다(hgss_vs_*는 관장 19 + 챔피언 그린 + 로켓보스 = 21종뿐).
  사용자 확정(2026-08-02, B안): **배틀 전신 그림에서 상반신만 잘라 세로 128로 키운다.**
  덧그리지 않는다 — 자르기와 확대(NEAREST)만 한다.
"""
import os, sys, argparse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "transitions"))

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

# 원본 Transitions 폴더에서 그대로 가져오는 것 — (원본파일, 우리이름)
COPY = [
    ("hgss_vsBar_LEADER_Green.png", "vs_bar.png"),   # 21장 전부 동일 → 대표 1장만
    ("hgss_vs1.png",                "vs1.png"),
    ("hgss_vs2.png",                "vs2.png"),
    ("hgss_vs_LEADER_Green.png",    "vs_LEADER_Green.png"),
]

# 전신 배틀 그림에서 상반신을 잘라 만드는 것 — (원본파일, 우리이름, 위에서 몇 %를 남길지)
#
# ⚠️ 지금은 비어 있다. **네모(vs_NEMONA.png)는 이 스크립트가 만들지 않는다.**
#    2026-08-02 사용자 결정: AR 전신 그림을 1.8배 확대한 크롭 대신, **192x128 일러스트 초상**을 쓴다.
#    근거 — AR 자체가 세대별로 다르게 만들었다(실측):
#       · 1세대 칸토 관장 12장 = 평균 13색 손도트(P모드)
#       · 8세대 갈라르 관장  9장 = 평균 4,983색 **일러스트를 192x128로 줄인 것**(RGBA)
#    9세대인 네모를 일러스트로 넣는 건 원본이 신세대 캐릭터에 한 처리와 같다.
#    그 파일은 `public/assets/transitions/vs_NEMONA.png`에 **직접 넣어 관리**한다 —
#    이 스크립트를 다시 돌려도 덮어쓰지 않게 여기서 뺐다(돌리면 원래 크롭으로 되돌아가 버린다).
BUST: list[tuple[str, str, float]] = []

TARGET_H = 128   # 원본 hgss_vs_* 초상 높이와 같게 맞춘다


def find_ar(given):
    if given:
        if not os.path.isdir(given):
            sys.exit(f"AR 경로가 없다: {given}")
        return given
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본을 못 찾았다. --ar '<경로>' 로 직접 알려줄 것.")


def to_rgba(im):
    """팔레트(P) 모드는 Phaser에서 투명이 깨진다 → 무조건 RGBA로."""
    return im.convert("RGBA")


def make_bust(path, keep_ratio):
    """전신 그림 → 머리~허리만 남겨 세로 TARGET_H로 확대(NEAREST, 덧그리기 없음)."""
    im = to_rgba(Image.open(path))
    im = im.crop(im.getbbox())                       # 투명 여백 제거
    w, h = im.size
    im = im.crop((0, 0, w, int(h * keep_ratio)))     # 위쪽 일부 = 상반신
    im = im.crop(im.getbbox())                       # 자른 뒤 다시 여백 제거
    w, h = im.size
    s = TARGET_H / h
    return im.resize((max(1, round(w * s)), TARGET_H), Image.NEAREST), s


def main():
    ap = argparse.ArgumentParser(description="AR VS 연출 그림을 public/assets/transitions로 뽑는다")
    ap.add_argument("--ar")
    args = ap.parse_args()
    ar = find_ar(args.ar)
    tr = os.path.join(ar, "Graphics", "Transitions")
    os.makedirs(OUT_DIR, exist_ok=True)

    for src, dst in COPY:
        p = os.path.join(tr, src)
        if not os.path.isfile(p):
            sys.exit(f"원본에 없다: {p}")
        im = to_rgba(Image.open(p))
        im.save(os.path.join(OUT_DIR, dst))
        print(f"  {src:32s} → {dst:22s} {im.size[0]}x{im.size[1]}")

    for src, dst, ratio in BUST:
        p = os.path.join(ar, "Graphics", src)
        if not os.path.isfile(p):
            sys.exit(f"원본에 없다: {p}")
        im, scale = make_bust(p, ratio)
        im.save(os.path.join(OUT_DIR, dst))
        print(f"  {src:32s} → {dst:22s} {im.size[0]}x{im.size[1]}  (상반신 {int(ratio*100)}% 크롭, {scale:.2f}배 확대)")

    print(f"\n{OUT_DIR}")


if __name__ == "__main__":
    main()
