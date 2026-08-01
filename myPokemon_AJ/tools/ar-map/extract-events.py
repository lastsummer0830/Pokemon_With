#!/usr/bin/env python3
"""
AR(Another Red) 맵의 **이벤트**(NPC 대사·팻말·바닥 아이템·열매나무)를 우리 게임용 JSON으로 뽑는다.

    python3 tools/ar-map/extract-events.py            # 우리가 이식한 맵 전부
    python3 tools/ar-map/extract-events.py --map 10   # 한 장만

왜 필요한가 (2026-08-03 원본 전수 대조에서 나온 것):
  우리는 맵 그림·충돌·트레이너만 가져왔고 **말 걸기로 반응하는 것들을 통째로 빼먹고 있었다.**
  1번도로 팻말·바닥 아이템 3개·열매나무 2그루, 태초마을 NPC 2명·팻말, 상록시티 NPC 2명·팻말·아이템 …
  (원본 이벤트 39개 중 우리 것 = 문 6개 + 트레이너 2명뿐이었다.)

원본 이벤트 명령 코드(RPG Maker XP):
  101/401 대사 · 102/402/404 선택지 · 111+412 조건분기 · 123 셀프스위치 · 355 스크립트 · 201 이동(문)
텍스트 코드(AR Messages.rb 실측):
  \\xn[이름] = 이름창(우리 DialogBox의 speaker) · \\pn = 플레이어 이름 · \\c[n] = 글자색 · \\. = 뜸들이기
  <ac> = 가운데 정렬(팻말에 쓰인다)
"""
import argparse, json, os, re, sys, glob
from rubymarshal.reader import loads

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

# 우리가 이식한 맵 → 출력 파일 이름(public/assets/world/<이름>_events.json)
MAPS = {
    10: "route1",
    55: "pallet_town",
    56: "viridian_city",
}

PLAYER_TOKEN = "{PLAYER}"   # 런타임에 플레이어 이름으로 바꾼다


def find_ar() -> str:
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본 폴더를 못 찾았다.\n"
             "찾는 법: find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname '*Another*Red*' -type d")


def b2s(x):
    return x.decode("utf-8", "replace") if isinstance(x, (bytes, bytearray)) else str(x)


def clean(text: str):
    """AR 텍스트 코드 → (이름창, 본문, 가운데정렬 여부)."""
    centered = "<ac>" in text
    text = text.replace("<ac>", "")
    speaker = None
    # 이름창. ⚠️ 안에 색코드가 또 대괄호를 쓴다(`\xn[\c[1]\pn]`) → 그 대괄호를 통째로 한 덩어리로 본다.
    m = re.search(r"\\xn\[((?:\\c\[\d+\]|[^\]])*)\]", text)
    if m:
        speaker = re.sub(r"\\c\[\d+\]", "", m.group(1)).strip()
        speaker = speaker.replace("\\pn", PLAYER_TOKEN)
        text = text[:m.start()] + text[m.end():]
    text = re.sub(r"\\c\[\d+\]", "", text)          # 색
    text = text.replace("\\pn", PLAYER_TOKEN)
    text = text.replace("\\.", "").replace("\\!", "")   # 뜸들이기(우리 대사창은 타자기라 필요 없다)
    text = re.sub(r"\\[a-zA-Z]+\[[^\]]*\]", "", text)   # 남은 코드
    return (speaker or None), text.strip(), centered


def read_page(page):
    """한 페이지의 명령을 우리 형식으로. 대사/선택지만 다루고, 못 옮기는 건 skipped로 알린다."""
    lines, skipped = [], []
    choice = None          # 선택지 진행 중 {"opts": [...], "branches": {i: [lines]}}
    branch_idx = None
    for c in page.attributes["@list"]:
        ca = c.attributes
        code = int(str(ca["@code"]))
        p = ca["@parameters"]
        if code in (101, 401):
            sp, t, ac = clean(b2s(p[0]))
            if not t:
                continue
            line = {"text": t}
            if sp:
                line["speaker"] = sp
            if ac:
                line["center"] = True
            if branch_idx is None:
                lines.append(line)
            else:
                choice["branches"][branch_idx].append(line)
        elif code == 102:                      # 선택지 보이기
            opts = [b2s(o) for o in p[0]] if isinstance(p[0], list) else []
            choice = {"opts": opts, "branches": {}}
        elif code == 402:                      # 선택지 갈래
            if choice is None:                 # 우리가 못 옮긴 구조 안의 갈래 → 본문으로 흘려보낸다
                skipped.append("선택지 갈래(짝이 되는 선택지 없음)")
                continue
            branch_idx = int(str(p[0]))
            choice["branches"].setdefault(branch_idx, [])
        elif code == 404:                      # 갈래 끝
            if choice:
                lines.append({"choice": choice["opts"],
                              "branches": [choice["branches"].get(i, []) for i in range(len(choice["opts"]))]})
                choice, branch_idx = None, None
        elif code == 111:                      # 조건분기 — 아이템 볼(pbItemBall)만 알아본다
            s = b2s(p[1]) if len(p) > 1 else ""
            m = re.search(r"pbItemBall\(:([A-Z0-9_]+)\)", s)
            if m:
                lines.append({"item": m.group(1)})
            else:
                skipped.append(f"조건분기: {s[:40]}")
        elif code == 355 or code == 655:       # 스크립트
            s = b2s(p[0])
            m = re.search(r"pbPickBerry\(:([A-Z0-9_]+),\s*(\d+)\)", s)
            if m:
                lines.append({"berry": m.group(1), "count": int(m.group(2))})
            elif s.strip():
                skipped.append(f"스크립트: {s[:40]}")
        elif code in (0, 412, 123, 108, 408):  # 빈 줄·분기끝·셀프스위치·주석 — 우리 쪽에서 알아서 한다
            continue
        elif code == 201:
            skipped.append("이동(문) — 워프는 WorldScene의 warpDefs가 따로 들고 있다")
        else:
            skipped.append(f"코드{code}")
    return lines, skipped


