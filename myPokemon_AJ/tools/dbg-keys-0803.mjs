// 0803 조작키 검증 — 배치가 원본 실측과 같은지 + **실제로 그 키가 먹는지**까지 본다.
//  사용: node tools/dbg-keys-0803.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0803_키설정_*.png   (사용자용 사진은 01_Resources/Pick/18_조작키/)
//
//  원본 근거(전부 실측):
//   · 게임 폴더 "조작키 및 안내사항.txt" — A버튼 C · B버튼 X · 가방/사용 Z · 스페셜 D · 배속 Q(배틀에서만)
//   · mkxp.json bindingNames + mkxp-z 기본 배치 — 물리 Z = 엔진의 A버튼 = Input::ACTION
//   · Scripts.rxdata / Scene_Map.rb — USE=말걸기, **ACTION=메뉴 열기**, SPECIAL=등록아이템
//     ⇒ 원본의 Z는 '가방'이 아니라 '메뉴'다. 이 스크립트는 그 규칙대로 검사한다.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
const PICK = path.resolve("../../01_Resources/Pick/18_조작키");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PICK, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto((process.env.DEV_URL ?? "http://localhost:5180"), { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
// ⚠️ isBooted 시점엔 첫 씬(TitleScene)이 **아직 '시작 중'이라 active로도 안 잡힌다.**
//    그 상태에서 씬을 갈아치우면 타이틀이 뒤에 살아남아 D(디버그) 단축키까지 같이 먹는다 → 자리잡을 때까지 기다린다.
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
// ⚠️ 캡처는 렌더를 기다렸다 찍는다(시각을 민 직후에 찍으면 이전 프레임이 찍힌다 · 씬 fadeIn 400ms).
const shot = async (file, dirs = [OUT]) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  const buf = await page.screenshot();
  for (const d of dirs) fs.writeFileSync(path.join(d, file), buf);
};
// ⚠️ headless에서 키를 연달아 보내면 이벤트가 씹힌다 → 사이를 띄운다.
const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const goScene = async (key, data) => {
  await page.evaluate(([k, d]) => {
    const g = window.__game;
    // ⚠️ getScenes(true)만 보면 '막 켜지는 중'인 씬(부팅 직후의 TitleScene)을 놓쳐 뒤에 계속 살아 있는다.
    //    그 상태로 검사하면 타이틀의 D(디버그) 단축키까지 같이 먹어 결과가 오염된다 → 전부 훑어서 내린다.
    g.scene.scenes.forEach((s) => {
      if (s.scene.key !== k && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
    });
    g.registry.set("playerName", "레드");
    g.scene.start(k, d);
  }, [key, data]);
  await page.waitForTimeout(1800);   // 씬 create + fadeIn(400ms)
};
const activeScenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
const usePreset = (name) => page.evaluate(async (n) => {
  const m = await import("/src/systems/input.ts");
  m.usePreset(n);
}, name);

// ══ 1. 기본 배치가 원본 실측과 같은가 ══════════════════════════════════════
console.log("\n[1] 기본 배치 = 원본(Another Red) 실측");
const map = await page.evaluate(async () => {
  const m = await import("/src/systems/input.ts");
  localStorage.removeItem("myPokemon.keys");
  m.usePreset("original");
  return { map: m.keyMap(), preset: m.matchedPreset(), saved: JSON.parse(localStorage.getItem("myPokemon.keys")) };
});
ok(map.map.USE[0] === "KeyC", `확인(A버튼) = C  [${map.map.USE.join(" · ")}]`);
ok(map.map.USE.includes("Enter") && map.map.USE.includes("Space"), "Enter·Space도 확인으로 계속 받는다(사용자 지시)");
ok(map.map.BACK[0] === "KeyX", `취소(B버튼) = X  [${map.map.BACK.join(" · ")}]`);
ok(map.map.MENU.join() === "KeyZ", "메뉴 = Z (원본 Input::ACTION — '가방'이 아니라 메뉴다)");
ok(map.map.BAG.join() === "KeyD", "가방 = D (원본 스페셜 자리)");
ok(map.map.SPEED.join() === "KeyQ", "배속 = Q");
ok(map.saved && map.saved.MENU.join() === "KeyZ", "배치가 localStorage(myPokemon.keys)에 저장된다");
ok(map.preset === "original", "지금 배치가 '원본식' 프리셋으로 인식된다");

// 한 키가 두 액션에 겹치지 않는가(겹치면 말 걸기+메뉴가 한 번에 터진다)
const dup = await page.evaluate(async () => {
  const m = await import("/src/systems/input.ts");
  const seen = {}; const bad = [];
  for (const a of m.ACTIONS) for (const k of m.keyMap()[a]) { if (seen[k]) bad.push(`${k}: ${seen[k]}+${a}`); seen[k] = a; }
  return bad;
});
ok(dup.length === 0, `원본식에서 한 키가 두 조작에 겹치지 않는다${dup.length ? " — " + dup.join(", ") : ""}`);

// ══ 2. 프리셋·재할당 규칙 ══════════════════════════════════════════════════
console.log("\n[2] 프리셋 전환과 키 다시 잡기");
const rb = await page.evaluate(async () => {
  const m = await import("/src/systems/input.ts");
  m.usePreset("legacy");
  const legacy = { ...m.keyMap(), preset: m.matchedPreset() };
  m.usePreset("original");
  // 확인키를 B로 다시 잡으면? (B는 아무 데도 안 걸려 있다)
  const okB = m.rebind("USE", "KeyB");
  const afterB = m.keyMap().USE.join();
  // 취소키를 메뉴(Z)로 뺏어오면? MENU는 키가 하나뿐이라 거절돼야 한다.
  const okSteal = m.rebind("BACK", "KeyZ");
  const menuAfter = m.keyMap().MENU.join();
  m.resetKeys();
  return { legacy, okB, afterB, okSteal, menuAfter, reset: m.keyMap().USE.join() };
});
ok(rb.legacy.preset === "legacy" && rb.legacy.USE.includes("KeyZ") && rb.legacy.MENU.includes("Enter"),
   "'기존식' 프리셋 = Z가 확인, 필드 메뉴는 Enter·X (0802까지의 배치)");
ok(rb.okB && rb.afterB === "KeyB", "확인키를 B로 다시 잡으면 그 키 하나로 바뀐다");
ok(!rb.okSteal && rb.menuAfter === "KeyZ", "다른 조작의 마지막 키(Z)는 뺏기지 않는다(조작 불능 방지)");
ok(rb.reset === "KeyC,Enter,Space", "R(기본값)으로 원본 배치가 돌아온다");

// ══ 3. 필드에서 실제로 먹는가 (원본식) ═════════════════════════════════════
console.log("\n[3] 필드 — 메뉴 Z · 가방 D (원본식)");
await usePreset("original");
await goScene("WorldScene", { testParty: true });
const hud = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return s.children.getByName("hud")?.text ?? "";
});
ok(/Z: 메뉴/.test(hud), `HUD 안내가 지금 걸린 메뉴 키를 적는다 — "${hud.slice(0, 60)}…"`);
await press("z", 900);
let act = await activeScenes();
ok(act.includes("MenuScene"), `Z를 누르면 메뉴가 열린다 (지금 씬: ${act.join(", ")})`);
await press("x", 900);   // 메뉴 닫기(취소)
await press("d", 900);
act = await activeScenes();
ok(act.includes("BagScene"), `D를 누르면 가방이 바로 열린다 (지금 씬: ${act.join(", ")})`);
await shot("0803_키설정_04_가방단축키.png");
await press("x", 900);
// 원본식에선 Enter가 확인이지 메뉴가 아니다 → 필드에서 Enter로는 메뉴가 안 열려야 한다... 가 아니라
//  Enter는 우리 편의로 '확인'에 남겼고 필드엔 확인 대상이 없으므로 아무 일도 없어야 한다.
await press("Enter", 900);
act = await activeScenes();
ok(!act.includes("MenuScene"), "원본식에선 Enter로 메뉴가 열리지 않는다(Enter=확인)");

