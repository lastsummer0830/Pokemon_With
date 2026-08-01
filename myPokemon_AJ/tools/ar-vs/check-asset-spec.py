"""
새로 만든 그래픽이 **AR 원본과 같은 규격인지** 숫자로 검사한다.
(말로 "원본 화풍대로 했다"고 하지 말고 이걸로 확인한다 — 2026-08-02 사용자 지적.)

쓰는 법:
    python3 tools/ar-vs/check-asset-spec.py <파일...> --kind vs_portrait
    python3 tools/ar-vs/check-asset-spec.py assets/*.png --kind item
    python3 tools/ar-vs/check-asset-spec.py x.png            # 종류 자동 추측

종류(kind):
    vs_portrait  VS 초상       item  아이템 아이콘
    trainer      배틀 트레이너   map   맵 걷기 스프라이트
    creature     맵 크리처(포켓몬 팔로워)     back  트레이너 뒷모습 5프레임

기준값의 출처 = **AR 원본 전수 실측**(2026-08-02, 이 저장소의 조사 기록):
    Items      792장 · 95%가 48x48 · 색 중앙 11 · 98%가 반투명 0
    Trainers   328장(앞) · 너비 79~176(128이 최다) · 색 중앙 15 · 95%가 반투명 0
    Characters 545장 · 72%가 128x192(셀 32x48) · 색 중앙 15 · 95%가 반투명 0
    팔로워      23장 · 20장이 256x256(셀 64x64)
    뒷모습       8장 · 전부 800x160(5프레임 x 160x160)
    VS 초상     21장 · **전부 192x128** · 두 화풍으로 갈림:
                 · 도트(칸토 12장)     색 11~15 · 반투명 0
                 · 일러스트(갈라르 9장) 색 2,023~12,778 · 반투명 93~2,326

⚠️ 화풍은 **종류로 결정되지 않는다.** 원본도 같은 세대 안에서 갈린다
   (9세대 trainer_IONO = 2,025색 일러스트 / 9세대 trainer_NEMONA = 24색 도트).
   그래서 이 도구는 "도트냐 일러스트냐"를 **판정만 하고 강제하지 않는다.**
   크기·투명 같은 **깨지면 게임이 틀어지는 것만** 실패로 잡는다.
"""
import sys, os, argparse
import numpy as np
from PIL import Image

# (가로, 세로) 또는 None(자유), 색 범위는 '도트' 기준 참고값
SPEC = {
    "vs_portrait": {"size": (192, 128), "desc": "VS 초상"},
    "item":        {"size": (48, 48),   "desc": "아이템 아이콘"},
    "map":         {"size": (128, 192), "desc": "맵 걷기 스프라이트(4x4, 셀 32x48)", "grid": (4, 4)},
    "creature":    {"size": (256, 256), "desc": "맵 크리처(4x4, 셀 64x64)", "grid": (4, 4)},
    "back":        {"size": (800, 160), "desc": "트레이너 뒷모습(가로 5프레임 x 160x160)", "frames": 5},
    "trainer":     {"size": None,       "desc": "배틀 트레이너 앞모습(너비 79~176, 128이 최다)"},
}
DOT_MAX_COLORS = 64        # 이 아래면 '도트'로 본다(원본 도트는 중앙 11~15, 최대 58)
ILLUST_MIN_COLORS = 500    # 이 위면 '일러스트'로 본다(원본 일러스트는 1,200~13,000)


def measure(path):
    im = Image.open(path)
    a = np.asarray(im.convert("RGBA"))
    al = a[..., 3]
    opaque = a[al > 0][:, :3]
    colors = len(np.unique(opaque.reshape(-1, 3), axis=0)) if opaque.size else 0
    return {
        "size": im.size, "mode": im.mode, "colors": colors,
        "semi": int(((al > 0) & (al < 255)).sum()),
        "clear": int((al == 0).sum()),
        "px": im.size[0] * im.size[1],
    }


def guess_kind(m):
    for k, v in SPEC.items():
        if v["size"] and m["size"] == v["size"]:
            return k
    return "trainer"


def check(path, kind):
    m = measure(path)
    spec = SPEC[kind]
    errs, warns = [], []

    if spec["size"] and m["size"] != spec["size"]:
        errs.append(f"크기가 {m['size'][0]}x{m['size'][1]} — 원본 규격은 {spec['size'][0]}x{spec['size'][1]}")
    if kind == "trainer" and not (79 <= m["size"][0] <= 176):
        warns.append(f"너비 {m['size'][0]} — 원본 범위(79~176) 밖")
    if "grid" in spec and spec["size"]:
        gx, gy = spec["grid"]
        errs and None
        if m["size"] == spec["size"]:
            pass  # 크기가 맞으면 셀도 자동으로 맞다
    if "frames" in spec and m["size"][0] % spec["frames"]:
        errs.append(f"가로 {m['size'][0]}가 {spec['frames']}프레임으로 안 나뉜다")

    # 투명 배경 — 원본은 전부 알파가 있다(VS 초상 44% · 트레이너 77% · 아이템 61%가 완전투명)
    if m["clear"] == 0:
        errs.append("완전투명 픽셀이 0개 — 배경이 안 지워졌다(원본은 전부 투명 배경)")
    elif m["clear"] / m["px"] < 0.05:
        warns.append(f"완전투명이 {m['clear']/m['px']*100:.1f}%뿐 — 배경이 남았는지 확인")

    if m["colors"] <= DOT_MAX_COLORS:
        style = f"도트 (색 {m['colors']}개, 반투명 {m['semi']}px)"
        if m["semi"] > m["px"] * 0.01:
            warns.append(f"도트인데 반투명이 {m['semi']}px — 원본 도트는 반투명 0이다")
    elif m["colors"] >= ILLUST_MIN_COLORS:
        style = f"일러스트 (색 {m['colors']:,}개, 반투명 {m['semi']}px)"
        if kind == "vs_portrait" and not (2023 <= m["colors"] <= 12778):
            warns.append(f"색 {m['colors']:,} — 원본 일러스트 초상 범위(2,023~12,778) 밖")
    else:
        style = f"애매 (색 {m['colors']}개) — 도트도 일러스트도 아니다"
        warns.append("색이 65~499 사이다. 원본엔 이 구간이 거의 없다(도트를 어설프게 줄인 결과일 수 있다)")

    return m, style, errs, warns


def main():
    ap = argparse.ArgumentParser(description="AR 원본 규격과 대조한다")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--kind", choices=list(SPEC), help="안 주면 크기로 추측")
    args = ap.parse_args()

    bad = 0
    for p in args.files:
        if not os.path.isfile(p):
            print(f"❌ {p} — 파일 없음"); bad += 1; continue
        m = measure(p)
        kind = args.kind or guess_kind(m)
        m, style, errs, warns = check(p, kind)
        head = "❌" if errs else ("⚠️ " if warns else "OK")
        print(f"\n{head} {os.path.basename(p)}  [{SPEC[kind]['desc']}]")
        print(f"    {m['size'][0]}x{m['size'][1]} {m['mode']} · 투명 {m['clear']/m['px']*100:.0f}% · 화풍 판정: {style}")
        for e in errs:  print(f"    ❌ {e}")
        for w in warns: print(f"    ⚠️  {w}")
        if errs: bad += 1
    print(f"\n{'실패 ' + str(bad) + '건' if bad else '전부 규격 통과'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
