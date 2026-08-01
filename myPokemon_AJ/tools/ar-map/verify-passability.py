"""
우리 맵 JSON(blocked/ledge)이 **원본(AR)의 이동 규칙과 같은 결과를 내는지** 자동 대조한다.

왜 필요한가:
    우리 `blocked`는 "사방(0x0f)이 다 막힌 타일"이라는 단순화다. 원본은 그것보다 정교하다
    (방향별 passage 비트 + priority 0 우선 + ignore_passability 지형 + 언덕은 한 방향 점프).
    눈대중으로 "맞겠지" 하면 안 되고(AGENTS.md 충돌격자 눈대중 금지), **닿을 수 있는 칸 집합**을
    양쪽 규칙으로 각각 구해서 완전히 같은지 본다.

쓰는 법:
    python3 tools/ar-map/verify-passability.py                       # 기본 3맵 전부
    python3 tools/ar-map/verify-passability.py --map 10 --out route1 --start 25,30

원본 규칙 출처(Scripts.rxdata에서 뽑은 루비 원문):
    Game_Map#passable?        — [2,1,0] 레이어를 위에서부터 보며 passage 비트/priority 판정
    Game_Character#passable?  — 현재 칸을 d로, 목적지 칸을 **10-d**로 두 번 검사
    Game_Player#move_generic  — 목적지가 :Ledge 지형이면 걷는 대신 jumpForward(2) = 2칸 점프
    TerrainTag.rb             — 1=:Ledge, 2=:Grass, id_number 13 = ignore_passability
"""
import os, sys, json, argparse, importlib.util
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("extract_map", os.path.join(HERE, "extract-map.py"))
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)
from rubymarshal.reader import loads

TERRAIN_IGNORE_PASSABILITY = {13}          # TerrainTag.rb: id_number 13만 ignore_passability = true
PASSAGE_BIT = {2: 1, 4: 2, 6: 4, 8: 8}     # 방향번호 → passage 막힘 비트
DELTA = {2: (0, 1), 4: (-1, 0), 6: (1, 0), 8: (0, -1)}

# 기본 대조 대상 = 지금 게임이 쓰는 야외 3맵 (AR 맵번호, 우리 JSON 이름, BFS 시작 로컬좌표)
DEFAULT_MAPS = [
    (10, "route1", (25, 30)),
    (55, "pallet_town", (20, 10)),
    (56, "viridian_city", (24, 34)),
]


def ar_reachable(ar: str, mid: int, start: tuple[int, int]) -> set[tuple[int, int]]:
    """원본 규칙 그대로 걸어서 닿는 칸 집합. (지상 이동만 — 파도타기·자전거·이벤트는 제외)"""
    m = loads(open(os.path.join(ar, "Data", f"Map{mid:03d}.rxdata"), "rb").read()).attributes
    ts_all = loads(open(os.path.join(ar, "Data", "Tilesets.rxdata"), "rb").read())
    ts = ts_all[int(str(m["@tileset_id"]))].attributes
    xs, ys, zs, vals = em.parse_table(m["@data"])
    _, _, _, terrain = em.parse_table(ts["@terrain_tags"])
    _, _, _, passg = em.parse_table(ts["@passages"])
    _, _, _, prio = em.parse_table(ts["@priorities"])

    def look(tbl, tid):
        if not tid:
            return 0
        i = tid if tid >= 384 else (tid // 48) * 48
        return tbl[i] if 0 <= i < len(tbl) else 0

    def tid_at(x, y, z):
        return vals[x + xs * y + xs * ys * z]

    def map_passable(x, y, d):
        bit = PASSAGE_BIT[d]
        for i in (2, 1, 0):
            tid = tid_at(x, y, i)
            if look(terrain, tid) in TERRAIN_IGNORE_PASSABILITY:
                continue
            if tid == 0:
                continue
            p = look(passg, tid)
            if (p & bit) != 0 or (p & 0x0F) == 0x0F:
                return False
            if look(prio, tid) == 0:
                return True
        return True

    def is_ledge(x, y):
        return any(look(terrain, tid_at(x, y, z)) == em.TERRAIN_LEDGE for z in range(zs))

    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for d in (2, 4, 6, 8):
            dx, dy = DELTA[d]
            nx, ny = x + dx, y + dy
            if not (0 <= nx < xs and 0 <= ny < ys):
                continue
            if not map_passable(x, y, d) or not map_passable(nx, ny, 10 - d):
                continue
            if is_ledge(nx, ny):                      # 언덕이면 걷는 대신 2칸 점프
                nx, ny = x + dx * 2, y + dy * 2
                if not (0 <= nx < xs and 0 <= ny < ys):
                    continue
            if (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    return seen


def ours_reachable(out: str, start: tuple[int, int]) -> tuple[set[tuple[int, int]], dict]:
    """우리 JSON(blocked/ledge)으로 걸어서 닿는 칸 집합 — WorldScene의 이동 판정과 같은 규칙."""
    path = os.path.join(em.OUT_DIR, f"{out}.json")
    d = json.load(open(path, encoding="utf-8"))
    bl, led = d["blocked"], d.get("ledge")
    cols, rows = d["cols"], d["rows"]
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dnum, (dx, dy) in DELTA.items():
            nx, ny = x + dx, y + dy
            if not (0 <= nx < cols and 0 <= ny < rows):
                continue
            ld = led[ny][nx] if led else 0
            if ld:
                if ld != dnum:            # 방향이 다르면 벽
                    continue
                nx, ny = x + dx * 2, y + dy * 2    # 방향이 맞으면 2칸 점프
                if not (0 <= nx < cols and 0 <= ny < rows) or bl[ny][nx]:
                    continue
            elif bl[ny][nx]:
                continue
            if (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    return seen, d


def main():
    ap = argparse.ArgumentParser(description="맵 JSON의 이동 가능 범위를 AR 원본 규칙과 대조한다")
    ap.add_argument("--ar")
    ap.add_argument("--map", type=int)
    ap.add_argument("--out")
    ap.add_argument("--start", help="BFS 시작 로컬좌표 'x,y'")
    args = ap.parse_args()
    ar = em.find_ar(args.ar)

    if args.map is not None:
        if not args.out or not args.start:
            sys.exit("--map 을 쓰면 --out 과 --start 도 같이 줄 것")
        sx, sy = (int(v) for v in args.start.split(","))
        targets = [(args.map, args.out, (sx, sy))]
    else:
        targets = DEFAULT_MAPS

    fail = 0
    for mid, out, start in targets:
        a = ar_reachable(ar, mid, start)
        b, data = ours_reachable(out, start)
        only_ar = sorted(a - b)
        only_ours = sorted(b - a)
        ledge_cells = sum(1 for r in data.get("ledge", []) for v in r if v)
        mark = "OK " if not only_ar and not only_ours else "❌ "
        print(f"{mark}Map{mid:03d} → {out:14s} 시작{start}  원본 {len(a)}칸 / 우리 {len(b)}칸  (언덕 {ledge_cells}칸)")
        if only_ar:
            fail += 1
            print(f"     원본에선 가는데 우리는 못 가는 칸 {len(only_ar)}: {only_ar[:15]}")
        if only_ours:
            fail += 1
            print(f"     우리는 가는데 원본에선 못 가는 칸 {len(only_ours)}: {only_ours[:15]}")
    if fail:
        sys.exit(f"\n대조 실패 {fail}건 — 맵 JSON이 원본과 다르게 움직인다.")
    print("\n전부 일치 — 우리 격자가 원본과 같은 범위를 준다.")


if __name__ == "__main__":
    main()
