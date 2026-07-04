import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = process.argv[2] || "/tmp/lab-3mon";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-webgl","--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });
for (const [pick, name] of [[0,"sprigatito"],[1,"charmander"],[2,"froakie"]]) {
  await page.evaluate((p) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("LabScene", { preview: "card", pick: p });
  }, pick);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${pick}_${name}.png` });
  console.log("saved", name);
}
await browser.close();
