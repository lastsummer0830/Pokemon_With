// 0801 밤낮(시간 흐름) 검증 — 해가 '점점' 지고 '점점' 뜨는지.
//   A. 시각별 색조가 끊기지 않고 이어지는가 (숫자 — toneAt을 5분 간격으로 훑는다)
//   B. 실제 야외 화면이 시각별로 어떻게 보이는가 (캡처 8장 + 몽타주)
//   C. 배틀 배경이 시간대 그림(route_night_bg)으로 바뀌는가 (캡처)
// 사용: node tools/dbg-daynight-0801.mjs   (⚠️ tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const URL = "http://localhost:5180";
const OUT = "../../.claude/.verify";
// 해가 뜨고 지는 대목을 훑는 시각들(정시가 아니라 '중간'도 넣어야 이어지는 게 보인다).
const HOURS = [4, 5.5, 6, 8, 13, 17.5, 18.5, 19.5, 20.5, 22];

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

// ── A. 색조가 이어지는가 — 5분 간격으로 훑어 '한 칸 사이 변화량'을 본다 ──
const curve = await page.evaluate(async () => {
  const { toneAt } = await import("/src/systems/daynight.ts");
  const out = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    const d = new Date(2026, 0, 1, Math.floor(m / 60), m % 60, 0, 0);
    const t = toneAt(d);
    out.push({ m, color: t.color, alpha: +t.alpha.toFixed(4) });
  }
  // 이웃한 두 시점의 밝기 차이가 가장 큰 곳(= 가장 툭 튀는 지점)을 찾는다.
  let worst = { m: 0, dAlpha: 0, dColor: 0 };
  for (let i = 1; i < out.length; i++) {
    const dA = Math.abs(out[i].alpha - out[i - 1].alpha);
    const ch = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    const [r1, g1, b1] = ch(out[i].color), [r0, g0, b0] = ch(out[i - 1].color);
    const dC = Math.max(Math.abs(r1 - r0), Math.abs(g1 - g0), Math.abs(b1 - b0));
    if (dA > worst.dAlpha) worst = { m: out[i].m, dAlpha: +dA.toFixed(4), dColor: dC };
  }
  const at = (h) => out.find((o) => o.m === h * 60);
  return { worst, samples: [0, 5, 6, 10, 16, 18, 19, 20, 22].map((h) => ({ h, ...at(h) })) };
});

// ── B. 실제 야외 화면 — 시각을 바꿔가며 캡처 ──
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.registry.set("playerName", "레드");
  g.scene.start("WorldScene");
});
await waitScene("WorldScene");
await page.waitForTimeout(3000);

for (const h of HOURS) {
  // 씬의 색조 사각형에 '그 시각의 색'을 직접 얹는다(진짜 게임 화면 위에서 확인).
  await page.evaluate(async (hour) => {
    const { toneAt } = await import("/src/systems/daynight.ts");
    const sc = window.__game.scene.getScene("WorldScene");
    const d = new Date(2026, 0, 1, Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    const t = toneAt(d);
    sc.dayNight.rect.setFillStyle(t.color, t.alpha);
  }, h);
  await page.waitForTimeout(700);
  const label = String(h).replace(".5", "30").padStart(2, "0");
  await snap(page, `${OUT}/0801_밤낮_${label}시.png`);
}

// ── C. 배틀 배경(밤) ──
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("BattleScene", { wild: true, testParty: true, backdrop: "route", debugTimeBand: "night" });
});
await waitScene("BattleScene");
await page.waitForTimeout(4000);
const bb = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  const src = sc.textures.get("bb_bg").getSourceImage();
  return { src: src.src ? src.src.split("/").pop() : "(canvas)", size: [src.width, src.height] };
});
await snap(page, `${OUT}/0801_밤낮_배틀배경.png`);

// ── D. 확인 항목이 실제로 쓰는 경로(debugTimeBand)로 들어갔을 때 ──
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("WorldScene", { debugTimeBand: "night" });
});
await waitScene("WorldScene");
await page.waitForTimeout(3500);
const forced = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("WorldScene");
  const hud = sc.children.getByName("hud");
  return { band: sc.dayNight.band, hud: hud?.text, alpha: +sc.dayNight.rect.fillAlpha.toFixed(3) };
});
await snap(page, `${OUT}/0801_밤낮_확인항목_밤.png`);

console.log("=== A. 색조 곡선(끊김 검사) ===");
console.log("  5분 사이 최대 변화:", JSON.stringify(curve.worst), "← alpha 변화가 0.01 언저리면 눈에 안 띈다");
for (const s of curve.samples) console.log(`  ${String(s.h).padStart(2)}시  #${s.color.toString(16).padStart(6, "0")}  a=${s.alpha}`);
console.log("\n=== D. 확인 항목(debugTimeBand: night) ===");
console.log(" ", JSON.stringify(forced));
console.log("\n=== C. 배틀 배경 ===");
console.log(" ", JSON.stringify(bb));
console.log("\n콘솔 에러:", errors.length, errors.slice(0, 5));

await browser.close();
