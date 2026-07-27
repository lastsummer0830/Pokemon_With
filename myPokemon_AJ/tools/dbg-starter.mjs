// 스타팅 지급 흐름이 파티+도감+세이브에 실제 반영되는지 데이터로 검증(캡처 아님).
//  shot-lab-flow.mjs와 같은 실제 지급 경로(별명 입력까지)를 태운 뒤,
//   ① registry(playerParty·dexSeen·dexOwn·starterChosen) 실제 값
//   ② 파티 객체가 JSON 직렬화 가능한지(saveGame의 JSON.stringify가 깨지지 않는지)
//   ③ 지급 '직후' localStorage 세이브에 스타터가 들어있는지(끊긴 지점 실증)
//  사용: node tools/dbg-starter.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";

const URL = "http://localhost:5180";
const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

// 깨끗한 재현: 이전 세이브 제거 후 시작(지급 후 세이브에 스타터가 생기면 그건 순수하게 지급 흐름 때문).
await page.evaluate(() => {
  try { localStorage.removeItem("myPokemon.save"); } catch {}
  const g = window.__game;
  g.registry.set("playerName", "레드");
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("LabScene", { preview: "cream", pick: 1 }); // 파이리(CHARMANDER)
});
await page.waitForTimeout(2800);

const key = async (k, w = 700) => { await page.keyboard.press(k); await page.waitForTimeout(w); };

// shot-lab-flow.mjs와 동일한 키 시퀀스로 지급을 완주한다(별명 "불꽃이"까지).
await key("Space", 300); await key("Space", 700);   // dex 소개
await key("Space", 300); await key("Space", 700);   // dex 설명
await key("Space", 300);                             // 오박사 확인 대사
await key("Space", 600);                             // → 예/아니오
await key("Space", 700);                             // 예 → 별명 질문
await key("Space", 300);
await key("Space", 600);                             // 별명 예/아니오
await key("Space", 700);                             // 예 → HTML 입력창
try {
  await page.waitForSelector("input", { timeout: 3000 });
  await page.fill("input", "불꽃이");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
} catch { console.log("(별명 입력창 안 뜸 — 별명 없이 진행됐을 수 있음)"); }
// 배웅 대사 몇 개 더 넘겨 흐름 끝까지(지급 자체는 별명 확정 직후 이미 일어남)
for (let i = 0; i < 6; i++) await key("Space", 350);

// ── 지급 결과를 데이터로 수집 ──
const result = await page.evaluate(() => {
  const g = window.__game;
  const party = g.registry.get("playerParty") ?? [];
  const partySummary = party.map((p) => ({
    speciesId: p.speciesId, nickname: p.nickname, level: p.level,
    hp: p.hp, maxHp: p.maxHp ?? p.stats?.hp,
    moves: Array.isArray(p.moves) ? p.moves.length : (p.moves ? "?" : 0),
    caughtBall: p.caughtBall,
  }));
  // JSON 직렬화 가능한지(순환참조 등으로 saveGame이 깨지지 않는지)
  let serializable = true, serErr = null, roundtripLen = null;
  try {
    const s = JSON.stringify(party);
    roundtripLen = (JSON.parse(s) ?? []).length;
  } catch (e) { serializable = false; serErr = String(e); }
  // 지급 '직후' 세이브 상태(저장 트리거가 흐름에 있으면 여기 스타터가 있어야 함)
  let saveRaw = null, saveParsed = null;
  try {
    saveRaw = localStorage.getItem("myPokemon.save");
    if (saveRaw) {
      const d = JSON.parse(saveRaw);
      saveParsed = {
        version: d.version,
        partyLen: (d.party ?? []).length,
        partySpecies: (d.party ?? []).map((p) => p.speciesId),
        starterChosen: d.starterChosen,
        dexOwn: d.dexOwn, dexSeen: d.dexSeen,
      };
    }
  } catch (e) { saveRaw = "PARSE_ERR: " + String(e); }
  return {
    party: partySummary,
    starterChosen: g.registry.get("starterChosen"),
    dexSeen: g.registry.get("dexSeen"),
    dexOwn: g.registry.get("dexOwn"),
    rivalBattlePending: g.registry.get("rivalBattlePending"),
    rivalEnemySpecies: g.registry.get("rivalEnemySpecies"),
    serializable, serErr, roundtripLen,
    saveExists: !!saveRaw && !String(saveRaw).startsWith("PARSE_ERR"),
    saveParsed,
  };
});

console.log("\n================ 스타터 지급 결과 ================");
console.log("[registry] playerParty:", JSON.stringify(result.party, null, 2));
console.log("[registry] starterChosen:", result.starterChosen);
console.log("[registry] dexSeen:", JSON.stringify(result.dexSeen));
console.log("[registry] dexOwn :", JSON.stringify(result.dexOwn));
console.log("[registry] rivalBattlePending:", result.rivalBattlePending, "/ rivalEnemySpecies:", result.rivalEnemySpecies);
console.log("\n[직렬화] JSON 가능:", result.serializable, "/ roundtrip party 길이:", result.roundtripLen, result.serErr ? "/ 오류:" + result.serErr : "");
console.log("\n[세이브] 지급 직후 localStorage에 세이브 존재:", result.saveExists);
if (result.saveParsed) console.log("[세이브] 내용:", JSON.stringify(result.saveParsed, null, 2));
else console.log("[세이브] → 스타터가 세이브에 없음(지급 흐름에 저장 트리거가 없다는 실증)");

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
await browser.close();
