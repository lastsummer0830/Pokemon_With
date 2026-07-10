// 3대 수정 실검증: (1) examine 스프라이트 또렷 (2) 메뉴가 월드 위 (3) 상단 카운터 충돌.
//  사용: node tools/verify-fixes.mjs [출력폴더]
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = process.argv[2] || fileURLToPath(new URL("../../.claude/.verify", import.meta.url));
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5180";

const browser = await chromium.launch({ headless: false,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("  [browser error]", m.text()); });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

const shot = async (name) => { await snap(page, `${OUT}/${name}.png`); console.log("saved", name); };
const startScene = async (key, data) => {
  await page.evaluate(({ key, data }) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start(key, data);
  }, { key, data });
};
// Phaser는 window의 keydown/keyup을 듣고 update()에서 isDown을 폴링한다.
//  Playwright page.keyboard가 focus 문제로 안 닿을 때가 있어, window에 직접 이벤트를 dispatch해 '유지'한다.
const KC = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
const hold = async (k, ms) => {
  await page.evaluate(({ k, kc }) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, keyCode: kc, which: kc, bubbles: true })), { k, kc: KC[k] });
  await page.waitForTimeout(ms);
  await page.evaluate(({ k, kc }) => window.dispatchEvent(new KeyboardEvent("keyup", { key: k, code: k, keyCode: kc, which: kc, bubbles: true })), { k, kc: KC[k] });
  await page.waitForTimeout(300);
};

// ── (1) examine 스프라이트: 나오하(pick 0) 액자 ──
await startScene("LabScene", { preview: "card", pick: 0 });
await page.waitForTimeout(2600);
await shot("fix_after_sprite");

// ── (3) 충돌: 프리뷰(pick -1)로 맵만 띄우고 주인공을 위로 몰아 카운터 진입 시도 ──
await startScene("LabScene", { preview: "card", pick: -1 });
await page.waitForTimeout(2400);
await page.mouse.click(500, 450);   // 캔버스 포커스(키입력 수신)
const blockedRow2 = await page.evaluate(() => {
  const s = window.__game.scene.getScene("LabScene");
  return s && s.map ? s.map.blocked[2] : null;
});
console.log("  loaded blocked[y2] =", JSON.stringify(blockedRow2), "(기대: [1,1,1,1,1,1,0,0,0,1,1,1,1])");
// walkable() 함수로 카운터 셀 직접 검증(실제 충돌 판정 로직)
const walk = await page.evaluate(() => {
  const s = window.__game.scene.getScene("LabScene");
  const r = {};
  for (let c = 0; c <= 8; c++) r[`(${c},2)`] = s.walkable(c, 2);
  return r;
});
console.log("  walkable(c,2):", JSON.stringify(walk), "\n    → cols0-5=false(막힘), cols6-8=true(통로) 이어야 정상");
// 가운데 통로(col6)로 끝까지 위로 → (6,2)에서 멈춤. 그 뒤 왼쪽은 카운터(막힘)라 못 감.
await hold("ArrowUp", 2600);
const afterUp = await page.evaluate(() => { const s = window.__game.scene.getScene("LabScene"); return [s.tx, s.ty]; });
await hold("ArrowLeft", 1600);
const afterLeft = await page.evaluate(() => { const s = window.__game.scene.getScene("LabScene"); return [s.tx, s.ty]; });
console.log("  up×12 후 위치 =", JSON.stringify(afterUp), "| left×5 후 =", JSON.stringify(afterLeft),
  "(기대: 위=[6,2], 좌=[6,2] — 카운터에 막혀 왼쪽 못 감)");
await shot("fix_after_collision");

// ── (2) 메뉴가 월드(마을) 위에 뜨는지 ──
await page.evaluate(() => { const g = window.__game; if (!g.registry.get("playerName")) g.registry.set("playerName", "테스트"); });
await startScene("WorldScene", { openMenu: true });
await page.waitForTimeout(2600);
await shot("fix_after_menu");

await browser.close();
console.log("DONE →", OUT);
