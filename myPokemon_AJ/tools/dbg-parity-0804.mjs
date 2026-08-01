// 0804 원본 동작 대조 검증 — audit-parity.py가 잡아낸 "실제로 영향 있는 구멍"이 메워졌는가.
//  사용: node tools/dbg-parity-0804.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//
//  원본 근거:
//   · Interpreter.rb: trigger<3이면 event.lock → Game_Character#lock → turn_toward_player
//     @prelock_direction=0 → **대화가 끝나도 계속 플레이어를 본다**
//   · 열매나무 = step_anime(제자리 흔들림) + direction_fix(돌아보지 않음)
//     시트 실측: 세로 4줄 = 성장단계(새싹→봉오리→꽃→열매), 가로 4칸 = 흔들림. 원본 dir=8 → 열매 단계
//   · 속도 = pattern_update_speed(move_time 0.25초 ×2)의 1/4 = 0.125초 = 8fps
import { chromium } from "playwright";
import fs from "fs"; import path from "path";
const OUT = path.resolve("../../.claude/.verify");
const PICK = path.resolve("../../01_Resources/Pick/21_상록민가");
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(PICK, { recursive: true });
const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });
let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
const press = async (k, ms = 300) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const shot = async (f) => { await page.waitForTimeout(600); const b = await page.screenshot();
  for (const d of [OUT, PICK]) fs.writeFileSync(path.join(d, f), b); };
const goScene = async (key, data) => {
  await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data]);
  await page.waitForFunction((k) => { const s = window.__game.scene.getScene(k);
    return s && s.scene.isActive() && s.sys.settings.status === 5; }, key, { timeout: 15000 });
  await page.waitForTimeout(900);
};
await page.evaluate(() => { const g = window.__game;
  g.registry.set("playerName", "테스트"); g.registry.set("playerGender", "boy");
  g.registry.set("eventSelfSwitches", {}); g.registry.set("arSwitches", {}); g.registry.set("bag", []); });

console.log("\n── 1. 열매나무 = 원본 성장단계(열매) + 제자리 흔들림 ────────");
await goScene("WorldScene", { map: "route1", spawn: [16, 15], testParty: true });
const tree = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const e = s.events2.find((x) => x.ev.kind === "berry");
  if (!e?.sprite) return null;
  return { frame: Number(e.sprite.frame.name), playing: e.sprite.anims?.isPlaying ?? false,
           anim: e.sprite.anims?.currentAnim?.key ?? "", fps: e.sprite.anims?.currentAnim?.frameRate ?? 0 };
});
const t0 = await tree();
ok(!!t0, "열매나무 스프라이트가 있다");
ok(t0 && t0.playing, `제자리 흔들림 애니가 돈다 (받은 값: ${t0?.anim})`);
ok(t0 && t0.fps === 8, `속도 8fps = 원본 pattern_update_speed 그대로 (받은 값: ${t0?.fps})`);
// 열매나무 시트는 세로 4줄이 성장단계 — 원본 dir=8이니 마지막 줄(프레임 12~15)이어야 한다
await page.waitForTimeout(400);
const t1 = await tree();
ok(t1 && t1.frame >= 12 && t1.frame <= 15,
  `열매 달린 마지막 성장단계(프레임 12~15)를 쓴다 (받은 값: ${t1?.frame}) — 전엔 0번줄=새싹이었다`);
ok(t0.frame !== t1.frame || t1.playing, "프레임이 실제로 넘어간다(정지 아님)");
// ⚠️ 흔들림은 프레임 차이가 작아 "두 시점 캡처 비교"로는 안 보인다(0803 물결에서 겪은 것과 같다).
//    → **프레임을 직접 지정해** 두 장을 찍고 나란히 붙인다.
const treeShot = async (frame, file) => {
  await page.evaluate((f) => {
    const s = window.__game.scene.getScene("WorldScene");
    const e = s.events2.find((x) => x.ev.kind === "berry");
    e.sprite.anims.pause(); e.sprite.setFrame(f);
    s.tx = e.gx + 2; s.ty = e.gy + 1; s.facing = "left";      // 나무 옆에 서야 안 가린다
    s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
    s.cameras.main.centerOn(s.cx(e.gx), s.cy(e.gy));
  }, frame);
  await shot(file);
  await page.evaluate(() => window.__game.scene.getScene("WorldScene")
    .events2.find((x) => x.ev.kind === "berry").sprite.anims.resume());
};
await treeShot(12, "0804_열매나무_프레임0.png");
await treeShot(14, "0804_열매나무_프레임2.png");

