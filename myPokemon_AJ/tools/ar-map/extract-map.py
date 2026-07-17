"""
AR(Another Red)의 맵 한 장을 우리 게임용 PNG + 충돌/풀숲 JSON으로 뽑는다.

쓰는 법:
    python3 tools/ar-map/extract-map.py --map 10 --out route1
    python3 tools/ar-map/extract-map.py --map 56 --out viridian_city

결과물 (public/assets/world/):
    <out>.png   — 맵 그림 (32px 타일)
    <out>.json  — {cols, rows, blocked, grass?}
                  blocked[y][x] = 1이면 못 지나감
                  grass[y][x]   = 1이면 풀숲(야생 포켓몬 나옴). 풀숲 없으면 이 키 자체가 없다.

⚠️ 집(방/거실)은 이 스크립트가 아니라 extract.py가 담당한다 — 이건 월드맵 전용.
"""
import struct, os, glob, json, argparse, sys
from rubymarshal.reader import loads
from PIL import Image

# --- AR 원본 위치는 PC마다 다르다 (D드라이브 회사PC / C드라이브 집PC).
#     하드코딩하면 다른 PC에서 죽으므로 후보를 훑고, 없으면 --ar 로 받는다.
AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

# RPG Maker XP의 terrain_tag 값. AR에서 2 = 풀숲(야생 인카운터)으로 쓴다.
TERRAIN_GRASS = 2

# 이 스크립트 위치 기준 상대경로 — 리포 폴더명이 PC마다 달라서 절대경로를 박으면 안 된다.
OUT_DIR = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets", "world"))


def find_ar(given: str | None) -> str:
    if given:
        if not os.path.isdir(given):
            sys.exit(f"AR 경로가 없다: {given}")
        return given
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본을 못 찾았다. --ar '<경로>' 로 직접 알려줄 것.\n"
             "찾는 법: find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname '*Another*Red*' -type d")


def b2s(x):
    return x.decode("utf-8", "replace") if isinstance(x, (bytes, bytearray)) else str(x)


def parse_table(ud):
    """RPG Maker의 Table 자료구조(바이너리)를 파이썬 값으로 푼다."""
    raw = ud._private_data
    dim, xs, ys, zs, tot = struct.unpack("<5i", raw[:20])
    vals = struct.unpack("<%dh" % (xs * ys * zs), raw[20:20 + 2 * xs * ys * zs])
    return xs, ys, zs, vals


def find_png(ar, folder, name):
    for ext in (".png", ".PNG"):
        p = os.path.join(ar, "Graphics", folder, name + ext)
        if os.path.exists(p):
            return p
    for f in glob.glob(os.path.join(ar, "Graphics", folder, "*")):
        if os.path.splitext(os.path.basename(f))[0] == name:
            return f
    return None


