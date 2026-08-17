// 0802 옵션 검증 — 값이 저장만 되는 게 아니라 **실제로 게임에 반영되는지**까지 본다.
//  사용: node tools/dbg-options-0802.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0802_옵션_*.png
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
const shot = async (f) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, f) });
};

// ══ 1. 저장·복원 ═══════════════════════════════════════════════════════════
console.log("\n[1] 설정이 저장되고 다시 읽히는가");
const store = await page.evaluate(async () => {
  const m = await import("/src/systems/settings.ts");
  localStorage.removeItem("myPokemon.settings");
  const before = { ...m.settings() };
  m.setSetting("musicVolume", 3);
  m.setSetting("textSpeed", "fast");
  m.setSetting("battleEffects", false);
  const raw = JSON.parse(localStorage.getItem("myPokemon.settings"));
  return { before, raw, now: { ...m.settings() } };
});
ok(store.before.musicVolume === 7 && store.before.textSpeed === "mid", "기본값이 원본 감각대로 잡혀 있다(음악 7/텍스트 보통)");
ok(store.raw.musicVolume === 3 && store.raw.textSpeed === "fast" && store.raw.battleEffects === false,
   "바꾼 값이 localStorage에 그대로 저장된다");

// ══ 2. 실제 반영 — 파생값 ══════════════════════════════════════════════════
console.log("\n[2] 값이 게임 동작에 실제로 쓰이는가");
const derived = await page.evaluate(async () => {
  const m = await import("/src/systems/settings.ts");
  const out = {};
  m.setSetting("textSpeed", "slow"); out.slow = m.textDelayMs();
  m.setSetting("textSpeed", "mid");  out.mid = m.textDelayMs();
  m.setSetting("textSpeed", "fast"); out.fast = m.textDelayMs();
  m.setSetting("musicVolume", 10); out.music10 = m.musicFactor();
  m.setSetting("musicVolume", 0);  out.music0 = m.musicFactor();
  m.setSetting("seVolume", 5);     out.se5 = m.seFactor();
  m.setSetting("moveStyle", "walk"); out.walk = m.stepDurationMs(false);
  m.setSetting("moveStyle", "run");  out.run = m.stepDurationMs(true);
  return out;
});
ok(derived.slow > derived.mid && derived.mid > derived.fast,
   `텍스트 속도가 실제 글자 간격으로 바뀐다 (느림 ${derived.slow}ms / 보통 ${derived.mid}ms / 빠름 ${derived.fast}ms)`);
ok(derived.music10 === 1 && derived.music0 === 0 && derived.se5 === 0.5, "볼륨 눈금이 0~1 배율로 변환된다");
ok(derived.run < derived.walk, `달리기가 실제로 더 빠르다 (걷기 ${derived.walk}ms → 달리기 ${derived.run}ms)`);

// ══ 3. 볼륨 0이면 소리를 아예 안 낸다 ══════════════════════════════════════
console.log("\n[3] 효과음 볼륨이 실제 재생에 걸리는가");
const sfxTest = await page.evaluate(async () => {
  const m = await import("/src/systems/settings.ts");
  const s = await import("/src/game/sfx.ts");
  const g = window.__game;
  g.scene.getScenes(true).forEach((x) => g.scene.stop(x.scene.key));
  g.scene.start("MainMenuScene");
  await new Promise((r) => setTimeout(r, 800));
  const sc = g.scene.getScene("MainMenuScene");
  const played = [];
  const orig = sc.sound.play.bind(sc.sound);
  sc.sound.play = (k, o) => { played.push({ k, v: o?.volume }); return orig(k, o); };
  m.setSetting("seVolume", 10); s.playSfx(sc, "sfx_cursor", 0.4);
  m.setSetting("seVolume", 5);  s.playSfx(sc, "sfx_cursor", 0.4);
  m.setSetting("seVolume", 0);  s.playSfx(sc, "sfx_cursor", 0.4);
  sc.sound.play = orig;
  return played;
});
ok(sfxTest.length === 2, `볼륨 0이면 재생 자체를 건너뛴다(3번 요청 중 ${sfxTest.length}번만 실제 재생)`);
ok(Math.abs(sfxTest[0].v - 0.4) < 1e-6 && Math.abs(sfxTest[1].v - 0.2) < 1e-6,
   `볼륨 눈금이 실제 재생 볼륨에 곱해진다 (${sfxTest.map((x) => x.v).join(" / ")})`);

// ══ 4. 화면 ════════════════════════════════════════════════════════════════
console.log("\n[4] 옵션 화면");
await page.evaluate(async () => {
  const m = await import("/src/systems/settings.ts");
  localStorage.removeItem("myPokemon.settings");
  for (const k of Object.keys(m.DEFAULTS)) m.setSetting(k, m.DEFAULTS[k]);
  const g = window.__game;
  g.scene.getScenes(true).forEach((x) => g.scene.stop(x.scene.key));
  g.scene.start("OptionsScene");
});
await page.waitForFunction(() => {
  const s = window.__game.scene.getScene("OptionsScene");
  return s?.scene.isActive() && s.rows?.length === 6;
}, { timeout: 60000 });
const ui = await page.evaluate(() => {
  const s = window.__game.scene.getScene("OptionsScene");
  return { names: s.rows.map((r) => r.name.text), vals: s.rows.map((r) => r.val.text), desc: s.desc.text };
});
ok(ui.names.length === 6, `항목 6개 (${ui.names.join(" / ")})`);
ok(ui.vals[0].includes("70%"), `볼륨이 눈금 막대로 보인다 → "${ui.vals[0]}"`);
ok(ui.vals[2] === "보통" && ui.vals[3] === "켬" && ui.vals[4] === "교체" && ui.vals[5] === "걷기",
   `나머지 값 표시 정상 (${ui.vals.slice(2).join(" / ")})`);
await shot("0802_옵션_1_기본.png");

// 좌우로 값 바꾸기 + R로 되돌리기
// ⚠️ 키를 쉬지 않고 연달아 보내면 이벤트가 씹힌다(headless에서 실제로 겪음) → 사이를 띄운다.
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
await key("ArrowDown"); await key("ArrowDown");
await key("ArrowRight"); await key("ArrowRight");
const after = await page.evaluate(() => {
  const s = window.__game.scene.getScene("OptionsScene");
  return { val: s.rows[2].val.text, stored: JSON.parse(localStorage.getItem("myPokemon.settings")).textSpeed };
});
ok(after.val !== "보통" && after.stored !== "mid", `←→로 값이 바뀌고 바로 저장된다 (텍스트 속도 → ${after.val})`);
await shot("0802_옵션_2_변경.png");
await key("R");
const reset = await page.evaluate(() => window.__game.scene.getScene("OptionsScene").rows.map((r) => r.val.text));
ok(reset[2] === "보통", "R로 기본값 복구");

// 뒷정리
await page.evaluate(() => localStorage.removeItem("myPokemon.settings"));
console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
if (errors.length) fail++;
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
await browser.close();
process.exit(fail ? 1 : 0);
