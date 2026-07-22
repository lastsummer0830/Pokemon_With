import struct, os, glob, json, sys, importlib.util
from rubymarshal.reader import loads
from PIL import Image, ImageDraw

# 오토타일 48변형 조립은 월드맵 추출기와 **완전히 같은 규격**이라 표를 복사하지 않고 빌려 온다.
#  (파일명에 하이픈이 있어 일반 import가 안 된다 → 경로로 직접 로드. extract-map.py는 __main__
#   가드가 있어 import해도 아무것도 실행되지 않는다.)
_emp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extract-map.py")
_spec = importlib.util.spec_from_file_location("ar_extract_map", _emp)
_mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod)
build_autotile = _mod.build_autotile
# AR 원본 위치는 PC마다 다르다(D드라이브 회사PC / C드라이브 집PC). 하드코딩하면 다른 PC에서 죽으므로
# 후보를 훑어 실제 존재하는 폴더를 고른다(extract-map.py와 동일 방식). 못 찾으면 명확히 죽는다.
AR_CANDIDATES = [
    "/mnt/d/Pokemon Another Red_PWT_250829",
    "/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829",
]
AR = next((p for p in AR_CANDIDATES if os.path.isdir(p)), None)
if AR is None:
    sys.exit("AR 원본을 못 찾았다. 후보: " + " / ".join(AR_CANDIDATES) +
             "\n찾는 법: find /mnt/d /mnt/c/Users/*/Desktop -maxdepth 4 -iname '*Another*Red*' -type d")
# 리포 폴더명/경로가 PC·이사에 따라 바뀌므로 스크립트 위치 기준 상대경로로 잡는다.
PUB=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","public","assets","house"))
os.makedirs(PUB, exist_ok=True)
def b2s(x): return x.decode('utf-8','replace') if isinstance(x,(bytes,bytearray)) else str(x)
def parse_table(ud):
    raw=ud._private_data; dim,xs,ys,zs,tot=struct.unpack('<5i',raw[:20])
    vals=struct.unpack('<%dh'%(xs*ys*zs),raw[20:20+2*xs*ys*zs]); return xs,ys,zs,vals
def find_png(folder,name):
    for ext in('.png','.PNG'):
        p=os.path.join(AR,'Graphics',folder,name+ext)
        if os.path.exists(p):return p
    for f in glob.glob(os.path.join(AR,'Graphics',folder,'*')):
        if os.path.splitext(os.path.basename(f))[0]==name:return f
    return None
ts_all=loads(open(f'{AR}/Data/Tilesets.rxdata','rb').read())

