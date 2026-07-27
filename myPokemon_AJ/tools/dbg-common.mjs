// 0727 Common 애니(능력·상태이상·혼란·아이템) 데모가 실제로 도는지 확인(캡처 없이 숫자로).
//  각 demoCommon 설정으로 BattleScene 데모를 띄우고 → playCommonAnim 호출 이름을 기록 +
//  그 동안 셀 스프라이트(anim_*)가 실제로 화면에 떴는지 샘플링한다.
//  사용: node tools/dbg-common.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
import { chromium } from "playwright";

const CASES = [
  { title: "능력 StatUp/StatDown", demoCommon: "StatUp|StatDown", byAlly: true },
  { title: "상태이상 6종",         demoCommon: "Poison|Toxic|Burn|Paralysis|Sleep|Frozen", byAlly: false },
  { title: "혼란 Confusion",       demoCommon: "Confusion", byAlly: false },
  { title: "아이템 UseItem",       demoCommon: "UseItem", byAlly: true },
];

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 15000 });

for (const c of CASES) {
  // 레지스트리 채우고(이름·파티) 데모로 BattleScene 시작
  await page.evaluate((cc) => {
    const g = window.__game;
    g.registry.set("playerName", "레드");
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("BattleScene", { wild: true, testParty: true, backdrop: "route",
      demo: "common", demoCommon: cc.demoCommon, demoByAlly: cc.byAlly });
  }, c);
  await page.waitForTimeout(1500);

  // playCommonAnim을 감싸 호출 이름 기록.
  //  ⚠️ Phaser는 씬 인스턴스를 재사용한다 → 케이스마다 다시 감싸면 래퍼가 겹쳐 이름이 중복 기록된다.
  //     원본을 한 번만 보관해 두고 매번 그 원본 위에 새 래퍼를 얹는다(중복 방지).
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene("BattleScene");
    if (!sc.__origCommonAnim) sc.__origCommonAnim = sc.playCommonAnim.bind(sc);
    window.__calls = [];
    window.__maxCells = 0;
    sc.playCommonAnim = async (name, onAlly) => {
      window.__calls.push(name);
      return await sc.__origCommonAnim(name, onAlly);
    };
  });

  // 스페이스로 대사 넘기며 셀 스프라이트 수를 샘플링(한 바퀴 다 돌게)
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Space");
    await page.evaluate(() => {
      const sc = window.__game.scene.getScene("BattleScene");
      const n = sc.children.list.filter((o) => o.texture && String(o.texture.key).startsWith("anim_")).length;
      if (n > window.__maxCells) window.__maxCells = n;
    });
    await page.waitForTimeout(120);
  }

  const out = await page.evaluate(() => ({ calls: window.__calls, maxCells: window.__maxCells }));
  console.log(`\n[${c.title}]  demoCommon=${c.demoCommon}`);
  console.log(`  playCommonAnim 호출: ${JSON.stringify(out.calls)}`);
  console.log(`  동시에 떠 있던 셀 스프라이트 최대: ${out.maxCells}`);
}

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
await browser.close();
