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

# ── 오토타일(물·모래·꽃 등) 조립표 ────────────────────────────────────────────
# RPG Maker XP는 타일ID 1~383을 오토타일로 쓴다: `id//48` = 오토타일 번호, `id%48` = **모양 변형 48종**
# (물 한가운데 / 왼쪽 물가 / 안쪽 모서리 …). 오토타일 원본 PNG는 96x128이고 이를 16px 조각
# 6x8=48개로 나눈 뒤, 변형마다 정해진 네 조각(좌상·우상·좌하·우하)을 붙여 32x32 한 칸을 만든다.
# ⚠️ 예전엔 이 변형을 통째로 무시하고 "채움 타일" 한 종류만 찍었다 → 태초마을·상록시티의 연못이
#    갈색 격자 덩어리로 나왔다(원본은 파란 물). 아래 표가 원본 규격이다. 건드리지 말 것.
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


def build_autotile(src: Image.Image, variant: int) -> Image.Image:
    """오토타일 원본에서 변형 하나(32x32)를 네 조각으로 조립한다.
    가로가 96px보다 넓으면 애니메이션(물결) 시트라 **첫 프레임**만 쓴다."""
    frame = src.crop((0, 0, 96, src.height)) if src.width > 96 else src
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for i, piece in enumerate(AUTOTILE_PARTS[variant % 48]):
        c, r = piece % 6, piece // 6
        out.paste(frame.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), ((i % 2) * 16, (i // 2) * 16))
    return out

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
    _, _, _, prio = parse_table(ts["@priorities"])
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
            return build_autotile(aimg[n - 1], tid % 48)
        return None

    def tbl_lookup(table, tid):
        """passages·terrain_tags는 타일ID로 찾는 표. 오토타일은 48칸 단위로 묶여 있다."""
        if not tid:
            return 0
        idx = tid if tid >= 384 else (tid // 48) * 48
        return table[idx] if 0 <= idx < len(table) else 0

    # 바닥(ground)과 전경(over)을 나눠 그린다.
    #  RPG Maker XP의 @priorities > 0인 타일 = **캐릭터보다 위에 그려지는 전경**(나무 캐노피·지붕·표지판 윗부분 등).
    #  예전엔 전 레이어를 canvas 한 장에 평탄화해서, 인게임에서 캐릭터(depth 5)가 그 위를 덮어
    #  "트레이너/플레이어가 나무 위에 선" 것처럼 보였다. → priority>0은 <out>_over.png로 따로 빼서
    #  WorldScene이 캐릭터 위(depth)로 그린다(AR·정품 포켓몬과 같은 겹침).
    ground = Image.new("RGBA", (xs * 32, ys * 32), (0, 0, 0, 0))
    over = Image.new("RGBA", (xs * 32, ys * 32), (0, 0, 0, 0))
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
                    # @priorities > 0 = 캐릭터 위에 그려지는 전경(나무 캐노피 등) → over로 뺀다.
                    dest = over if tbl_lookup(prio, tid) > 0 else ground
                    dest.alpha_composite(t, (x * 32, y * 32))
                # 사방(0x0f)이 다 막힌 타일 = 못 지나감
                if (tbl_lookup(passg, tid) & 0x0f) == 0x0f:
                    cellblock = True
                if tbl_lookup(terrain, tid) == TERRAIN_GRASS:
                    cellgrass = True
            blocked[y][x] = 1 if cellblock else 0
            grass[y][x] = 1 if cellgrass else 0

    os.makedirs(OUT_DIR, exist_ok=True)
    png_path = os.path.join(OUT_DIR, f"{out}.png")
    ground.convert("RGB").save(png_path)
    # 전경 타일이 하나라도 있으면 투명 배경 PNG로 저장(없으면 파일을 안 만든다 — 씬이 flag로 판단).
    over_path = os.path.join(OUT_DIR, f"{out}_over.png")
    if over.getbbox() is not None:
        over.save(over_path)
        print(f"  전경 레이어: {over_path}")
    elif os.path.isfile(over_path):
        os.remove(over_path)   # 예전에 만든 전경이 이번엔 비었으면 지운다(오래된 파일 방지)

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
