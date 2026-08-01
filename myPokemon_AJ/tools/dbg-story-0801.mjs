// 0801 스토리 봉합 검증 — "이상한 꿈"으로 인트로·집·연구소를 잇는 대목이 실제로 도는지.
//   A. 1층 거실에 엄마 NPC가 서 있고, 다가와 아침 대사 2줄을 한다 (캡처 + 화면 텍스트)
//   B. 대사 뒤 엄마가 제자리로 돌아가고, 말을 걸면 다시 한 줄 한다 (캡처)
//   C. 오박사 소개장 대사 앞에 "어머니께 얘기는 들었다"가 붙고 소개장이 실제로 들어온다 (데이터)
//   D. 소개장 세이브 호환 — 스타터는 있는데 소개장이 없는 옛 저장을 불러오면 채워진다 (데이터)
// 사용: node tools/dbg-story-0801.mjs   (⚠️ tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const URL = "http://localhost:5180";
// ⚠️ 리포 루트의 .claude/.verify (myPokemon_AJ 아래가 아니다). tools/에서 실행하므로 두 단계 위.
const OUT = "../../.claude/.verify";

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

const key = async (k, w = 500) => { await page.keyboard.press(k); await page.waitForTimeout(w); };
const waitScene = (k) => page.waitForFunction(
  (key) => window.__game.scene.isActive(key), k, { timeout: 12000 });
// 지금 화면에 그려진 텍스트를 그대로 긁는다(코드가 아니라 렌더 결과로 확인).
const texts = (sceneKey) => page.evaluate((k) => {
  const sc = window.__game.scene.getScene(k);
  return sc.children.list.filter((o) => o.type === "Text" && o.text)
    .map((o) => o.text.trim()).filter(Boolean);
}, sceneKey);
const momState = () => page.evaluate(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  return { room: sc.roomKey, momTile: sc.momTile, momVisible: sc.momSpr?.visible, player: [sc.tx, sc.ty], busy: sc.busy };
});

const results = {};

// ── A0. 실제 경로 — 침실 계단으로 1층에 내려오면 저절로 발동하는가 ──
//  (디버그 플래그가 아니라 doWarpTransition의 진짜 트리거를 확인한다.)
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.registry.set("playerName", "레드");
  g.registry.set("houseIntroDone", true);   // 인트로는 봤고, 아직 파트너는 없다
  g.registry.set("starterChosen", null);
  g.registry.set("playerParty", []);
  g.scene.start("InteriorScene", { room: "bedroom", skipIntro: true });
});
await waitScene("InteriorScene");
await page.waitForTimeout(1500);
// 계단(10,3)은 오른쪽 칸(11,3)에서 왼쪽으로 들어가는 자리다(인트로에서 네모가 쓰는 그 경로).
await page.evaluate(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  sc.tx = 11; sc.ty = 3; sc.facing = "left";
  sc.player.setFrame(sc.idleFrame.left);
  sc.snapPlayer();
});
await page.keyboard.down("ArrowLeft");
await page.waitForTimeout(600);
await page.keyboard.up("ArrowLeft");
// ⚠️ headless(swiftshader)는 3fps 언저리로 돈다 = 씬 타이머·트윈이 실제로 느리게 흐른다.
//    fadeOut(300)+delayedCall(320)+엄마 걸음까지 실시간으로 수십 초가 걸릴 수 있으니 넉넉히 기다린다.
await page.waitForFunction(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  return sc.roomKey === "living" && sc.boxG.visible && sc.boxText.text.length > 0;
}, null, { timeout: 90000 });
await page.waitForTimeout(1200);
results.stairsRoute = { ...(await momState()), line: (await texts("InteriorScene")).find((t) => t.includes("꿈")) ?? "(없음)" };
await snap(page, `${OUT}/0801_계단으로_내려옴.png`);

// ── A. 엄마가 다가와 아침 대사 ────────────────────────────────
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.registry.set("playerName", "레드");
  g.registry.set("houseIntroDone", true);
  g.registry.set("starterChosen", null);
  g.scene.start("InteriorScene", { room: "living", debugMomGreet: true });
});
await waitScene("InteriorScene");
await page.waitForTimeout(1200);
results.momStart = await momState();      // 걸어오기 전 = 부엌 앞 제자리(13,4)
// ⚠️ 고정 sleep이 아니라 '대사가 실제로 뜰 때까지' 기다린다(걸어오는 시간이 위치마다 다르다).
await page.waitForFunction(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  return sc.boxG.visible && sc.boxText.text.length > 0;
}, null, { timeout: 90000 });
await page.waitForTimeout(1500);          // 타자 연출이 다 찍히도록
results.momNear = await momState();       // 주인공 옆칸까지 왔나
results.line1 = await texts("InteriorScene");
await snap(page, `${OUT}/0801_엄마_아침대사1.png`);

await key("Space", 300); await key("Space", 1500);   // 타자 넘기기 1 + 다음 줄
results.line2 = await texts("InteriorScene");
await snap(page, `${OUT}/0801_엄마_아침대사2.png`);

// ── B. 대사 뒤 제자리 복귀 + 말 걸기 ──────────────────────────
await key("Space", 300); await key("Space", 600);   // 마지막 줄 닫기
// 컷신이 끝나면(busy=false) 엄마는 이미 부엌으로 돌아가 있다.
await page.waitForFunction(() => !window.__game.scene.getScene("InteriorScene").busy, null, { timeout: 90000 });
results.momBack = await momState();
await snap(page, `${OUT}/0801_엄마_복귀.png`);

