// 0802 세이브 슬롯 검증 — 원본(Auto Multi Save)처럼 자동 3 + 수동 8칸이 실제로 도는지.
//  사용: node tools/dbg-saveslot-0802.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0802_세이브_*.png
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto((process.env.DEV_URL ?? "http://localhost:5180"), { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
const save = () => page.evaluate(() => import("/src/systems/save.ts"));
const shot = async (f) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, f) });
};

// ══ 1. 옛 1칸 저장이 '세이브 A'로 옮겨지는가 ═══════════════════════════════
console.log("\n[1] 슬롯이 없던 시절의 저장 이관");
const mig = await page.evaluate(async () => {
  const m = await import("/src/systems/save.ts");
  localStorage.clear();
  // 슬롯이 없던 시절의 저장을 손으로 심는다(옛 형식 그대로)
  localStorage.setItem("myPokemon.save", JSON.stringify({
    version: 4, name: "옛저장", gender: "boy", party: [], starterChosen: "CHARMANDER",
    badges: ["GREEN"], loc: { scene: "WorldScene", map: "pallet", tx: 17, ty: 8 }, savedAt: 1,
  }));
  const slots = m.listSlots();
  return {
    legacyGone: localStorage.getItem("myPokemon.save") === null,
    a: slots.find((s) => s.id === "A")?.data?.name ?? null,
    filled: slots.filter((s) => s.data).map((s) => s.id),
    last: m.lastSlot(),
  };
});
ok(mig.a === "옛저장", `옛 저장이 '세이브 A'로 옮겨졌다 (이름 "${mig.a}")`);
ok(mig.legacyGone, "옛 키(myPokemon.save)는 지워졌다");
ok(mig.filled.length === 1 && mig.filled[0] === "A", "다른 칸은 건드리지 않았다");
ok(mig.last === "A", "마지막 슬롯이 A로 잡힌다(다음 저장의 기본 칸)");

// ══ 2. 슬롯별 저장·불러오기 ═══════════════════════════════════════════════
console.log("\n[2] 슬롯마다 따로 저장되고 따로 불러와지는가");
const rw = await page.evaluate(async () => {
  const m = await import("/src/systems/save.ts");
  const reg = window.__game.registry;
  const put = (name, slot) => {
    reg.set("playerName", name);
    reg.set("saveLoc", { scene: "WorldScene", map: "pallet", tx: 17, ty: 8, facing: "down" });
    m.saveGame(reg, slot);
  };
  put("첫번째", "B");
  put("두번째", "C");
  const names = m.listSlots().filter((s) => s.data).map((s) => `${s.id}:${s.data.name}`);
  reg.set("playerName", "지워짐");
  const b = m.loadGame(reg, "B");
  const afterB = reg.get("playerName");
  const c = m.loadGame(reg, "C");
  const afterC = reg.get("playerName");
  return { names, afterB, afterC, missing: m.loadGame(reg, "H"), last: m.lastSlot() };
});
ok(JSON.stringify(rw.names) === JSON.stringify(["A:옛저장", "B:첫번째", "C:두번째"]),
   `세 칸이 각각 따로 남는다 → ${rw.names.join(" / ")}`);
ok(rw.afterB === "첫번째" && rw.afterC === "두번째", "칸마다 다른 내용이 불러와진다");
ok(rw.missing === null, "빈 칸을 불러오면 null(빈 칸은 못 연다)");
ok(rw.last === "C", "마지막으로 연 칸(C)이 기억된다");

// ══ 3. 자동세이브는 3칸을 돌아가며, 수동 저장을 안 덮는다 ══════════════════
console.log("\n[3] 자동세이브 3칸 순환");
const auto = await page.evaluate(async () => {
  const m = await import("/src/systems/save.ts");
  const reg = window.__game.registry;
  const used = [];
  for (let i = 0; i < 4; i++) {
    reg.set("playerName", `자동${i}`);
    m.autoSave(reg, { scene: "WorldScene", map: "pallet", tx: 17, ty: 8 });
    // 방금 어느 자동칸에 들어갔는지 = 가장 최근 savedAt
    const autos = m.listSlots().filter((s) => s.auto && s.data);
    used.push(autos.sort((x, y) => y.data.savedAt - x.data.savedAt)[0].id);
    await new Promise((r) => setTimeout(r, 5));   // savedAt이 같아지지 않게
  }
  const slots = m.listSlots();
  return {
    used,
    autoNames: slots.filter((s) => s.auto).map((s) => s.data?.name ?? null),
    manualIntact: slots.filter((s) => !s.auto && s.data).map((s) => `${s.id}:${s.data.name}`),
    last: m.lastSlot(),
  };
});
ok(new Set(auto.used.slice(0, 3)).size === 3, `자동저장 3번이 서로 다른 칸에 들어간다 (${auto.used.slice(0, 3).join(" → ")})`);
ok(auto.used[3] === auto.used[0], `4번째는 가장 오래된 칸을 덮는다 (${auto.used[3]})`);
ok(JSON.stringify(auto.manualIntact) === JSON.stringify(["A:옛저장", "B:첫번째", "C:두번째"]),
   "자동저장이 수동 칸을 건드리지 않는다");
