// 메뉴 열림이 월드를 실제로 어둡게 하는지 '측정'으로 확정. 사용: node tools/shot-dimtest.mjs
import { chromium } from "playwright";
import fs from "fs";
const OUT = "/mnt/d/dev/Pokemon_With/.claude/.verify";

// WebGL 캔버스를 화면에 보이는 그대로 캡처(page.screenshot은 검게 나옴).
async function snap(page, path) {
  const u = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; let done = false;
    const f = (x) => { if (!done) { done = true; res(x); } };
    try { g.renderer.snapshot((im) => f(im && im.src ? im.src : null)); } catch (e) { f(null); }
    setTimeout(() => { const c = document.querySelector("canvas"); f(c ? c.toDataURL("image/png") : null); }, 1500);
  }));
  if (!u) throw new Error("capture 실패");
  fs.writeFileSync(path, Buffer.from(u.split(",")[1], "base64"));
}

const b = await chromium.launch({ headless: false,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 960, height: 640 } });
await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

// (1) 메뉴 없이 월드만
await page.evaluate(() => { const g = window.__game; if (!g.registry.get("playerName")) g.registry.set("playerName", "테스트"); g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key)); g.scene.start("WorldScene"); });
await page.waitForTimeout(2200);
await snap(page, `${OUT}/dimtest_worldonly.png`);

// (2) 메뉴 열고 (main 하단 바)
await page.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key)); g.scene.start("WorldScene", { openMenu: true }); });
await page.waitForTimeout(2200);
// 런타임 실측: 딤이 실제로 보이는지 + state
const info = await page.evaluate(() => { const m = window.__game.scene.getScene("MenuScene"); return { state: m && m.state, dimVisible: m && m.dim ? m.dim.visible : null, dimAlpha: m && m.dim ? m.dim.alpha : null }; });
await snap(page, `${OUT}/dimtest_worldmenu.png`);
await b.close();
console.log("MenuScene 런타임:", JSON.stringify(info));
console.log("DONE: dimtest_worldonly.png / dimtest_worldmenu.png");