// ══ 4. 기존식 프리셋에서는 Enter가 필드 메뉴 ═══════════════════════════════
console.log("\n[4] 기존식 — Enter가 필드 메뉴(손에 익은 배치 그대로)");
await usePreset("legacy");
await goScene("WorldScene", { testParty: true });
await press("Enter", 900);
act = await activeScenes();
ok(act.includes("MenuScene"), `기존식에선 Enter로 메뉴가 열린다 (지금 씬: ${act.join(", ")})`);
await press("x", 900);
await usePreset("original");

// ══ 5. 대사 넘기기 — 확인키 C ══════════════════════════════════════════════
console.log("\n[5] 대사 — 확인키(C)로 넘어간다");
await goScene("InteriorScene", { room: "living", skipIntro: true });
const dlg = await page.evaluate(async () => {
  const s = window.__game.scene.getScene("InteriorScene");
  window.__dlgDone = false;
  s.say("검증용 대사입니다.").then(() => { window.__dlgDone = true; });
  return true;
});
await page.waitForTimeout(600);
await press("c", 400);      // 첫 번째: 타자기 끝내기
await press("c", 400);      // 두 번째: 넘기기
ok(dlg && await page.evaluate(() => window.__dlgDone === true), "C 두 번으로 대사가 끝까지 넘어간다");

