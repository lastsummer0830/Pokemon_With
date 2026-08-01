// 0802 언덕(점프대) 검증 — 원본 규칙대로 "아래로만 2칸 점프, 위/옆은 벽"이 실제로 도는지.
//  사용: node tools/dbg-ledge-0802.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0802_언덕_*.png
//
// ⚠️ headless(swiftshader)는 ~3fps로 돈다 → 고정 sleep 말고 waitForFunction으로 기다린다(0801 함정 1번).
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });
const ROUTE1_OY = 40;                     // region.ts: route1은 리전에서 oy=40
const L = (x, y) => [x, y + ROUTE1_OY];   // 1번도로 로컬 → 리전 글로벌

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "OK " : "❌ "}${msg}`); if (!cond) fail++; };

/** 1번도로의 주어진 로컬좌표에 서서 WorldScene을 연다. 파티도 한 마리 넣어 둔다(조우 판정 경로를 살려두려고). */
async function enter(lx, ly, face) {
  await page.evaluate(([x, y, f]) => {
    const g = window.__game;
    // ⚠️ 씬을 다시 시작해도 Phaser는 **같은 인스턴스**를 쓴다 → 지난 검증에서 붙인 훅이 그대로 살아남아
    //    새 씬을 시작하자마자 다시 얼려버린다(실제로 [4]번 항목이 이래서 죽었다). 먼저 떼어낸다.
    const old = g.scene.getScene("WorldScene");
    if (old?.__sampler) { old.events.off("postupdate", old.__sampler); old.__sampler = null; }
    if (old?.__origLandOn) { old.landOn = old.__origLandOn; old.__origLandOn = null; }
    g.registry.set("playerName", "레드");
    g.registry.set("playerGender", "boy");
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("WorldScene", { map: "route1", spawn: [x, y], face: f });
  }, [lx, ly, face]);
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("WorldScene");
    // ⚠️ 씬 진입 fadeIn(400ms)이 끝나기 전에 캡처하면 화면이 시커멓게 찍혀 "밤인가?" 하고 오해한다.
    //    (실제로 첫 몽타주가 그랬다 — 밤낮 색조는 멀쩡한데 페이드 도중이었다.)
    return s?.scene.isActive() && s.player && !s.busy && s.ledge?.length
        && !s.cameras.main.fadeEffect.isRunning;
  }, { timeout: 90000 });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("WorldScene");
    window.__samples = [];
    window.__sfx = [];
    window.__landed = null;
    if (!s.__origPlay) { s.__origPlay = s.sound.play.bind(s.sound); }
    s.sound.play = (k, o) => { window.__sfx.push(k); return s.__origPlay(k, o); };
    // 점프 궤적을 재려고 매 프레임 위치를 기록한다(headless ~3fps라 표본 수도 같이 찍는다).
    s.__sampler = () => window.__samples.push(
      { x: s.player.x, y: s.player.y, tx: s.tx, ty: s.ty, moving: s.moving, t: performance.now() });
    s.events.on("postupdate", s.__sampler);
    // ⚠️ 키를 누른 채로 두면 `moving`은 프레임 사이에 **절대 false로 안 보인다**
    //    (착지시킨 그 update가 곧바로 다음 걸음을 시작한다) → 바깥에서 폴링하면 착지칸을 놓친다.
    //    그래서 도착 처리(landOn) 자체를 가로채 **첫 착지칸**을 남기고 그 자리에서 얼린다.
    s.__origLandOn = s.landOn.bind(s);
    s.landOn = (tx, ty) => {
      s.__origLandOn(tx, ty);
      if (!window.__landed) { window.__landed = [tx, ty]; s.busy = true; }
    };
    // 점프 트윈의 갱신 함수를 붙잡아 둔다 — 나중에 f=0/0.5/1을 **직접 먹여** 궤적을 정확히 잰다.
    //  (프레임을 샘플링해서 재면 headless 3fps에선 표본이 1~2개라 값이 0.75↔1.21로 튄다. 실제로 튀었다.)
    s.__origAddCounter = s.tweens.addCounter.bind(s.tweens);
    s.tweens.addCounter = (cfg) => { window.__jumpCfg = cfg; return s.__origAddCounter(cfg); };
  });
}
const pos = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return { tx: s.tx, ty: s.ty, moving: s.moving, px: s.player.x, py: s.player.y, tile: s.tile };
});

// ── 1. 격자에 언덕이 실제로 들어왔나 ───────────────────────────────────────
await enter(25, 30, "down");
const grid = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const c = {};
  for (const row of s.ledge) for (const v of row) if (v) c[v] = (c[v] ?? 0) + 1;
  return { counts: c, total: Object.values(c).reduce((a, b) => a + b, 0) };
});
console.log("\n[1] 리전 격자에 실린 언덕");
console.log(`  방향별: ${JSON.stringify(grid.counts)} (2=아래 4=왼 6=오 8=위)  합계 ${grid.total}칸`);
ok(grid.total === 100, "1번도로 61 + 상록시티 39 = 100칸이 실렸다");
ok(grid.counts["2"] === 100, "우리 3맵의 언덕은 전부 '아래로' 방향이다(원본 실측과 같음)");
ok(await page.evaluate(() => window.__game.scene.getScene("WorldScene").blocked[71][25] === 1),
   "언덕 칸은 blocked로도 막혀 있다(그 위에 설 수 없다)");

// ── 2. 아래로 → 2칸 점프 ──────────────────────────────────────────────────
console.log("\n[2] ↓ 입력 = 언덕 뛰어내리기");
const before = await pos();
ok(before.ty === L(25, 30)[1], `시작 위치 (25,30) 로컬 = 글로벌 y ${before.ty}`);
await page.screenshot({ path: path.join(OUT, "0802_언덕_1_점프전.png") });

await page.keyboard.down("ArrowDown");
await page.waitForFunction(() => window.__game.scene.getScene("WorldScene").moving, { timeout: 90000 });
await page.waitForFunction(() => window.__landed, { timeout: 90000 });
await page.keyboard.up("ArrowDown");
const after = await page.evaluate(() => window.__landed);
await page.screenshot({ path: path.join(OUT, "0802_언덕_3_착지.png") });
ok(after[1] === L(25, 32)[1] && after[0] === 25,
   `언덕(y=71)을 건너뛰어 (25,32)에 착지 — 글로벌 y ${before.ty}→${after[1]} (2칸)`);
ok((await page.evaluate(() => window.__sfx)).includes("sfx_jump"), "AR 'Player jump' 효과음이 울렸다");

// 점프 궤적 — 붙잡아 둔 갱신 함수에 진행도 f를 직접 먹여 잰다(프레임 수와 무관하게 정확).
//  원본 Game_Character: 높이 = jump_peak × (4·|f−0.5|² − 1), jump_peak = 2칸 × 32px × 3/8 = 0.75칸.
const arc = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const cfg = window.__jumpCfg;
  if (!cfg?.onUpdate) return null;
  const keep = { x: s.player.x, y: s.player.y };
  const at = (f) => { cfg.onUpdate({ getValue: () => f }); return { x: s.player.x, y: s.player.y }; };
  const p = [0, 0.25, 0.5, 0.75, 1].map(at);
  s.player.setPosition(keep.x, keep.y);                 // 재고 나서 원위치(검증이 화면을 흔들지 않게)
  const straight = (f) => p[0].y + (p[4].y - p[0].y) * f;
  return {
    tiles: (p[4].y - p[0].y) / s.tile,                  // 총 이동 = 2칸이어야 한다
    peak: (straight(0.5) - p[2].y) / s.tile,            // f=0.5에서 직선보다 얼마나 위인가
    quarter: (straight(0.25) - p[1].y) / s.tile,        // f=0.25 → 원본 공식상 0.75×0.75 = 0.5625칸
    ends: [(straight(0) - p[0].y) / s.tile, (straight(1) - p[4].y) / s.tile],   // 양끝은 0이어야 한다
  };
});
const near = (a, b) => Math.abs(a - b) < 0.02;
console.log(`  총 이동 ${arc?.tiles.toFixed(2)}칸 · 최고점(f=0.5) ${arc?.peak.toFixed(3)}칸 · f=0.25 지점 ${arc?.quarter.toFixed(3)}칸`
          + ` · 양끝 ${arc?.ends.map((v) => v.toFixed(3)).join("/")}`);
ok(arc !== null && near(arc.tiles, 2), "언덕 너머 2칸을 이동한다");
ok(arc !== null && near(arc.peak, 0.75), "최고점이 원본 jump_peak = 0.75칸과 같다");
ok(arc !== null && near(arc.quarter, 0.5625), "f=0.25 높이도 원본 포물선 공식과 같다(0.5625칸)");
ok(arc !== null && near(arc.ends[0], 0) && near(arc.ends[1], 0), "출발·착지 순간엔 떠 있지 않다(양끝 0)");

// 궤적 꼭대기 한 장 — headless는 ~3fps라 실제 프레임으로는 점프 시작(f≈0)밖에 못 잡는다.
//  그래서 **그 점프의 갱신 함수를 f=0.5로 직접 돌려** 같은 화면을 그리고 찍는다(합성 아님, 진짜 렌더).
await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  window.__keep = { x: s.player.x, y: s.player.y };
  window.__jumpCfg.onUpdate({ getValue: () => 0.5 });
});
await page.screenshot({ path: path.join(OUT, "0802_언덕_2_점프중.png") });
await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  s.player.setPosition(window.__keep.x, window.__keep.y);
});

// ── 3. 아래에서 위로는 못 올라간다 ────────────────────────────────────────
console.log("\n[3] ↑ 입력 = 언덕은 못 올라간다");
await enter(25, 32, "up");
const upBefore = await pos();
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(2500);       // 3fps라 넉넉히 — 움직였다면 이 안에 끝난다
await page.keyboard.up("ArrowUp");
const upAfter = await pos();
ok(upAfter.ty === upBefore.ty && upAfter.tx === upBefore.tx,
   `제자리 그대로 (${upAfter.tx},${upAfter.ty}) — 언덕을 기어오르지 못한다`);
ok((await page.evaluate(() => window.__sfx)).includes("sfx_bump"), "대신 '툭' 부딪힘 소리가 났다");
await page.screenshot({ path: path.join(OUT, "0802_언덕_4_위로막힘.png") });

// ── 4. 옆으로도 못 들어간다 ───────────────────────────────────────────────
console.log("\n[4] 언덕 줄을 옆에서 파고들 수 없다");
await enter(21, 31, "right");           // (21,31)은 언덕줄 y=31의 빈칸, 오른쪽 (22,31)이 언덕
const sideBefore = await pos();
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(2500);
await page.keyboard.up("ArrowRight");
const sideAfter = await pos();
ok(sideAfter.tx === sideBefore.tx, `옆(오른쪽)으로 언덕에 못 들어간다 — x ${sideBefore.tx} 그대로`);

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
if (errors.length) fail++;
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
await browser.close();
process.exit(fail ? 1 : 0);
