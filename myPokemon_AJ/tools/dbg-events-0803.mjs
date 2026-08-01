// 0803 필드 이벤트 검증 — 원본 맵 이벤트(NPC 대사·팻말·바닥 아이템·열매나무)가 실제로 서 있고 말이 걸리는가.
//  사용: node tools/dbg-events-0803.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0803_이벤트_*.png  +  01_Resources/Pick/19_필드이벤트/
//
//  원본 근거(전수 대조): AR Map10/55/56의 이벤트 39개 중 우리 것은 문 6 + 트레이너 2뿐이었다.
//   · 1번도로: 팻말(18,7) · 바닥 아이템 POTION(16,14)/ANTIDOTE(33,35)/POKEBALL(33,3) · 열매나무 2그루(15·16,7)
//   · 태초마을: NPC(20,12) "과학의 힘은 대단해!" · NPC(21,6) · 팻말(23,2) "태초마을"
//   · 상록시티: 팻말(19,16) · 자는 NPC(23,12) · NPC(30,24) · 아이템 TM09(10,5)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
const PICK = path.resolve("../../01_Resources/Pick/19_필드이벤트");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PICK, { recursive: true });

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
const shot = async (file, dirs = [OUT]) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  const buf = await page.screenshot();
  for (const d of dirs) fs.writeFileSync(path.join(d, file), buf);
};
const press = async (k, ms = 260) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
/** 대사창에 지금 찍혀 있는 글. */
const dlgText = () => page.evaluate(() => window.__game.scene.getScene("WorldScene").dlg?.boxText?.text ?? "");
/** 이벤트가 끝날 때까지(대사 다 넘길 때까지) 확인키를 누른다. 선택지가 뜨면 첫 항목(예)을 고른다. */
const finishDialog = async (max = 12) => {
  for (let i = 0; i < max; i++) {
    const busy = await page.evaluate(() => window.__game.scene.getScene("WorldScene").busy);
    if (!busy) return true;
    await press("c", 700);
  }
  return false;
};
/** 플레이어를 그 칸 **옆**에 세워 마주보게 한다(물건이 주인공에 가리지 않아 사진 찍기 좋다). dx=-1 왼쪽 / +1 오른쪽. */
const standBeside = async (gx, gy, dx = 1) => {
  await page.evaluate(([gx, gy, dx]) => {
    const s = window.__game.scene.getScene("WorldScene");
    s.tx = gx + dx; s.ty = gy; s.facing = dx > 0 ? "left" : "right";
    s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
    s.player.setFrame(s.idleFrame[s.facing]);
    s.player.setDepth(5 + s.ty * 0.001);
    s.cameras.main.centerOn(s.cx(gx), s.cy(gy));
  }, [gx, gy, dx]);
  await page.waitForTimeout(450);
};
/** 플레이어를 그 칸 바로 앞(아래쪽)에 세우고 위를 보게 한다. 리전 y오프셋: 상록 0 · 1번도로 40 · 태초 80. */
const standBelow = async (gx, gy) => {
  await page.evaluate(([gx, gy]) => {
    const s = window.__game.scene.getScene("WorldScene");
    s.tx = gx; s.ty = gy + 1; s.facing = "up";
    s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
    s.cameras.main.centerOn(s.cx(s.tx), s.cy(s.ty));
  }, [gx, gy]);
  await page.waitForTimeout(450);
};

/** 그 맵의 그 칸 앞에 서서 이벤트를 바라보게 한다(걸어가지 않고 좌표를 직접 놓는다 — 검증은 상호작용이 목적). */
const standFacing = (map, ex, ey, dir) => page.evaluate(([map, ex, ey, dir]) => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => {
    if (s.scene.key !== "WorldScene" && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
  });
  g.registry.set("playerName", "레드");
  const s = g.scene.getScene("WorldScene");
  const start = { map, spawn: [ex, ey - 1], face: dir };
  g.scene.start("WorldScene", { map, spawn: [ex, ey + (dir === "up" ? 1 : -1)], facing: dir, testParty: true });
  return !!s && !!start;
}, [map, ex, ey, dir]);

const world = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return { tx: s.tx, ty: s.ty, facing: s.facing, events: s.events2.map((e) => ({ kind: e.ev.kind, x: e.gx, y: e.gy, drawn: !!e.sprite })) };
});

// ══ 1. 원본 이벤트가 실제로 맵에 올라와 있는가 ═════════════════════════════
console.log("\n[1] 원본 이벤트가 맵에 서 있는가");
await page.evaluate(() => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => {
    if (s.scene.key !== "WorldScene" && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
  });
  g.registry.set("playerName", "레드");
  g.scene.start("WorldScene", { testParty: true });
});
await page.waitForTimeout(2600);
const w = await world();
const byKind = (k) => w.events.filter((e) => e.kind === k).length;
console.log(`     등록된 이벤트: ${w.events.length}개 — ` +
  `NPC ${byKind("npc")} · 팻말 ${byKind("sign")} · 아이템 ${byKind("item")} · 열매 ${byKind("berry")}`);
ok(byKind("item") === 4, `바닥 아이템 4개(1번도로 3 + 상록 1) — 실제 ${byKind("item")}`);
ok(byKind("berry") === 2, `열매나무 2그루(1번도로 15,7·16,7) — 실제 ${byKind("berry")}`);
ok(byKind("sign") >= 3, `팻말 3개 이상(1번도로·태초·상록) — 실제 ${byKind("sign")}`);
ok(byKind("npc") >= 3, `말 거는 NPC 3명 이상 — 실제 ${byKind("npc")}`);
ok(w.events.filter((e) => e.kind !== "sign").every((e) => e.drawn),
   "팻말을 뺀 이벤트는 전부 그림이 화면에 올라와 있다");

