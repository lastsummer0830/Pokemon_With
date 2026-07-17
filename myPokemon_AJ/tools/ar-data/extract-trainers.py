"""
AR의 트레이너 정의(trainers.dat / trainer_types.dat)와 맵 위 배치(MapXXX.rxdata)를
우리 게임용 JSON 하나로 뽑는다.

쓰는 법:
    python3 tools/ar-data/extract-trainers.py --maps 10          # 1번도로
    python3 tools/ar-data/extract-trainers.py --maps 10,56

결과물: public/assets/data/ar/trainers.json
    {
      "defs": {                       # 트레이너 정의(팀·상금·패배대사)
        "YOUNGSTER:한주": {
          "type": "YOUNGSTER", "typeName": "반바지꼬마", "name": "한주",
          "baseMoney": 16,            # 상금 = 상대 팀 최고레벨 × baseMoney
          "loseText": "이건 없던 거로 칠래!",
          "sprite": "YOUNGSTER",      # public/assets/trainers/<sprite>.png (배틀 그림)
          "team": [{"id": "RATTATA", "level": 3}, ...]
        }
      },
      "placements": {                 # 맵 위 어디에 서 있나
        "10": [{
          "id": "YOUNGSTER:한주", "x": 25, "y": 13,
          "dir": "right",             # 바라보는 방향
          "sight": 4,                 # 시야 칸수(이벤트명 "Trainer(4)"에서)
          "overworld": "trainer_YOUNGSTER",
          "introText": "내 첫 포켓몬 배틀이야!",       # 눈 마주쳤을 때
          "afterText": "어린 아이 상대로 부끄럽지도 않아?"  # 이긴 뒤 말 걸면
        }]
      }
    }

⚠️ 585명을 통째로 뽑지 않는다 — `--maps`에 적은 맵에 실제로 서 있는 트레이너만.
   (extract-encounters.py와 같은 철학 — 리포 오염 방지)
"""
import os, re, json, argparse, sys
from rubymarshal.reader import loads

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]

OUT = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "public", "assets", "data", "ar", "trainers.json"))

# RPG Maker XP의 방향 번호 → 우리 게임 표기
DIRS = {2: "down", 4: "left", 6: "right", 8: "up"}

# 한국어 트레이너 타입명이 들어있는 번역 테이블 위치(messages_kor_core.dat의 13번 칸)
KOR_TRAINER_TYPES_SECTION = 13


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


def text(x):
    """AR 문자열은 bytes(UTF-8)로 나온다 → 파이썬 str로"""
    if isinstance(x, bytes):
        return x.decode("utf-8")
    return str(x)


def strip_speaker(s):
    """
    `\\xn[한주]내 첫 포켓몬 배틀이야!` → ("한주", "내 첫 포켓몬 배틀이야!")
    `\\xn[...]`은 AR의 이름창 태그다. 우리 대화박스도 이름창이 따로 있어 분리해 둔다.
    """
    m = re.match(r"^\\xn\[([^\]]*)\](.*)$", s, re.S)
    if m:
        return m.group(1), m.group(2)
    return None, s


def mon_entry(p):
    """
    trainers.dat의 팀 한 칸 → {"id","level"}.
    키가 rubymarshal Symbol이라 문자열로 바꿔서 꺼낸다(p["species"]로는 안 잡힌다).
    """
    d = {sym(k): v for k, v in p.items()}
    # species는 Symbol(:RATTATA) — sym()으로 이름만 꺼낸다(str()로 하면 ":"가 붙어 species.json 키와 안 맞는다).
    return {"id": sym(d["species"]), "level": int(d["level"])}


def parse_battle_call(s):
    """`TrainerBattle.start("YOUNGSTER", "한주", 0)` → ("YOUNGSTER", "한주", 0)"""
    m = re.search(r'TrainerBattle\.start\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*(?:,\s*(\d+))?', s)
    if not m:
        return None
    return m.group(1), m.group(2), int(m.group(3) or 0)


