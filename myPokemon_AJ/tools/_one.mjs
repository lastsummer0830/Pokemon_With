import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-webgl","--no-sandbox"] });
const p = await b.newPage({ viewport:{width:1280,height:800} });
await p.goto("http://localhost:5180",{waitUntil:"networkidle"});
await p.waitForFunction(()=>window.__game&&window.__game.isBooted,{timeout:15000});
await p.evaluate(()=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.scene.start("LabScene",{preview:"card",pick:0});});
await p.waitForTimeout(3200);
await p.screenshot({path:process.argv[2]});
await b.close(); console.log("saved");
