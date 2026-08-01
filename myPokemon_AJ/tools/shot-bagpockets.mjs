// 가방 포켓별 화면 캡처(스크롤 슬라이더가 보이도록 아이템을 넉넉히 넣는다).
import { chromium } from "playwright";
import fs from "fs"; import path from "path";
const OUT=path.resolve(process.argv[2]);
fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
const p=await b.newPage({viewport:{width:1280,height:720}});
const errors=[]; p.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
await p.goto("http://localhost:5180",{waitUntil:"networkidle"});
await p.waitForFunction(()=>window.__game?.isBooted,{timeout:30000});
await p.waitForFunction(()=>window.__game.scene.getScenes(true).length>0,{timeout:15000});
await p.evaluate(async ()=>{const g=window.__game;
  g.scene.scenes.forEach(s=>{if(s.scene.key!=="BagScene"&&(s.scene.isActive()||s.scene.isPaused()||s.scene.isSleeping()))g.scene.stop(s.scene.key);});
  g.registry.set("playerName","레드");
  const {addItem}=await import("/src/data/Bag.ts");
  for(const [id,n] of [["POTION",3],["SUPERPOTION",1],["ANTIDOTE",2],["PARALYZEHEAL",1],["AWAKENING",1],["BURNHEAL",1],["ICEHEAL",1],["REVIVE",2],
                       ["POKEBALL",5],["GREATBALL",2],["ULTRABALL",1],["MASTERBALL",1],["TM09",1],["ORANBERRY",2],["OAKSINTRODUCTION",1]]) addItem(g.registry,id,n);
  g.scene.start("BagScene",{from:"DebugMenuScene"});});
await p.waitForTimeout(2600);
const names={1:"1_일반",2:"2_회복약",3:"3_몬스터볼",4:"4_기술머신",5:"5_나무열매",8:"8_소중한물건"};
for(let i=0;i<6;i++){
  const pocket=await p.evaluate(()=>window.__game.scene.getScene("BagScene").pocket);
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); await p.waitForTimeout(500);
  fs.writeFileSync(path.join(OUT,`${names[pocket]||pocket}.png`), await p.screenshot());
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(450);
}
console.log(errors.length?"콘솔에러:"+errors.join("|"):"콘솔에러 없음");
await b.close();
