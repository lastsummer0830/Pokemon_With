// 0818 — 상록시티 경호(AR Map56 EV014) 말 걸기 스토리 이벤트 회귀 테스트.
//  사용: node tools/dbg-kyungho-0818.mjs      (myPokemon_AJ/ 에서 실행 — 캡처 경로는 CWD와 무관)
//  ⚠️ dev 서버(http://localhost:5180)는 **밖에서 이미 떠 있어야 한다** — 이 스크립트는 서버를 켜지도 끄지도 않는다.
//
// ── 무엇을 고정하는가 ─────────────────────────────────────────────────────
//  원본 EV014는 페이지 3장이고, 추출기(extract-events.py)가 207·106·111/411·배틀을 못 옮겨
//  두 페이지가 `partial: true`로 **꺼져 있었다**(activePage가 건너뜀). 0818에 손으로 옮겼다.
//   p0(조건 없음)  : "!"(원본 애니 3번) → "거기 너!" → 주인공 "?"(4번) → 대기 → 대사 2줄 → 선택지 2갈래 → 셀프스위치 A
//   p1(셀프스위치A): "22번 트레이너들을 모두 이기고 왔니?" → 스위치 87~90이 **모두** 켜졌으면 CAMPER:경호 배틀,
//                    아니면 "트레이너들을 모두 쓰러뜨리고 다시 오렴." (22번도로 미이식 → 정상 플레이는 늘 이쪽)
//   p2(스위치95)   : 그림 없음 = 배틀에서 이기면 사라진다
//
// ── 원본과 일부러 다르게 한 것(여기서 못박는다) ─────────────────────────────
//  · 원본 207의 대상은 이벤트 [13]이다. 13번은 뱃지 획득 뒤에만 보이는 **다른 칸(37,10)의 이벤트**라
//    지금은 보이지도 않는다 → 아일라(EV10)가 자기 id를 쓰는 것으로 보아 작성자 번호 실수로 판단하고
//    경호 자신에게 띄웠다. 사용자가 원본대로 (37,10)에 띄우기로 정하면 이 기대값을 바꿔야 한다.
//  · 배틀 뒤 223(화면 색조 2회)은 안 옮겼다 — 암전 없이 바로 사라진다.
//  · ⭐ **경호가 칸을 막지 않게 했다(page.through)**. 원본에서 그는 상록체육관 문(35,9) 앞 (35,10)에 선
//    **문지기**이고 (35,9)로 가는 칸은 (35,10) 하나뿐이다. 22번도로를 아직 안 이식해 그를 이길 수 없으므로
//    원본대로 막으면 체육관·소개장·배지가 영구 도달 불가가 된다. 22번도로가 들어오면 through를 지운다.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));   // <repo>/myPokemon_AJ/tools
const OUT = path.resolve(HERE, "../../.claude/.verify");     // <repo>/.claude/.verify
fs.mkdirSync(OUT, { recursive: true });

