// 0818 — 리전이 L자가 된 뒤 **카메라가 아무 맵도 없는 빈 영역을 비추지 않는지**.
//  사용: DEV_URL=http://localhost:5181 node tools/dbg-camera-0818.mjs
//
// 왜: 22번도로(x0~57, 행0~39)가 붙으면서 리전이 L자가 됐다. 행 40~99의 x0~57은 **어느 맵도 안 덮는다.**
//  카메라 경계를 리전 전체(110×100) 직사각형으로 잡으면 1번도로·태초 서쪽 변, 22번도로 남쪽 변에서
//  화면 절반이 검게 뜬다. 화면 네 모서리 타일이 실제로 맵 위인지로 판정한다(눈대중 아님).
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });
const DEV_URL = process.env.DEV_URL ?? "http://localhost:5180";

// [맵, 로컬x, 로컬y, 허용치%, 설명] — 각 맵에서 **빈 영역과 맞닿은 구석**에 선다.
//  ⭐ 상록시티 남서 구석만 0%가 아니다. 거기서 보이는 x<58·y≥40은 **대각선으로만 이웃한 칸**이라
//     원본(Essentials)도 안 그린다 — 원본은 "그 맵 + 직접 연결된 맵"만 그린다. 그래서 원본과 같은 동작이다.
//     다만 늘어나면 안 되니 실측값(24%)에 여유를 둔 상한으로 못박는다.
const SPOTS = [
  ["route1", 0, 8, 0, "1번도로 서쪽 끝(왼쪽이 빈 영역)"],
  ["pallet", 0, 8, 0, "태초마을 서쪽 끝(왼쪽이 빈 영역)"],
  ["route22", 20, 38, 0, "22번도로 남쪽 끝(아래가 빈 영역)"],
  ["viridian_city", 0, 39, 25, "상록시티 남서 구석 = L자 안쪽 모서리(원본도 대각선 이웃은 안 그린다)"],
];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
const until = async (fn, arg, t = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout: t, polling: 100 }); return true; } catch { return false; }
};

await page.goto(DEV_URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 20000 });

/** 화면이 덮는 타일 범위를 구하고, 그 안에 **맵이 없는 칸**이 몇 %인지 센다. */
const voidRatio = () => page.evaluate(async () => {
  const { mapAtGlobal } = await import("/src/data/region.ts");
  const s = window.__game.scene.getScene("WorldScene");
  const cam = s.cameras.main, t = s.tile;
  const x0 = Math.floor(cam.scrollX / t), x1 = Math.ceil((cam.scrollX + cam.width) / t) - 1;
  const y0 = Math.floor(cam.scrollY / t), y1 = Math.ceil((cam.scrollY + cam.height) / t) - 1;
  let total = 0, empty = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { total++; if (!mapAtGlobal(x, y)) empty++; }
  return { view: [x0, y0, x1, y1], total, empty, pct: Math.round((empty / total) * 100) };
});

for (const [map, lx, ly, allow, label] of SPOTS) {
  console.log(`\n── ${label} — ${map} 로컬(${lx},${ly}) ──────────────`);
  await page.evaluate(([m, x, y]) => {
    const g = window.__game;
    g.scene.scenes.forEach((s) => {
      if (s.scene.key !== "WorldScene" && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
    });
    g.scene.start("WorldScene", { map: m, spawn: [x, y], face: "down", testParty: true });
  }, [map, lx, ly]);
  const up = await until((k) => {
    const s = window.__game.scene.getScene(k);
    return !!s && s.scene.isActive() && s.sys.settings.status === 5;
  }, "WorldScene", 20000);
  if (!up) { ok(false, `${map}: WorldScene이 안 떴다`); continue; }
  await page.waitForTimeout(900);   // 카메라 follow가 자리를 잡을 때까지
  const v = await voidRatio();
  ok(v.pct <= allow,
    `화면에 맵 없는 칸 ${v.empty}/${v.total}칸 = ${v.pct}% (허용 ${allow}%) · 보이는 범위 ${JSON.stringify(v.view)}`);
  await snap(page, path.join(OUT, `camera-0818-${map}.png`));
}

console.log("\n" + (errors.length ? `콘솔에러 ${errors.length}건:\n` + errors.join("\n") : "콘솔에러 없음"));
console.log(fail ? `\n❌ 실패 ${fail}건` : "\n✅ 전부 통과");
await browser.close();
process.exit(fail ? 1 : 0);
