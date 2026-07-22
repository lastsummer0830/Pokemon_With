// 기술 애니메이션(AR 원본) 실동작 검증 — 애니 재생기를 직접 불러 프레임을 하나씩 캡처한다.
//  사용: node tools/shot-moveanim.mjs [출력폴더] [기술id...]
//  ⚠️ tools/ 안에서 실행할 것(./_snap.mjs import). 캡처는 headless.
//  · 메뉴를 키로 더듬어 가면 타이밍이 어긋난다 → dev서버(Vite)의 ESM으로 battleAnim을 직접 import해 재생.
//  · registry의 animFps로 3fps까지 늦춘다(원본 20fps는 캡처가 못 따라감).
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/tmp/moveanim";
const MOVES = process.argv.slice(3);
if (!MOVES.length) MOVES.push("EMBER");
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5180";

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("playerName", "레드");
  g.registry.set("animFps", 3);
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("BattleScene", {});
});
await page.waitForTimeout(2000);
// 상대가 등장할 때까지 대사를 넘긴다(상대 스프라이트는 등장 전엔 alpha 0)
for (let i = 0; i < 3; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(500); }
await page.waitForFunction(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  return sc?.enemySprite && sc.enemySprite.alpha > 0.9 && sc.allySprite?.alpha > 0.9;
}, { timeout: 10000 });

const shot = async (path) => { await snap(page, path); };

for (const arg of MOVES) {
  const byAlly = !arg.startsWith("foe:");             // "foe:TACKLE" = 상대가 쓰는 경우
  const move = byAlly ? arg : arg.slice(4);
  // 재생기를 직접 호출(배틀 흐름과 무관하게 애니만 검증)
  const info = await page.evaluate(async ({ move, byAlly }) => {
    const sc = window.__game.scene.getScene("BattleScene");
    const m = await import("/src/game/battleAnim.ts");
    const ar = await import("/src/data/ar/index.ts");
    const md = ar.getMove(move);
    const user = byAlly ? sc.allySprite : sc.enemySprite;
    const target = byAlly ? sc.enemySprite : sc.allySprite;
    window.__animDone = false;
    window.__before = { ux: user.x, uy: user.y, usx: user.scaleX, tx: target.x, ty: target.y };
    m.playMoveAnimation(sc, sc.view, { user, target }, move, byAlly,
      md ? { type: md.type, category: md.category, target: md.target } : undefined)
      .then(() => { window.__animDone = true; });
    const idx = await m.loadAnimIndex();
    const pair = idx?.moves[move];
    const id = pair ? (byAlly || pair[1] < 0 ? pair[0] : pair[1]) : -1;
    return { id, meta: id >= 0 ? idx.anims[String(id)] : null };
  }, { move, byAlly });
  const tag = (byAlly ? "" : "foe_") + move;
  console.log(`${tag}: 애니 #${info.id}`, JSON.stringify(info.meta));

  // ⚠️ snap() 한 장에 0.5초 넘게 걸린다 → 대기 없이 연속으로 찍어야 애니 중간을 잡는다.
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => window.__animDone);
    await shot(`${OUT}/${tag}_${String(i).padStart(2, "0")}.png`);
    if (done) break;
  }
  await page.waitForFunction(() => window.__animDone, { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(`${OUT}/${tag}_zz_after.png`);   // 포켓몬 위치·크기가 원래대로 돌아왔는지
  // 끝난 뒤 포켓몬이 원래 자리·크기로 돌아왔는지 숫자로도 확인
  const back = await page.evaluate(({ byAlly }) => {
    const sc = window.__game.scene.getScene("BattleScene");
    const user = byAlly ? sc.allySprite : sc.enemySprite;
    const target = byAlly ? sc.enemySprite : sc.allySprite;
    const b = window.__before;
    return { dx: user.x - b.ux, dy: user.y - b.uy, dsx: user.scaleX - b.usx,
      tdx: target.x - b.tx, tdy: target.y - b.ty, ox: user.originX, oy: user.originY };
  }, { byAlly });
  console.log(`  복구: 사용자 Δ(${back.dx.toFixed(1)},${back.dy.toFixed(1)}) 크기Δ${back.dsx.toFixed(2)} 원점(${back.ox},${back.oy}) / 상대 Δ(${back.tdx.toFixed(1)},${back.tdy.toFixed(1)})`);
}

console.log(errors.length ? "콘솔에러:\n" + errors.join("\n") : "콘솔에러 없음");
await browser.close();
console.log("DONE →", OUT);
