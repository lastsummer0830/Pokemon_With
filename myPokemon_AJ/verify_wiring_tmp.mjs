import { chromium } from "playwright";
const SHOTS = "/tmp/claude-1000/-mnt-d-dev-Pokemon-With/5f56de99-e4f8-434c-b8b0-09a9add86b61/scratchpad";
const errors = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.on("console", (m) => { if (m.type() === "error") errors.push(`[error] ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

const ev = (fn, arg) => page.evaluate(fn, arg);
const stopAll = () => ev(() => window.__game.scene.getScenes(true).forEach((s) => window.__game.scene.stop(s.scene.key)));
const active = () => ev(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
const reg = (k) => ev((k) => window.__game.registry.get(k), k);

// 배틀이 끝나 특정 씬으로 돌아올 때까지 Enter 연타(적응형)
async function driveBattleUntil(returnKey, maxPress = 60) {
  for (let i = 0; i < maxPress; i++) {
    const a = await active();
    if (!a.includes("BattleScene")) return a;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(220);
  }
  return active();
}

await page.goto("http://localhost:5180/");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1400);

// ── 실제 스타터 선택으로 진짜 파티 확보(CHARMANDER) ──
await ev(() => {
  const g = window.__game, sm = g.scene;
  sm.getScenes(true).forEach((s) => sm.stop(s.scene.key));
  g.registry.set("playerName", "레드"); g.registry.set("playerGender", "boy");
  g.registry.set("playerParty", []); g.registry.remove("rivalBattlePending");
  sm.start("LabScene");
});
// LabScene create 완료(winG 준비)까지 폴링
for (let i = 0; i < 25; i++) {
  const ready = await ev(() => { const s = window.__game.scene.getScene("LabScene"); return !!(s && s.winG && s.dlg); });
  if (ready) break;
  await page.waitForTimeout(200);
}
for (let i = 0; i < 8; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(200); }
await ev(() => window.__game.scene.getScene("LabScene").openWindow(1)); // 파이리
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Enter"); await page.waitForTimeout(230);
  if (await reg("rivalBattlePending")) break;
}
const before = await ev(() => { const p = window.__game.registry.get("playerParty")[0]; return { sp: p.speciesId, level: p.level, exp: p.exp, hp: p.currentHp, maxHp: p.maxHp }; });
log("파티 확보:", JSON.stringify(before));

// ══ TEST A: 야생 배틀 승리 → 경험치 획득 ══
await ev(() => { const r = window.__game.registry; r.set("rivalBattlePending", false); const p = r.get("playerParty")[0]; p.currentHp = p.maxHp; });
await stopAll();
await ev(() => { const p = window.__game.registry.get("playerParty")[0]; window.__game.scene.start("BattleScene", { ally: p, wild: true }); });
await page.waitForTimeout(1600);
await page.screenshot({ path: `${SHOTS}/w_battle.png` });
let a = await driveBattleUntil("WorldScene");
await page.waitForTimeout(500);
const afterA = await ev(() => { const p = window.__game.registry.get("playerParty")[0]; return { level: p.level, exp: p.exp }; });
log(`[A] 야생승리: exp ${before.exp} -> ${afterA.exp}, level ${before.level} -> ${afterA.level}  active=${JSON.stringify(a)}`);
log(`[A] 경험치 증가? ${afterA.exp > before.exp ? "✅" : "❌"}`);

// ══ TEST A2: 반복 승리로 레벨업 발생 확인 ══
let leveled = afterA.level > before.level;
for (let n = 0; n < 8 && !leveled; n++) {
  await ev(() => { const p = window.__game.registry.get("playerParty")[0]; p.currentHp = p.maxHp; });
  await stopAll();
  await ev(() => { const p = window.__game.registry.get("playerParty")[0]; window.__game.scene.start("BattleScene", { ally: p, wild: true }); });
  await page.waitForTimeout(1500);
  await driveBattleUntil("WorldScene");
  await page.waitForTimeout(300);
  const lv = await ev(() => window.__game.registry.get("playerParty")[0].level);
  if (lv > before.level) leveled = true;
}
const afterLv = await ev(() => { const p = window.__game.registry.get("playerParty")[0]; return { level: p.level, exp: p.exp, moves: p.moves.map((m) => m.id) }; });
log(`[A2] 반복 승리 후 level=${afterLv.level} (>${before.level}? ${leveled ? "✅ 레벨업" : "❌"}) moves=${JSON.stringify(afterLv.moves)}`);

// ══ TEST B: 저장(메뉴) ══
await ev(() => localStorage.removeItem("myPokemon.save"));
await stopAll();
await ev(() => { window.__game.registry.set("rivalBattlePending", false); window.__game.scene.start("WorldScene", { spawn: [20, 15], face: "left" }); });
await page.waitForTimeout(900);
await page.keyboard.press("Enter"); // openMenu (saveLoc 기록 + MenuScene)
await page.waitForTimeout(700);
const menuUp = (await active()).includes("MenuScene");
await ev(() => { const ms = window.__game.scene.getScene("MenuScene"); ms.idx = 3; ms.confirm(); }); // 저장
await page.waitForTimeout(500);
const saved = await ev(() => { const s = localStorage.getItem("myPokemon.save"); return s ? JSON.parse(s) : null; });
log(`[B] 메뉴 활성=${menuUp}  저장됨=${saved ? "✅" : "❌"}  party수=${saved?.party?.length} loc=${JSON.stringify(saved?.loc)} name=${saved?.name}`);

// ══ TEST C: 이어하기(MainMenuScene) ══
await ev(() => { const r = window.__game.registry; r.set("playerParty", []); r.set("playerName", ""); r.set("starterChosen", null); });
await stopAll();
await ev(() => window.__game.scene.start("MainMenuScene"));
await page.waitForTimeout(900);
await ev(() => { const mm = window.__game.scene.getScene("MainMenuScene"); mm.idx = 1; mm.choose(); }); // 이어하기
await page.waitForTimeout(1200);
const restored = await ev(() => { const r = window.__game.registry; const p = r.get("playerParty"); return { partyLen: p?.length ?? 0, sp: p?.[0]?.speciesId ?? null, level: p?.[0]?.level ?? null, name: r.get("playerName") }; });
const cActive = await active();
await page.screenshot({ path: `${SHOTS}/w_continue.png` });
log(`[C] 이어하기: party복원 ${restored.partyLen>0?"✅":"❌"} (${restored.sp} Lv.${restored.level}) name=${restored.name} active=${JSON.stringify(cActive)}`);

// ══ TEST D: 실내 메뉴 열기/닫기 ══
await stopAll();
await ev(() => window.__game.scene.start("InteriorScene", { room: "living", skipIntro: true }));
await page.waitForTimeout(1200);
await page.keyboard.press("Enter"); // openMenu
await page.waitForTimeout(700);
const dOpen = await ev(() => ({ menu: window.__game.scene.isActive("MenuScene"), interiorPaused: window.__game.scene.isPaused("InteriorScene") }));
await ev(() => window.__game.scene.getScene("MenuScene").cancel()); // main에서 취소=닫기
await page.waitForTimeout(600);
const dClose = await ev(() => ({ interiorActive: window.__game.scene.isActive("InteriorScene"), inputEnabled: window.__game.scene.getScene("InteriorScene").input.enabled }));
await page.screenshot({ path: `${SHOTS}/w_indoor_menu.png` });
log(`[D] 실내메뉴 열림 menu=${dOpen.menu} interiorPaused=${dOpen.interiorPaused} | 닫힘 interiorActive=${dClose.interiorActive} input복구=${dClose.inputEnabled}  ${dOpen.menu&&dClose.interiorActive&&dClose.inputEnabled?"✅":"❌"}`);

// ══ TEST E: F1 — 라이벌 예약은 트리거 때 소비 안 됨, 승리 때만 소비 ══
await ev(() => { const r = window.__game.registry; const p = r.get("playerParty")[0]; p.currentHp = p.maxHp; r.set("rivalBattlePending", true); r.set("rivalEnemySpecies", "PIDGEY"); });
await stopAll();
await ev(() => window.__game.scene.start("WorldScene", { spawn: [20, 15], face: "down" }));
await page.waitForTimeout(2000); // 라이벌 트리거 → BattleScene
const midBattle = await active();
const midPending = await reg("rivalBattlePending");
log(`[E] 라이벌전 진입 active=${JSON.stringify(midBattle)}  진행중 pending 유지(트리거소비X)? ${midPending===true?"✅":"❌"}`);
await driveBattleUntil("WorldScene");
await page.waitForTimeout(400);
const afterPending = await reg("rivalBattlePending");
log(`[E] 승리 후 pending=${afterPending} (승리시 소비 → false 기대) ${afterPending===false?"✅":"❌"}`);

log("\n=== CONSOLE ERRORS ===");
log(errors.length ? errors.join("\n") : "(none)");
await browser.close();
