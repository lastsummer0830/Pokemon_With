#!/usr/bin/env python3
"""
원본(Another Red) ↔ 우리 게임 **전수 대조** — 눈으로 틀린그림찾기 하지 말고 이걸 돌린다.

    python3 tools/ar-map/audit-parity.py            # 이식한 맵 전부
    python3 tools/ar-map/audit-parity.py --map 160  # 한 장만
    python3 tools/ar-map/audit-parity.py --verbose  # 못 옮긴 명령의 원문까지

왜 있나 (2026-08-04 사용자 지적):
  "니가 하나하나 확인은 하고 있냐" — 그때까지는 **작업할 때만** 그 맵을 훑었다.
  그래서 이식한 뒤에 원본이 바뀌거나 우리가 빠뜨린 것을 **사람이 눈으로** 찾아야 했다.
  이 도구는 원본 맵의 이벤트·페이지·명령·속성을 전부 세서 우리 결과물과 맞춰보고
  **"원본에 있는데 우리에게 없는 것"만** 뱉는다.

무엇을 보나:
  1) 이벤트 수      — 원본 이벤트 중 우리 JSON에 안 들어간 것과 그 이유
  2) 명령(코드)     — 페이지 안의 RMXP 명령 중 우리가 못 옮긴 것 (코드별 집계 + 원문)
  3) 페이지 속성    — move_type(돌아다님)·step_anime(제자리 발동작)·always_on_top·through·trigger
  4) 엔진 동작      — 원본 스크립트가 하는데 우리가 안 하는 것(말 걸면 돌아보기 등)은 ENGINE_NOTES에 적어둔다
"""
import argparse, json, os, sys, struct
from rubymarshal.reader import loads

AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, "..", ".."))

# 우리가 이식한 맵 → (설명, 이벤트 JSON 이름 or None)
#  None = 그 맵의 이벤트를 **씬 코드가 손으로 들고 있다**(연구소·체육관·센터·마트). 그건 "미반영"이 아니라
#         "다른 방식으로 반영"이라 이벤트 JSON 대조 대신 개수만 알린다.
MAPS = {
    10:  ("1번도로",            "route1"),
    55:  ("태초마을",           "pallet_town"),
    56:  ("상록시티",           "viridian_city"),
    156: ("라이벌(그린)의 집",  None),
    157: ("오박사 연구소",      None),
    158: ("상록 포켓몬센터",    None),
    159: ("상록 프렌들리숍",    None),
    160: ("상록 민가1",         "viridian_house1"),
    161: ("상록 민가2",         "viridian_house2"),
    162: ("상록 민가3",         "viridian_house3"),
    163: ("상록 민가4",         "viridian_house4"),
    194: ("상록체육관",         None),
}