const MAP = "viridian_city";        // region.ts: ox=0, oy=0 → 이 맵만은 로컬 좌표 = 글로벌 좌표
const EV_ID = 14;
const EV_TILE = [35, 10];           // 원본 EV014 자리
const SPAWN = [35, 11];             // 바로 아래 칸(blocked=0 실측) — 위를 보면 경호에게 말이 걸린다
const TRAINER_ID = "CAMPER:경호";   // trainers.json 정의 키
const GATE_SWITCHES = [87, 88, 89, 90];   // 원본이 묻는 22번도로 트레이너 격파 스위치
const GONE_SWITCH = 95;             // 켜지면 p2(빈 페이지)로 넘어가 사라진다
const SELF_KEY = `${MAP}:${EV_ID}:A`;
const WORLD_DATA = { map: MAP, spawn: SPAWN, face: "up", testParty: true };
const ENTRY_WAIT = 20000;           // headless swiftshader에서 캐릭터 시트가 늦게 올라온다(bounded)

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
  try { await fn(); }
  catch (e) { fail++; console.log(`  ❌ 이 구간이 끊겼다(다음 구간은 계속한다): ${e?.message ?? e}`); }
};
const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const until = async (fn, arg, timeout = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; }
  catch { return false; }
};
const sceneActive = (key, timeout = 15000) => until((k) => {
  const s = window.__game.scene.getScene(k);
  return !!s && s.scene.isActive() && s.sys.settings.status === 5;
}, key, timeout);
const inBattle = () => page.evaluate(() => {
  const b = window.__game.scene.getScene("BattleScene");
  return !!b && b.scene.isActive();
});
/** 씬 전환은 Game SceneManager로 직접 건다(getScenes(true)[0]은 전환 중 undefined가 된다). */
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
/** WorldScene을 항상 같은 spawn으로 시작하고 경호 sprite가 올라오기를 기다린다. */
const goWorld = async (extra = {}) => {
  await startScene("WorldScene", { ...WORLD_DATA, ...extra });
  const okScene = await sceneActive("WorldScene");
  ok(okScene, `WorldScene이 ${MAP} (${SPAWN})에서 떴다`);
  if (!okScene) return false;
  const hasSprite = await until(([map, id]) => {
    const s = window.__game.scene.getScene("WorldScene");
    const e = (s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
    return !!e?.sprite;
  }, [MAP, EV_ID], ENTRY_WAIT);
  ok(hasSprite, "경호 sprite가 화면에 올라와 있다");
  return hasSprite;
};
const worldState = () => page.evaluate(([map, id, selfKey, goneSw, tile]) => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  const e = (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  return {
    tx: s.tx, ty: s.ty, busy: !!s.busy,
    ev: e ? { gx: e.gx, gy: e.gy, sprite: !!e.sprite } : null,
    tileBlocked: s.blocked?.[tile[1]]?.[tile[0]] === 1,
    selfA: !!(window.__game.registry.get("eventSelfSwitches") ?? {})[selfKey],
    gone: !!(window.__game.registry.get("arSwitches") ?? {})[goneSw],
  };
}, [MAP, EV_ID, SELF_KEY, GONE_SWITCH, EV_TILE]);
const dialogState = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  const d = s.dlg;
  return {
    visible: !!d?.visible,
    text: d?.boxText?.text ?? "",
    speaker: d?.speaker ?? null,
    nameShown: !!d?.nameTag?.visible,
    nameText: d?.nameTag?.text ?? "",
    // 선택지 메뉴가 떠 있는가 — askChoice가 만드는 커서 "▶"(depth 1004)로 판정한다.
    choiceOpen: (s.children?.list ?? []).some((o) => o.type === "Text" && o.text === "▶"),
    choiceRows: (s.children?.list ?? [])
      .filter((o) => o.type === "Text" && o.depth === 1004 && o.text !== "▶").map((o) => o.text),
  };
});
/** 대사창에 이 줄이 올라올 때까지 확인키로 넘긴다(타자 중이면 앞부분과 일치한다). */
const advanceToLine = async (want, tries = 14) => {
  for (let i = 0; i < tries; i++) {
    const st = await dialogState();
    if (st?.visible && (st.text === want || (want.startsWith(st.text) && st.text.length > 0))) return st;
    if (st?.choiceOpen) break;   // 선택지가 떴으면 확인키는 '고르기'가 된다 — 여기서 멈춘다
    await press("c", 300);
  }
  return await dialogState();
};
/**
 * 머리 위 말풍선("!"·"?")이 **뜬 순서와 위치**를 매 프레임 담는 래치.
 *  showEmote는 560ms 뒤 지운다 → evaluate 폴링으로는 놓친다. depth 6.5 Text만 본다.
 *  y는 화면좌표다 — 경호(35,10)는 플레이어(35,11)보다 **한 칸 위**라 y가 더 작아야 한다.
 */