// 이벤트 칸은 막혔는가(원본도 이벤트는 통과 못 한다)
const blockedOk = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return s.events2.filter((e) => e.sprite).every((e) => s.blocked[e.gy][e.gx] === 1);
});
ok(blockedOk, "사람·볼·나무가 선 칸은 통행 불가로 잠긴다");

// ══ 2. 팻말 — 확인키로 읽힌다 ══════════════════════════════════════════════
console.log("\n[2] 팻말(1번도로 18,7) — 확인키로 읽힌다");
await standBelow(18, 7 + 40);      // route1은 리전에서 y+40
await press("c", 900);
const signText = await dlgText();
ok(/열매를 따고/.test(signText), `팻말 대사가 원본 그대로 뜬다 — "${signText.slice(0, 30)}"`);
await shot("0803_이벤트_01_팻말.png", [OUT, PICK]);
ok(await finishDialog(), "확인키로 팻말 대사를 끝까지 넘길 수 있다");

// ══ 3. 바닥 아이템 — 주우면 가방에 들어가고 볼이 사라진다 ══════════════════
console.log("\n[3] 바닥 아이템(1번도로 16,14 = POTION)");
const before = await page.evaluate(async () => {
  const { countItem } = await import("/src/data/Bag.ts");
  return countItem(window.__game.registry, "POTION");
});
// 사진은 **옆에서** 찍는다 — 아래에 서면 볼이 주인공 머리에 겹쳐 안 보인다(실제로 그렇게 찍혔다).
await standBeside(16, 14 + 40, 1);   // 볼의 오른쪽에 서서 왼쪽을 본다
await shot("0803_이벤트_02_아이템볼.png", [OUT, PICK]);
await press("c", 900);
const gotText = await dlgText();
ok(/주웠다/.test(gotText), `원본 문구 "○○을 주웠다!"가 나온다 — "${gotText}"`);
await finishDialog();
const after = await page.evaluate(async () => {
  const { countItem } = await import("/src/data/Bag.ts");
  const s = window.__game.scene.getScene("WorldScene");
  return {
    potion: countItem(window.__game.registry, "POTION"),
    gone: !s.events2.some((e) => e.gx === 16 && e.gy === 54),
    unblocked: s.blocked[54][16] === 0,
    selfSw: window.__game.registry.get("eventSelfSwitches"),
  };
});
ok(after.potion === before + 1, `상처약이 가방에 1개 늘었다 (${before} → ${after.potion})`);
ok(after.gone, "주운 볼은 화면에서 사라진다(원본: 셀프스위치 A → 빈 페이지)");
ok(after.unblocked, "볼이 있던 칸은 다시 지나갈 수 있다");
ok(!!after.selfSw && Object.keys(after.selfSw).length > 0, "셀프스위치가 세이브용 레지스트리에 남는다");

// 원본 RMXP는 **아래 칸 것이 앞에** 그려진다(Y정렬). 안 지키면 위 칸 볼이 주인공 머리를 덮는다.
const depths = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  s.tx = 33; s.ty = 3 + 40 + 1; s.facing = "up";
  s.player.setPosition(s.cx(s.tx), s.cy(s.ty));
  s.player.setDepth(5 + s.ty * 0.001);
  const ball = s.events2.find((e) => e.gx === 33 && e.gy === 43);
  return { player: s.player.depth, ball: ball?.sprite?.depth };
});
ok(depths.ball < depths.player,
   `위 칸의 물건이 주인공보다 **뒤에** 그려진다 (볼 ${depths.ball?.toFixed(3)} < 주인공 ${depths.player?.toFixed(3)})`);

// ══ 4. 열매나무 — 원본처럼 "딸까?"를 묻는다 ════════════════════════════════
console.log("\n[4] 열매나무(1번도로 16,7 = 오랜열매 2개)");
await standBelow(16, 7 + 40);
await press("c", 900);
const berryAsk = await dlgText();
ok(/열려있다/.test(berryAsk), `"몇 개 열려있다! 열매를 딸까?"를 묻는다 — "${berryAsk.replace(/\n/g, " ").slice(0, 30)}"`);
await shot("0803_이벤트_03_열매나무.png", [OUT, PICK]);
await finishDialog();      // 확인키 = 선택지에서 첫 항목(예)
const berry = await page.evaluate(async () => {
  const { countItem } = await import("/src/data/Bag.ts");
  return countItem(window.__game.registry, "ORANBERRY");
});
ok(berry === 2, `오랜열매를 원본과 같은 2개 딴다 (가방: ${berry})`);

// ══ 5. NPC — 태초마을 "과학의 힘은 대단해!" ════════════════════════════════
console.log("\n[5] NPC(태초마을 20,12)");
await standBelow(20, 12 + 80);
await press("c", 900);
const npcText = await dlgText();
ok(/과학/.test(npcText), `원본 대사 그대로 나온다 — "${npcText}"`);
await shot("0803_이벤트_04_NPC.png", [OUT, PICK]);

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(fail ? `\n실패 ${fail}개` : "\n전부 통과");
await browser.close();
process.exit(fail || errors.length ? 1 : 0);