def read_map_placements(ar, mid):
    """MapXXX.rxdata의 이벤트 중 `Trainer(n)` 이름을 가진 것만 골라 배치 정보로."""
    path = f"{ar}/Data/Map{int(mid):03d}.rxdata"
    if not os.path.isfile(path):
        sys.exit(f"맵 파일이 없다: {path}")
    m = loads(open(path, "rb").read())
    out = []
    for ev in m.attributes["@events"].values():
        at = ev.attributes
        name = text(at["@name"])
        sight = re.match(r"^trainer\((\d+)\)$", name, re.I)
        if not sight:
            continue
        pages = at["@pages"]
        page0 = pages[0].attributes
        graphic = page0["@graphic"].attributes

        # page0의 명령에서 배틀 호출과 첫 대사를 찾는다.
        battle, intro = None, None
        for c in page0["@list"]:
            ca = c.attributes
            code, params = ca["@code"], ca["@parameters"]
            if code == 111 and len(params) >= 2:               # 조건분기(스크립트)
                battle = battle or parse_battle_call(text(params[1]))
            elif code == 101 and intro is None:                # 대사 표시
                intro = strip_speaker(text(params[0]))
        if not battle:
            continue

        # page1 = 이 트레이너를 이긴 뒤(셀프스위치 A) 말 걸면 나오는 대사
        after = None
        if len(pages) > 1:
            for c in pages[1].attributes["@list"]:
                ca = c.attributes
                if ca["@code"] == 101:
                    after = strip_speaker(text(ca["@parameters"][0]))
                    break

        ttype, tname, _ver = battle
        out.append({
            "id": f"{ttype}:{tname}",
            "x": int(at["@x"]),
            "y": int(at["@y"]),
            "dir": DIRS.get(graphic["@direction"], "down"),
            "sight": int(sight.group(1)),
            "overworld": text(graphic["@character_name"]),
            # 이름창에 띄울 화자 = 원본 대사의 `\xn[...]` 태그 값(예: "한주").
            "speaker": (intro[0] if intro else None) or (after[0] if after else None) or tname,
            "introText": intro[1] if intro else "",
            "afterText": after[1] if after else "",
        })
    return out


def main():
    ap = argparse.ArgumentParser(description="AR 트레이너 정의 + 맵 배치 추출")
    ap.add_argument("--maps", default="10", help="맵 번호 쉼표구분 (기본 10=1번도로)")
    ap.add_argument("--ar", default=None)
    a = ap.parse_args()
    ar = find_ar(a.ar)
    want = [m.strip() for m in a.maps.split(",") if m.strip()]

    # 1) 맵에 실제로 서 있는 트레이너만 먼저 모은다.
    placements = {mid: read_map_placements(ar, mid) for mid in want}
    needed = {p["id"] for rows in placements.values() for p in rows}
    if not needed:
        sys.exit(f"이 맵들에 트레이너 이벤트가 없다: {want}")

    # 2) 한국어 타입명 표 (Youngster → 반바지꼬마)
    kor = loads(open(f"{ar}/Data/messages_kor_core.dat", "rb").read())
    kor_types = kor[KOR_TRAINER_TYPES_SECTION] or {}

    # 3) 타입 정보(상금)
    types = {}
    for k, v in loads(open(f"{ar}/Data/trainer_types.dat", "rb").read()).items():
        at = v.attributes
        types[sym(k)] = {
            "realName": text(at["@real_name"]),
            "baseMoney": int(at["@base_money"]),
        }

    # 4) 필요한 트레이너 정의만
    defs = {}
    for k, v in loads(open(f"{ar}/Data/trainers.dat", "rb").read()).items():
        at = v.attributes
        ttype, tname = sym(at["@trainer_type"]), text(at["@real_name"])
        key = f"{ttype}:{tname}"
        if key not in needed:
            continue
        ti = types.get(ttype)
        if not ti:
            sys.exit(f"트레이너 타입이 trainer_types.dat에 없다: {ttype}")
        defs[key] = {
            "type": ttype,
            "typeName": text(kor_types.get(ti["realName"], ti["realName"])),
            "name": tname,
            "baseMoney": ti["baseMoney"],
            "loseText": text(at["@real_lose_text"]),
            "sprite": ttype,
            # 기술은 안 적는다 — AR도 `reset_moves`(레벨업 학습표 최근 4개)로 채운다.
            "team": [mon_entry(p) for p in at["@pokemon"]],
        }

    missing = needed - set(defs)
    if missing:
        sys.exit(f"맵이 부르는데 trainers.dat엔 없는 트레이너: {sorted(missing)}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"defs": defs, "placements": placements},
              open(OUT, "w"), ensure_ascii=False, indent=1)

    for mid, rows in placements.items():
        print(f"Map{mid}: 트레이너 {len(rows)}명")
        for p in rows:
            d = defs[p["id"]]
            team = " + ".join(f"{t['id']} L{t['level']}" for t in d["team"])
            print(f"   {d['typeName']} {d['name']}  ({p['x']},{p['y']}) "
                  f"{p['dir']} 시야{p['sight']}  상금base {d['baseMoney']}")
            print(f"      팀: {team}")
            print(f"      먼저: {p['introText']}")
            print(f"      지면: {d['loseText']}")
            print(f"      이긴 뒤: {p['afterText']}")
    print(f"\n→ {OUT}")


if __name__ == "__main__":
    main()