const startEmoteLatch = () => page.evaluate(() => {
  window.__emoteLatch?.stop?.();
  const g = window.__game;
  const L = { marks: [], running: true, raf: 0 };
  L.stop = () => { L.running = false; if (L.raf) cancelAnimationFrame(L.raf); L.raf = 0; };
  const tick = () => {
    if (!L.running) return;
    const s = g.scene.getScene("WorldScene");
    if (s && s.scene.isActive()) {
      for (const o of s.children.list) {
        if (o.type !== "Text" || o.depth !== 6.5) continue;
        if (o.text !== "!" && o.text !== "?") continue;
        if (L.marks.some((m) => m.obj === o)) continue;
        L.marks.push({ obj: o, glyph: o.text, x: Math.round(o.x), y: Math.round(o.y) });
      }
    }
    L.raf = requestAnimationFrame(tick);
  };
  window.__emoteLatch = L;
  L.raf = requestAnimationFrame(tick);
});
const readEmoteLatch = () => page.evaluate(() => (window.__emoteLatch?.marks ?? [])
  .map((m) => ({ glyph: m.glyph, x: m.x, y: m.y })));
const stopEmoteLatch = () => page.evaluate(() => {
  const L = window.__emoteLatch;
  if (!L) return [];
  L.stop();
  return L.marks.map((m) => ({ glyph: m.glyph, x: m.x, y: m.y }));
});
/**
 * 이어실행 경로를 **지금 데이터에서** 계산한다 — 상수로 박지 않는다.
 * 경호의 배틀은 페이지 본문이 아니라 **조건분기 안**이라 경로가 세 칸이다:
 *   `[분기줄, 갈래(0=then·1=else), 그 갈래의 배틀 다음 줄]` = 경호는 `[1, 0, 3]`.
 * 갈래 번호가 경로에 들어가는 게 중요하다 — 이어실행이 조건을 다시 보지 않아야 스위치가 달라져도 안 엉킨다.
 */
const computeResumePath = () => page.evaluate(([map, id]) => {
  const g = window.__game;
  const s = g.scene.getScene("WorldScene");
  const live = s && s.scene.isActive()
    ? (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id)
    : null;
  const pages = live?.ev?.pages
    ?? g.cache.json.get(`${map}_events`)?.events?.find((e) => e.id === id)?.pages
    ?? [];
  for (let pi = 0; pi < pages.length; pi++) {
    const lines = pages[pi].lines ?? [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].battle) return { pi, path: [i + 1], trainerId: lines[i].battle };
      for (const [branch, inner] of [[0, lines[i].then ?? []], [1, lines[i].else ?? []]]) {
        const j = inner.findIndex((l) => l.battle);
        if (j >= 0) return { pi, path: [i, branch, j + 1], trainerId: inner[j].battle };
      }
    }
  }
  return { pi: -1, path: null, trainerId: null };
}, [MAP, EV_ID]);
/** 결정론 초기화 — 셀프스위치·전역 스위치·이어실행 예약을 전부 비운다. */
const resetSwitches = (on = []) => page.evaluate(([sw]) => {
  const g = window.__game;
  g.registry.set("eventSelfSwitches", {});
  const m = {};
  for (const s of sw) m[s] = true;
  g.registry.set("arSwitches", m);
  g.registry.remove("eventContinue");
}, [on]);

// ── 0. 부팅 + 테스트 파티 ────────────────────────────────────────────────
try {
  await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
} catch {
  console.log("❌ dev 서버(http://localhost:5180)에 못 붙었다 — `npm run dev`를 먼저 띄워라.");
  await browser.close();
  process.exit(1);
}
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

