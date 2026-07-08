// 시안 A 하단 바 메뉴 실렌더 캡쳐. 사용: node tools/shot-menuA.mjs
import { chromium } from "playwright";
const OUT = "/mnt/d/dev/Pokemon_With/.claude/.verify";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

await page.evaluate(() => {
  const g = window.__game;
  if (!g.registry.get("playerName")) g.registry.set("playerName", "테스트");
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("WorldScene", { openMenu: true });
});
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/menuA_after_default.png` });   // 기본(포켓몬 선택)

// 좌우로 선택 이동해서 다른 칸도 확인 — window에 keydown dispatch
const KC = { ArrowLeft: 37, ArrowRight: 39 };
const tap = async (k) => {
  await page.evaluate(({ k, kc }) => { window.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, keyCode: kc, which: kc, bubbles: true })); window.dispatchEvent(new KeyboardEvent("keyup", { key: k, code: k, keyCode: kc, which: kc, bubbles: true })); }, { k, kc: KC[k] });
  await page.waitForTimeout(350);
};
await tap("ArrowLeft"); await tap("ArrowLeft");   // 도감쪽으로
const idx = await page.evaluate(() => window.__game.scene.getScene("MenuScene").idx);
console.log("좌2회 후 선택 idx =", idx, "(기대: 0=도감 부근, 좌우이동 동작 확인)");
await page.screenshot({ path: `${OUT}/menuA_after_left.png` });
await browser.close();
console.log("DONE");