def process(mid, outpng):
    m=loads(open(f'{AR}/Data/Map%03d.rxdata'%mid,'rb').read()).attributes
    tsid=int(str(m['@tileset_id'])); xs,ys,zs,vals=parse_table(m['@data'])
    ts=ts_all[tsid].attributes
    tsimg=Image.open(find_png('Tilesets',b2s(ts['@tileset_name']))).convert('RGBA')
    autos=[(find_png('Autotiles',b2s(a)) if a else None) for a in ts['@autotile_names']]
    aimg=[Image.open(p).convert('RGBA') if p else None for p in autos]
    _,_,_,passg=parse_table(ts['@passages'])
    tcols=tsimg.width//32
    def tile(tid):
        if not tid: return None
        if tid>=384:
            i=tid-384;c=i%tcols;r=i//tcols
            return tsimg.crop((c*32,r*32,c*32+32,r*32+32)) if (r+1)*32<=tsimg.height else None
        n=tid//48
        if 1<=n<=len(aimg) and aimg[n-1]:
            # 오토타일은 `tid%48`이 모양 변형(한가운데/물가/모서리)이다. 예전엔 이걸 무시하고
            # 채움 타일 한 종류만 찍어서 물·바닥 경계가 원본과 달라졌다(태초마을·상록시티 연못이
            # 갈색 덩어리로 나온 원인). 조립표는 extract-map.py 한 곳에만 두고 여기서 빌려 쓴다.
            return build_autotile(aimg[n-1], tid%48)
        return None
    def pflag(tid):
        if not tid: return 0
        idx = tid if tid>=384 else (tid//48)*48
        return passg[idx] if 0<=idx<len(passg) else 0
    canvas=Image.new('RGBA',(xs*32,ys*32),(0,0,0,0))
    blocked=[[0]*xs for _ in range(ys)]
    for y in range(ys):
        for x in range(xs):
            cellblock=False
            for z in range(zs):
                tid=vals[x+xs*y+xs*ys*z]
                t=tile(tid)
                if t: canvas.alpha_composite(t,(x*32,y*32))
                if (pflag(tid)&0x0f)==0x0f: cellblock=True
            blocked[y][x]=1 if cellblock else 0
    canvas.convert('RGB').save(outpng)
    return xs,ys,blocked

# ─────────────────────────────────────────────────────────────────────────────
# 라이벌(그린)의 집 = AR Map156 "그린의집" (태초마을 27,7 문으로 들어가는 집).
#  ⚠️ 예전엔 이 스크립트가 rooms.json을 통째로 다시 써서 손으로 다듬은 bedroom/living
#     (계단·침대·문 워프)을 날렸다 → 이제는 156만 뽑아 rooms.json에 rival 키만 **병합**한다.
#     bedroom/living PNG·JSON은 절대 건드리지 않는다.
#  ⚠️ rival 키도 이미 rooms.json에 있으면 **덮어쓰지 않는다**(충돌격자는 손으로 다듬는 데이터 —
#     프로젝트 규칙: 맵 충돌격자는 눈대중·재생성 금지). AR 원본에서 정말 다시 뽑아야 할 때만
#     `--force-rival` 인자(또는 FORCE_RIVAL=1 환경변수)로 강제한다.
#
# 디버그 오버레이 저장 폴더. 예전엔 세션 임시폴더(/tmp/.../<세션uuid>/scratchpad)를 하드코딩해서
# 다른 PC·다른 세션에서 재실행하면 FileNotFoundError로 죽었다. 그것도 rival PNG는 이미 덮어쓴
# 뒤·rooms.json 병합 전이라 리포가 반쯤 갱신된 상태로 남았다. → 이제 스크립트 옆 `_debug/`(리포
# 상대경로)를 기본으로 쓰고, 환경변수 AR_MAP_DEBUG_DIR로 바꿀 수 있다.
DBG = os.environ.get("AR_MAP_DEBUG_DIR") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "_debug")

# rival 강제 덮어쓰기 플래그(둘 중 아무거나): python3 extract.py --force-rival  /  FORCE_RIVAL=1 python3 extract.py
FORCE_RIVAL = ("--force-rival" in sys.argv) or (os.environ.get("FORCE_RIVAL", "").lower() not in ("", "0", "false"))


def save_debug(img, name):
    """디버그 오버레이 저장(선택 사항). 실패해도 절대 예외를 밖으로 던지지 않는다 —
    오버레이는 '눈으로 보려고' 만드는 부가물일 뿐이고, 뒤의 rooms.json 병합이 항상 실행돼야 하기 때문."""
    try:
        os.makedirs(DBG, exist_ok=True)
        p = os.path.join(DBG, name)
        img.convert('RGB').save(p)
        print("오버레이 저장:", p)
        return p
    except Exception as e:
        print(f"[경고] 오버레이 저장 실패({name}): {e} — 무시하고 계속 진행한다(병합은 그대로 수행).")
        return None

# 배치 좌표(칸). None이면 "추출 + 격자 오버레이만" 하고 rooms.json은 안 건드린다.
#  → 오버레이(overlay_rival_labeled.png)로 문/시작칸을 눈으로 찍은 뒤 값을 채우고 재실행한다.
RIVAL_START = [6, 10]         # 문 바로 안쪽 시작칸(오버레이 확인: row10 전부 walkable)
RIVAL_EXIT  = [6, 11]         # 나가는 문칸 = blocked grid의 유일한 walkable(6,11) 도어매트

