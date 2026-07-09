import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
const OUT="/mnt/d/dev/Pokemon_With/.claude/.verify";
const b=await chromium.launch({ headless: false,args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-webgl","--no-sandbox"]});
const p=await b.newPage({viewport:{width:1000,height:1000}});
await p.goto("http://localhost:5180",{waitUntil:"networkidle"});
await p.waitForFunction(()=>window.__game&&window.__game.isBooted,{timeout:15000});
await p.evaluate(()=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.scene.start("LabScene",{preview:"card",pick:-1});});
await p.waitForTimeout(2400);
// walkable 검증: 책장 상판(y7)·책(y8)은 막힘, 그 앞(y6)은 통과여야
const w=await p.evaluate(()=>{const s=window.__game.scene.getScene("LabScene");return{"(2,6)앞":s.walkable(2,6),"(2,7)책장상판":s.walkable(2,7),"(2,8)책":s.walkable(2,8)};});
console.log("walkable:",JSON.stringify(w),"→ (2,6)=true, (2,7)=false, (2,8)=false 이어야 정상");
// 주인공을 책장 앞(2,6)에 놓고, 아래로 밀어 책장에 못 들어가는지 확인
await p.evaluate(()=>{const s=window.__game.scene.getScene("LabScene");s.tx=2;s.ty=6;s.facing="down";s.player.setPosition(s.cx(2),s.cy(6)).setFrame(s.idleFrame.down);});
await p.waitForTimeout(300);
// 아래로 주입 → 책장(y7)에 막혀 못 내려가야
await p.evaluate(()=>{window.__game.scene.getScene("LabScene").cursors.down.isDown=true;});
await p.waitForTimeout(1200);
await p.evaluate(()=>{window.__game.scene.getScene("LabScene").cursors.down.isDown=false;});
await p.waitForTimeout(300);
const fin=await p.evaluate(()=>{const s=window.__game.scene.getScene("LabScene");return[s.tx,s.ty];});
console.log("책장 앞(2,6)에서 아래로 밀기 후:",JSON.stringify(fin),"→ [2,6] 유지(책장에 못 들어감)여야");
await snap(p, `${OUT}/shelf_after_fixed.png`);
await b.close();console.log("DONE");
