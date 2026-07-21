// 건물 크기 대조용 캡처: 태초마을 야외(WorldScene)를 1280x720 / 1920x1080 두 뷰포트로 찍는다.
// 창 크기에 따라 보이는 칸 수가 달라지는 게 쟁점이라 두 해상도가 모두 필요하다.
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const OUT = "/tmp/claude-1000/-mnt-d-dev-Pokemon-With/907c4f26-40cf-4781-b3bb-e959aab50a0f/scratchpad";
const b = await chromium.launch({
  headless: false,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
         "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});

for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://localhost:5180", { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 20000 });
  await p.evaluate(() => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("WorldScene");
  });
  await p.waitForTimeout(3000);           // fadeIn(400ms) + 타일 렌더 여유
  const info = await p.evaluate(() => {
    const s = window.__game.scene.getScene("WorldScene");
    const cam = s.cameras.main;
    return { tx: s.tx, ty: s.ty, tile: s.tile, zoom: cam.zoom, cw: cam.width, ch: cam.height };
  });
  console.log(JSON.stringify({ viewport: [w, h], ...info,
    tilesAcross: +(info.cw / info.tile * info.zoom).toFixed(2),
    tilesDown: +(info.ch / info.tile * info.zoom).toFixed(2) }));
  await snap(p, `${OUT}/mine_${w}x${h}.png`);
  await p.close();
}
await b.close();
console.log("CAPTURE DONE");
