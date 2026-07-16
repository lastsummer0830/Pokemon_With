"""
AR의 야생 인카운터 표(encounters.dat)를 우리 게임용 JSON으로 뽑는다.

쓰는 법:
    python3 tools/ar-data/extract-encounters.py --maps 10
    python3 tools/ar-data/extract-encounters.py --maps 10,56          # 여러 맵

결과물: public/assets/data/ar/encounters.json
    {
      "10": {
        "stepChance": 21,            # 100보당 조우 확률(%)
        "land": [
          {"w": 8, "id": "PIDGEY", "min": 2, "max": 4},   # w = 가중치(합 100)
          ...
        ]
      }
    }

⚠️ 맵을 통째로 다 뽑지 않는다 — 쓰는 맵만 화이트리스트(--maps)로. (리포 오염 방지, extract-items.py와 같은 철학)
"""
import os, json, argparse, sys
from rubymarshal.reader import loads

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

OUT = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "public", "assets", "data", "ar", "encounters.json"))


def find_ar(given):
    if given:
        if not os.path.isdir(given):
            sys.exit(f"AR 경로가 없다: {given}")
        return given
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본을 못 찾았다. --ar '<경로>' 로 알려줄 것.")


def sym(x):
    """rubymarshal Symbol → 파이썬 문자열"""
    return getattr(x, "name", None) or str(x)


def main():
    ap = argparse.ArgumentParser(description="AR 야생 인카운터 표 추출")
    ap.add_argument("--maps", default="10", help="맵 번호 쉼표구분 (기본 10=1번도로)")
    ap.add_argument("--ar", default=None)
    a = ap.parse_args()
    ar = find_ar(a.ar)
    want = [m.strip() for m in a.maps.split(",") if m.strip()]

    raw = loads(open(f"{ar}/Data/encounters.dat", "rb").read())
    out = {}
    for key, val in raw.items():
        name = sym(key)                      # 예: "10_0" = 맵10 버전0
        mid = name.split("_")[0]
        if mid not in want:
            continue
        at = val.attributes
        chances = {sym(k): int(v) for k, v in at["@step_chances"].items()}
        types = at["@types"]
        entry = {}
        for tkey, rows in types.items():
            tname = sym(tkey).lower()        # Land → land
            entry[tname] = [
                {"w": int(r[0]), "id": sym(r[1]), "min": int(r[2]), "max": int(r[3])}
                for r in rows
            ]
        # Land가 기본. 물/낚시는 지금 안 쓰지만 구조는 그대로 남겨둔다.
        entry["stepChance"] = chances.get("Land", 0)
        out[mid] = entry

    missing = [m for m in want if m not in out]
    if missing:
        sys.exit(f"이 맵들의 인카운터 표가 AR에 없다: {missing}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    for mid, e in out.items():
        land = e.get("land", [])
        total = sum(r["w"] for r in land)
        print(f"Map{mid}: 100보당 {e['stepChance']}%  종 {len(land)}개  가중치합 {total}")
        for r in land:
            print(f"   {r['w']:>3}  {r['id']:<14} L{r['min']}~{r['max']}")
    print(f"\n→ {OUT}")


if __name__ == "__main__":
    main()