def page_condition(page):
    """페이지 조건 → 우리 형식. 셀프스위치만 쓴다(그 외는 스토리 스위치라 지금은 못 옮긴다)."""
    c = page.attributes["@condition"].attributes
    out = {}
    if str(c["@self_switch_valid"]) == "True":
        out["selfSwitch"] = b2s(c["@self_switch_ch"])
    if str(c["@switch1_valid"]) == "True":
        out["switch"] = int(str(c["@switch1_id"]))
    if str(c["@switch2_valid"]) == "True":
        out["switch2"] = int(str(c["@switch2_id"]))
    if str(c["@variable_valid"]) == "True":
        out["variable"] = [int(str(c["@variable_id"])), int(str(c["@variable_value"]))]
    return out


def kind_of(name: str, graphic: str, lines) -> str:
    if name == "Item" or any("item" in l for l in lines):
        return "item"
    if name == "BerryPlant" or any("berry" in l for l in lines):
        return "berry"
    if not graphic:
        return "sign"          # 그림 없는 말걸기 = 팻말/간판(원본도 타일 위에 얹은 빈 이벤트다)
    return "npc"


def extract(ar: str, mid: int, out_name: str, out_dir: str):
    m = loads(open(f"{ar}/Data/Map%03d.rxdata" % mid, "rb").read()).attributes
    events, notes = [], []
    for eid in sorted(m["@events"], key=lambda k: int(str(k))):
        ev = m["@events"][eid].attributes
        name = b2s(ev["@name"])
        x, y = int(str(ev["@x"])), int(str(ev["@y"]))
        if name in ("Home door", "CutTree") or name.startswith("Trainer"):
            notes.append(f"{name}({x},{y}) — 따로 처리(문=warpDefs · 트레이너=trainerSpots · 나무베기=미구현)")
            continue
        pages = []
        for pg in ev["@pages"]:
            lines, skipped = read_page(pg)
            gfx = b2s(pg.attributes["@graphic"].attributes["@character_name"])
            trig = int(str(pg.attributes["@trigger"]))
            if skipped:
                notes.append(f"[{eid}]{name}({x},{y}) p{len(pages)+1}: 못 옮긴 것 — " + " / ".join(skipped[:3]))
            page = {"graphic": gfx, "trigger": trig, "cond": page_condition(pg), "lines": lines}
            # ⚠️ 조건분기·이동경로처럼 못 옮긴 명령이 섞인 페이지는 **반쪽짜리**다.
            #    그대로 쓰면 갈래별 대사가 한 줄로 이어져 "그래? / 그래?"처럼 이상하게 나온다.
            #    → partial로 찍어 두고 게임에선 건너뛴다(스토리로 제대로 붙일 때 이 표시를 지운다).
            if skipped:
                page["partial"] = True
            pages.append(page)
        # 대사도 아이템도 없는 페이지뿐이면(스토리 스위치 전용) 건너뛴다.
        if not any(p["lines"] for p in pages):
            notes.append(f"[{eid}]{name}({x},{y}) — 대사 없음(스토리 전용) → 제외")
            continue
        gfx0 = next((p["graphic"] for p in pages if p["graphic"]), "")
        events.append({"id": int(str(eid)), "name": name, "x": x, "y": y,
                       "kind": kind_of(name, gfx0, [l for p in pages for l in p["lines"]]),
                       "graphic": gfx0, "pages": pages})
    path = os.path.join(out_dir, f"{out_name}_events.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"arMap": mid, "events": events}, f, ensure_ascii=False, indent=1)
    print(f"{out_name}: 이벤트 {len(events)}개 → {path}")
    for n in notes:
        print("   · " + n)
    return events


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", type=int, help="AR 맵 번호 하나만")
    ap.add_argument("--out-dir", default="public/assets/world")
    a = ap.parse_args()
    ar = find_ar()
    os.makedirs(a.out_dir, exist_ok=True)
    todo = {a.map: MAPS[a.map]} if a.map else MAPS
    for mid, nm in todo.items():
        extract(ar, mid, nm, a.out_dir)
