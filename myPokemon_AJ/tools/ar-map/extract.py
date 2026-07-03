import struct, os, glob, json
from rubymarshal.reader import loads
from PIL import Image
AR="/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829"
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
            a=aimg[n-1]; return a.crop((0,32,32,64)) if a.height>=64 else a.crop((0,0,32,32))
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

# 방(155), 거실(067)
r1x,r1y,b1=process(155, f'{PUB}/red_room_2f.png')
r2x,r2y,b2=process(67,  f'{PUB}/red_living_1f.png')
rooms={
 "bedroom":{"img":"assets/house/red_room_2f.png","cols":r1x,"rows":r1y,"blocked":b1,
            "start":[9,6],"warps":[{"x":10,"y":3,"to":"living","ax":9,"ay":10}]},
 "living": {"img":"assets/house/red_living_1f.png","cols":r2x,"rows":r2y,"blocked":b2,
            "start":[9,10],"warps":[{"x":9,"y":11,"to":"bedroom","ax":10,"ay":4}]},
}
json.dump(rooms, open(f'{PUB}/rooms.json','w'), ensure_ascii=False)
print("방", r1x,r1y, "거실", r2x,r2y)
# 충돌 오버레이(검증용)
SCR="/tmp/claude-1000/-mnt-d-dev-AJ-Proj-vcPortfolio-AJ/a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b/scratchpad"
for nm,png,bl,wp in [("room",f'{PUB}/red_room_2f.png',b1,rooms['bedroom']['warps']),("living",f'{PUB}/red_living_1f.png',b2,rooms['living']['warps'])]:
    im=Image.open(png).convert('RGBA'); ov=Image.new('RGBA',im.size,(0,0,0,0))
    from PIL import ImageDraw; d=ImageDraw.Draw(ov)
    for y,row in enumerate(bl):
        for x,v in enumerate(row):
            if v: d.rectangle([x*32,y*32,x*32+31,y*32+31],fill=(255,0,0,90))
    for w in wp: d.rectangle([w['x']*32,w['y']*32,w['x']*32+31,w['y']*32+31],fill=(0,150,255,140))
    im.alpha_composite(ov); im.convert('RGB').save(f'{SCR}/overlay_{nm}.png')
