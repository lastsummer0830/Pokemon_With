// 자동/수동 저장 실동작 검증 + 화면 캡처.
//  (A) LabScene 스타터 지급 흐름을 끝까지 태운 뒤 localStorage 세이브에 스타터가 실제 들어갔는지 확인
//      + 자동저장 "저장 중…" 배너를 그 순간 캡처.
//  (B) MenuScene "저장" 선택 → "○○은 게임을 저장했다!" 토스트 캡처.
//  사용: node tools/dbg-save-verify.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const URL = "http://localhost:5180";
const OUT = "/mnt/d/dev/Pokemon_With/.claude/.verify";
const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

// 깨끗한 재현: 이전 세이브 제거 후 LabScene 진입(파이리 pick:1).
await page.evaluate(() => {
  try { localStorage.removeItem("myPokemon.save"); } catch {}
  const g = window.__game;
  g.registry.set("playerName", "레드");
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("LabScene", { preview: "cream", pick: 1 });
});
await page.waitForTimeout(2800);

const key = async (k, w = 700) => { await page.keyboard.press(k); await page.waitForTimeout(w); };
const hasSave = () => page.evaluate(() => !!localStorage.getItem("myPokemon.save"));

// dbg-starter.mjs와 동일한 지급 완주 시퀀스(별명 "불꽃이"까지).
await key("Space", 300); await key("Space", 700);
await key("Space", 300); await key("Space", 700);
await key("Space", 300);
await key("Space", 600);
await key("Space", 700);
await key("Space", 300);
await key("Space", 600);
await key("Space", 700);
try {
  await page.waitForSelector("input", { timeout: 3000 });
  await page.fill("input", "불꽃이");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
} catch { console.log("(별명 입력창 안 뜸 — 별명 없이 진행됐을 수 있음)"); }

// 배웅 대사(298~307) 넘기며 세이브가 생기는 순간을 감시한다.
//  autoSaveWithToast는 walkNemonaOut 이후에 실행되므로, 세이브가 처음 나타나면 그게 배너가 뜬 순간.
let bannerSnapped = false;
for (let i = 0; i < 20 && !bannerSnapped; i++) {
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  if (await hasSave()) {
    // 세이브가 방금 생김 = 배너가 방금 떴다(페이드는 1.2초 뒤 시작) → 즉시 캡처.
    await snap(page, `${OUT}/save_auto_indicator.png`);
    bannerSnapped = true;
    console.log(`[배너] 세이브 감지 → 캡처(반복 ${i}회째)`);
  }
}
if (!bannerSnapped) {
  // walkNemonaOut가 아직 안 끝났을 수 있으니 여유를 더 준 뒤 마지막 시도.
  for (let i = 0; i < 12 && !bannerSnapped; i++) {
    await page.waitForTimeout(400);
    if (await hasSave()) { await snap(page, `${OUT}/save_auto_indicator.png`); bannerSnapped = true; console.log("[배너] 지연 감지 → 캡처"); }
  }
}
if (!bannerSnapped) console.log("[배너] ⚠️ 세이브가 생기지 않음 — 배너 캡처 못 함");

// ── 자동저장 결과를 데이터로 수집 ──
const result = await page.evaluate(() => {
  const g = window.__game;
  const party = g.registry.get("playerParty") ?? [];
  let saveParsed = null, saveExists = false;
  try {
    const raw = localStorage.getItem("myPokemon.save");
    saveExists = !!raw;
    if (raw) {
      const d = JSON.parse(raw);
      saveParsed = {
        version: d.version,
        partySpecies: (d.party ?? []).map((p) => p.speciesId),
        starterChosen: d.starterChosen,
        dexOwn: d.dexOwn, dexSeen: d.dexSeen,
        loc: d.loc,
      };
    }
  } catch (e) { saveParsed = "PARSE_ERR: " + String(e); }
  return {
    regParty: party.map((p) => ({ speciesId: p.speciesId, nickname: p.nickname, level: p.level })),
    starterChosen: g.registry.get("starterChosen"),
    rivalBattlePending: g.registry.get("rivalBattlePending"),
    saveExists, saveParsed,
  };
});

console.log("\n================ (A) 자동저장 검증 ================");
console.log("[registry] rivalBattlePending:", result.rivalBattlePending, "(true면 autoSave 지점 도달)");
console.log("[registry] starterChosen:", result.starterChosen, "/ party:", JSON.stringify(result.regParty));
console.log("[세이브] 존재:", result.saveExists);
console.log("[세이브] 내용:", JSON.stringify(result.saveParsed, null, 2));

// ── (B) 수동저장 토스트 캡처 ──
console.log("\n================ (B) 수동저장 캡처 ================");
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("MenuScene", { from: "WorldScene" });
});
await page.waitForTimeout(1500);
// 하단 바(main)는 좌우 이동만 유효. 기본선택=포켓몬(idx1) → ArrowRight 2번 = 저장(idx3). 그 다음 Space로 저장.
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
await page.keyboard.press("Space");
await page.waitForTimeout(250);   // 토스트가 뜬 직후(페이드는 900ms 뒤 시작)
await snap(page, `${OUT}/save_manual_toast.png`);
const manualSaveOk = await page.evaluate(() => !!localStorage.getItem("myPokemon.save"));
console.log("[수동저장] Space 후 세이브 존재:", manualSaveOk, "→ 토스트 캡처 완료");

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
await browser.close();