console.log("\n── 2. 말 걸면 돌아본다 (원본 lock → turn_toward_player) ─────");
// 열매나무는 direction_fix=True → **돌아보면 안 된다**(돌아보면 성장단계가 바뀌어 딴 그림이 된다)
const before = (await tree()).frame;
await page.evaluate(() => { const s = window.__game.scene.getScene("WorldScene");
  const e = s.events2.find((x) => x.ev.kind === "berry");
  s.tx = e.gx; s.ty = e.gy + 1; s.facing = "up";
  s.player.setPosition(s.cx(s.tx), s.cy(s.ty)); });
await press("c", 800);
const afterTree = await tree();
ok(afterTree.frame >= 12 && afterTree.frame <= 15,
  `열매나무는 말 걸어도 성장단계가 안 바뀐다(direction_fix) (받은 값: ${afterTree.frame})`);
for (let i = 0; i < 8; i++) { if (!(await page.evaluate(() => window.__game.scene.getScene("WorldScene").busy))) break; await press("c", 500); }

// 사람 NPC는 반대로 **반드시 돌아봐야** 한다 — 민가1 도박사(14,5)는 원본이 아래를 보고 서 있다
await goScene("BuildingScene", { building: "house1", testParty: true });
const npc = (x, y) => page.evaluate(([x, y]) => {
  const s = window.__game.scene.getScene("BuildingScene");
  const e = s.roomEvents.find((r) => r.ev.x === x && r.ev.y === y);
  return e?.sprite ? { frame: Number(e.sprite.frame.name), faceDir: e.faceDir ?? null } : null;
}, [x, y]);
const g0 = await npc(14, 5);
ok(g0 && g0.frame === 0, `도박사는 원본대로 아래를 보고 서 있다(프레임 0) (받은 값: ${g0?.frame})`);
// 아래칸(14,6)에서 위를 보고 말 걸기 → 도박사는 아래(프레임 0)를 계속 본다 = 변화 없음.
// 왼쪽칸(13,5)에서 오른쪽을 보고 말 걸면 → 도박사는 왼쪽(프레임 4)을 봐야 한다.
await page.evaluate(() => { const s = window.__game.scene.getScene("BuildingScene");
  s.tx = 13; s.ty = 5; s.facing = "right";
  s.player.setPosition(s.cx(s.tx), s.cy(s.ty)); s.player.setFrame(s.idleFrame.right); });
await page.waitForTimeout(300);
await press("c", 800);
const g1 = await npc(14, 5);
ok(g1 && g1.frame === 4, `왼쪽에서 말 걸면 도박사가 왼쪽을 본다(프레임 4) (받은 값: ${g1?.frame})`);
await shot("0804_말걸면돌아본다.png");
for (let i = 0; i < 8; i++) { if (!(await page.evaluate(() => window.__game.scene.getScene("BuildingScene").busy))) break; await press("c", 500); }
const g2 = await npc(14, 5);
ok(g2 && g2.frame === 4, `대화가 끝나도 계속 이쪽을 본다(원본 @prelock_direction=0) (받은 값: ${g2?.frame})`);

console.log(`\n콘솔 에러 ${errors.length}건`);
for (const e of errors.slice(0, 5)) console.log("   " + e);
ok(errors.length === 0, "콘솔 에러 없음");
console.log(`\n=== 실패 ${fail}건 ===`);
await browser.close();
process.exit(fail ? 1 : 0);
