// 0818 — 아일라(EV10) 자동실행에서 원본 명령 순서와 **주인공 머리 위 "?"**가 실제로 뜨는지만 본다.
//  dbg-illa-pwh004.mjs(전체 회귀)는 말풍선을 보지 않는다 — 0818에 원본 순서를 맞추고
//  빠져 있던 207[-1,4]("?")·106 대기 2개를 넣었으므로 그 부분만 여기서 못박는다.
//  사용: node tools/dbg-illa-emote-0818.mjs   (dev 서버 5180이 이미 떠 있어야 한다)
import { chromium } from "playwright";

const MAP = "viridian_city";
const EV_ID = 10;
const WORLD_DATA = { map: MAP, spawn: [23, 38], face: "up", testParty: true };

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio"],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

// 파티 채우기(1번도로 바로가기 — 상록시티 바로가기를 쓰면 여기서 자동실행이 소모된다)
await page.evaluate(() => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => { if (s.scene.isActive()) g.scene.stop(s.scene.key); });
  g.scene.start("DebugMenuScene");
});
await page.waitForTimeout(800);
await page.keyboard.press("e");
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("playerName", "테스트");
  g.registry.set("eventSelfSwitches", {});
  g.registry.set("arSwitches", {});
  g.registry.remove("eventContinue");
});

// ── 데이터 순서 먼저(런타임과 별개로 JSON이 원본 순서인지) ────────────────
const lines = await page.evaluate(([map, id]) => {
  const f = window.__game.cache.json.get(`${map}_events`);
  const p = f?.events?.find((e) => e.id === id)?.pages?.find((x) => x.trigger === 3);
  return (p?.lines ?? []).map((l) => Object.keys(l).join("+"));
}, [MAP, EV_ID]);
ok(lines[0] === "text", `첫 줄이 대사(나레이션)다 — 원본과 같은 순서 (받은 값: ${lines[0]})`);
ok(lines.filter((k) => k.startsWith("emote")).length === 2,
  `emote 줄이 2개다("!"와 주인공 "?") — 받은 값: ${JSON.stringify(lines.filter((k) => k.startsWith("emote")))}`);
ok(lines.includes("emote+emoteOn"), `주인공에게 띄우는 emote 줄이 있다 (전체: ${JSON.stringify(lines)})`);
ok(lines.filter((k) => k === "wait").length === 3, `대기 줄이 3개다(원본 106 ×3) — 받은 값: ${lines.filter((k) => k === "wait").length}`);

// ── 런타임 — 자동실행이 도는 동안 말풍선을 매 프레임 담는다 ────────────────
await page.evaluate((d) => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => { if (s.scene.key !== "WorldScene" && s.scene.isActive()) g.scene.stop(s.scene.key); });
  g.scene.start("WorldScene", d);
  // 씬이 뜨기 전에 래치를 걸어야 앞쪽 "!"를 놓치지 않는다.
  const L = { marks: [], running: true, raf: 0 };
  L.stop = () => { L.running = false; if (L.raf) cancelAnimationFrame(L.raf); };
  const tick = () => {
    if (!L.running) return;
    const s = g.scene.getScene("WorldScene");
    if (s && s.scene.isActive()) {
      for (const o of s.children.list) {
        if (o.type !== "Text" || o.depth !== 6.5) continue;
        if (o.text !== "!" && o.text !== "?") continue;
        if (L.marks.some((m) => m.obj === o)) continue;
        L.marks.push({ obj: o, glyph: o.text, y: Math.round(o.y) });
      }
    }
    L.raf = requestAnimationFrame(tick);
  };
  window.__L = L;
  L.raf = requestAnimationFrame(tick);
}, WORLD_DATA);

// 확인키로 대사를 넘기며 두 말풍선이 다 뜨기를 기다린다(배틀로 넘어가기 전까지).
for (let i = 0; i < 30; i++) {
  const got = await page.evaluate(() => ({
    n: (window.__L?.marks ?? []).length,
    battle: !!window.__game.scene.getScene("BattleScene")?.scene.isActive(),
  }));
  if (got.n >= 2 || got.battle) break;
  await page.keyboard.press("c");
  await page.waitForTimeout(350);
}
const marks = await page.evaluate(() => {
  const L = window.__L;
  L?.stop?.();
  return (L?.marks ?? []).map((m) => ({ glyph: m.glyph, y: m.y }));
});
const glyphs = marks.map((m) => m.glyph);
ok(glyphs[0] === "!", `첫 말풍선이 아일라의 "!"다 (받은 순서: ${JSON.stringify(glyphs)})`);
ok(glyphs[1] === "?", `두 번째가 주인공의 "?"다 (받은 순서: ${JSON.stringify(glyphs)})`);
// 아일라(23,35)는 플레이어(23,38)보다 세 칸 위 → "!"의 y가 더 작아야 한다.
const bang = marks.find((m) => m.glyph === "!");
const q = marks.find((m) => m.glyph === "?");
ok(!!bang && !!q && bang.y < q.y, `"!"가 위(아일라), "?"가 아래(주인공)다 — y: ${bang?.y} < ${q?.y}`);

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(fail === 0 ? "\n✅ 전부 통과" : `\n❌ 실패 ${fail}건`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
