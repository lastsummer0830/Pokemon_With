import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
const OUT="/mnt/d/dev/Pokemon_With/.claude/.verify";
const b=await chromium.launch({ headless: false,args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-webgl","--no-sandbox"]});
const p=await b.newPage({viewport:{width:900,height:520}});
await p.goto("http://localhost:5180",{waitUntil:"networkidle"});
await p.waitForFunction(()=>window.__game&&window.__game.isBooted,{timeout:15000});
// LabScene를 띄워 SPRIGATITO 원본 텍스처를 로드시킴
await p.evaluate(()=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.scene.start("LabScene",{preview:"card",pick:-1});});
await p.waitForTimeout(2400);
// 같은 씬에 밝은 배경 + 두 방식 스프라이트를 나란히 그린다
await p.evaluate(()=>{
  const Ph=window.Phaser, s=window.__game.scene.getScene("LabScene");
  const src=s.textures.get("SPRIGATITO").getSourceImage(); const fh=src.height; // 96
  // 밝은 패널
  s.add.rectangle(0,0,900,520,0xf3e4c8).setOrigin(0).setScrollFactor(0).setDepth(2000);
  const DISP=300; // 화면 표시 크기
  // OLD 방식: 6배(576) 굽고 표시 때 축소(0.52) — 기본 LINEAR
  const cOld=document.createElement("canvas"); cOld.width=fh*6; cOld.height=fh*6;
  const xo=cOld.getContext("2d"); xo.imageSmoothingEnabled=false; xo.drawImage(src,0,0,fh,fh,0,0,fh*6,fh*6);
  s.textures.addCanvas("AB_old",cOld);
  const io=s.add.image(230,270,"AB_old").setScrollFactor(0).setDepth(2001);
  io.setDisplaySize(DISP,DISP); // 576→300 축소(LINEAR)
  // NEW 방식: 표시크기(300)로 바로 굽고 1:1
  const cNew=document.createElement("canvas"); cNew.width=DISP; cNew.height=DISP;
  const xn=cNew.getContext("2d"); xn.imageSmoothingEnabled=false; xn.drawImage(src,0,0,fh,fh,0,0,DISP,DISP);
  s.textures.addCanvas("AB_new",cNew);
  s.textures.get("AB_new").setFilter(Ph.Textures.FilterMode.NEAREST);
  const inw=s.add.image(660,270,"AB_new").setScrollFactor(0).setDepth(2001); // scale 1.0
  s.add.text(140,40,"OLD (6x→축소, LINEAR)",{fontFamily:"Galmuri11",fontSize:"22px",color:"#b03030"}).setScrollFactor(0).setDepth(2002);
  s.add.text(560,40,"NEW (표시크기 1:1 nearest)",{fontFamily:"Galmuri11",fontSize:"22px",color:"#207020"}).setScrollFactor(0).setDepth(2002);
});
await p.waitForTimeout(800);
await snap(p, `${OUT}/sprite_ab_samepane.png`);
// 눈 부위 확대 크롭
await snap(p, `${OUT}/sprite_ab_zoom.png`); // snap은 전체 캔버스 캡처(clip 미지원) — 확대 크롭이 필요하면 PIL로 후처리
await b.close();console.log("DONE");