rx, ry, br = process(156, f'{PUB}/rival_house_1f.png')
print("그린의집(rival)", rx, ry, "blocked칸", sum(sum(r) for r in br))
print("blocked grid:")
for r in br:
    print("".join("#" if v else "." for v in r))

# 32px 격자 + 칸좌표 라벨 오버레이(눈대중 금지 — 원본 PNG에 좌표를 얹어 문/시작을 찍는다)
im = Image.open(f'{PUB}/rival_house_1f.png').convert('RGBA')
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
for y, row in enumerate(br):
    for x, v in enumerate(row):
        if v:
            d.rectangle([x*32, y*32, x*32+31, y*32+31], fill=(255, 0, 0, 80))
for x in range(0, im.width+1, 32):
    d.line([(x, 0), (x, im.height)], fill=(0, 0, 0, 120))
for y in range(0, im.height+1, 32):
    d.line([(0, y), (im.width, y)], fill=(0, 0, 0, 120))
for y in range(len(br)):
    for x in range(len(br[0])):
        d.text((x*32+2, y*32+1), f"{x},{y}", fill=(255, 255, 0, 255))
im.alpha_composite(ov)
save_debug(im, 'overlay_rival_labeled.png')

if RIVAL_START is not None and RIVAL_EXIT is not None:
    rooms_path = f'{PUB}/rooms.json'
    rooms = json.load(open(rooms_path, encoding='utf-8')) if os.path.isfile(rooms_path) else {}
    if "rival" in rooms and not FORCE_RIVAL:
        # 손으로 다듬은 blocked/start/warps 보호 — 자동 재추출 값으로 덮어쓰지 않는다.
        print("rooms.json에 rival 키가 이미 있다 → 덮어쓰지 않고 건너뛴다.")
        print("  (충돌격자·시작칸·워프는 손으로 다듬는 데이터라 자동 재생성으로 날리면 안 된다.)")
        print("  정말 AR 원본 값으로 다시 덮어쓰려면: python3 tools/ar-map/extract.py --force-rival")
        print("  (또는 FORCE_RIVAL=1 python3 tools/ar-map/extract.py)")
    else:
        rooms["rival"] = {
            "img": "assets/house/rival_house_1f.png", "cols": rx, "rows": ry, "blocked": br,
            "start": RIVAL_START,
            "warps": [{"x": RIVAL_EXIT[0], "y": RIVAL_EXIT[1], "to": "world",
                       "dir": "down", "kind": "door",
                       "map": "pallet", "spawn": [27, 8], "face": "down"}],
        }
        with open(rooms_path, 'w', encoding='utf-8') as f:
            json.dump(rooms, f, ensure_ascii=False)
        print(("rooms.json rival 강제 덮어쓰기 완료" if FORCE_RIVAL else "rooms.json 병합 완료")
              + " — 키: " + ", ".join(rooms.keys()))
    # 확정 배치(시작=초록, 문=파랑) 확인용 오버레이
    im2 = Image.open(f'{PUB}/rival_house_1f.png').convert('RGBA')
    ov2 = Image.new('RGBA', im2.size, (0, 0, 0, 0)); d2 = ImageDraw.Draw(ov2)
    for y, row in enumerate(br):
        for x, v in enumerate(row):
            if v: d2.rectangle([x*32, y*32, x*32+31, y*32+31], fill=(255, 0, 0, 90))
    sx, sy = RIVAL_START; ex, ey = RIVAL_EXIT
    d2.rectangle([sx*32, sy*32, sx*32+31, sy*32+31], fill=(0, 220, 0, 150))
    d2.rectangle([ex*32, ey*32, ex*32+31, ey*32+31], fill=(0, 150, 255, 150))
    im2.alpha_composite(ov2)
    save_debug(im2, 'overlay_rival_placed.png')
else:
    print("RIVAL_START/RIVAL_EXIT 미설정 → rooms.json 미변경(오버레이만).")
