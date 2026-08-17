// 0804 상록시티 민가 4채 검증 — 문 4개가 이어졌는가 · 그 안의 원본 이벤트가 그대로 도는가.
//  사용: node tools/dbg-houses-0804.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0804_민가_*.png  +  01_Resources/Pick/21_상록민가/
//
//  원본 근거(AR Data/Map56·160~163.rxdata 직접 판독):
//   · 문 → 집: (26,18)→Map160 · (35,18)→Map161 · (26,11)→Map162 · (8,27)→Map163, 넷 다 도착 (9,11)
//   · 나가기: 각 집 EV001 → 상록시티 (26,19)·(35,19)·(26,12)·(8,28)
//   · Map160: 원예사(7,4) 물뿌리개 4종 선택 · 로젤리아(8,4) · 도박사(14,5) · 여행자(6,9) · TV(9,2)(10,2)
//   · Map161: 아이(6,6) · 포켓인형 볼(5,6) → 스위치96 → 아이 대사 변경 · TV 2
//   · Map162: 피카츄(7,6)+울음SE · 주인(9,6) · 부인(15,4) · TV 2
//   · Map163: 젬 상점 아주머니(6,6) — 원본 pbPokemonMart(상점 미구현이라 안내만)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
const PICK = path.resolve("../../01_Resources/Pick/21_상록민가");
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
// ⚠️ 부팅 직후엔 첫 씬이 getScenes(true)에 안 잡힌다(0803 함정 2번) → 하나라도 뜰 때까지 기다린다.
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
const shot = async (file, dirs = [OUT, PICK]) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  const buf = await page.screenshot();
  for (const d of dirs) fs.writeFileSync(path.join(d, file), buf);
};
const press = async (k, ms = 260) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };

/** 씬 하나를 곧장 띄운다(디버그 바로가기와 같은 경로 — primeDebugRegistry로 가방·이름을 채운다). */
const goScene = async (key, data) => {
  await page.evaluate(([key, data]) => {
    const g = window.__game;
    const cur = g.scene.getScenes(true)[0];
    cur.scene.start(key, data);
  }, [key, data]);
  await page.waitForFunction((k) => {
    const s = window.__game.scene.getScene(k);
    return s && s.scene.isActive() && s.sys.settings.status === 5;
  }, key, { timeout: 15000 });
  await page.waitForTimeout(900);
};
const prime = async () => {
  await page.evaluate(() => {
    const g = window.__game;
    g.registry.set("playerName", "테스트");
    g.registry.set("playerGender", "boy");
    // 확인을 반복해도 늘 같은 상태에서 시작하도록 이벤트 기억을 지운다.
    g.registry.set("eventSelfSwitches", {});
    g.registry.set("arSwitches", {});
    g.registry.set("bag", []);
  });
};

const B = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("BuildingScene");
  return { building: s.initData?.building, tx: s.tx, ty: s.ty, busy: s.busy,
           events: s.roomEvents.map((e) => ({ id: e.ev.id, x: e.ev.x, y: e.ev.y, kind: e.ev.kind, drawn: !!e.sprite })) };
});
const W = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return { tx: s.tx, ty: s.ty, busy: s.busy };
});
const dlgB = () => page.evaluate(() => window.__game.scene.getScene("BuildingScene").dlg?.boxText?.text ?? "");
const nameB = () => page.evaluate(() => window.__game.scene.getScene("BuildingScene").dlg?.nameText?.text ?? "");
const bag = () => page.evaluate(() => (window.__game.registry.get("bag") ?? []).map((e) => `${e.itemId}x${e.count}`));

/**
 * 실내에서 그 칸을 마주보고 서게 한다. dir = **플레이어가 바라보는 방향**.
 * ⚠️ 설 자리가 실제로 걸을 수 있는 칸인지 반드시 확인한다 — 안 그러면 벽·가구 위로 순간이동해
 *    "말은 걸리는데 실제로는 못 가는 자리"를 통과시키고, 사진에도 사람이 가구에 올라선 채로 찍힌다(실제로 겪음).
 */
const faceTile = async (x, y, dir) => {
  const okStand = await page.evaluate(([x, y, dir]) => {
    const s = window.__game.scene.getScene("BuildingScene");
    const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir];
    const sx = x + d[0], sy = y + d[1];
    if (!s.walkable(sx, sy)) return false;
    s.tx = sx; s.ty = sy; s.facing = dir;
    s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
    s.player.setFrame(s.idleFrame[dir]);
    s.player.setDepth(s.charDepth(s.ty));
    return true;
  }, [x, y, dir]);
  ok(okStand, `(${x},${y})를 ${dir}쪽으로 마주볼 자리에 실제로 설 수 있음`);
  await page.waitForTimeout(300);
};
/** 대사를 끝까지 넘긴다(선택지가 뜨면 확인키로 첫 항목). */
const finish = async (max = 14) => {
  for (let i = 0; i < max; i++) {
    if (!(await B()).busy) return true;
    await press("c", 650);
  }
  return false;
};