# extract-events.py가 실제로 옮기는 명령. 여기 없는 코드가 나오면 "미반영"으로 잡힌다.
HANDLED = {
    0: "빈 줄", 101: "대사", 401: "대사(이어짐)", 102: "선택지", 402: "선택지 갈래", 404: "갈래 끝",
    111: "조건분기(pbItemBall/pbReceiveItem만)", 412: "분기 끝", 121: "스위치 조작", 123: "셀프스위치",
    250: "효과음", 355: "스크립트(pbPickBerry/pbPokemonMart만)", 655: "스크립트(이어짐)",
    209: "이동경로 지정(연출 — 건너뜀)", 509: "이동경로 끝", 108: "주석", 408: "주석(이어짐)",
    201: "장소이동(문 — warpDefs가 따로 들고 있다)",
}
# 코드 번호 → 사람이 읽는 이름(미반영 목록을 볼 때 뭐가 빠졌는지 바로 알게)
CODE_NAME = {
    103: "숫자 입력", 104: "글상자 설정", 106: "대기", 112: "루프", 113: "루프 중단", 115: "이벤트 처리 중단",
    116: "이벤트 일시 소거", 117: "공통 이벤트", 118: "라벨", 119: "라벨로 점프", 122: "변수 조작",
    125: "소지금 증감", 126: "아이템 증감", 129: "멤버 변경", 201: "장소 이동", 202: "이벤트 위치 설정",
    203: "맵 스크롤", 204: "맵 설정 변경", 205: "안개 색조", 206: "안개 불투명도", 207: "애니메이션 표시",
    403: "선택지 '취소' 갈래", 411: "조건분기 else", 413: "루프 끝", 314: "상태이상 회복",
    208: "투명 상태 변경", 210: "이동 완료 대기", 221: "화면 페이드아웃", 222: "화면 페이드인",
    223: "화면 색조 변경", 224: "화면 플래시", 225: "화면 흔들기", 231: "그림 표시", 232: "그림 이동",
    235: "그림 지우기", 236: "날씨 효과", 241: "BGM 연주", 242: "BGM 페이드아웃", 245: "BGS 연주",
    246: "BGS 페이드아웃", 247: "BGM/BGS 기억", 248: "BGM/BGS 복원", 249: "ME 연주",
    251: "효과음 정지", 351: "메뉴 호출", 352: "저장 화면 호출", 353: "게임 오버", 354: "타이틀로",
}
# 이벤트 이름이 이러면 **JSON이 아니라 다른 방식으로 반영**된 것 — "빠짐"이 아니다.
#  문 = WorldScene.warpDefs / 실내 씬의 spawn·exit · 트레이너 = trainers.json의 placements · 나무베기 = 미구현(알고 있음)
ELSEWHERE = ("Home door", "Exit", "CutTree")
ELSEWHERE_PREFIX = ("Trainer",)


def handled_elsewhere(name):
    return name in ELSEWHERE or name.startswith(ELSEWHERE_PREFIX)


def is_door(ev):
    """이름이 뭐든 **장소이동(201)만 하는 이벤트 = 문**. 워프(warpDefs·씬 exit)로 반영돼 있다.
    민가 4채의 나가는 문은 이름이 그냥 'EV001'이라 이름만 봐선 못 거른다."""
    for pg in ev["@pages"]:
        codes = {int(str(c.attributes["@code"])) for c in pg.attributes["@list"]}
        if 201 in codes and not (codes & {101, 401, 102}):
            return True
    return False


# 원본 스크립트를 읽어 확인한 **엔진 동작**(맵 데이터엔 안 나오지만 원본이 항상 하는 것).
#  ⚠️ 여기 적힌 것은 사람이 코드에 반영했는지 직접 확인해야 한다 — 이 도구가 자동 판정하진 않는다.
ENGINE_NOTES = [
    ("✅ 반영됨(2026-08-04) — 말 걸면 이벤트가 플레이어를 돌아본다",
     "Interpreter.rb: trigger<3이면 event.lock → Game_Character#lock → turn_toward_player. "
     "@prelock_direction=0이라 unlock 후에도 **계속 플레이어를 본다**(원래 방향으로 안 돌아감).\n"
     "       → mapEvents.faceDirToward + WorldScene.turnToPlayer / BuildingScene.onKey. direction_fix면 예외."),
    ("✅ 반영됨(2026-08-04) — 제자리 발동작(step_anime)",
     "열매나무가 바람에 흔들리는 것. 속도는 원본 pattern_update_speed의 1/4 = 8fps.\n"
     "       → fieldEventRunner.applyEventSprite. ⚠️열매나무는 세로 4줄이 방향이 아니라 성장단계다."),
    ("이동경로(209)는 연출이라 건너뛴다",
     "고개 돌리기·점프 등. 대사 뜻이 바뀌지 않는 것만 건너뛰어야 한다 — 걸어서 사라지는 NPC가 나오면 그때 손볼 것."),
]


def find_ar():
    for p in AR_CANDIDATES:
        if os.path.isdir(p):
            return p
    sys.exit("AR 원본 폴더를 못 찾았다.")


def b2s(x):
    return x.decode("utf-8", "replace") if isinstance(x, (bytes, bytearray)) else str(x)


