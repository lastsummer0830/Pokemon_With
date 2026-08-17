// 0818 — ⭐ 경호(35,10)를 **실제로 걸어서 지나** 상록체육관 문(35,9)으로 들어가지는지.
//  사용: node tools/dbg-gymdoor-0818.mjs      (myPokemon_AJ/ 에서 실행 — 캡처 경로는 CWD와 무관)
//  ⚠️ dev 서버(http://localhost:5180)는 **밖에서 이미 떠 있어야 한다** — 켜지도 끄지도 않는다.
//
// 왜 따로 만들었나: dbg-kyungho-0818.mjs는 `walkable(35,10)`/`walkable(35,9)`만 본다. 그건 blocked 배열
//  한 칸을 읽은 것이고, "위를 눌러 걸어가면 실제로 체육관 씬이 뜬다"는 증거가 아니다. 워프는 방향(dir:"up")
//  조건이 있고 landOn 뒤에 걸리므로 실제 입력으로만 확인된다.
//
// 세 상태를 모두 걷는다 — 경호의 페이지가 바뀌어도 길이 막히지 않아야 한다.
//   p0 (조건 없음)      : 아직 말 안 건 첫 대면 상태
//   p1 (셀프스위치 A)   : 말 걸어 끝낸 상태 (정상 플레이의 대부분)
//   p2 (스위치 95)      : 22번도로+배틀 후 — 그림 없는 페이지 = 사라진다
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });

// ⚠️ WorldScene의 tx/ty는 **글로벌 좌표**다. 상록시티는 22번도로가 들어오면서 ox=58로 밀렸으므로
//    로컬 좌표를 그대로 비교하면 안 된다 — 게임에서 오프셋을 읽어와 더한다(하드코딩하면 또 밀릴 때 조용히 깨진다).
const MAP = "viridian_city";
const EV_ID = 14;
const DOOR = [35, 9];             // 상록체육관 문 (warp dir:"up")
const GUARD = [35, 10];           // 경호가 선 칸
// 문 바로 아래 두 칸 중 서 있을 수 있는 자리. viridian_city.json blocked 실측:
//   row9  x33..37 = 1,1,0,1,1  → (35,9)로 들어가는 칸은 (35,10) **하나뿐**
//   row10 x33..37 = 0,0,0,0,0  · row11 = 전부 0 · row12 = 전부 1(벽)
// → 출발은 (35,11)이다. (35,12)는 벽이라 설 수 없다.
const START = [35, 11];
const SELF_KEY = `${MAP}:${EV_ID}:A`;
const GONE_SWITCH = 95;
const ENTRY_WAIT = 20000;         // headless swiftshader는 캐릭터 시트가 늦다

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
const section = async (title, fn) => {
  console.log(`\n── ${title} ──────────────────────────────`);
  try { await fn(); } catch (e) { fail++; console.log(`  ❌ 이 구간이 끊겼다: ${e?.message ?? e}`); }
};
const until = async (fn, arg, timeout = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; }
  catch { return false; }
};
const sceneActive = (key, timeout = 15000) => until((k) => {
  const s = window.__game.scene.getScene(k);
  return !!s && s.scene.isActive() && s.sys.settings.status === 5;
}, key, timeout);

const startScene = async (key, data) => {
  await until(() => window.__game.scene.getScenes(true).length > 0, undefined, 15000);
  await page.evaluate(([k, d]) => {
    const g = window.__game;
    g.scene.scenes.forEach((s) => {
      if (s.scene.key !== k && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
    });
    g.scene.start(k, d);
  }, [key, data]);
};

/** registry의 이벤트 진행 상태를 이 케이스가 원하는 값으로 고정한다(세이브에 안 굽는다 — 여기서만). */
const setProgress = async (selfA, gone) => {
  await page.evaluate(([key, sw, a, g]) => {
    const r = window.__game.registry;
    r.set("eventSelfSwitches", a ? { [key]: true } : {});
    r.set("arSwitches", g ? { [sw]: true } : {});
  }, [SELF_KEY, GONE_SWITCH, selfA, gone]);
};

/** 이 맵의 리전 오프셋(ox,oy) — 글로벌 tx/ty를 로컬로 되돌리는 데 쓴다. */
let OFF = [0, 0];
const readOffset = async () => {
  OFF = await page.evaluate((map) => {
    const s = window.__game.scene.getScene("WorldScene");
    const m = s?.curMap?.name === map ? s.curMap : null;
    return m ? [m.ox, m.oy] : [0, 0];
  }, MAP);
};

/** 현재 칸을 **로컬 좌표로** 돌려준다(원본 좌표와 바로 비교할 수 있게). */
const tile = () => page.evaluate(([ox, oy]) => {
  const s = window.__game.scene.getScene("WorldScene");
  return s && s.scene.isActive()
    ? { tx: s.tx - ox, ty: s.ty - oy, gx: s.tx, gy: s.ty, moving: !!s.moving, busy: !!s.busy } : null;
}, OFF);

/** 한 칸 걷기 — update()가 isDown을 보므로 키를 '누르고 있다가' 떼고 이동 종료를 기다린다. */
const stepUp = async () => {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(120);
  await page.keyboard.up("ArrowUp");
  await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !s || !s.scene.isActive() || !s.moving;
  }, undefined, 5000);
  await page.waitForTimeout(120);
};