await section("0. 결정론 초기화와 테스트 파티", async () => {
  // 파티는 DebugMenu의 "E. 1번도로"(testParty)로 채운다 — 상록시티 바로가기를 쓰면 아일라 자동실행이 걸린다.
  await startScene("DebugMenuScene");
  ok(await sceneActive("DebugMenuScene"), "DebugMenuScene 진입(파티 채우기용)");
  await press("e", 500);
  const hasParty = await until(() => (window.__game.registry.get("playerParty") ?? []).length >= 1, undefined, 10000);
  const partyN = await page.evaluate(() => (window.__game.registry.get("playerParty") ?? []).length);
  ok(hasParty && partyN >= 1, `테스트 파티 준비(${partyN}마리)`);
  await page.evaluate(() => {
    const g = window.__game;
    g.registry.set("playerName", "테스트");
    g.registry.set("playerGender", "boy");
  });
  await resetSwitches();
  const clean = await page.evaluate(() =>
    Object.keys(window.__game.registry.get("eventSelfSwitches") ?? {}).length === 0
    && Object.keys(window.__game.registry.get("arSwitches") ?? {}).length === 0);
  ok(clean, "셀프스위치·전역 스위치가 전부 꺼진 상태에서 시작한다");
  // 트레이너 정의가 실제로 있는가(없으면 배틀 구간이 통째로 무의미해진다).
  //  AR DB는 Phaser 로더가 아니라 fetch로 읽어 모듈 안에 두므로(src/data/ar/index.ts) 캐시에 없다 → 같은 파일을 직접 읽는다.
  const hasDef = await page.evaluate(async (id) => {
    const t = await (await fetch("assets/data/ar/trainers.json")).json();
    return !!(t?.defs ?? {})[id];
  }, TRAINER_ID);
  ok(hasDef, `trainers.json에 "${TRAINER_ID}" 정의가 있다`);
});