// ══ 6. 배속 Q — 배틀에서만 ═════════════════════════════════════════════════
console.log("\n[6] 배속 — 배틀에서만 듣는다");
await goScene("WorldScene", { testParty: true });
await press("q", 600);
const worldScale = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return { time: s.time.timeScale, tween: s.tweens.timeScale };
});
ok(worldScale.time === 1 && worldScale.tween === 1, "필드에서 Q는 아무 일도 안 한다(원본: 배속은 배틀 시에만)");

await goScene("BattleScene", { wild: true, testParty: true, backdrop: "route" });
const before = await page.evaluate(() => {
  const s = window.__game.scene.getScene("BattleScene");
  return { time: s.time.timeScale, up: s.speedUp };
});
await press("q", 600);
const after = await page.evaluate(() => {
  const s = window.__game.scene.getScene("BattleScene");
  const label = s.children.list.find((o) => o.text === "≫ 배속 2배");
  return { time: s.time.timeScale, tween: s.tweens.timeScale, up: s.speedUp, label: !!label?.visible };
});
await shot("0803_키설정_05_배틀배속.png");
await press("q", 600);
const off = await page.evaluate(() => {
  const s = window.__game.scene.getScene("BattleScene");
  return { time: s.time.timeScale, up: s.speedUp };
});
ok(before.time === 1 && before.up === false, "배틀에 들어가면 배속은 꺼져 있다(씬 재사용에도 남지 않는다)");
ok(after.time === 2 && after.tween === 2 && after.up === true, `Q로 시간·트윈이 2배가 된다 (time=${after.time})`);
ok(after.label, "화면에 '≫ 배속 2배' 표시가 뜬다");
ok(off.time === 1 && off.up === false, "다시 누르면 원래 속도로 돌아온다");
// 배틀을 떠나면 시간배속이 남지 않는가(다른 씬 타이머까지 빨라지면 안 된다)
await press("q", 600);
await goScene("WorldScene", { testParty: true });
const leftover = await page.evaluate(() => {
  const b = window.__game.scene.getScene("BattleScene");
  return b.time.timeScale;
});
ok(leftover === 1, "배속을 켠 채 배틀을 나가도 시간배속이 남지 않는다");

// ══ 7. 키 설정 화면(F1) ════════════════════════════════════════════════════
console.log("\n[7] 키 설정 화면 — F1로 열고, 실제로 키가 바뀐다");
await goScene("WorldScene", { testParty: true });
await page.keyboard.press("F1");
await page.waitForTimeout(1500);
act = await activeScenes();
ok(act.includes("KeyConfigScene"), `어느 화면에서든 F1로 키 설정이 열린다 (지금 씬: ${act.join(", ")})`);
await shot("0803_키설정_01_원본식.png", [OUT, PICK]);

// 프리셋 줄에서 →: 원본식 → 기존식
await press("ArrowRight", 700);
const presetNow = await page.evaluate(async () => (await import("/src/systems/input.ts")).matchedPreset());
ok(presetNow === "legacy", "맨 윗줄에서 →로 '기존식'으로 갈아끼워진다");
await shot("0803_키설정_02_기존식.png", [OUT, PICK]);
await press("ArrowLeft", 700);   // 원본식으로 되돌리기

// 가방(BAG) 줄로 내려가 확인키 → 새 키(B) 잡기
await press("ArrowDown", 300); await press("ArrowDown", 300); await press("ArrowDown", 300); await press("ArrowDown", 300);
const rowNow = await page.evaluate(() => window.__game.scene.getScene("KeyConfigScene").idx);
await press("c", 500);           // 확인키 = 다시 잡기 시작
const capturing = await page.evaluate(() => window.__game.scene.getScene("KeyConfigScene").capturing);
await shot("0803_키설정_03_키잡는중.png", [OUT, PICK]);
await press("b", 700);           // 새 키 = B
const bagKeys = await page.evaluate(async () => (await import("/src/systems/input.ts")).keyMap().BAG.join());
ok(rowNow === 4, `↑↓로 '가방' 줄까지 내려간다 (idx=${rowNow})`);
ok(capturing === "BAG", `확인키를 누르면 '새 키를 누르세요' 상태가 된다 (capturing=${capturing})`);
ok(bagKeys === "KeyB", `그 다음 누른 키가 그 자리에 들어간다 (가방=${bagKeys})`);

// R = 기본값으로 되돌리기 → 닫기
await press("r", 600);
const resetBack = await page.evaluate(async () => (await import("/src/systems/input.ts")).keyMap().BAG.join());
ok(resetBack === "KeyD", "R로 원본 배치가 돌아온다(가방=D)");
await press("x", 900);
act = await activeScenes();
ok(!act.includes("KeyConfigScene") && act.includes("WorldScene"), `취소키로 닫으면 원래 화면으로 돌아온다 (${act.join(", ")})`);

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(fail ? `\n실패 ${fail}개` : "\n전부 통과");
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