console.log("\n── 1. 상록시티 → 민가 문 4개 ─────────────────────────");
await prime();
// 원본 'Home door' 좌표(상록시티 로컬) → 들어갔을 때의 building · 나왔을 때 서 있을 칸
const DOORS = [
  { door: [26, 18], out: [26, 19], building: "house1" },
  { door: [35, 18], out: [35, 19], building: "house2" },
  { door: [26, 11], out: [26, 12], building: "house3" },
  { door: [8, 27], out: [8, 28], building: "house4" },
];
for (const d of DOORS) {
  await goScene("WorldScene", { map: "viridian_city", spawn: [d.out[0], d.out[1]], face: "up", testParty: true });
  // 문 앞칸에서 위를 눌러 문으로 걸어 들어간다(실제 조작과 같은 경로).
  await page.keyboard.down("ArrowUp"); await page.waitForTimeout(700); await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(1400);
  const b = await B();
  ok(b.building === d.building, `상록시티 문(${d.door}) → ${d.building} (받은 값: ${b.building})`);
  ok(b.tx === 9 && b.ty === 11, `  도착칸 (9,11) — 원본 transfer 값 (받은 값: ${b.tx},${b.ty})`);
  // 도어매트에서 아래 → 나가기
  await page.keyboard.down("ArrowDown"); await page.waitForTimeout(700); await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(1600);
  const w = await W();
  ok(w.tx === d.out[0] && w.ty === d.out[1], `  나가면 상록시티 (${d.out}) (받은 값: ${w.tx},${w.ty})`);
}

console.log("\n── 2. 민가1 — 원본 이벤트 6개가 서 있는가 ────────────");
await prime();
await goScene("BuildingScene", { building: "house1", testParty: true });
let b = await B();
ok(b.events.length === 6, `이벤트 6개 등록 (받은 값: ${b.events.length})`);
const drawn1 = b.events.filter((e) => e.drawn).map((e) => `${e.x},${e.y}`).sort().join(" ");
ok(drawn1 === "14,5 6,9 7,4 8,4", `사람 4명이 원본 좌표에 그려짐 (받은 값: ${drawn1})`);
ok(b.events.filter((e) => e.kind === "sign").length === 2, "TV 2개(그림 없는 이벤트)도 말 걸기 대상");
await shot("0804_민가1_방.png");

// 통행 차단 — 원예사·로젤리아가 선 칸은 못 지나간다
const walk = async (x, y) => page.evaluate(([x, y]) => window.__game.scene.getScene("BuildingScene").walkable(x, y), [x, y]);
ok((await walk(7, 4)) === false && (await walk(8, 4)) === false, "사람이 선 칸은 통행 차단");
ok((await walk(9, 10)) === true, "빈 바닥(9,10)은 지나갈 수 있음");

console.log("\n── 3. 민가1 — 원예사 물뿌리개(선택지 + 셀프스위치) ────");
await faceTile(7, 4, "up");
await press("c", 900);
let t = await dlgB();
ok(t.includes("원예사"), `첫 대사 원본 그대로 (받은 값: "${t.slice(0, 20)}")`);
await shot("0804_민가1_원예사.png");
await finish();
const bag1 = await bag();
ok(bag1.some((s) => s.startsWith("SQUIRTBOTTLE")), `고른 물뿌리개가 가방에 (받은 값: ${bag1.join(",")})`);
// 다시 말 걸면 셀프스위치 A가 켜져 다음 페이지로 넘어가 있어야 한다(무한 지급 방지)
await faceTile(7, 4, "up");
await press("c", 900);
t = await dlgB();
ok(t.includes("물을 주자"), `두 번째 대사는 다음 페이지 (받은 값: "${t.slice(0, 20)}")`);
await finish();
const bag1b = await bag();
ok(bag1b.filter((s) => s.startsWith("SQUIRTBOTTLE")).length === 1 && bag1b.length === bag1.length,
  "다시 말 걸어도 물뿌리개를 또 주지 않음");

console.log("\n── 4. 민가1 — 나머지 사람·TV 대사 ──────────────────");
for (const [x, y, dir, want] of [[8, 4, "up", "로젤리아"], [14, 5, "up", "배지"], [6, 9, "left", "여행"], [9, 2, "up", "특집 방송"]]) {
  await faceTile(x, y, dir);
  await press("c", 800);
  const got = await dlgB();
  ok(got.includes(want), `(${x},${y}) 대사에 "${want}" (받은 값: "${got.slice(0, 22)}")`);
  await finish();
}