ok(auto.last === "C", "자동저장은 '마지막 수동 칸' 표시를 바꾸지 않는다(다음 수동 저장이 엉뚱한 데 가지 않게)");

// ══ 4. 플레이 시간이 쌓이는가 ═════════════════════════════════════════════
console.log("\n[4] 플레이 시간(원본 로드화면의 Time)");
const t = await page.evaluate(async () => {
  const m = await import("/src/systems/save.ts");
  const reg = window.__game.registry;
  m.startPlayClock(reg, 3600 + 120);          // 이미 1시간 2분 놀았던 세이브를 이어받았다고 치고
  reg.set("playerName", "시간");
  m.saveGame(reg, "D");
  const d = m.listSlots().find((s) => s.id === "D").data;
  return { sec: d.playSeconds, text: m.playTimeText(d.playSeconds) };
});
ok(t.sec >= 3720, `이어받은 시간부터 계속 쌓인다 (${t.sec}초)`);
ok(t.text === "1시간 2분", `표시가 원본처럼 시/분이다 → "${t.text}"`);

// ══ 5. 화면 — 불러오기 목록 ═══════════════════════════════════════════════
console.log("\n[5] 이어하기 화면");
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("SaveSlotScene", { mode: "load" });
});
await page.waitForFunction(() => {
  const s = window.__game.scene.getScene("SaveSlotScene");
  return s?.scene.isActive() && s.rows?.length === 11;
}, { timeout: 60000 });
const ui = await page.evaluate(() => {
  const s = window.__game.scene.getScene("SaveSlotScene");
  return {
    rows: s.rows.length,
    titles: s.rows.map((r) => r.title.text),
    subs: s.rows.map((r) => r.sub.text),
    cursor: s.idx,
  };
});
ok(ui.rows === 11, "칸이 11개다(자동 3 + 수동 8 — 원본과 같은 구성)");
ok(ui.titles.slice(0, 3).every((t) => t.includes("자동세이브")), "위 3칸이 자동세이브다");
ok(ui.titles[3].includes("세이브 A"), "그 아래가 세이브 A~H다");
ok(ui.subs[3].includes("옛저장") && ui.subs[3].includes("배지"), `내용 있는 칸엔 이름·배지·시간이 적힌다 → "${ui.subs[3]}"`);
ok(ui.subs.some((x) => x === "비어 있음"), "빈 칸은 '비어 있음'으로 나온다");
await shot("0802_세이브_1_이어하기.png");

// ══ 6. 화면 — 인게임 저장 목록(빈 칸도 고를 수 있어야 한다) ═══════════════
console.log("\n[6] 인게임 저장 화면");
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("SaveSlotScene", { mode: "save", from: "WorldScene" });
});
await page.waitForFunction(() => window.__game.scene.getScene("SaveSlotScene")?.scene.isActive(), { timeout: 60000 });
const ui2 = await page.evaluate(() => {
  const s = window.__game.scene.getScene("SaveSlotScene");
  return { subs: s.rows.map((r) => r.sub.text), hint: s.hint.text };
});
ok(ui2.subs.some((x) => x.includes("여기에 저장")), "저장 모드에선 빈 칸이 '여기에 저장'으로 바뀐다");
ok(ui2.hint.includes("에 저장"), `안내문이 저장용으로 바뀐다 → "${ui2.hint}"`);
await shot("0802_세이브_2_저장.png");

// 뒷정리 — 검증이 심은 저장을 지운다(실제 플레이에 남으면 안 된다)
await page.evaluate(() => localStorage.clear());

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
if (errors.length) fail++;
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
await browser.close();
process.exit(fail ? 1 : 0);
