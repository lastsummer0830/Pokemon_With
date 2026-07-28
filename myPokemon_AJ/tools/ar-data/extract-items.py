#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Another Red의 아이템 데이터(items.dat = Ruby Marshal, 842개)와 아이콘을
우리 게임이 쓰는 형태로 뽑는다.

  Data/items.dat + messages_kor_*.dat  →  public/assets/data/ar/items.json
  Graphics/Items/<ID>.png              →  public/assets/items/<ID>.png

⚠️ 842개 중 '화이트리스트'만 뽑는다. 아이콘 792장을 전부 복사하면 리포가 오염된다.
   세로 슬라이스(첫 뱃지까지)에 실제로 쓰이는 것만 WHITELIST에 적는다.
   나중에 아이템이 더 필요해지면 WHITELIST에 id 한 줄 추가하고 다시 돌리면 된다.

사용법(extract-battle-data.py와 동일):
  cd myPokemon_AJ && python3 tools/ar-data/extract-items.py
의존성: pip install rubymarshal
"""
import os, sys, json, glob, shutil

try:
    from rubymarshal.reader import loads
    from rubymarshal.classes import RubyString, Symbol
except ImportError:
    sys.exit("rubymarshal 필요: pip install rubymarshal")


# ── 뽑을 아이템 (세로 슬라이스에 실제로 쓰는 것만) ─────────────
#  pocket: AR items.dat의 @pocket을 그대로 쓴다. 원본(Essentials v21.1) 포켓 번호는 9개다 —
#          1=일반 2=회복약 3=몬스터볼 4=기술머신 5=나무열매 6=편지 7=배틀아이템 8=소중한물건 9=Z크리스탈.
#          (원본 items.dat 실측: 1→382개, 2→95, 3→37, 4→107, 5→68, 6→12, 7→42, 8→64, 9→35)
WHITELIST = [
    "POKEBALL", "GREATBALL", "ULTRABALL", "MASTERBALL",   # 잡는다 (하이퍼·마스터볼 = 포획 시스템에서 추가)
    "POTION", "SUPERPOTION",                     # HP 회복
    "ANTIDOTE", "PARALYZEHEAL", "AWAKENING", "BURNHEAL", "ICEHEAL",  # 상태이상
    "REVIVE",                                    # 기절 회복
    # 소중한 물건(포켓8) — 스토리 진행용. 오박사가 스타터와 함께 주고, 상록체육관에서 그린에게 보여준다.
    #  ⚠️ 원본에 실제로 있는 아이템이다(:OAKSINTRODUCTION = "오박사의 소개장"). 우리가 지어낸 게 아니다.
    "OAKSINTRODUCTION",
]

# ── 원본 값을 일부러 덮어쓰는 가격 ────────────────────────────
#  ⚠️ 이 표가 없으면 이 스크립트를 다시 돌릴 때마다 아래 값이 AR 원본 값으로 되돌아가 회귀가 난다
#     (실제로 한 번 발생: 하이퍼볼 1200→800, 마스터볼 0→50000).
#  이유: AR은 자체 밸런스를 쓰지만 우리는 공식 한국판 기준을 따르기로 했다.
PRICE_OVERRIDE = {
    "ULTRABALL": 1200,   # 공식 한국판 하이퍼볼 가격(AR 원본은 800)
    "MASTERBALL": 0,     # 비매품 — 상점에 노출되면 안 된다(AR 원본은 50000)
}


# ── AR 원본 경로 찾기 (extract-battle-data.py와 같은 규칙) ─────
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
    sys.exit("AR 원본을 못 찾음. 인자나 AR_PATH로 경로를 주세요 (예: /mnt/d/Pokemon Another Red_PWT_250829)")
DATA = os.path.join(AR, "Data")
ICONS_SRC = os.path.join(AR, "Graphics", "Items")

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT_JSON = os.path.join(ROOT, "public", "assets", "data", "ar")
OUT_ICON = os.path.join(ROOT, "public", "assets", "items")
os.makedirs(OUT_JSON, exist_ok=True)
os.makedirs(OUT_ICON, exist_ok=True)


def sym(v):
    return v.name if isinstance(v, Symbol) else v


def txt(v):
    return v.text if isinstance(v, RubyString) else v


# ── 한글 이름/설명 (messages_kor_*.dat = 카테고리 리스트) ──────
#  인덱스 7 = 아이템명, 9 = 아이템 설명. core에 없으면 game 쪽도 본다.
def load_messages():
    names, descs = {}, {}
    for fname in ("messages_kor_core.dat", "messages_kor_game.dat"):
        path = os.path.join(DATA, fname)
        if not os.path.exists(path):
            continue
        cats = loads(open(path, "rb").read())
        for idx, target in ((7, names), (9, descs)):
            d = cats[idx] if idx < len(cats) and isinstance(cats[idx], dict) else {}
            for k, v in d.items():
                target.setdefault(txt(k), txt(v))
    return names, descs


def main():
    print(f"AR 원본: {AR}")
    ko_name, ko_desc = load_messages()

    src = loads(open(os.path.join(DATA, "items.dat"), "rb").read())
    # items.dat 는 {Symbol -> GameData::Item}. Symbol 키에는 콜론이 붙으므로 .name 으로 맞춘다.
    by_id = {sym(k): v for k, v in src.items()}

    out, copied, missing = {}, 0, []
    for iid in WHITELIST:
        obj = by_id.get(iid)
        if not obj:
            missing.append(iid)
            continue
        a = obj.attributes
        en = txt(a.get("@real_name"))
        desc_en = txt(a.get("@real_description"))
        out[iid] = {
            "id": iid,
            "name": ko_name.get(en, en),               # 한글명(없으면 영문)
            "nameEn": en,
            "pocket": a.get("@pocket"),                # 1=일반 2=회복 3=볼 …
            "price": PRICE_OVERRIDE.get(iid, a.get("@price")),
            "desc": ko_desc.get(desc_en, desc_en),     # 한글 설명(없으면 영문)
            # 0이 아니면 그 상황에서 쓸 수 있다는 뜻(에센셜즈 규약).
            "fieldUse": a.get("@field_use") or 0,
            "battleUse": a.get("@battle_use") or 0,
            "consumable": bool(a.get("@consumable")),
        }
        # 아이콘: 파일명이 곧 아이템 id (별도 인덱스 매핑 불필요)
        png = os.path.join(ICONS_SRC, f"{iid}.png")
        if os.path.exists(png):
            shutil.copy2(png, os.path.join(OUT_ICON, f"{iid}.png"))
            copied += 1
        else:
            print(f"  ⚠ 아이콘 없음: {iid}.png")

    path = os.path.join(OUT_JSON, "items.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → {os.path.relpath(path, ROOT)}  ({len(out)}개)")
    print(f"  → {os.path.relpath(OUT_ICON, ROOT)}/  (아이콘 {copied}장)")
    if missing:
        print(f"  ⚠ items.dat 에 없는 id: {missing}")
    for iid, v in out.items():
        print(f"     {iid:14s} {v['name']:10s} pocket={v['pocket']} price={v['price']}")


if __name__ == "__main__":
    main()
