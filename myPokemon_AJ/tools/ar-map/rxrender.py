import struct, os, glob
from rubymarshal.reader import loads
from PIL import Image

AR="/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829"
def b2s(x):
    return x.decode('utf-8','replace') if isinstance(x,(bytes,bytearray)) else str(x)

def parse_table(ud):
    raw = ud._private_data
    dim,xs,ys,zs,total = struct.unpack('<5i', raw[:20])
    vals = struct.unpack('<%dh'%(xs*ys*zs), raw[20:20+2*xs*ys*zs])
    return xs,ys,zs,vals

def find_png(folder, name):
    for ext in ('.png','.PNG'):
        p=os.path.join(AR,'Graphics',folder,name+ext)
        if os.path.exists(p): return p
    # 느슨 매칭
    for f in glob.glob(os.path.join(AR,'Graphics',folder,'*')):
        if os.path.splitext(os.path.basename(f))[0]==name: return f
    return None

ts_all = loads(open(f'{AR}/Data/Tilesets.rxdata','rb').read())

def render_map(mapfile, out):
    m=loads(open(mapfile,'rb').read()).attributes
    tsid=int(str(m['@tileset_id']))
    xs,ys,zs,vals=parse_table(m['@data'])
    ts=ts_all[tsid].attributes
    tsname=b2s(ts['@tileset_name'])
    autos=[b2s(a) for a in ts['@autotile_names']]
    tsimg=Image.open(find_png('Tilesets',tsname)).convert('RGBA') if find_png('Tilesets',tsname) else None
    auto_imgs=[]
    for an in autos:
        p=find_png('Autotiles',an) if an else None
        auto_imgs.append(Image.open(p).convert('RGBA') if p else None)
    tcols = tsimg.width//32 if tsimg else 8
    canvas=Image.new('RGBA',(xs*32,ys*32),(0,0,0,0))
    def tile_at(tid):
        if tid is None or tid==0: return None
        if tid>=384:
            idx=tid-384; c=idx%tcols; r=idx//tcols
            if tsimg and (r+1)*32<=tsimg.height:
                return tsimg.crop((c*32,r*32,c*32+32,r*32+32))
            return None
        # 오토타일: tid//48 = 오토타일 번호(1..7) → auto_imgs[n-1]
        n=tid//48
        if 1<=n<=len(auto_imgs) and auto_imgs[n-1]:
            ai=auto_imgs[n-1]
            # 대표 풀타일: 오토타일 소스의 (x=0,y=32) 영역(보통 채움 타일) 시험
            return ai.crop((0,32,32,64)) if ai.height>=64 else ai.crop((0,0,32,32))
        return None
    for z in range(zs):
        for y in range(ys):
            for x in range(xs):
                tid=vals[x + xs*y + xs*ys*z]
                t=tile_at(tid)
                if t: canvas.alpha_composite(t,(x*32,y*32))
    canvas.convert('RGB').save(out)
    print(f'{os.path.basename(mapfile)}: {xs}x{ys} tileset={tsname} autos={[a for a in autos if a]}')
    return xs,ys

SCR="/tmp/claude-1000/-mnt-d-dev-AJ-Proj-vcPortfolio-AJ/a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b/scratchpad"
render_map(f'{AR}/Data/Map067.rxdata', f'{SCR}/map067.png')

# ── 후보 일괄 렌더: 집(House) 맵들 + 시작맵 ──
if __name__=="__main__" and os.environ.get("BATCH"):
    info=loads(open(f'{AR}/Data/MapInfos.rxdata','rb').read())
    names={int(str(k)):b2s(v.attributes.get('@name')) for k,v in info.items()}
    # 리포 위치가 이사로 바뀌므로 스크립트 기준 상대경로(리포루트/01_Resources/...)로 잡는다.
    OUT=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","..","01_Resources","Pick","07_집","AR집후보"))
    os.makedirs(OUT, exist_ok=True)
    # 집/방 관련 맵 id 모으기(너무 큰 야외맵 제외)
    cand=[i for i,n in names.items() if n.strip() in ('House',) or any(k in n for k in ('Room','집','방','House'))]
    cand=sorted(set(cand))
    done=[]
    for i in cand:
        f=f'{AR}/Data/Map%03d.rxdata'%i
        if not os.path.exists(f): continue
        try:
            m=loads(open(f,'rb').read()).attributes
            w,h=int(str(m['@width'])),int(str(m['@height']))
            if w>40 or h>40: continue   # 야외/큰 맵 제외(집만)
            xs,ys=render_map(f, f'{OUT}/map%03d.png'%i)
            done.append(i)
        except Exception as e:
            print('skip',i,e)
        if len(done)>=20: break
    print('렌더된 집 맵:', done)

if __name__=="__main__" and os.environ.get("RED"):
    SCR="/tmp/claude-1000/-mnt-d-dev-AJ-Proj-vcPortfolio-AJ/a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b/scratchpad"
    for mid,tag in [(155,'레드의방_2F'),(154,'레드의집_1F'),(156,'그린의집')]:
        render_map(f'{AR}/Data/Map%03d.rxdata'%mid, f'{SCR}/red_{mid}_{tag}.png')