// 엄마 바로 아래칸으로 순간이동시킨 뒤 위를 보고 Space = 말 걸기(이동 조작 없이 판정만 확인).
await page.evaluate(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  sc.tx = sc.momTile[0]; sc.ty = sc.momTile[1] + 1; sc.facing = "up";
  sc.player.setFrame(sc.idleFrame.up);
  sc.snapPlayer();
});
await key("Space", 900);
results.talk = await texts("InteriorScene");
await snap(page, `${OUT}/0801_엄마_말걸기.png`);

// ── C. 오박사 소개장 대사 + 실제 지급 ─────────────────────────
await page.evaluate(() => {
  const g = window.__game;
  try { localStorage.removeItem("myPokemon.save"); } catch {}
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.registry.set("bag", []);
  g.registry.set("playerParty", []);
  g.registry.set("starterChosen", null);
  g.registry.set("playerName", "레드");
  g.scene.start("LabScene", { preview: "cream", pick: 1 });   // 파이리
});
await waitScene("LabScene");
await page.waitForTimeout(2800);

// dbg-story-0728.mjs에서 검증된 지급 시퀀스 그대로.
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
} catch { console.log("(별명 입력창 안 뜸)"); }

// ⚠️ 대사 1줄당 Space 2번(타자 건너뛰기 + 넘김). 지나가는 줄을 전부 모아 '꿈' 대사를 확인한다.
//    ⚠️ 소개장은 대사를 말하기 **전에** 가방에 들어간다(addItem 먼저) → 아이템만 보고 멈추면
//       정작 새로 넣은 대사가 한 줄도 안 지나간 채 끝난다(첫 실행에서 실제로 그랬다). 끝까지 훑는다.
const seen = new Set();
let letterAt = -1;
for (let i = 0; i < 40; i++) {
  await key("Space", 320);
  (await texts("LabScene")).forEach((t) => seen.add(t));
  if (letterAt < 0) {
    const got = await page.evaluate(() =>
      (window.__game.registry.get("bag") || []).some((e) => e.itemId === "OAKSINTRODUCTION"));
    if (got) letterAt = i + 1;
  }
}
console.log(`  (소개장 지급 — Space ${letterAt}번째)`);
results.labLines = [...seen].filter((t) => t.includes("어머니") || t.includes("꿈") || t.includes("소개장") || t.includes("준비"));
results.letter = await page.evaluate(() => {
  const g = window.__game;
  const bag = g.registry.get("bag") || [];
  return { bag, starterChosen: g.registry.get("starterChosen"), hasLetter: bag.some((e) => e.itemId === "OAKSINTRODUCTION") };
});
await snap(page, `${OUT}/0801_오박사_꿈대사.png`);

// ── D. 소개장 세이브 호환(옛 저장 보정) ───────────────────────
results.migration = await page.evaluate(async () => {
  const g = window.__game;
  // 소개장 기능이 생기기 전의 저장을 흉내낸다: 스타터는 있는데 가방에 소개장이 없다.
  const old = {
    version: 4, name: "레드", gender: "boy",
    party: [], starterChosen: "CHARMANDER", rivalBattlePending: false, rivalEnemySpecies: null,
    houseIntroDone: true, houseLayout: { furniture: [] },
    difficulty: "normal", money: 3000,
    bag: [{ itemId: "POKEBALL", count: 5 }],
    dexSeen: [], dexOwn: [], badges: [], trainersDefeated: [],
    loc: { scene: "WorldScene", map: "pallet" }, savedAt: Date.now(),
  };
  localStorage.setItem("myPokemon.save", JSON.stringify(old));
  g.registry.set("bag", []);
  const { loadGame } = await import("/src/systems/save.ts");
  loadGame(g.registry);
  const bag = g.registry.get("bag") || [];
  return { bag, hasLetter: bag.some((e) => e.itemId === "OAKSINTRODUCTION") };
});

console.log("\n=== A0. 계단으로 내려왔을 때(실제 경로) ===");
console.log(" ", JSON.stringify(results.stairsRoute));
console.log("\n=== A. 엄마 아침 대사 ===");
console.log("  시작 위치:", JSON.stringify(results.momStart));
console.log("  다가온 뒤:", JSON.stringify(results.momNear));
console.log("  1줄:", results.line1.join(" | "));
console.log("  2줄:", results.line2.join(" | "));
console.log("\n=== B. 복귀 + 말 걸기 ===");
console.log("  복귀 상태:", JSON.stringify(results.momBack));
console.log("  말 걸기:", results.talk.join(" | "));
console.log("\n=== C. 오박사 꿈 대사 + 소개장 ===");
console.log("  관련 대사:", results.labLines.join(" | "));
console.log("  starterChosen:", results.letter.starterChosen, "/ 소개장:", results.letter.hasLetter);
console.log("\n=== D. 옛 저장 소개장 보정 ===");
console.log("  가방:", JSON.stringify(results.migration.bag), "/ 소개장:", results.migration.hasLetter);
console.log("\n콘솔 에러:", errors.length, errors.slice(0, 5));

await browser.close();