def audit(ar, mid, label, out_name, verbose):
    m = loads(open(f"{ar}/Data/Map%03d.rxdata" % mid, "rb").read()).attributes
    events = m["@events"]

    ours = None
    if out_name:
        p = os.path.join(PROJ, "public", "assets", "world", f"{out_name}_events.json")
        if os.path.isfile(p):
            ours = {e["id"]: e for e in json.load(open(p, encoding="utf-8"))["events"]}
        else:
            p2 = os.path.join(PROJ, "public", "assets", "house", f"{out_name}_events.json")
            if os.path.isfile(p2):
                ours = {e["id"]: e for e in json.load(open(p2, encoding="utf-8"))["events"]}

    missing_codes = {}        # 코드 → [원문 조각]  (스토리라 제외된 페이지까지 전부)
    live_codes = {}           # ⭐ 그중 **지금 게임에서 실제로 도는 페이지**의 것만
    attr_gaps = []            # 우리가 모델링 안 한 페이지 속성 (전부)
    live_attrs = []           # ⭐ 그중 지금 실제로 영향 있는 것만
    dropped = []              # 원본엔 있는데 우리 JSON엔 없는 이벤트(다른 방식 반영 제외)
    elsewhere = []            # 문·트레이너처럼 JSON 밖에서 반영한 것
    partial = []              # 반쪽만 옮긴 페이지

    def live_page(eidn, pi):
        """이 페이지가 **지금 우리 게임에서 실제로 도는가**.
        ours가 없으면(씬이 직접 구현한 맵) 판정 불가 → False로 두고 전체 목록에만 남긴다."""
        if ours is None or eidn not in ours:
            return False
        pgs = ours[eidn]["pages"]
        if pi >= len(pgs):
            return False
        pg = pgs[pi]
        if pg.get("partial"):
            return False
        c = pg.get("cond", {})
        return "variable" not in c and "switch" not in c and "switch2" not in c

    for eid in sorted(events, key=lambda k: int(str(k))):
        ev = events[eid].attributes
        name = b2s(ev["@name"]); x, y = int(str(ev["@x"])), int(str(ev["@y"]))
        eidn = int(str(eid))
        tag = f"[{eidn}]{name}({x},{y})"

        for pi, pg in enumerate(ev["@pages"]):
            p = pg.attributes
            g = p["@graphic"].attributes
            gname = b2s(g["@character_name"])
            trig = int(str(p["@trigger"]))

            live = live_page(eidn, pi)
            ourpg = (ours or {}).get(eidn, {}).get("pages", [])
            ourpg = ourpg[pi] if pi < len(ourpg) else {}
            def note_attr(msg):
                attr_gaps.append(msg)
                if live:
                    live_attrs.append(msg)

            # ── 페이지 속성 중 우리가 모델링하지 않은 것
            if gname:
                if int(str(p["@move_type"])) != 0:
                    note_attr(f"{tag} p{pi}: move_type={p['@move_type']} (원본은 돌아다닌다 — 우린 고정)")
                if str(p["@step_anime"]) == "True" and not ourpg.get("step"):
                    note_attr(f"{tag} p{pi}: step_anime (제자리 발동작 — 우린 정지 프레임)")
                if str(p["@always_on_top"]) == "True":
                    note_attr(f"{tag} p{pi}: always_on_top (항상 위에 그림)")
                if str(p["@direction_fix"]) == "True" and not ourpg.get("fixed"):
                    note_attr(f"{tag} p{pi}: direction_fix (말 걸어도 안 돌아봐야 하는데 값을 안 들고 간다)")
                if str(p["@through"]) == "True":
                    note_attr(f"{tag} p{pi}: through (통과 가능 — 우린 무조건 막는다)")
            if not (handled_elsewhere(name) or is_door(ev)):
                if trig in (1, 2):
                    note_attr(f"{tag} p{pi}: trigger={trig} (접촉 발동 — 우린 말걸기만)")
                elif trig == 3:
                    attr_gaps.append(f"{tag} p{pi}: trigger=3 (자동실행 — 스토리 컷신)")
                elif trig == 4:
                    attr_gaps.append(f"{tag} p{pi}: trigger=4 (병렬처리)")

            # ── 명령
            for c in p["@list"]:
                ca = c.attributes
                code = int(str(ca["@code"]))
                if code in HANDLED:
                    continue
                txt = ""
                for pp in ca["@parameters"]:
                    if isinstance(pp, (bytes, bytearray)):
                        txt += b2s(pp) + " "
                missing_codes.setdefault(code, []).append(f"{tag} p{pi} {txt.strip()[:60]}")
                if live:
                    live_codes.setdefault(code, []).append(f"{tag} p{pi} {txt.strip()[:60]}")

        # ── 우리 JSON에 들어갔나
        if handled_elsewhere(name) or is_door(ev):
            elsewhere.append(tag)
        elif ours is not None and eidn not in ours:
            dropped.append(tag)
        elif ours is not None:
            for pi, pg in enumerate(ours[eidn]["pages"]):
                if pg.get("partial"):
                    partial.append(f"{tag} p{pi}")

    # ── 출력
    total_ev = len(events)
    got = len(ours) if ours is not None else None
    head = f"■ Map{mid} {label}  — 원본 이벤트 {total_ev}개"
    head += f" / 우리 {got}개" if got is not None else " / (씬 코드가 직접 구현 — JSON 대조 불가)"
    print(head)

    # ⭐ 지금 게임에서 **실제로 도는 페이지**의 구멍 = 진짜 고쳐야 할 것
    if live_codes or live_attrs:
        print("   ⭐ 지금 실제로 영향 있는 구멍:")
        for c, v in sorted(live_codes.items()):
            print(f"       명령 {c}({CODE_NAME.get(c, '?')}) ×{len(v)} — {v[0]}")
        for a in live_attrs:
            print(f"       속성 {a}")

    # 아래는 참고 — 스토리라 일부러 뺀 페이지·다른 방식으로 반영한 것
    if elsewhere:
        print(f"   · JSON 밖에서 반영(문·트레이너 등) {len(elsewhere)}개: " + ", ".join(elsewhere[:5]) + ("…" if len(elsewhere) > 5 else ""))
    if dropped:
        print(f"   · 우리 JSON에 없는 이벤트 {len(dropped)}개: " + ", ".join(dropped[:6]) + ("…" if len(dropped) > 6 else ""))
    if partial:
        print(f"   · 반쪽만 옮긴 페이지(스토리 대기) {len(partial)}개: " + ", ".join(partial[:5]) + ("…" if len(partial) > 5 else ""))
    other_codes = sum(len(v) for v in missing_codes.values()) - sum(len(v) for v in live_codes.items() for _ in [0])
    rest = {c: v for c, v in missing_codes.items() if c not in live_codes}
    if rest:
        print("   · (참고) 안 도는 페이지의 못 옮긴 명령: "
              + ", ".join(f"{c}({CODE_NAME.get(c, '?')})×{len(v)}" for c, v in sorted(rest.items())))
        if verbose:
            for c, v in sorted(rest.items()):
                for line in v[:3]:
                    print(f"       {c}: {line}")
    if not (live_codes or live_attrs):
        print("   ✅ 지금 도는 페이지에는 구멍 없음")
    print()
    return dict(live=len(live_attrs) + sum(len(v) for v in live_codes.values()),
                dropped=len(dropped), partial=len(partial),
                codes=sum(len(v) for v in missing_codes.values()), attrs=len(attr_gaps))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", type=int)
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    ar = find_ar()
    todo = {a.map: MAPS[a.map]} if a.map else MAPS
    print(f"AR 원본: {ar}\n")
    tot = dict(live=0, dropped=0, partial=0, codes=0, attrs=0)
    for mid, (label, out) in todo.items():
        r = audit(ar, mid, label, out, a.verbose)
        for k in tot:
            tot[k] += r[k]
    print("─" * 70)
    print(f"⭐ 지금 실제로 영향 있는 구멍 {tot['live']}개")
    print(f"   (참고) 빠진 이벤트 {tot['dropped']} · 반쪽 페이지 {tot['partial']} · "
          f"안 도는 페이지의 명령 {tot['codes']} · 속성 {tot['attrs']}")
    print("\n■ 맵 데이터엔 안 나오는 엔진 동작 (원본 스크립트 실측 — 코드에 반영했는지 사람이 확인할 것)")
    for title, why in ENGINE_NOTES:
        print(f"   · {title}\n       {why}")