// ── 1. 첫 페이지 — "!" → 대사 → 주인공 "?" → 선택지 ─────────────────────
let resume = null;
await section('1. p0: "!"·"?" 말풍선과 선택지 2갈래', async () => {
  if (!(await goWorld())) return;
  resume = await computeResumePath();
  ok(resume.path !== null && resume.trainerId === TRAINER_ID,
    `배틀 줄을 데이터에서 찾았다 → 이어실행 경로 [${resume.path}] (트레이너 ${resume.trainerId})`);

  const before = await worldState();
  ok(!!before?.ev && before.ev.gx === EV_TILE[0] && before.ev.gy === EV_TILE[1],
    `경호는 원본 자리 (${EV_TILE})에 서 있다 (받은 값: ${before?.ev ? [before.ev.gx, before.ev.gy] : "없음"})`);
  ok(before?.tx === SPAWN[0] && before?.ty === SPAWN[1],
    `플레이어가 (${SPAWN})에 서 있다 (받은 값: ${[before?.tx, before?.ty]})`);
  // ⛔ 원본과 다르게 **막지 않는다**(page.through) — 안 그러면 체육관 문이 영구히 닫힌다.
  ok(before?.tileBlocked === false, `경호가 선 칸 (${EV_TILE})은 막히지 않았다(through)`);
  const gym = await page.evaluate(() => {
    const s = window.__game.scene.getScene("WorldScene");
    const w = (s.warpDefs ?? []).find((x) => x.to === "gym");
    return { warp: w ? [w.x, w.y] : null, doorOk: s.walkable(35, 9), frontOk: s.walkable(35, 10) };
  });
  ok(gym.frontOk === true && gym.doorOk === true,
    `상록체육관 문 앞(35,10)과 문(35,9)이 둘 다 지나갈 수 있다 — 체육관이 막히지 않았다 (받은 값: ${JSON.stringify(gym)})`);

  await startEmoteLatch();
  try {
    await press("c", 500);   // 말 걸기
    const first = await advanceToLine("거기 너!");
    ok(!!first?.visible && "거기 너!".startsWith(first.text) && first.text.length > 0,
      `첫 대사 "거기 너!"가 떴다 (받은 값: "${first?.text ?? "대사창 없음"}")`);
    ok(first?.speaker === "경호" && first?.nameShown && first?.nameText === "경호",
      `이름창에 "경호"가 뜬다 (speaker=${JSON.stringify(first?.speaker)}, 이름창="${first?.nameText}")`);

    // "!"는 대사보다 먼저, "?"는 그 대사 뒤에 뜬다 → 다음 줄로 넘겨 "?"까지 잡는다.
    const second = await advanceToLine("상록체육관 관장은 강하다고!");
    ok(!!second?.visible && "상록체육관 관장은 강하다고!".startsWith(second.text) && second.text.length > 0,
      `두 번째 대사가 떴다 (받은 값: "${second?.text ?? "대사창 없음"}")`);

    const marks = await readEmoteLatch();
    const glyphs = marks.map((m) => m.glyph);
    ok(glyphs[0] === "!", `첫 말풍선이 "!"다 (받은 순서: ${JSON.stringify(glyphs)})`);
    ok(glyphs[1] === "?", `두 번째 말풍선이 주인공 "?"다 (받은 순서: ${JSON.stringify(glyphs)})`);
    const bang = marks.find((m) => m.glyph === "!");
    const q = marks.find((m) => m.glyph === "?");
    ok(!!bang && !!q && bang.y < q.y,
      `"!"는 경호(위 칸) 머리 위, "?"는 주인공(아래 칸) 머리 위다 — y: ! ${bang?.y} < ? ${q?.y}`);

    // 선택지 — 2개가 뜨고, 아래쪽(다른 용무)을 고르면 마지막에 한 줄이 더 붙는다.
    const atChoice = await advanceToLine("도전할 생각이야?");
    ok(!!atChoice?.visible, "선택지 앞 대사 \"도전할 생각이야?\"까지 왔다");
    await press("c", 500);
    const ch = await dialogState();
    ok(ch?.choiceOpen && ch.choiceRows.length === 2,
      `선택지 2개가 떴다 (받은 값: ${JSON.stringify(ch?.choiceRows)})`);
    await press("ArrowDown", 200);
    await press("c", 400);   // "다른 용무로 왔어요." 갈래
    const extra = await advanceToLine("(다른 용무라니까..)");
    ok(!!extra?.visible && "(다른 용무라니까..)".startsWith(extra.text) && extra.text.length > 0,
      `아래 갈래에만 있는 마지막 줄이 떴다 (받은 값: "${extra?.text ?? "대사창 없음"}")`);
    ok(extra?.speaker === "테스트",
      `그 줄의 이름창은 주인공 이름이다({PLAYER} 치환 — 받은 값: ${JSON.stringify(extra?.speaker)})`);
  } finally {
    await stopEmoteLatch();
  }

  await snap(page, path.join(OUT, "kyungho-0818-p0.png"));
  // 남은 대사를 확인키로 끝까지 넘긴 **뒤에** 셀프스위치 A와 busy를 본다
  //  (마지막 줄이 떠 있는 동안은 busy가 켜진 채로 있는 게 정상이다).
  for (let i = 0; i < 8; i++) {
    const st = await worldState();
    if (st && !st.busy && st.selfA) break;
    await press("c", 300);
  }
  const after = await worldState();
  ok(after?.busy === false, "대화가 끝나고 busy가 풀렸다(플레이어가 다시 움직일 수 있다)");
  ok(after?.selfA === true, "셀프스위치 A가 켜졌다 → 다음부터 두 번째 페이지다");
  ok(after?.ev?.sprite === true, "경호는 아직 그 자리에 있다(두 번째 페이지에도 그림이 있다)");
});