console.log("\n── 5. 민가2 — 포켓인형 → 전역 스위치 96 → 아이 대사 변경 ─");
await prime();
await goScene("BuildingScene", { building: "house2", testParty: true });
b = await B();
ok(b.events.length === 4, `이벤트 4개 등록 (받은 값: ${b.events.length})`);
await faceTile(6, 6, "left");
await press("c", 800);
t = await dlgB();
ok(t.includes("생일선물"), `가져가기 전 아이 대사 (받은 값: "${t.slice(0, 20)}")`);
await finish();
await shot("0804_민가2_아이.png");
// 볼(5,6)은 왼쪽 칸(4,6)에서 오른쪽을 보고 줍는다
await faceTile(5, 6, "right");
await press("c", 900);
t = await dlgB();
ok(t.includes("주웠다"), `볼을 주우면 "주웠다" (받은 값: "${t.slice(0, 20)}")`);
await finish();
const bag2 = await bag();
ok(bag2.some((s) => s.startsWith("POKEDOLL")), `삐삐인형이 가방에 (받은 값: ${bag2.join(",")})`);
b = await B();
ok(!b.events.some((e) => e.x === 5 && e.y === 6), "주운 볼은 사라짐(셀프스위치 A)");
// ⚠️ 이 칸(5,6)은 **원본 방 타일이 원래 막힘**이다(볼이 침대 옆에 놓여 있다) → 주워도 계속 못 지나간다.
//    그래서 "볼이 사라지면 걸어갈 수 있다"로 확인하면 안 되고, 격자와 어긋나지 않는지를 본다.
const rawBlocked = await page.evaluate(() => window.__game.scene.getScene("BuildingScene").map.blocked[6][5]);
ok(rawBlocked === 1 && (await walk(5, 6)) === false, "볼 자리는 원본 타일부터 막힌 칸 — 격자와 일치");
const sw = await page.evaluate(() => window.__game.registry.get("arSwitches")?.[96] === true);
ok(sw, "원본 전역 스위치 96번이 켜짐");
// 아이 대사는 **그 자리에서 바로** 바뀌어야 한다(원본도 스위치가 켜지는 즉시 페이지가 갈린다).
await faceTile(6, 6, "left");
await press("c", 800);
t = await dlgB();
ok(t.includes("왜 가져가"), `가져간 뒤 아이 대사가 바뀜 (받은 값: "${t.slice(0, 20)}")`);
await shot("0804_민가2_아이_뺏긴뒤.png");
await finish();

console.log("\n── 6. 민가3 — 피카츄 울음(원본 SE) ─────────────────");
await prime();
await goScene("BuildingScene", { building: "house3", testParty: true });
b = await B();
ok(b.events.length === 5, `이벤트 5개 등록 (받은 값: ${b.events.length})`);
ok(await page.evaluate(() => window.__game.cache.audio.exists("cry_PIKACHU")), "피카츄 울음(AR 원본 SE) 로드됨");
await faceTile(7, 6, "left");
await press("c", 800);
t = await dlgB();
ok(t.includes("피카피"), `피카츄 대사 (받은 값: "${t.slice(0, 12)}")`);
await shot("0804_민가3_피카츄.png");
await finish();
for (const [x, y, dir, want] of [[9, 6, "right", "피카츄"], [15, 4, "up", "남편"]]) {
  await faceTile(x, y, dir);
  await press("c", 800);
  const got = await dlgB();
  ok(got.includes(want), `(${x},${y}) 대사에 "${want}" (받은 값: "${got.slice(0, 22)}")`);
  await finish();
}

console.log("\n── 7. 민가4 — 젬 상점(원본 pbPokemonMart · 미구현 안내) ─");
await prime();
await goScene("BuildingScene", { building: "house4", testParty: true });
b = await B();
ok(b.events.length === 3, `이벤트 3개 등록 (받은 값: ${b.events.length})`);
await faceTile(6, 6, "up");
await press("c", 800);
t = await dlgB();
ok(t.includes("준비 중"), `상점은 준비 중 안내 (받은 값: "${t.slice(0, 20)}")`);
await shot("0804_민가4_젬상점.png");
await finish();

console.log("\n── 8. 회귀 — 야외 이벤트가 그대로인가(공용 실행기로 옮긴 뒤) ─");
await prime();
await goScene("WorldScene", { map: "route1", spawn: [16, 15], testParty: true });
await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  s.tx = 16; s.ty = 40 + 15; s.facing = "up";   // 1번도로는 리전 y오프셋 40
  s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
  s.cameras.main.centerOn(s.cx(s.tx), s.cy(s.ty));
});
await page.waitForTimeout(500);
await press("c", 900);
const wt = await page.evaluate(() => window.__game.scene.getScene("WorldScene").dlg?.boxText?.text ?? "");
ok(wt.includes("주웠다"), `1번도로 바닥 아이템 그대로 동작 (받은 값: "${wt.slice(0, 20)}")`);
for (let i = 0; i < 8; i++) {
  if (!(await W()).busy) break;
  await press("c", 600);
}
const wbag = await bag();
ok(wbag.some((s) => s.startsWith("POTION")), `주운 상처약이 가방에 (받은 값: ${wbag.join(",")})`);

console.log(`\n콘솔 에러 ${errors.length}건`);
for (const e of errors.slice(0, 6)) console.log("   " + e);
ok(errors.length === 0, "콘솔 에러 없음");
console.log(`\n=== 실패 ${fail}건 ===`);
console.log(`캡처: ${OUT}\n      ${PICK}`);
await browser.close();
process.exit(fail ? 1 : 0);
