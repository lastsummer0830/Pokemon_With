// 0801 날씨 검증 — AR Graphics/Weather 이식본이 실제로 뿌려지는지.
//   A. 종류별로 알갱이·무늬·색조가 실제로 생기는가 (개수 확인 + 캡처)
//   B. 밤낮과 겹쳤을 때 날씨가 밤 색조 '아래'에 있는가 (depth 880 < 900)
//   C. 맵에 날씨가 없으면 맑음인가 (원본 그대로 — 우리 3맵은 weather 없음)
// 사용: node tools/dbg-weather-0801.mjs   (⚠️ tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const URL = "http://localhost:5180";
const OUT = "../../.claude/.verify";
const KINDS = ["rain", "storm", "snow", "blizzard", "hail", "sandstorm", "fog"];

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });
const waitScene = (k) => page.waitForFunction(
  (key) => window.__game.scene.isActive(key), k, { timeout: 20000 });

// 씬 안에 실제로 생긴 것들을 센다(코드가 아니라 화면 오브젝트로 확인).
const stat = () => page.evaluate(() => {
  const sc = window.__game.scene.getScene("WorldScene");
  const list = sc.children.list;
  const tint = list.find((o) => o.name === "weatherTint");
  const tile = list.find((o) => o.name === "weatherTile");
  const night = list.find((o) => o.name === "dayNight");
  // 알갱이 = scrollFactor 0에 depth 882인 Image들
  const grains = list.filter((o) => o.type === "Image" && o.depth === 882).length;
  const hud = sc.children.getByName("hud");
  return {
    kind: sc.weather.kind, grains,
    tint: tint ? { depth: tint.depth, alpha: +tint.fillAlpha.toFixed(2) } : null,
    tile: tile ? { depth: tile.depth, alpha: +tile.alpha.toFixed(2) } : null,
    nightDepth: night?.depth ?? null,
    hud: hud?.text ?? "",
  };
});

const results = {};

// ── A. 종류별 ──
for (const k of KINDS) {
  await page.evaluate((kind) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.registry.set("playerName", "레드");
    g.scene.start("WorldScene", { debugWeather: kind });
  }, k);
  await waitScene("WorldScene");
  await page.waitForTimeout(2500);
  results[k] = await stat();
  await snap(page, `${OUT}/0801_날씨_${k}.png`);
}

// ── B. 밤 + 비 (겹치기) ──
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("WorldScene", { debugWeather: "rain", debugTimeBand: "night" });
});
await waitScene("WorldScene");
await page.waitForTimeout(2500);
results.nightRain = await stat();
await snap(page, `${OUT}/0801_날씨_밤비.png`);

// ── C. 맵에 날씨가 없으면 맑음 (강제값 없이) ──
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("WorldScene");
});
await waitScene("WorldScene");
await page.waitForTimeout(2000);
results.plain = await stat();

for (const [k, v] of Object.entries(results)) {
  console.log(`${k.padEnd(10)} kind=${String(v.kind).padEnd(10)} 알갱이=${String(v.grains).padStart(3)}  색조=${JSON.stringify(v.tint)}  무늬=${JSON.stringify(v.tile)}`);
}
console.log("\n겹침 순서(날씨 < 밤낮이어야 함):",
  `날씨색조 ${results.nightRain.tint?.depth} / 밤낮 ${results.nightRain.nightDepth}`,
  results.nightRain.tint?.depth < results.nightRain.nightDepth ? "OK" : "❌");
console.log("HUD(밤비):", results.nightRain.hud);
console.log("HUD(맑음):", results.plain.hud, "← 맑을 땐 날씨를 안 적는다");
console.log("\n콘솔 에러:", errors.length, errors.slice(0, 5));

await browser.close();
