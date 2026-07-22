// 애니 마감 3종 검증 — ① 애니 도중 대사창 유지 ② 타이밍 2·4(배경/전경 서서히 변화) ③ Common 애니.
//  사용: node tools/shot-animpolish.mjs [출력폴더]   (⚠️ tools/ 안에서 실행 — ./_snap.mjs import)
//  캡처는 headless. ②·③은 재생기를 직접 부르고, ①만 실제 배틀 흐름(커맨드→기술)으로 확인한다.
//  ⚠️ 배경/전경 판은 TileSprite인데 texture.key가 내부 UUID다 → 깊이(20·21·120·121)로 찾는다.
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/tmp/animpolish";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

const boot = async (fps) => {
  await page.evaluate((fps) => {
    const g = window.__game;
    g.registry.set("playerName", "레드");
    g.registry.set("animFps", fps);      // 캡처가 따라가게 늦춘다(평소엔 원본 20fps)
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("BattleScene", {});
  }, fps);
  await page.waitForTimeout(2000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(500); }
  await page.waitForFunction(() => {
    const sc = window.__game.scene.getScene("BattleScene");
    return sc?.enemySprite?.alpha > 0.9 && sc?.allySprite?.alpha > 0.9;
  }, { timeout: 10000 });
};

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 15000 });

// ── ① 실제 배틀 흐름: 커맨드 → 기술 → "OO의 기술!" 대사 → 애니. 그 동안 대사창이 떠 있어야 한다 ──
await boot(6);
await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  window.__inAnim = false; window.__animRan = false; window.__msgDuring = [];
  const orig = sc.playMoveAnim.bind(sc);
  sc.playMoveAnim = async (id, isAlly) => {
    window.__inAnim = true; window.__animRan = true;
    const r = await orig(id, isAlly);
    window.__inAnim = false;
    return r;
  };
});
let shotDuringAnim = false;
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => {
    const sc = window.__game.scene.getScene("BattleScene");
    if (window.__inAnim) window.__msgDuring.push(!!sc.msgLayer?.visible);
    return { inAnim: window.__inAnim, ran: window.__animRan };
  });
  if (st.inAnim && !shotDuringAnim) {           // 애니 도중 화면 한 장(대사창이 보이는지 눈으로도 확인)
    shotDuringAnim = true;
    await snap(page, `${OUT}/flow_during_anim.png`);
  }
  if (!st.inAnim && st.ran) break;
  if (!st.inAnim) await page.keyboard.press("Space");
  await page.waitForTimeout(160);
}
const flow = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  return { samples: window.__msgDuring, ran: window.__animRan, text: sc.msgText?.text };
});
const ok1 = flow.samples.length > 0 && flow.samples.every(Boolean);
console.log(`① 실제 흐름: 애니 실행=${flow.ran} · 애니 도중 대사창 표시 샘플=${flow.samples.length}개 중 보임 ${flow.samples.filter(Boolean).length}개`);
console.log(`   마지막 대사="${flow.text}" → ${ok1 ? "대사창 유지 OK" : "❌ 애니 도중 대사창이 사라진다"}`);

// ── ②③ 은 재생기를 직접 불러 검증(배틀 흐름과 무관) ──
await boot(4);
await page.evaluate(async () => {
  const sc = window.__game.scene.getScene("BattleScene");
  const m = await import("/src/game/battleAnim.ts");
  const ar = await import("/src/data/ar/index.ts");
  const md = ar.getMove("EARTHQUAKE");
  window.__animDone = false;
  m.playMoveAnimation(sc, sc.view, { user: sc.allySprite, target: sc.enemySprite }, "EARTHQUAKE", true,
    md ? { type: md.type, category: md.category, target: md.target } : undefined)
    .then(() => { window.__animDone = true; });
});

const readPlanes = () => page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  const planes = sc.children.list
    .filter((o) => [20, 21, 120, 121].includes(o.depth))
    .map((o) => ({ z: o.depth, a: +(o.alpha ?? 1).toFixed(2), tx: o.tilePositionX === undefined ? null : Math.round(o.tilePositionX) }));
  return { planes, done: window.__animDone };
});
const samples = [];
for (let i = 0; i < 24; i++) {
  const s = await readPlanes();
  samples.push(s.planes);
  if (i % 3 === 0 && i < 22) await snap(page, `${OUT}/eq_${String(i).padStart(2, "0")}.png`);
  if (s.done) break;
  await page.waitForTimeout(120);
}
console.log("\n② EARTHQUAKE 배경(z21)·전경(z121) 판 — alpha/스크롤이 서서히 변해야 정상:");
samples.forEach((p, i) => console.log(` ${String(i).padStart(2)} ${JSON.stringify(p)}`));
const bg = samples.flatMap((p) => p.filter((o) => o.z === 21));
const fo = samples.flatMap((p) => p.filter((o) => o.z === 121));
const uniq = (a) => [...new Set(a)].join(",");
console.log(`② 배경 alpha:[${uniq(bg.map((o) => o.a))}] 스크롤:[${uniq(bg.map((o) => o.tx))}]`);
console.log(`② 전경 alpha:[${uniq(fo.map((o) => o.a))}] 스크롤:[${uniq(fo.map((o) => o.tx))}]`);
const ok2 = new Set(bg.map((o) => o.a)).size > 1 && new Set(bg.map((o) => o.tx)).size > 1;
console.log("②", ok2 ? "서서히 변화 OK(즉시 설정만이면 값이 한 종류였을 것)" : "❌ 값이 안 변한다");

await page.waitForFunction(() => window.__animDone, { timeout: 40000 });
await page.waitForTimeout(400);
const leftover = await readPlanes();
console.log("② 애니 후 남은 판:", JSON.stringify(leftover.planes), leftover.planes.length ? "❌ 누수" : "OK");
await snap(page, `${OUT}/eq_zz_after.png`);

// ── ③ Common 애니(HealthUp) ──
await page.evaluate(async () => {
  const sc = window.__game.scene.getScene("BattleScene");
  const m = await import("/src/game/battleAnim.ts");
  window.__cDone = false; window.__cMax = 0;
  m.playCommonAnimation(sc, sc.view, { user: sc.allySprite, target: sc.allySprite }, "HealthUp")
    .then(() => { window.__cDone = true; });
});
for (let i = 0; i < 14; i++) {
  const done = await page.evaluate(() => {
    const sc = window.__game.scene.getScene("BattleScene");
    const n = sc.children.list.filter((o) => String(o.texture?.key).startsWith("anim_")).length;
    if (n > window.__cMax) window.__cMax = n;
    return window.__cDone;
  });
  if (i % 2 === 0) await snap(page, `${OUT}/healthup_${String(i).padStart(2, "0")}.png`);
  if (done) break;
}
await page.waitForFunction(() => window.__cDone, { timeout: 20000 });
const cMax = await page.evaluate(() => window.__cMax);
console.log("\n③ HealthUp Common 애니: 동시에 뜬 셀 스프라이트 최대", cMax, cMax > 0 ? "OK" : "❌ 아무것도 안 그려짐");

console.log("\n" + (errors.length ? "콘솔에러:\n" + errors.join("\n") : "콘솔에러 없음"));
console.log("캡처:", OUT);
await browser.close();
