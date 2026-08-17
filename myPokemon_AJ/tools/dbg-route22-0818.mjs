// 0818 — 22번도로(AR Map49) A단계: 상록시티 서쪽으로 **걸어서** 넘어가고 되돌아오는지.
//  사용: node tools/dbg-route22-0818.mjs      (myPokemon_AJ/ 에서 실행)
//  ⚠️ dev 서버는 밖에서 이미 떠 있어야 한다 — 켜지도 끄지도 않는다. 기본 주소는 http://localhost:5180.
//  ⚠️ **오래 떠 있던 dev 서버는 새로 만든 public/assets 파일을 못 준다**(index.html로 폴백한다 →
//     "Unexpected token '<'" 콘솔에러 무더기). 맵·오디오를 새로 뽑았으면 dev 서버를 껐다 켤 것.
//     다른 포트로 확인하려면 DEV_URL=http://localhost:5181 node tools/dbg-route22-0818.mjs
//
// 무엇을 고정하는가:
//  · 원본 map_connections.dat `[56,'W',0, 49,'E',0]` → region.ts에서 route22 ox=0, 나머지 셋 ox=58.
//    **글로벌 좌표가 전부 +58 밀렸다** — 세이브는 맵이름+로컬좌표라 안 깨져야 한다(여기서 확인한다).
//  · 걸어서 넘을 수 있는 경계는 **행 16~19(도로)뿐**이다. 우리 격자로 BFS한 결과이고
//    verify-passability.py가 원본 규칙과 460칸 일치를 확인했다. 행 17로 넘고, 행 24는 막힌 것을 확인한다.
//  · 맵이 바뀌면 BGM이 bgm_viridian → bgm_route3(원본 Map49 @bgm = KM_Route3)로 바뀐다.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });

const ROAD_ROW = 17;      // 걸어서 넘는 도로 행(로컬 y = 글로벌 y, 두 맵 다 oy=0)
const WALL_ROW = 24;      // 같은 서쪽 변인데 막혀 있는 행 — 차단도 확인해야 한다
const START_X = 3;        // 상록시티 로컬 x (서쪽 변에서 세 칸)
const GLOBAL_SEAM = 58;   // 상록시티 x=0 의 글로벌 x. 그 왼쪽(57)이 22번도로 동쪽 끝
const DEV_URL = process.env.DEV_URL ?? "http://localhost:5180";

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
const sceneActive = (key, timeout = 20000) => until((k) => {
  const s = window.__game.scene.getScene(k);
  return !!s && s.scene.isActive() && s.sys.settings.status === 5;
}, key, timeout);

const startScene = async (key, data) => {
  await until(() => window.__game.scene.getScenes(true).length > 0, undefined, 20000);
  await page.evaluate(([k, d]) => {
    const g = window.__game;
    g.scene.scenes.forEach((s) => {
      if (s.scene.key !== k && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
    });
    g.scene.start(k, d);
  }, [key, data]);
};

/** 지금 서 있는 곳 — 글로벌 좌표와 "어느 맵인지"를 함께 본다(좌표계 착각 방지). */
const where = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  return {
    gx: s.tx, gy: s.ty, moving: !!s.moving, busy: !!s.busy,
    map: s.curMap?.name ?? null, label: s.curMap?.label ?? null, bgm: s.curMap?.bgm ?? null,
    cols: s.cols, rows: s.rows,
  };
});

/** 한 칸 걷기 — update()가 isDown을 보므로 눌렀다 떼고 이동 종료를 기다린다. */
const step = async (key) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !s || !s.scene.isActive() || !s.moving;
  }, undefined, 5000);
  await page.waitForTimeout(100);
};

await page.goto(DEV_URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 20000 });

await section("① 리전이 넓어졌다 — 글로벌 좌표가 +58 밀렸는지", async () => {
  await startScene("WorldScene", { map: "viridian_city", spawn: [START_X, ROAD_ROW], face: "left", testParty: true });
  ok(await sceneActive("WorldScene"), "WorldScene이 상록시티에서 떴다");
  const w = await where();
  ok(w?.cols === 110 && w?.rows === 100, `리전 크기 ${w?.cols}x${w?.rows} (기대 110x100 — 22번도로 58칸이 왼쪽에 붙었다)`);
  ok(w?.gx === GLOBAL_SEAM + START_X && w?.gy === ROAD_ROW,
    `상록시티 로컬(${START_X},${ROAD_ROW}) → 글로벌(${w?.gx},${w?.gy}) (기대 ${GLOBAL_SEAM + START_X},${ROAD_ROW})`);
  ok(w?.map === "viridian_city" && w?.bgm === "bgm_viridian", `지금 맵=${w?.label}(${w?.map}) BGM=${w?.bgm}`);
});

await section("② 서쪽으로 걸어서 22번도로로 넘어간다(도로 행 17)", async () => {
  for (let i = 0; i < 5; i++) await step("ArrowLeft");     // x 61 → 56 (경계 58/57을 지난다)
  const w = await where();
  ok(w?.map === "route22", `⭐ 맵이 바뀌었다 — ${w?.label}(${w?.map}) 글로벌(${w?.gx},${w?.gy})`);
  ok(w?.gx < GLOBAL_SEAM, `글로벌 x=${w?.gx} < ${GLOBAL_SEAM} = 22번도로 영역이다`);
  ok(w?.bgm === "bgm_route3", `BGM이 22번도로 곡으로 바뀌었다 — ${w?.bgm} (원본 Map49 @bgm = KM_Route3)`);
  await snap(page, path.join(OUT, "route22-0818-1-넘어온직후.png"));
});

