// 실제 배틀 흐름에서 기술 애니가 도는지 확인(캡처 없이 숫자로).
//  doTurn → playMoveAnim 호출 여부 + 그 동안 셀 스프라이트가 실제로 화면에 있었는지를 샘플링한다.
//  사용: node tools/dbg-anim.mjs   (tools/ 안에서 실행)
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 15000 });
await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("playerName", "레드");
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("BattleScene", {});
});
await page.waitForTimeout(2000);

// doTurn이 부르는 playMoveAnim을 감싸서 호출을 기록한다
await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  window.__calls = [];
  window.__maxCells = 0;
  const orig = sc.playMoveAnim.bind(sc);
  sc.playMoveAnim = async (id, isAlly) => {
    window.__calls.push({ id, isAlly });
    const r = await orig(id, isAlly);
    window.__calls.push({ id, isAlly, done: true });
    return r;
  };
});

// 커맨드를 눌러 한 턴을 진행시키면서(스페이스 연타) 셀 스프라이트 수를 계속 샘플링
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Space");
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene("BattleScene");
    const n = sc.children.list.filter((o) => o.texture && String(o.texture.key).startsWith("anim_")).length;
    if (n > window.__maxCells) window.__maxCells = n;
  });
  await page.waitForTimeout(180);
}

const out = await page.evaluate(() => ({ calls: window.__calls, maxCells: window.__maxCells }));
console.log("playMoveAnim 호출:", JSON.stringify(out.calls));
console.log("동시에 떠 있던 셀 스프라이트 최대:", out.maxCells);
console.log(errors.length ? "콘솔에러:\n" + errors.join("\n") : "콘솔에러 없음");
await browser.close();