// ── 2. 두 번째 페이지 — 스위치 87~90이 꺼져 있으면 배틀이 없다 ──────────────
await section("2. p1 else 갈래: 스위치가 꺼져 있으면 배틀 없음", async () => {
  const st = await worldState();
  ok(st?.selfA === true, "앞 구간에서 켠 셀프스위치 A가 유지된다");
  await press("c", 500);
  const first = await advanceToLine("22번 트레이너들을 모두 이기고 왔니?");
  ok(!!first?.visible && "22번 트레이너들을 모두 이기고 왔니?".startsWith(first.text) && first.text.length > 0,
    `두 번째 페이지 첫 대사가 떴다 (받은 값: "${first?.text ?? "대사창 없음"}")`);
  const els = await advanceToLine("트레이너들을 모두 쓰러뜨리고 다시 오렴.");
  ok(!!els?.visible && "트레이너들을 모두 쓰러뜨리고 다시 오렴.".startsWith(els.text) && els.text.length > 0,
    `else 갈래 대사가 떴다 (받은 값: "${els?.text ?? "대사창 없음"}")`);
  // 여기서 배틀로 넘어가면 안 된다(원본도 스위치 4개가 다 켜져야 싸운다).
  for (let i = 0; i < 5; i++) await press("c", 300);
  ok((await inBattle()) === false, "배틀로 넘어가지 않았다");
  const gone = await page.evaluate(([sw]) =>
    !!(window.__game.registry.get("arSwitches") ?? {})[sw], [GONE_SWITCH]);
  ok(gone === false, `${GONE_SWITCH}번 스위치도 안 켜졌다(경호가 사라지지 않는다)`);
  const st2 = await worldState();
  ok(st2?.ev?.sprite === true, "경호가 아직 서 있다 → 22번도로를 이식하면 그때 배틀이 열린다");
});

// ── 3. 스위치 87~90을 켜면 배틀 갈래로 들어간다 ───────────────────────────
await section("3. p1 then 갈래: 스위치를 켜면 CAMPER:경호 배틀", async () => {
  await resetSwitches(GATE_SWITCHES);
  // 셀프스위치를 비웠으니 p0부터 다시 — 한 번 말 걸어 A를 켠다.
  if (!(await goWorld({ debugArSwitches: GATE_SWITCHES }))) return;
  await press("c", 500);
  for (let i = 0; i < 14; i++) {
    const st = await dialogState();
    if (st?.choiceOpen) { await press("c", 400); continue; }   // 위쪽("맞아요") 갈래
    if (!st?.visible && (await worldState())?.selfA) break;
    await press("c", 300);
  }
  const mid = await worldState();
  ok(mid?.selfA === true, "p0을 한 번 돌려 셀프스위치 A를 켰다");

  // 두 번째 말 걸기 = p1 then 갈래 → 배틀
  await press("c", 500);
  const good = await advanceToLine("그래? 잘 됐네!");
  ok(!!good?.visible && "그래? 잘 됐네!".startsWith(good.text) && good.text.length > 0,
    `then 갈래 대사가 떴다 (받은 값: "${good?.text ?? "대사창 없음"}")`);
  const last = await advanceToLine("그럼 마지막 배틀은 바로 나야!");
  ok(!!last?.visible, "배틀 직전 대사까지 왔다");

  for (let i = 0; i < 10 && !(await inBattle()); i++) await press("c", 350);
  const battling = await inBattle();
  ok(battling, "BattleScene으로 넘어갔다");
  const got = await page.evaluate(() => {
    const b = window.__game.scene.getScene("BattleScene");
    const c = window.__game.registry.get("eventContinue");
    return { trainerId: b?.initData?.trainerId ?? b?.trainerId ?? null, cont: c ?? null };
  });
  ok(got.trainerId === TRAINER_ID,
    `배틀 상대가 "${TRAINER_ID}"다 (받은 값: ${JSON.stringify(got.trainerId)})`);
  ok(!!got.cont && got.cont.evId === EV_ID && JSON.stringify(got.cont.resumeAt) === JSON.stringify(resume?.path),
    `이어실행 예약이 조건분기 안쪽 경로다 — 기대 [${resume?.path}], 받은 값 ${JSON.stringify(got.cont?.resumeAt ?? null)}`);
  if (battling) await snap(page, path.join(OUT, "kyungho-0818-battle.png"));
});