// ⭐ 도로 행 17은 **x=52까지만** 이어지고 x=51·50은 원본에서 벽이다(route22.json 실측
//    row17 x50..57 = 1,1,0,0,0,0,0,0). 그래서 "왼쪽으로 계속 가면 어디서 멈추나"가
//    맵이 제대로 붙었는지 보는 검사가 된다 — 더 가면 격자가 틀린 것이다.
const ROAD_WALL_X = 51;   // 22번도로 로컬 x = 글로벌 x (route22는 ox=0)
await section("③ 22번도로 안쪽으로 더 걸어 들어간다 — 원본 벽에서 정확히 멈춘다", async () => {
  for (let i = 0; i < 6; i++) await step("ArrowLeft");
  const w = await where();
  ok(w?.map === "route22", `아직 22번도로다 — 글로벌(${w?.gx},${w?.gy})`);
  ok(w?.gx === ROAD_WALL_X + 1,
    `원본 벽 앞 x=${ROAD_WALL_X + 1}에서 멈췄다 — 받은 값 ${w?.gx} (x=${ROAD_WALL_X}부터 벽)`);
  const wallOk = await page.evaluate(([x, y]) => {
    const s = window.__game.scene.getScene("WorldScene");
    return { wall: s.walkable(x, y), open: s.walkable(x + 1, y) };
  }, [ROAD_WALL_X, ROAD_ROW]);
  ok(wallOk.wall === false && wallOk.open === true,
    `벽(${ROAD_WALL_X},${ROAD_ROW})=막힘 · 그 앞(${ROAD_WALL_X + 1},${ROAD_ROW})=열림 (받은 값 ${JSON.stringify(wallOk)})`);
  await snap(page, path.join(OUT, "route22-0818-2-도로안쪽.png"));
});

await section("④ 되돌아 상록시티로 나온다(왕복이 되는지)", async () => {
  for (let i = 0; i < 12; i++) await step("ArrowRight");
  const w = await where();
  ok(w?.map === "viridian_city", `상록시티로 돌아왔다 — ${w?.label}(${w?.map}) 글로벌(${w?.gx},${w?.gy})`);
  ok(w?.bgm === "bgm_viridian", `BGM도 상록시티로 돌아왔다 — ${w?.bgm}`);
});

await section("⑤ 막힌 행(24)에서는 못 넘는다 — 통과 칸만 열려 있는지", async () => {
  await startScene("WorldScene", { map: "viridian_city", spawn: [1, WALL_ROW], face: "left", testParty: true });
  ok(await sceneActive("WorldScene"), `상록시티 로컬(1,${WALL_ROW})에서 다시 떴다`);
  const before = await where();
  for (let i = 0; i < 3; i++) await step("ArrowLeft");
  const after = await where();
  ok(after?.map === "viridian_city" && after.gx >= GLOBAL_SEAM,
    `행 ${WALL_ROW}에서는 벽에 막혀 못 넘는다 — (${before?.gx},${before?.gy}) → (${after?.gx},${after?.gy})`);
  await snap(page, path.join(OUT, "route22-0818-3-막힌행.png"));
});

await section("⑥ 기존 세이브 호환 — 맵이름+로컬좌표라 오프셋이 밀려도 같은 자리", async () => {
  // 세이브가 들고 있는 것은 {map:"viridian_city", tx,ty}(로컬)다. 그것으로 되살리면
  // 오프셋이 바뀐 뒤에도 같은 로컬 칸에 서야 한다 — 안 그러면 기존 세이브가 벽 속에서 시작한다.
  const loc = { map: "viridian_city", tx: 35, ty: 11 };   // 경호 아래 칸
  await startScene("WorldScene", { map: loc.map, spawn: [loc.tx, loc.ty], face: "up", testParty: true });
  ok(await sceneActive("WorldScene"), "세이브 좌표로 WorldScene이 떴다");
  const w = await where();
  ok(w?.map === "viridian_city" && w?.gx === GLOBAL_SEAM + loc.tx && w?.gy === loc.ty,
    `로컬(${loc.tx},${loc.ty}) → 글로벌(${w?.gx},${w?.gy}) = 같은 자리(오프셋만 +58)`);
  const walkable = await page.evaluate(([gx, gy]) => {
    const s = window.__game.scene.getScene("WorldScene");
    return s.walkable(gx, gy);
  }, [GLOBAL_SEAM + loc.tx, loc.ty]);
  ok(walkable === true, "그 칸이 여전히 지나갈 수 있는 칸이다(벽 속에서 시작하지 않는다)");
});

console.log("\n" + (errors.length ? `콘솔에러 ${errors.length}건:\n` + errors.join("\n") : "콘솔에러 없음"));
console.log(fail ? `\n❌ 실패 ${fail}건` : "\n✅ 전부 통과");
console.log(`캡처: ${OUT}`);
await browser.close();
process.exit(fail ? 1 : 0);
