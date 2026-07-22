#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Another Red(포켓몬 에센셜즈)의 **기술 배틀 애니메이션**을 우리 게임이 쓰는 JSON으로 변환한다.

뽑는 것:
  Data/PkmnAnimations.rxdata → public/assets/data/ar/anim/<번호>.json   (애니 1개 = 파일 1개)
  Data/move2anim.dat         → public/assets/data/ar/anim/index.json    (기술 → 애니 번호)
  Graphics/Animations/*.png  → public/assets/animations/                (--sheets 일 때만 복사)

⚠️ 원본 포맷을 "짐작해서" 만든 게 아니다. 아래는 전부 AR 자신의 루비 스크립트(Data/Scripts.rxdata)에서 읽은 값이다.
   - 셀(cel) 27칸의 의미  : class AnimFrame (Scripts: BattleAnimationPlayer)
   - 시트 자르는 법        : pbSpriteSetAnimFrame → 한 칸 192x192, 가로 5칸(pattern%5, pattern/5)
   - pattern -1 = 사용자 스프라이트 / -2 = 상대 스프라이트 (시트가 아니라 포켓몬 그림을 쓴다)
   - 재생 속도            : PBAnimationPlayerX#update → (경과초 * 20) = **20fps 고정**
   - focus(26번 칸)       : 1=상대기준 2=사용자기준 3=둘을 잇는 선 기준 4=화면 절대좌표
       화면 기준점은 Battle::Scene의 FOCUSUSER=(128,224) / FOCUSTARGET=(384,96) (AR 내부해상도 512x384)
   - timing(효과음·배경)  : class PBAnimTiming (0=SE재생 1=배경설정 2=배경변화 3=전경설정 4=전경변화)
   - 상대가 쓸 때         : move2anim[1](OppMove)에 있으면 그걸, 없으면 [0]을 쓴다 (pbFindMoveAnimDetails)

사용법:
  python3 tools/ar-anim/extract-animations.py             # JSON만
  python3 tools/ar-anim/extract-animations.py --sheets    # JSON + 시트 PNG 복사
  (AR 경로는 인자 / AR_PATH 환경변수 / 자동탐색 순으로 찾는다 — PC마다 경로가 다르므로.)
의존성: pip install rubymarshal
"""
import io, os, sys, json, glob, shutil

try:
    from rubymarshal import reader as rr
    from rubymarshal.classes import RubyString, Symbol
except ImportError:
    sys.exit("rubymarshal 필요: pip install rubymarshal")


# ── ① Ruby Marshal 'C'(UserClass) 토큰 지원 ────────────────────
#  PkmnAnimations.rxdata는 `class PBAnimation < Array`(Array를 상속한 클래스)를 담고 있다.
#  이건 marshal에서 'C' 토큰으로 저장되는데 rubymarshal이 지원하지 않아 그대로는 못 읽는다
#  ("token b'C' is not recognized"). 형식은 `C <클래스심볼> <실제객체>` 뿐이라 여기서 직접 처리한다.
class RubyUserList(list):
    """Ruby의 `class Foo < Array` = 리스트 + 인스턴스변수(@array 등)."""
    ruby_class_name = None
    attributes = None


class UserClassReader(rr.Reader):
    def read(self, in_ivar=False):
        pos = self.fd.tell()
        if self.fd.read(1) != b"C":
            self.fd.seek(pos)                 # 우리 토큰이 아니면 원래 리더에게 넘긴다
            return super().read(in_ivar=in_ivar)
        class_symbol = super().read()          # :PBAnimation / :PBAnimations
        idx = len(self.objects)                # 안쪽 객체가 등록될 자리(링크 참조용)
        inner = super().read()                 # 실제 Array
        result = RubyUserList(inner) if isinstance(inner, list) else inner
        result.ruby_class_name = class_symbol.name if isinstance(class_symbol, Symbol) else str(class_symbol)
        if idx < len(self.objects):
            self.objects[idx] = result         # 나중 나오는 링크(@)가 껍데기를 가리키게 바꿔둔다
        if in_ivar:
            result.attributes = self.read_attributes()
        return result


def rxload(path):
    fd = io.BytesIO(open(path, "rb").read())
    if fd.read(2) != b"\x04\x08":
        sys.exit(f"Ruby Marshal 4.8 파일이 아님: {path}")
    return UserClassReader(fd).read()


# ── ② 경로 ────────────────────────────────────────────────────
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

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DATA = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "data", "ar", "anim"))
OUT_SHEET = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "animations"))
os.makedirs(OUT_DATA, exist_ok=True)

COPY_SHEETS = "--sheets" in sys.argv
COPY_SE = "--se" in sys.argv
OUT_SE = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "audio", "anim"))


def txt(v):
    if isinstance(v, RubyString):
        return v.text
    if isinstance(v, (bytes, bytearray)):
        return v.decode("utf-8", "replace")
    return "" if v is None else str(v)


# ── ③ 셀 27칸 → 우리가 쓰는 20칸 ───────────────────────────────
#  AnimFrame 상수(AR 원본): 0 X · 1 Y · 2 ZOOMX · 3 ANGLE · 4 MIRROR · 5 BLENDTYPE · 6 VISIBLE ·
#    7 PATTERN · 8 OPACITY · 11 ZOOMY · 12~15 COLOR(RGBA) · 16~19 TONE(RGB+GRAY) · 20 LOCKED ·
#    21~24 FLASH(RGBA, 에디터 전용) · 25 PRIORITY · 26 FOCUS
#  9·10번은 원본에서도 안 쓰는 빈칸(nil)이다. LOCKED·FLASH는 에디터 전용이라 버린다.
CELL_ORDER = [0, 1, 2, 11, 3, 4, 5, 6, 7, 8, 25, 26, 12, 13, 14, 15, 16, 17, 18, 19]
#             x  y  zx zy  ang mir bl vis pat op  pri foc [color rgba ] [tone rgb+gray]


def n(v, dflt=0):
    return dflt if v is None else int(v)


def pack_cell(cel):
    if not cel:
        return None
    out = [n(cel[i]) if i < len(cel) else 0 for i in CELL_ORDER]
    while len(out) > 12 and out[-1] == 0:      # 색조/색보정이 전부 0이면(대부분) 잘라 버린다
        out.pop()
    return out


def pack_timing(t):
    a = t.attributes
    g = lambda k: a.get(k)
    out = {
        "f": n(g("@frame")),
        "t": n(g("@timingType")),
    }
    name = txt(g("@name"))
    if name:
        out["n"] = name
    if out["t"] == 0:                          # 효과음
        out["vol"] = n(g("@volume"), 80)
        out["pitch"] = n(g("@pitch"), 100)
    else:                                      # 배경/전경 그래픽
        out["dur"] = n(g("@duration"), 5)
        for key, src in (("x", "@bgX"), ("y", "@bgY"), ("op", "@opacity")):
            if g(src) is not None:
                out[key] = n(g(src))
        col = [g("@colorRed"), g("@colorGreen"), g("@colorBlue"), g("@colorAlpha")]
        if any(c is not None for c in col):
            out["c"] = [n(c) for c in col]
    return out


# ── ④ 읽기 ────────────────────────────────────────────────────
print(f"AR: {AR}")
anims = rxload(os.path.join(AR, "Data", "PkmnAnimations.rxdata")).attributes["@array"]
m2a = rxload(os.path.join(AR, "Data", "move2anim.dat"))
normal, opp = m2a[0], m2a[1]

moves = {}
for k, v in normal.items():
    moves[k.name if isinstance(k, Symbol) else str(k)] = [int(v), -1]
for k, v in opp.items():
    key = k.name if isinstance(k, Symbol) else str(k)
    if key in moves:
        moves[key][1] = int(v)
    else:
        moves[key] = [-1, int(v)]              # OppMove만 있는 기술(원본도 [0] 없으면 못 찾음)

need = sorted({i for pair in moves.values() for i in pair if i >= 0})

# "Common:xxx" 애니(HealthUp/HealthDown 등)도 이름으로 찾아 쓸 수 있게 목록에 넣는다.
commons = {}
for i, a in enumerate(anims):
    if a is None:
        continue
    nm = txt(a.attributes.get("@name"))
    if nm.startswith("Common:"):
        commons[nm[len("Common:"):]] = i
need = sorted(set(need) | set(commons.values()))

meta = {}
sheets = set()
ses = set()
written = 0
for i in need:
    a = anims[i] if i < len(anims) else None
    if a is None:
        continue
    at = a.attributes
    frames = [[pack_cell(c) for c in fr] for fr in at["@array"]]
    # 뒤쪽이 통째로 빈 셀이면 잘라낸다(재생기가 만들 스프라이트 수를 줄인다)
    for fr in frames:
        while fr and fr[-1] is None:
            fr.pop()
    graphic = os.path.splitext(txt(at.get("@graphic")))[0]
    timings = [pack_timing(t) for t in (at.get("@timing") or [])]
    doc = {
        "id": i,
        "name": txt(at.get("@name")),
        "graphic": graphic,
        "hue": n(at.get("@hue")),
        "position": n(at.get("@position"), 4),
        "frames": frames,
        "timings": timings,
    }
    json.dump(doc, open(os.path.join(OUT_DATA, f"{i}.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    written += 1
    if graphic:
        sheets.add(graphic)
    for t in timings:
        if not t.get("n"):
            continue
        if t["t"] == 0:
            ses.add(os.path.splitext(t["n"])[0])     # 효과음 (Audio/SE/Anim)
        else:
            sheets.add(os.path.splitext(t["n"])[0])  # 배경/전경 그림 (Graphics/Animations)
    meta[str(i)] = {"g": graphic, "hue": doc["hue"], "len": len(frames)}

# 기술에 애니가 없을 때 원본이 쓰는 대타표(pbFindMoveAnimation의 typeDefaultAnim 그대로).
#  칸 순서 = [단일물리, 단일특수, 자신변화, 광역물리, 광역특수, 상대변화]
TYPE_DEFAULT = {
    "NORMAL":   ["TACKLE", "SONICBOOM", "DEFENSECURL", "EXPLOSION", "SWIFT", "TAILWHIP"],
    "FIGHTING": ["MACHPUNCH", "AURASPHERE", "DETECT", None, None, None],
    "FLYING":   ["WINGATTACK", "GUST", "ROOST", None, "AIRCUTTER", "FEATHERDANCE"],
    "POISON":   ["POISONSTING", "SLUDGE", "ACIDARMOR", None, "ACID", "POISONPOWDER"],
    "GROUND":   ["SANDTOMB", "MUDSLAP", None, "EARTHQUAKE", "EARTHPOWER", "MUDSPORT"],
    "ROCK":     ["ROCKTHROW", "POWERGEM", "ROCKPOLISH", "ROCKSLIDE", None, "SANDSTORM"],
    "BUG":      ["TWINEEDLE", "BUGBUZZ", "QUIVERDANCE", None, "STRUGGLEBUG", "STRINGSHOT"],
    "GHOST":    ["LICK", "SHADOWBALL", "GRUDGE", None, None, "CONFUSERAY"],
    "STEEL":    ["IRONHEAD", "MIRRORSHOT", "IRONDEFENSE", None, None, "METALSOUND"],
    "FIRE":     ["FIREPUNCH", "EMBER", "SUNNYDAY", None, "INCINERATE", "WILLOWISP"],
    "WATER":    ["CRABHAMMER", "WATERGUN", "AQUARING", None, "SURF", "WATERSPORT"],
    "GRASS":    ["VINEWHIP", "MEGADRAIN", "COTTONGUARD", "RAZORLEAF", None, "SPORE"],
    "ELECTRIC": ["THUNDERPUNCH", "THUNDERSHOCK", "CHARGE", None, "DISCHARGE", "THUNDERWAVE"],
    "PSYCHIC":  ["ZENHEADBUTT", "CONFUSION", "CALMMIND", None, "SYNCHRONOISE", "MIRACLEEYE"],
    "ICE":      ["ICEPUNCH", "ICEBEAM", "MIST", None, "POWDERSNOW", "HAIL"],
    "DRAGON":   ["DRAGONCLAW", "DRAGONRAGE", "DRAGONDANCE", None, "TWISTER", None],
    "DARK":     ["PURSUIT", "DARKPULSE", "HONECLAWS", None, "SNARL", "EMBARGO"],
    "FAIRY":    ["TACKLE", "FAIRYWIND", "MOONLIGHT", None, "SWIFT", "SWEETKISS"],
}

index = {
    "fps": 20,                 # PBAnimationPlayerX: (경과초 * 20)
    "cellSize": 192,           # pbSpriteSetAnimFrame: animwidth = 192
    "cols": 5,                 # pattern % 5 / pattern / 5
    "focusUser": [128, 224],   # Battle::Scene::FOCUSUSER_X/Y
    "focusTarget": [384, 96],  # Battle::Scene::FOCUSTARGET_X/Y
    "moves": moves,
    "commons": commons,
    "typeDefault": TYPE_DEFAULT,
    "anims": meta,
}
json.dump(index, open(os.path.join(OUT_DATA, "index.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))

print(f"애니 JSON {written}개 → {OUT_DATA}")
print(f"기술 {len(moves)}개 · Common {len(commons)}개 · 시트 {len(sheets)}종")

# ── ⑤ 시트 PNG 복사 ───────────────────────────────────────────
if COPY_SHEETS:
    os.makedirs(OUT_SHEET, exist_ok=True)
    src_dir = os.path.join(AR, "Graphics", "Animations")
    copied, missing, total = 0, [], 0
    for name in sorted(sheets):
        src = None
        for ext in (".png", ".PNG"):
            p = os.path.join(src_dir, name + ext)
            if os.path.exists(p):
                src = p
                break
        if not src:
            missing.append(name)
            continue
        dst = os.path.join(OUT_SHEET, name + ".png")
        if not (os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src)):
            shutil.copy2(src, dst)
        copied += 1
        total += os.path.getsize(src)
    print(f"시트 복사 {copied}개 ({total/1e6:.1f} MB) → {OUT_SHEET}")
    if missing:
        print(f"⚠️ 원본에 없는 시트 {len(missing)}개(그 애니는 그림 없이 재생됨): {missing[:10]}")
else:
    print("시트 PNG는 복사 안 함 (--sheets 로 실행하면 복사)")

# ── ⑥ 효과음 복사 (전부 .ogg 로 통일 — 브라우저가 바로 디코드) ──
#  원본 Audio/SE/Anim 은 .wav/.ogg/.mp3 가 섞여 있다. ogg는 그대로 복사, 나머지는 ffmpeg로 변환.
if COPY_SE:
    os.makedirs(OUT_SE, exist_ok=True)
    src_dir = os.path.join(AR, "Audio", "SE", "Anim")
    done, conv, missing, total = 0, 0, [], 0
    for name in sorted(ses):
        src = None
        for ext in (".ogg", ".wav", ".mp3", ".OGG", ".WAV", ".MP3"):
            p = os.path.join(src_dir, name + ext)
            if os.path.exists(p):
                src = p
                break
        if not src:
            missing.append(name)
            continue
        dst = os.path.join(OUT_SE, name + ".ogg")
        if not os.path.exists(dst):
            if src.lower().endswith(".ogg"):
                shutil.copy2(src, dst)
            else:
                rc = os.system(f'ffmpeg -v error -y -i "{src}" -c:a libvorbis -q:a 2 "{dst}" ')
                if rc != 0:
                    missing.append(name + " (변환실패)")
                    continue
                conv += 1
        done += 1
        total += os.path.getsize(dst)
    print(f"효과음 {done}개 (ogg 변환 {conv}개, {total/1e6:.1f} MB) → {OUT_SE}")
    if missing:
        print(f"⚠️ 못 넣은 효과음 {len(missing)}개(그 애니는 무음): {missing[:10]}")
else:
    print("효과음은 복사 안 함 (--se 로 실행하면 복사·변환, ffmpeg 필요)")
