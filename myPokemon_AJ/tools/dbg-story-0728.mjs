// 0728 스토리 라인 작업 검증 — 실제로 도는지 눈으로 볼 캡처 + 데이터 확인.
//   A. 가방에 '소중한 물건' 포켓이 생기고 그 안에 '오박사의 소개장'이 보이는가 (캡처)
//   B. 파트너를 받고 내 방에 돌아오면 유대 힌트 나레이션이 뜨는가 (캡처)
//   C. 스타터를 실제로 받으면 소개장이 가방에 들어가는가 (데이터)
// 사용: node tools/dbg-story-0728.mjs   (⚠️ tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";
import { snap } from "./_snap.mjs";

const URL = "http://localhost:5180";
// ⚠️ 리포 루트의 .claude/.verify (myPokemon_AJ 아래가 아니다 — Stop 훅이 루트만 본다).
//    이 스크립트는 tools/ 안에서 실행하므로 두 단계 올라가야 리포 루트다.
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
// 씬이 실제로 active 가 된 뒤에 키를 넣는다(고정 sleep으로 하면 키가 허공에 먹힌다).
const waitScene = (k) => page.waitForFunction(
  (key) => window.__game.scene.isActive(key), k, { timeout: 12000 });

const results = {};

// ── A. 가방 '소중한 물건' 포켓 ────────────────────────────────
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  // 디버그 확인 항목과 같은 경로로 가방을 연다(프라이밍 포함 = 소개장이 들어있다).
  g.registry.set("playerName", "레드");
  g.registry.set("bag", [
    { itemId: "POTION", count: 5 }, { itemId: "POKEBALL", count: 5 },
    { itemId: "OAKSINTRODUCTION", count: 1 },
  ]);
  g.scene.start("BagScene", { testParty: true });
});
await waitScene("BagScene");
await page.waitForTimeout(1200);

// 탭 순서 = POCKETS [2회복약, 3볼, 1일반, 8소중한물건] → 오른쪽 3번이면 소중한 물건.
await key("ArrowRight", 450); await key("ArrowRight", 450); await key("ArrowRight", 700);

results.bag = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("BagScene");
  // 화면에 실제로 그려진 텍스트를 그대로 긁는다(코드가 아니라 렌더 결과로 확인).
  const texts = sc.children.list
    .filter((o) => o.type === "Text" && o.text)
    .map((o) => o.text.trim()).filter(Boolean);
  return { pocket: sc.pocket, texts };
});
await snap(page, `${OUT}/0728_가방_소중한물건.png`);

// ── B. 집에 돌아왔을 때 유대 힌트 ─────────────────────────────
await page.evaluate(() => {
  const g = window.__game;
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("InteriorScene", { room: "bedroom", debugBondHint: true });
});
await waitScene("InteriorScene");
await page.waitForTimeout(2600);   // fadeIn(450) + 힌트 대기(400) + 타자연출

results.homeHintLine1 = await page.evaluate(() => {
  const sc = window.__game.scene.getScene("InteriorScene");
  const texts = sc.children.list
    .filter((o) => o.type === "Text" && o.text)
    .map((o) => o.text.trim()).filter(Boolean);
  return texts;
});
await snap(page, `${OUT}/0728_집_유대힌트.png`);

// ── C. 스타터를 실제로 받으면 소개장이 가방에 들어가는가 ──────────
await page.evaluate(() => {
  const g = window.__game;
  try { localStorage.removeItem("myPokemon.save"); } catch {}
  g.registry.set("bag", []);          // 빈 가방에서 시작 → 소개장이 생기면 순수하게 지급 흐름 때문
  g.registry.set("playerParty", []);
  g.registry.set("starterChosen", null);
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.registry.set("playerName", "레드");
  g.scene.start("LabScene", { preview: "cream", pick: 1 });   // 파이리 — dbg-starter.mjs와 같은 진입
});
await waitScene("LabScene");
await page.waitForTimeout(2800);

// dbg-starter.mjs에서 검증된 지급 시퀀스 그대로(별명은 입력창까지 간다).
await key("Space", 300); await key("Space", 700);   // dex 소개
await key("Space", 300); await key("Space", 700);   // dex 설명
await key("Space", 300);                            // 오박사 확인 대사
await key("Space", 600);                            // → 예/아니오
await key("Space", 700);                            // 예 → 별명 질문
await key("Space", 300);
await key("Space", 600);                            // 별명 예/아니오
await key("Space", 700);                            // 예 → HTML 입력창
try {
  await page.waitForSelector("input", { timeout: 3000 });
  await page.fill("input", "불꽃이");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
} catch { console.log("(별명 입력창 안 뜸)"); }
// 여기부터가 이번에 새로 붙인 대목: 유대 조언 3줄 + 소개장 4줄.
//  ⚠️ 타자 연출 때문에 대사 1줄당 Space가 2번 필요하다(1번은 '타자 건너뛰기'로 먹힌다).
//     소개장이 들어온 걸 확인하면 즉시 멈춘다.
for (let i = 0; i < 40; i++) {
  await key("Space", 320);
  const got = await page.evaluate(() =>
    (window.__game.registry.get("bag") || []).some((e) => e.itemId === "OAKSINTRODUCTION"));
  if (got) { console.log(`  (소개장 확인 — Space ${i + 1}번째)`); break; }
}

results.letter = await page.evaluate(() => {
  const g = window.__game;
  const bag = g.registry.get("bag") || [];
  return {
    bag,
    starterChosen: g.registry.get("starterChosen"),
    hasLetter: bag.some((e) => e.itemId === "OAKSINTRODUCTION"),
  };
});
await snap(page, `${OUT}/0728_랩_소개장지급.png`);

console.log("\n=== A. 가방 소중한 물건 포켓 ===");
console.log("  현재 포켓 번호:", results.bag.pocket, "(8이어야 함)");
console.log("  화면 텍스트:", results.bag.texts.join(" | "));
console.log("\n=== B. 집 유대 힌트 ===");
console.log("  화면 텍스트:", results.homeHintLine1.join(" | "));
console.log("\n=== C. 소개장 지급 ===");
console.log("  starterChosen:", results.letter.starterChosen);
console.log("  소개장 보유:", results.letter.hasLetter);
console.log("  가방:", JSON.stringify(results.letter.bag));
console.log("\n콘솔 에러:", errors.length, errors.slice(0, 5));

await browser.close();