// ── 4. 이기고 돌아오면 이어서 실행 → 95번 스위치 → 경호가 사라진다 ──────────
await section("4. 승리 이어실행: 남은 대사 → 95번 스위치 → 사라짐", async () => {
  // 실제 배틀 승리는 난수에 걸린다 → BattleScene이 승리 시 하는 것(예약을 남긴 채 WorldScene 복귀)만 재현한다.
  //  예약 경로는 3번에서 데이터로 계산한 값 그대로다(상수 아님).
  if (!resume?.path) { ok(false, "이어실행 경로를 못 구해 이 구간을 돌 수 없다"); return; }
  await page.evaluate(([sw, selfKey, cont]) => {
    const g = window.__game;
    const m = {};
    for (const s of sw) m[s] = true;
    g.registry.set("arSwitches", m);                       // 87~90 켜진 상태 유지(then 갈래로 다시 들어가야 한다)
    g.registry.set("eventSelfSwitches", { [selfKey]: true });   // p1이 활성이어야 한다
    g.registry.set("eventContinue", cont);
  }, [GATE_SWITCHES, SELF_KEY, { map: MAP, evId: EV_ID, resumeAt: resume.path }]);
  if (!(await goWorld({ debugArSwitches: GATE_SWITCHES }))) return;

  const started = await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && !!s.busy;
  }, undefined, 12000);
  ok(started, "이어실행이 스스로 시작했다(busy가 켜졌다 — 말 걸지 않았다)");
  const resumed = await advanceToLine("... 뭐? 체육관에 도전하러 온 게 아니라고?");
  ok(!!resumed?.visible && "... 뭐? 체육관에 도전하러 온 게 아니라고?".startsWith(resumed.text) && resumed.text.length > 0,
    `배틀 **다음 줄**부터 이어졌다 (받은 값: "${resumed?.text ?? "대사창 없음"}")`);
  for (let i = 0; i < 10; i++) {
    const st = await worldState();
    if (st && !st.busy && st.gone) break;
    await press("c", 350);
  }
  const end = await worldState();
  ok(end?.gone === true, `${GONE_SWITCH}번 스위치가 켜졌다`);
  ok(end?.ev === null, "경호가 events2에서 빠졌다(그림 없는 p2로 넘어갔다)");
  ok(end?.tileBlocked === false, `경호가 섰던 칸 (${EV_TILE})이 다시 열렸다`);
  ok(end?.busy === false, "busy가 풀렸다");
  await snap(page, path.join(OUT, "kyungho-0818-after.png"));
});

// ── 5. 패배 재도전 — 예약이 없으면 처음부터 다시 걸린다 ─────────────────────
await section("5. 패배 재도전: 셀프스위치 A는 그대로, 95번은 꺼진 채", async () => {
  // BattleScene은 패배 경로에서 eventContinue를 지운다 → 95번이 안 켜지고 p1이 그대로 남는다.
  await page.evaluate(([sw, selfKey]) => {
    const g = window.__game;
    const m = {};
    for (const s of sw) m[s] = true;
    g.registry.set("arSwitches", m);
    g.registry.set("eventSelfSwitches", { [selfKey]: true });
    g.registry.remove("eventContinue");
  }, [GATE_SWITCHES, SELF_KEY]);
  if (!(await goWorld({ debugArSwitches: GATE_SWITCHES }))) return;
  const st = await worldState();
  ok(st?.ev?.sprite === true, "경호가 다시 그 자리에 있다");
  ok(st?.busy === false, "말 걸기 이벤트라 저절로 시작하지 않는다");
  await press("c", 500);
  const again = await advanceToLine("22번 트레이너들을 모두 이기고 왔니?");
  ok(!!again?.visible && "22번 트레이너들을 모두 이기고 왔니?".startsWith(again.text) && again.text.length > 0,
    `p1이 처음부터 다시 돈다 = 재도전 가능 (받은 값: "${again?.text ?? "대사창 없음"}")`);
});

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(`\n캡처: ${OUT}/kyungho-0818-*.png`);
console.log(fail === 0 ? "\n✅ 전부 통과" : `\n❌ 실패 ${fail}건`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
