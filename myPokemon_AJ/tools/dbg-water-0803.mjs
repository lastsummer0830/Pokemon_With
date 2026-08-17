// 0803 물결(움직이는 오토타일) 검증.
//  사용: node tools/dbg-water-0803.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//
//  원본 실측(왜 상록시티만인가):
//   · 태초마을 물 12칸 = 오토타일 NOANIMSEA.png(96x128 = 1프레임) → **원본도 안 움직인다**
//   · 상록시티 물 30칸 = 오토타일 STILL.png(1056x128 = 11프레임) → 움직인다
//   · 속도 = TilemapRenderer.rb의 AUTOTILE_FRAME_DURATION 5 → 5/20초 = 프레임당 0.25초(4fps)
//
//  ⚠️ STILL은 이름 그대로 **잔잔한** 물이라 프레임 차이가 타일당 20/1024픽셀뿐이다.
//     그래서 "두 시점을 찍어 비교"하면 우연히 같은 프레임이 잡혀 0%가 나온다(실제로 겪음).
//     → 프레임을 **직접 지정해** 찍어서 화면이 진짜 바뀌는지 본다.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
const PICK = path.resolve("../../01_Resources/Pick/20_물결");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PICK, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto((process.env.DEV_URL ?? "http://localhost:5180"), { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };

await page.evaluate(() => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => {
    if (s.scene.key !== "WorldScene" && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
  });
  g.registry.set("playerName", "레드");
  g.scene.start("WorldScene", { map: "viridian_city", spawn: [24, 20], testParty: true });
});
await page.waitForTimeout(2600);

const info = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const w = s.children.list.filter((o) => o.anims?.currentAnim?.key?.startsWith?.("water_"));
  const t = w[0];
  s.cameras.main.stopFollow();
  s.cameras.main.centerOn(t.x, t.y);
  return { n: w.length, fps: t.anims.currentAnim.frameRate, frames: t.anims.currentAnim.frames.length, playing: t.anims.isPlaying };
});
console.log(`\n[1] 물결이 상록시티에 깔렸는가`);
ok(info.n === 30, `원본과 같은 30칸 (실제 ${info.n})`);
ok(info.frames === 11, `원본 STILL과 같은 11프레임 (실제 ${info.frames})`);
ok(info.fps === 4, `원본 규칙대로 프레임당 0.25초 = 4fps (실제 ${info.fps})`);
ok(info.playing, "실제로 돌고 있다");

// 태초마을 물은 원본이 정지 오토타일 → 우리도 붙이지 않는다.
//  ⚠️ "파일이 404인지"로 보면 안 된다 — vite는 없는 경로에 index.html을 돌려줘 200이 나온다(실제로 헷갈렸다).
//     대신 **그 맵 구역에 물결 스프라이트가 하나도 없는지**를 본다(태초마을 = 리전 y 80~99).
const palletWater = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const tile = s.tile;
  return s.children.list
    .filter((o) => o.anims?.currentAnim?.key?.startsWith?.("water_"))
    .filter((o) => Math.floor(o.y / tile) - 1 >= 80).length;
});
ok(palletWater === 0, `태초마을엔 물결이 없다(원본도 NOANIMSEA = 정지) — 실제 ${palletWater}칸`);

console.log(`\n[2] 프레임을 바꾸면 화면이 실제로 바뀌는가`);
const shotAt = async (frame, file) => {
  await page.evaluate((f) => {
    const s = window.__game.scene.getScene("WorldScene");
    s.children.list.filter((o) => o.anims?.currentAnim?.key?.startsWith?.("water_")).forEach((o) => {
      o.anims.pause();
      o.anims.setCurrentFrame(o.anims.currentAnim.frames[f]);
    });
  }, frame);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(600);
  const buf = await page.screenshot();
  fs.writeFileSync(path.join(PICK, file), buf);
  fs.writeFileSync(path.join(OUT, file), buf);
};
await shotAt(0, "0803_물결_프레임0.png");
await shotAt(5, "0803_물결_프레임5.png");
console.log("     캡처: 01_Resources/Pick/20_물결/0803_물결_프레임0.png · _프레임5.png");
console.log("     (imgdiff.mjs로 두 장을 비교하면 물 칸만 달라진다 — 잔물결이라 차이가 작다)");

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(fail ? `\n실패 ${fail}개` : "\n전부 통과");
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
