#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Another Red(포켓몬 에센셜즈)의 배틀 기반 데이터(.dat = Ruby Marshal)를
우리 게임이 쓰는 JSON으로 변환한다. → 배틀 시스템의 "1:1 토대".

뽑는 것:
  types.dat   → src/data/ar/types.json    (20타입 상성: weak/resist/immune + 한글명)
  species.dat → src/data/ar/species.json  (종족값·타입·특성·레벨업기술·진화)
  moves.dat   → src/data/ar/moves.json    (위력·타입·분류·명중·PP·우선도·효과)

AR 원본 경로는 PC마다 다르다(리포 밖 소스). 아래 순서로 찾는다:
  1) 명령행 인자:  python3 extract-battle-data.py "<AR경로>"
  2) 환경변수 AR_PATH
  3) 자동 탐색(find): /mnt/d, /mnt/c/Users/*/Desktop 아래 *Another*Red*

사용법:
  cd myPokemon_AJ && python3 tools/ar-data/extract-battle-data.py
의존성: pip install rubymarshal
"""
import os, sys, json, glob

try:
    from rubymarshal.reader import loads
    from rubymarshal.classes import RubyObject, RubyString, Symbol
except ImportError:
    sys.exit("rubymarshal 필요: pip install rubymarshal")


# ── AR 원본 경로 찾기 ─────────────────────────────────────────
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

# 출력: 문자열 경로로 fetch하는 데이터라 public/assets/ 아래여야 build에 포함됨(AGENTS.md §3).
# 스크립트 위치 기준 상대경로(리포 이사에도 안전) → myPokemon_AJ/public/assets/data/ar/
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets", "data", "ar"))
os.makedirs(OUT, exist_ok=True)


# ── Ruby 값 → 파이썬 값 변환 헬퍼 ─────────────────────────────
def sym(v):
    """Symbol -> 'NAME' 문자열"""
    return v.name if isinstance(v, Symbol) else v


def txt(v):
    """RubyString/str -> 파이썬 str (한글 포함)"""
    if isinstance(v, RubyString):
        return v.text
    return v


def syms(lst):
    """Symbol 리스트 -> ['A','B',...]"""
    return [sym(x) for x in (lst or [])]


def load(name):
    return loads(open(os.path.join(DATA, name), "rb").read())


# ── 한글 메시지 매핑 (messages_kor_core.dat = MessageTypes 카테고리 리스트) ──
# 각 카테고리 dict는 {영문명 -> 한글명}. 우리 데이터의 영문 real_name을 키로 조회한다.
# 카테고리 인덱스는 실제 내용으로 검증함(아래 주석).
MSG = {}  # {카테고리 -> {영문:한글}}
_MSG_CAT = {
    "species": 1,   # 'Charizard' -> '리자몽'
    "kind":    2,   # 'Seed' -> '씨앗'   (분류: OO포켓몬)
    "dex":     3,   # 도감 설명문
    "move":    5,   # 'Megahorn' -> '메가혼'
    "moveDesc": 6,  # 기술 설명문
    "ability": 10,  # 'Stench' -> '악취'
    "item":    7,   # 도구명
}


def load_messages():
    """messages_kor_core.dat 로드 → MSG['species'] 같은 {영문:한글} 사전 구성. 없으면 빈 사전."""
    path = os.path.join(DATA, "messages_kor_core.dat")
    if not os.path.exists(path):
        print("  (messages_kor_core.dat 없음 — 한글명 생략, 영문 id 사용)")
        return
    cats = loads(open(path, "rb").read())
    for name, idx in _MSG_CAT.items():
        d = cats[idx] if idx < len(cats) and isinstance(cats[idx], dict) else {}
        MSG[name] = {txt(k): txt(v) for k, v in d.items()}


def ko(cat, en, fallback=None):
    """영문명 en을 해당 카테고리 한글로. 없으면 fallback(기본=영문명)."""
    if not en:
        return fallback
    return MSG.get(cat, {}).get(en, fallback if fallback is not None else en)


# ── 1) 타입 상성표 ────────────────────────────────────────────
def extract_types():
    src = load("types.dat")
    out = {}
    for key, obj in src.items():
        a = obj.attributes
        tid = sym(a["@id"])
        out[tid] = {
            "id": tid,
            "name": txt(a.get("@real_name")),          # 한글명
            "special": bool(a.get("@special_type")),    # (구세대 물리/특수 구분 흔적)
            "pseudo": bool(a.get("@pseudo_type")),      # ??? 같은 실제 아닌 타입
            # 방어 기준: 이 타입이 '받을 때'의 배율. 공격타입 A → 이 타입 D:
            #   A in weaknesses → 2배 / A in resistances → 0.5배 / A in immunities → 0배
            "weaknesses": syms(a.get("@weaknesses")),
            "resistances": syms(a.get("@resistances")),
            "immunities": syms(a.get("@immunities")),
        }
    save("types.json", out)
    return len(out)


# ── 2) 종족 데이터 ────────────────────────────────────────────
STAT_KEYS = ["HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED"]


def stat_dict(d):
    return {sym(k): v for k, v in (d or {}).items()}


def level_moves(lst):
    # @moves = [[level, Symbol(MOVE)], ...]
    out = []
    for pair in (lst or []):
        if isinstance(pair, (list, tuple)) and len(pair) >= 2:
            out.append([pair[0], sym(pair[1])])
    return out


def evolutions(lst):
    # @evolutions = [[Symbol(SPECIES), Symbol(METHOD), param, bool], ...]
    out = []
    for e in (lst or []):
        if isinstance(e, (list, tuple)) and len(e) >= 2:
            out.append({
                "species": sym(e[0]),
                "method": sym(e[1]),
                "param": sym(e[2]) if len(e) > 2 else None,
            })
    return out


def extract_species():
    src = load("species.dat")
    out = {}
    for key, obj in src.items():
        a = obj.attributes
        sid = sym(a["@id"])
        form = a.get("@form", 0)
        # 폼 0(기본형)만 키로. 폼>0은 뒤에 _form 붙여 구분 저장.
        out_key = sid if form in (0, None) else f"{sid}_{form}"
        en = txt(a.get("@real_name"))
        out[out_key] = {
            "id": sid,
            "form": form,
            "name": ko("species", en, en),          # 한글명(없으면 영문)
            "nameEn": en,
            "kind": ko("kind", txt(a.get("@real_category"))),   # 분류(예: 씨앗)
            "types": syms(a.get("@types")),
            "baseStats": stat_dict(a.get("@base_stats")),
            "abilities": syms(a.get("@abilities")),
            "hiddenAbilities": syms(a.get("@hidden_abilities")),
            "genderRatio": sym(a.get("@gender_ratio")),
            "growthRate": sym(a.get("@growth_rate")),
            "catchRate": a.get("@catch_rate"),
            "baseExp": a.get("@base_exp"),
            "eggGroups": syms(a.get("@egg_groups")),
            "levelMoves": level_moves(a.get("@moves")),
            "tutorMoves": syms(a.get("@tutor_moves")),
            "eggMoves": syms(a.get("@egg_moves")),
            "evolutions": evolutions(a.get("@evolutions")),
            "generation": a.get("@generation"),
        }
    save("species.json", out)
    return len(out)


# ── 3) 기술 데이터 ────────────────────────────────────────────
CATEGORY = {0: "Physical", 1: "Special", 2: "Status"}


def extract_moves():
    src = load("moves.dat")
    out = {}
    for key, obj in src.items():
        a = obj.attributes
        mid = sym(a["@id"])
        en = txt(a.get("@real_name"))
        desc_en = txt(a.get("@real_description"))
        out[mid] = {
            "id": mid,
            "name": ko("move", en, en),             # 한글명(없으면 영문)
            "nameEn": en,
            "type": sym(a.get("@type")),
            "category": CATEGORY.get(a.get("@category"), a.get("@category")),
            "power": a.get("@power"),
            "accuracy": a.get("@accuracy"),
            "pp": a.get("@total_pp"),
            "priority": a.get("@priority"),
            "target": sym(a.get("@target")),
            "effectChance": a.get("@effect_chance"),
            "functionCode": txt(a.get("@function_code")),
            "flags": syms(a.get("@flags")),
            "description": ko("moveDesc", desc_en, desc_en),   # 한글 설명(없으면 영문)
        }
    save("moves.json", out)
    return len(out)


def _json_default(o):
    # 혹시 남은 Ruby 값(RubyString/Symbol/RubyObject)을 안전하게 문자열로.
    if isinstance(o, RubyString):
        return o.text
    if isinstance(o, Symbol):
        return o.name
    return str(o)


def save(fname, obj):
    path = os.path.join(OUT, fname)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), default=_json_default)
    size = os.path.getsize(path)
    print(f"  → {os.path.relpath(path)}  ({len(obj)}개, {size//1024}KB)")


if __name__ == "__main__":
    print(f"AR 원본: {AR}")
    print(f"출력:   {OUT}")
    load_messages()
    nt = extract_types()
    ns = extract_species()
    nm = extract_moves()
    print(f"완료: 타입 {nt} · 종족 {ns} · 기술 {nm}")
