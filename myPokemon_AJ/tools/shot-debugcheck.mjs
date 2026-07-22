// 디버그 "확인 항목" 페이지 검증 — 메뉴 → 항목 실행 → 상단 확인바로 다음/이전 훑기.
//  사용: node tools/shot-debugcheck.mjs [출력폴더]   (⚠️ tools/ 안에서 실행 — ./_snap.mjs import)
//  전부 headless. 실제 UI(마우스 클릭·키)로 몰아보고 각 단계를 캡처한다.
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/tmp/debugcheck";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 15000 });

// 애니는 캡처가 따라가게 늦춘다(평소엔 원본 20fps).
await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("animFps", 6);
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("DebugMenuScene");
});
await page.waitForTimeout(1200);

const menuState = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("DebugMenuScene");
  const rows = sc.panel.list.filter((o) => o.type === "Rectangle" && o.input);
  return { rows: rows.length, first: { x: rows[0]?.x, y: rows[0]?.y, w: rows[0]?.width, h: rows[0]?.height } };
});
console.log("확인 항목 행 수:", menuState.rows, menuState.first);
await snap(page, `${OUT}/01_debugmenu.png`);

// ── 항목 3(기술 애니 재생 — 기술 고르기)을 진짜 마우스로 클릭한다 ──
const rowXY = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("DebugMenuScene");
  const rows = sc.panel.list.filter((o) => o.type === "Rectangle" && o.input);
  const r = rows[2];
  return { x: r.x + 40, y: r.y + r.height / 2 };
});
await page.mouse.click(rowXY.x, rowXY.y);
await page.waitForTimeout(1500);
await snap(page, `${OUT}/02_movepicker.png`);
const pickerInfo = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("DebugMenuScene");
  return { open: sc.pickerOpen };
});
console.log("기술 고르기 오버레이:", pickerInfo);

// EMBER 프리셋 버튼(초록)을 클릭 — 없으면 첫 페이지 첫 칸.
const emberXY = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("DebugMenuScene");
  const layer = sc.children.list.find((o) => o.type === "Container" && o.depth === 1000);
  const t = layer.list.find((o) => o.type === "Text" && o.style?.backgroundColor === "#1d3a2a");
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, label: t.text };
});
console.log("고른 프리셋:", emberXY.label);
await page.mouse.click(emberXY.x, emberXY.y);

// ── BattleScene 데모 — 애니 재생 여부를 훅으로 확인한다(한 번만 걸어두면 재시작해도 남는다) ──
await page.waitForFunction(() => window.__game.scene.getScene("BattleScene")?.scene.isActive(), { timeout: 15000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BattleScene");
  if (sc.__patched) return;
  sc.__patched = true;
  window.__anim = { in: false, log: [] };
  const m = sc.playMoveAnim.bind(sc), c = sc.playCommonAnim.bind(sc);
  sc.playMoveAnim = async (id, isAlly) => {
    window.__anim.in = true; window.__anim.log.push(`move:${id}:${isAlly ? "ally" : "foe"}`);
    const r = await m(id, isAlly); window.__anim.in = false; return r;
  };
  sc.playCommonAnim = async (name, onAlly) => {
    window.__anim.in = true; window.__anim.log.push(`common:${name}:${onAlly ? "ally" : "foe"}`);
    const r = await c(name, onAlly); window.__anim.in = false; return r;
  };
});

// 데모 한 편을 돌린다: 스페이스로 대사를 넘기며, 애니가 도는 순간과 대사창 상태를 기록·캡처.
async function runDemo(tag, spaces = 6) {
  let shot = false, msgDuringAnim = [];
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => {
      const sc = window.__game.scene.getScene("BattleScene");
      return { inAnim: window.__anim.in, msg: !!sc.msgLayer?.visible, text: sc.msgText?.text ?? "" };
    });
    if (st.inAnim) {
      msgDuringAnim.push(st.msg);
      if (!shot) { shot = true; await snap(page, `${OUT}/${tag}.png`); }
    } else if (spaces > 0 && !shot) {
      await page.keyboard.press("Space"); spaces--;
    } else if (shot) break;
    await page.waitForTimeout(250);
  }
  if (!shot) await snap(page, `${OUT}/${tag}.png`);
  const log = await page.evaluate(() => { const l = window.__anim.log.slice(); window.__anim.log = []; return l; });
  console.log(`[${tag}] 애니=${log.join(", ") || "없음"} · 애니중 대사창 표시=${msgDuringAnim.filter(Boolean).length}/${msgDuringAnim.length}`);
  return { log, msgDuringAnim };
}

await runDemo("03_move_ember");

// ── 상단 확인바의 "다음 ▶"(]) 로 하루치를 순서대로 훑는다 ──
const tags = ["04_bg_earthquake", "05_msgbox", "06_healthup", "07_healthdown", "08_residual"];
for (const tag of tags) {
  await page.keyboard.press("BracketRight");
  await page.waitForTimeout(2000);
  const bar = await page.evaluate(() => window.__game.registry.get("debugCheck"));
  console.log(`→ 다음 항목: ${bar.date} #${bar.idx + 1}`);
  await runDemo(tag);
}

// ── 목록(\)으로 돌아가 1·2번(월드 씬 항목)도 확인 ──
await page.keyboard.press("Backslash");
await page.waitForTimeout(1500);
const back = await page.evaluate(() => ({
  menu: window.__game.scene.getScene("DebugMenuScene").scene.isActive(),
  bar: window.__game.scene.getScene("DebugCheckBarScene").scene.isActive(),
  cursor: window.__game.scene.getScene("DebugMenuScene").checkIdx,
}));
console.log("목록 복귀:", back);
await snap(page, `${OUT}/09_back_to_menu.png`);

for (const [idx, tag] of [[0, "10_camera_frame"], [1, "11_water_autotile"]]) {
  await page.evaluate((i) => {
    const sc = window.__game.scene.getScene("DebugMenuScene");
    sc.runCheck("0722", i);
  }, idx);
  await page.waitForTimeout(3000);
  await snap(page, `${OUT}/${tag}.png`);
  const w = await page.evaluate(() => {
    const sc = window.__game.scene.getScene("WorldScene");
    return { active: sc.scene.isActive(), tile: sc.tile, px: sc.player?.x, py: sc.player?.y,
      bar: window.__game.scene.getScene("DebugCheckBarScene").scene.isActive() };
  });
  console.log(`[${tag}]`, w);
  // 다음 확인을 위해 목록으로
  await page.keyboard.press("Backslash");
  await page.waitForTimeout(1200);
}

console.log("콘솔 에러:", errors.length ? errors : "0");
await browser.close();
