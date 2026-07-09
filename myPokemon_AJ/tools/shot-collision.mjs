import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
const OUT="/mnt/d/dev/Pokemon_With/.claude/.verify";
const b=await chromium.launch({ headless: false,args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-webgl","--no-sandbox"]});
const p=await b.newPage({viewport:{width:960,height:720}});
await p.goto("http://localhost:5180",{waitUntil:"networkidle"});
await p.waitForFunction(()=>window.__game&&window.__game.isBooted,{timeout:15000});
await p.evaluate(()=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.scene.start("LabScene",{preview:"card",pick:-1});});
await p.waitForTimeout(2400);
// cursor.isDown 직접 주입(이벤트 시뮬 우회) → update()+walkable() 실제 경로로 이동
const drive=async(key,ms)=>{await p.evaluate(k=>{window.__game.scene.getScene("LabScene").cursors[k].isDown=true;},key);await p.waitForTimeout(ms);await p.evaluate(k=>{window.__game.scene.getScene("LabScene").cursors[k].isDown=false;},key);await p.waitForTimeout(300);};
const pos=async()=>p.evaluate(()=>{const s=window.__game.scene.getScene("LabScene");return[s.tx,s.ty];});
console.log("시작:",await pos());
await drive("up",6800);           // 가운데 통로로 끝까지 위로
console.log("up 후:",await pos());
await drive("left",2400);         // 카운터쪽(막힘) 시도
console.log("left 후:",await pos(),"(기대: tx=6 유지 — (5,2)카운터에 막힘)");
await snap(p, `${OUT}/collision_blocked_live.png`);
await b.close(); console.log("DONE");