def extract(ar: str, mid: int, out: str):
    ts_all = loads(open(f"{ar}/Data/Tilesets.rxdata", "rb").read())
    m = loads(open(f"{ar}/Data/Map%03d.rxdata" % mid, "rb").read()).attributes
    tsid = int(str(m["@tileset_id"]))
    xs, ys, zs, vals = parse_table(m["@data"])
    ts = ts_all[tsid].attributes

    tsimg = Image.open(find_png(ar, "Tilesets", b2s(ts["@tileset_name"]))).convert("RGBA")
    autos = [(find_png(ar, "Autotiles", b2s(a)) if a else None) for a in ts["@autotile_names"]]
    aimg = [Image.open(p).convert("RGBA") if p else None for p in autos]
    _, _, _, passg = parse_table(ts["@passages"])
    _, _, _, terrain = parse_table(ts["@terrain_tags"])
    tcols = tsimg.width // 32

    def tile(tid):
        """타일 ID → 32x32 그림 조각. 384 미만은 오토타일(물·풀 등)."""
        if not tid:
            return None
        if tid >= 384:
            i = tid - 384
            c, r = i % tcols, i // tcols
            return tsimg.crop((c * 32, r * 32, c * 32 + 32, r * 32 + 32)) if (r + 1) * 32 <= tsimg.height else None
        n = tid // 48
        if 1 <= n <= len(aimg) and aimg[n - 1]:
            a = aimg[n - 1]
            return a.crop((0, 32, 32, 64)) if a.height >= 64 else a.crop((0, 0, 32, 32))
        return None

    def tbl_lookup(table, tid):
        """passages·terrain_tags는 타일ID로 찾는 표. 오토타일은 48칸 단위로 묶여 있다."""
        if not tid:
            return 0
        idx = tid if tid >= 384 else (tid // 48) * 48
        return table[idx] if 0 <= idx < len(table) else 0

    canvas = Image.new("RGBA", (xs * 32, ys * 32), (0, 0, 0, 0))
    blocked = [[0] * xs for _ in range(ys)]
    grass = [[0] * xs for _ in range(ys)]

    for y in range(ys):
        for x in range(xs):
            cellblock = False
            cellgrass = False
            for z in range(zs):
                tid = vals[x + xs * y + xs * ys * z]
                t = tile(tid)
                if t:
                    canvas.alpha_composite(t, (x * 32, y * 32))
                # 사방(0x0f)이 다 막힌 타일 = 못 지나감
                if (tbl_lookup(passg, tid) & 0x0f) == 0x0f:
                    cellblock = True
                if tbl_lookup(terrain, tid) == TERRAIN_GRASS:
                    cellgrass = True
            blocked[y][x] = 1 if cellblock else 0
            grass[y][x] = 1 if cellgrass else 0

    os.makedirs(OUT_DIR, exist_ok=True)
    png_path = os.path.join(OUT_DIR, f"{out}.png")
    canvas.convert("RGB").save(png_path)

    data = {"cols": xs, "rows": ys, "blocked": blocked}
    grass_cells = sum(sum(r) for r in grass)
    # 풀숲이 한 칸도 없는 맵(도시·실내)은 grass 키를 아예 넣지 않는다 — 스키마 선택 필드.
    if grass_cells:
        data["grass"] = grass
    json_path = os.path.join(OUT_DIR, f"{out}.json")

    # ⚠️ 이 도구가 만드는 건 cols/rows/blocked/grass 뿐이다. 실내 맵 JSON엔 씬이 쓰는
    #    img·spawn·exit 같은 **손으로 넣은 키**가 함께 들어있다(예: viridian_gym, oak_lab).
    #    통째로 덮어쓰면 그게 조용히 사라져 씬이 스폰 좌표를 못 찾고 죽는다 → 기존 키는 남긴다.
    kept = {}
    if os.path.isfile(json_path):
        try:
            old = json.load(open(json_path, encoding="utf-8"))
            kept = {k: v for k, v in old.items() if k not in data and k != "grass"}
        except (OSError, ValueError) as e:
            print(f"  ⚠️ 기존 JSON을 못 읽어 보존을 건너뛴다({e}) — spawn/exit가 있었다면 다시 넣을 것")
    if kept:
        print(f"  기존 키 보존: {', '.join(sorted(kept))}")
    json.dump({**data, **kept}, open(json_path, "w"), ensure_ascii=False)

    blocked_cells = sum(sum(r) for r in blocked)
    print(f"Map{mid:03d} → {out}: {xs}x{ys}칸  막힘 {blocked_cells}칸  풀숲 {grass_cells}칸")
    print(f"  {png_path}")
    print(f"  {json_path}")
    return xs, ys, blocked, grass


def main():
    ap = argparse.ArgumentParser(description="AR 맵 한 장을 PNG+JSON으로 추출한다 (월드맵 전용)")
    ap.add_argument("--map", type=int, required=True, help="AR 맵 번호 (예: 10=1번도로, 56=상록시티)")
    ap.add_argument("--out", required=True, help="출력 이름 (예: route1 → route1.png/route1.json)")
    ap.add_argument("--ar", default=None, help="AR 원본 폴더 (기본: 알려진 후보 자동탐색)")
    a = ap.parse_args()
    extract(find_ar(a.ar), a.map, a.out)


if __name__ == "__main__":
    main()