const guardSprite = () => page.evaluate(([map, id, gx, gy]) => {
  const s = window.__game.scene.getScene("WorldScene");
  const e = (s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  // blocked는 **글로벌 격자**다 — 경호 칸의 글로벌 좌표로 읽어야 한다.
  return { known: !!e, sprite: !!e?.sprite, blocked: s?.blocked?.[gy]?.[gx] === 1 };
}, [MAP, EV_ID, GUARD[0] + OFF[0], GUARD[1] + OFF[1]]);

// 새로 만든 public/assets 파일은 오래 떠 있던 dev 서버가 index.html로 폴백한다 → 다른 포트로 확인할 수 있게 열어 둔다.
await page.goto(process.env.DEV_URL ?? "http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 20000 });

/** 한 케이스: (35,11)에서 위로 두 번 걸어 (35,10) → (35,9) → GymScene. */
const walkCase = async (label, { selfA, gone, expectSprite, shots = [] }) => {
  await startScene("WorldScene", { map: MAP, spawn: START, face: "up", testParty: true });
  if (!(await sceneActive("WorldScene"))) { ok(false, `${label}: WorldScene이 안 떴다`); return; }
  // 페이지 조건을 바꾼 뒤 setupEvents가 다시 돌게 씬을 새로 띄운다(활성 페이지는 시작 때 결정된다).
  await setProgress(selfA, gone);
  await startScene("WorldScene", { map: MAP, spawn: START, face: "up", testParty: true });
  ok(await sceneActive("WorldScene"), `${label}: WorldScene이 ${MAP} (${START})에서 떴다`);
  await readOffset();
  ok(OFF[0] >= 0 && OFF[1] >= 0, `${label}: 상록시티 리전 오프셋 (ox,oy)=(${OFF})`);
  if (expectSprite) {
    ok(await until(([map, id]) => {
      const s = window.__game.scene.getScene("WorldScene");
      const e = (s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
      return !!e?.sprite;
    }, [MAP, EV_ID], ENTRY_WAIT), `${label}: 경호 sprite가 (35,10)에 서 있다`);
  }
  const g = await guardSprite();
  ok(expectSprite ? g.sprite : !g.known,
    `${label}: 경호 존재=${g.known} 그림=${g.sprite} (기대: ${expectSprite ? "보인다" : "사라졌다"})`);
  ok(g.blocked === false, `${label}: blocked[10][35]=${g.blocked ? 1 : 0} — 경호 칸이 막혀 있지 않다`);

  const t0 = await tile();
  ok(t0?.tx === START[0] && t0?.ty === START[1], `${label}: 출발 좌표 (${t0?.tx},${t0?.ty}) = (${START})`);
  if (shots[0]) await snap(page, path.join(OUT, shots[0]));

  await stepUp();                                        // (35,11) → (35,10) = 경호 칸
  const t2 = await tile();
  ok(t2?.tx === GUARD[0] && t2?.ty === GUARD[1],
    `${label}: ⭐ 경호 칸 (35,10)을 **밟았다** — 받은 값 (${t2?.tx},${t2?.ty})`);
  if (shots[1]) await snap(page, path.join(OUT, shots[1]));

  await stepUp();                                        // (35,10) → (35,9) = 문 → 워프
  const entered = await sceneActive("GymScene", 12000);
  ok(entered, `${label}: ⭐ 상록체육관(GymScene)에 들어갔다`);
  if (entered && shots[2]) await snap(page, path.join(OUT, shots[2]));
  if (!entered) {
    const t3 = await tile();
    console.log(`     (막힌 자리: 현재 좌표 (${t3?.tx},${t3?.ty}) moving=${t3?.moving} busy=${t3?.busy})`);
  }
};

await section("① 말 걸기 전(p0) — 첫 대면 상태로 걸어서 통과", () =>
  walkCase("p0", { selfA: false, gone: false, expectSprite: true,
    shots: ["gymdoor-0818-1-출발.png", "gymdoor-0818-2-경호칸.png", "gymdoor-0818-3-체육관.png"] }));

await section("② 말 걸어 끝낸 뒤(p1, 셀프스위치 A) — 정상 플레이 상태", () =>
  walkCase("p1", { selfA: true, gone: false, expectSprite: true }));

await section("③ 배틀 후(p2, 스위치 95) — 경호가 사라진 뒤에도 길이 열려 있다", () =>
  walkCase("p2", { selfA: true, gone: true, expectSprite: false }));

console.log("\n" + (errors.length ? `콘솔에러 ${errors.length}건:\n` + errors.join("\n") : "콘솔에러 없음"));
console.log(fail ? `\n❌ 실패 ${fail}건` : "\n✅ 전부 통과");
console.log(`캡처: ${OUT}`);
await browser.close();
process.exit(fail ? 1 : 0);
