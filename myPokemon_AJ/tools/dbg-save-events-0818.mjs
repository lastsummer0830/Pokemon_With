// 0818 — **원본 맵 이벤트 진행이 세이브에 실리는가**(세이브 v6).
//  v5까지는 셀프스위치·전역 스위치가 registry에만 있어서, 저장하고 불러오면
//  아일라·경호·민가2 인형처럼 **한 번 끝낸 이벤트가 원상복구**됐다.
//  사용: node tools/dbg-save-events-0818.mjs   (dev 서버 5180이 이미 떠 있어야 한다)
//
// 흐름은 전부 실제 사용자 경로다:
//   경호에게 말 걸어 셀프스위치 A를 켠다 → Z(메뉴) → 저장 → 커서가 잡아 주는 칸(기본 "세이브 A")
//   → **페이지를 새로 띄운다**(registry가 완전히 비는 유일한 방법) → 불러오기 → 경호에게 다시 말 걸기
//   → p0("거기 너!")가 아니라 **p1("22번 트레이너들을…")**이 나오면 진행이 살아남은 것이다.
import { chromium } from "playwright";

const MAP = "viridian_city";
const EV_ID = 14;
const SPAWN = [35, 11];
const SELF_KEY = `${MAP}:${EV_ID}:A`;
const GATE = [87, 88, 89, 90];
// 저장 슬롯 키를 박지 않는다 — SaveSlotScene 커서는 lastSlot()에서 시작하고,
//  기록이 없으면 그 기본값이 "A"다(auto1이 아니다). 저장 뒤 **실제로 생긴 칸을 찾아** 읽는다.
const SLOT_PREFIX = "myPokemon.save.";
const WORLD_DATA = { map: MAP, spawn: SPAWN, face: "up", testParty: true, debugArSwitches: GATE };
const P0_LINE = "거기 너!";
const P1_LINE = "22번 트레이너들을 모두 이기고 왔니?";

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
const section = async (t, fn) => {
  console.log(`\n── ${t} ──────────────────────────────`);
  try { await fn(); } catch (e) { fail++; console.log(`  ❌ 이 구간이 끊겼다: ${e?.message ?? e}`); }
};
const press = async (k, ms = 300) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const until = async (fn, arg, timeout = 15000) => {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; }
  catch { return false; }
};
const sceneActive = (key, timeout = 15000) => until((k) => {
  const s = window.__game.scene.getScene(k);
  return !!s && s.scene.isActive() && s.sys.settings.status === 5;
}, key, timeout);
const boot = async () => {
  await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
  await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });
};
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
const dialogText = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const d = s?.scene.isActive() ? s.dlg : null;
  return { visible: !!d?.visible, text: d?.boxText?.text ?? "", choiceOpen: (s?.children?.list ?? []).some((o) => o.type === "Text" && o.text === "▶") };
});
const selfA = () => page.evaluate((k) => !!(window.__game.registry.get("eventSelfSwitches") ?? {})[k], SELF_KEY);
/** 지금 존재하는 저장 칸 하나를 {key, data}로 돌려준다(없으면 data=null). */
const readSlot = () => page.evaluate((pre) => {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(pre)) continue;
      const d = JSON.parse(localStorage.getItem(k) ?? "null");
      if (d) return { key: k, data: d };
    }
  } catch { /* noop */ }
  return { key: null, data: null };
}, SLOT_PREFIX);
/** 경호 sprite가 올라오기를 기다린다(headless는 캐릭터 시트가 늦다). */
const waitEv = () => until(([map, id]) => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!(s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id)?.sprite;
}, [MAP, EV_ID], 20000);

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await boot();

// ── 0. 깨끗한 시작 ───────────────────────────────────────────────────────
await section("0. 세이브 슬롯 비우고 테스트 파티 준비", async () => {
  await page.evaluate(() => {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("myPokemon.")) localStorage.removeItem(k); } catch { /* noop */ }
  });
  ok((await readSlot()).data === null, "저장 칸이 전부 비었다");
  await startScene("DebugMenuScene");
  ok(await sceneActive("DebugMenuScene"), "DebugMenuScene 진입(파티 채우기용)");
  await press("e", 900);   // 1번도로 바로가기 = primeDebugRegistry(party)
  const n = await page.evaluate(() => (window.__game.registry.get("playerParty") ?? []).length);
  ok(n >= 1, `테스트 파티 준비(${n}마리)`);
  await page.evaluate(() => {
    const g = window.__game;
    g.registry.set("playerName", "테스트");
    g.registry.set("playerGender", "boy");
    g.registry.set("eventSelfSwitches", {});
    g.registry.set("arSwitches", {});
    g.registry.remove("eventContinue");
  });
});

// ── 1. 경호에게 말 걸어 진행을 만든다 ─────────────────────────────────────
await section("1. 경호 p0을 끝내 셀프스위치 A를 켠다", async () => {
  await startScene("WorldScene", WORLD_DATA);
  ok(await sceneActive("WorldScene"), `WorldScene이 ${MAP} (${SPAWN})에서 떴다`);
  ok(await waitEv(), "경호 sprite가 올라왔다");
  await press("c", 500);
  for (let i = 0; i < 16; i++) {
    if (await selfA()) break;
    await press("c", 300);   // 선택지에서도 확인키 = 첫 항목("맞아요") 선택
  }
  ok(await selfA(), `셀프스위치 "${SELF_KEY}"가 켜졌다`);
  // 확인 항목이 강제로 켠 스위치는 **세이브에 안 실리는 자리**(debugArSwitches)로 간다 —
  //  진짜 자리(arSwitches)에 켜면 확인 항목 한 번 돌린 것이 세이브에 영구히 구워진다.
  const sw = await page.evaluate(() => ({
    real: window.__game.registry.get("arSwitches") ?? {},
    dbg: window.__game.registry.get("debugArSwitches") ?? {},
  }));
  ok(GATE.every((x) => sw.dbg[x] === true), `강제로 켠 ${GATE}는 디버그 자리에 있다 (받은 값: ${JSON.stringify(sw.dbg)})`);
  ok(Object.keys(sw.real).length === 0, `진짜 전역 스위치 자리는 아직 비었다 (받은 값: ${JSON.stringify(sw.real)})`);
});

// ── 2. 실제 메뉴로 저장 → 저장 파일에 두 필드가 실렸는가 ──────────────────
await section("2. Z(메뉴) → 저장 → 저장 파일에 두 필드가 실렸는가", async () => {
  const idle = await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && !s.busy;
  }, undefined, 12000);
  ok(idle, "대화가 끝나 메뉴를 열 수 있다");
  await press("z", 700);
  ok(await sceneActive("MenuScene"), "MenuScene이 열렸다");
  // 하단 바 5칸: 도감·포켓몬·가방·**저장**·설정. 열릴 때 기본 선택은 **1번(포켓몬)**이라 오른쪽 2번이다.
  //  ⚠️ 눈으로 세지 말고 실제 선택 항목을 읽어 확인한 뒤 누른다(3번 눌러 '설정'을 열어 한 번 헛돌았다).
  for (let i = 0; i < 2; i++) await press("ArrowRight", 200);
  const picked = await page.evaluate(() => {
    const m = window.__game.scene.getScene("MenuScene");
    return m?.MAIN_ITEMS?.[m.idx] ?? null;
  });
  ok(picked === "저장", `메뉴에서 "저장"이 선택됐다 (받은 값: ${JSON.stringify(picked)})`);
  await press("c", 900);
  ok(await sceneActive("SaveSlotScene"), "SaveSlotScene(저장 칸 고르기)이 열렸다");
  await press("c", 1800);   // 커서가 잡고 있는 칸에 저장(lastSlot 기본값 = "세이브 A")
  const slot = await readSlot();
  const raw = slot.data;
  ok(!!raw, `저장 파일이 생겼다 (칸: ${slot.key})`);
  ok(raw?.version === 6, `저장 버전이 6이다 (받은 값: ${raw?.version})`);
  ok(!!raw?.eventSelfSwitches && raw.eventSelfSwitches[SELF_KEY] === true,
    `저장 파일에 셀프스위치가 실렸다 (받은 값: ${JSON.stringify(raw?.eventSelfSwitches ?? null)})`);
  ok(!!raw?.arSwitches && typeof raw.arSwitches === "object",
    `저장 파일에 전역 스위치 칸이 있다 (받은 값: ${JSON.stringify(raw?.arSwitches ?? null)})`);
  ok(GATE.every((x) => raw?.arSwitches?.[x] === undefined),
    `⭐ 확인 항목이 강제로 켠 ${GATE}는 저장 파일에 **안 실렸다** (받은 값: ${JSON.stringify(raw?.arSwitches ?? null)})`);
  ok(raw?.loc?.map === MAP && raw?.loc?.tx === SPAWN[0] && raw?.loc?.ty === SPAWN[1],
    `저장 위치가 경호 앞이다 (받은 값: ${JSON.stringify(raw?.loc ?? null)})`);
});

// ── 3. 페이지를 새로 띄워 registry를 완전히 비운 뒤 불러오기 ────────────────
await section("3. 새로 켜서 불러오기 — 경호가 p1부터 시작하는가", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await boot();
  const before = await page.evaluate(() => Object.keys(window.__game.registry.get("eventSelfSwitches") ?? {}).length);
  ok(before === 0, "새로 켠 직후 registry에는 이벤트 진행이 없다(정말 비었다)");

  await startScene("SaveSlotScene", { mode: "load", from: "MainMenuScene" });
  ok(await sceneActive("SaveSlotScene"), "SaveSlotScene(불러오기)이 열렸다");
  await press("c", 2500);   // 첫 칸 = 방금 저장한 자동세이브 1
  ok(await sceneActive("WorldScene", 20000), "불러오기가 WorldScene으로 이어졌다");
  ok(await waitEv(), "경호 sprite가 올라왔다");

  const restored = await page.evaluate(([k, gate]) => {
    const g = window.__game;
    const self = g.registry.get("eventSelfSwitches") ?? {};
    const ar = g.registry.get("arSwitches") ?? {};
    const dbg = g.registry.get("debugArSwitches") ?? {};
    return { selfA: self[k] === true, gate: gate.some((s) => ar[s] === true), self, ar, dbg };
  }, [SELF_KEY, GATE]);
  ok(restored.selfA, `셀프스위치가 되살아났다 (받은 값: ${JSON.stringify(restored.self)})`);
  // 게이트는 확인 항목이 강제로 켠 것이라 **되살아나면 안 된다**(진짜 전역 스위치는 3-1에서 본다).
  ok(restored.gate === false,
    `강제로 켠 게이트는 안 되살아났다 (arSwitches: ${JSON.stringify(restored.ar)}, debug: ${JSON.stringify(restored.dbg)})`);

  const at = await page.evaluate(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return [s.tx, s.ty];
  });
  ok(at[0] === SPAWN[0] && at[1] === SPAWN[1], `저장했던 칸 (${SPAWN})에서 시작한다 (받은 값: ${at})`);

  // ⭐ 진짜 증거 — 말을 걸면 p0이 아니라 p1이 돈다.
  await press("c", 700);
  let got = null;
  for (let i = 0; i < 8; i++) {
    const d = await dialogText();
    if (d.visible && d.text.length > 0) { got = d.text; break; }
    await press("c", 300);
  }
  ok(got !== null && P1_LINE.startsWith(got),
    `p1 대사가 나왔다 = 진행이 살아남았다 (받은 값: "${got}")`);
  ok(!(got !== null && P0_LINE.startsWith(got)),
    `p0 대사("${P0_LINE}")로 되돌아가지 않았다`);
});

// ── 3-1. 게이트가 꺼진 뒤 이어실행해도 then 갈래가 이어진다 + 그 결과가 저장된다 ──────
//  코드리뷰 지적(0818): 이어실행이 조건분기를 **다시 보고** 갈래를 고르면, 배틀 사이에 스위치가
//  달라졌을 때(= 확인 항목을 끄고 다시 들어온 지금이 바로 그 경우다) 엉뚱한 갈래의 그 번째 줄부터
//  돌거나 아무것도 안 돌고 조용히 끝난다 → "이겼는데 뒷대사도 없고 경호도 안 사라진다".
//  경로에 **갈래 번호를 기록**하게 고쳤으므로, 게이트가 꺼진 채로도 then 갈래가 이어져야 한다.
await section("3-1. 게이트 꺼진 채 이어실행 → 95번 스위치 → 저장까지 남는가", async () => {
  const resume = await page.evaluate(([map, id]) => {
    const g = window.__game;
    const s = g.scene.getScene("WorldScene");
    const pages = (s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id)?.ev?.pages
      ?? g.cache.json.get(`${map}_events`)?.events?.find((e) => e.id === id)?.pages ?? [];
    for (let pi = 0; pi < pages.length; pi++) {
      const lines = pages[pi].lines ?? [];
      for (let i = 0; i < lines.length; i++) {
        for (const [b, inner] of [[0, lines[i].then ?? []], [1, lines[i].else ?? []]]) {
          const j = inner.findIndex((l) => l.battle);
          if (j >= 0) return [i, b, j + 1];
        }
      }
    }
    return null;
  }, [MAP, EV_ID]);
  ok(Array.isArray(resume) && resume.length === 3,
    `이어실행 경로에 갈래 번호가 들어 있다 (받은 값: ${JSON.stringify(resume)})`);
  if (!resume) return;
  const dbgNow = await page.evaluate(() => window.__game.registry.get("debugArSwitches") ?? {});
  ok(Object.keys(dbgNow).length === 0, `지금 게이트 스위치는 꺼져 있다 (받은 값: ${JSON.stringify(dbgNow)})`);

  // 배틀에서 이기고 돌아온 상태를 재현한다(BattleScene이 남기는 예약과 같은 모양).
  await page.evaluate((c) => window.__game.registry.set("eventContinue", c),
    { map: MAP, evId: EV_ID, resumeAt: resume });
  await startScene("WorldScene", { map: MAP, spawn: SPAWN, face: "up" });
  ok(await sceneActive("WorldScene"), "WorldScene을 다시 열어 예약을 소비했다");
  ok(await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && !!s.busy;
  }, undefined, 12000), "이어실행이 스스로 시작했다");
  let tail = null;
  for (let i = 0; i < 10; i++) {
    const d = await dialogText();
    if (d.visible && d.text.length > 0) { tail = d.text; break; }
    await press("c", 300);
  }
  ok(tail !== null && "... 뭐? 체육관에 도전하러 온 게 아니라고?".startsWith(tail),
    `then 갈래 뒷대사가 이어졌다(조건을 다시 보지 않았다) (받은 값: "${tail}")`);
  for (let i = 0; i < 10; i++) {
    const g = await page.evaluate(() => ({
      gone: !!(window.__game.registry.get("arSwitches") ?? {})[95],
      busy: !!window.__game.scene.getScene("WorldScene")?.busy,
    }));
    if (g.gone && !g.busy) break;
    await press("c", 350);
  }
  const after = await page.evaluate(() => ({
    ar: window.__game.registry.get("arSwitches") ?? {},
    ev: !!(window.__game.scene.getScene("WorldScene")?.events2 ?? []).find((x) => x.ev.id === 14),
  }));
  ok(after.ar[95] === true, `95번 스위치가 켜졌다 (받은 값: ${JSON.stringify(after.ar)})`);
  ok(after.ev === false, "경호가 사라졌다(빈 페이지로 넘어갔다)");

  // 그 결과가 저장에 남고, 새로 켜서 불러와도 경호가 여전히 없어야 한다.
  await press("z", 700);
  for (let i = 0; i < 2; i++) await press("ArrowRight", 200);
  await press("c", 900);
  ok(await sceneActive("SaveSlotScene"), "저장 칸 고르기가 열렸다");
  await press("c", 1800);
  const saved = (await readSlot()).data;
  ok(saved?.arSwitches?.[95] === true,
    `저장 파일에 95번 스위치가 실렸다 (받은 값: ${JSON.stringify(saved?.arSwitches ?? null)})`);

  await page.reload({ waitUntil: "networkidle" });
  await boot();
  await startScene("SaveSlotScene", { mode: "load", from: "MainMenuScene" });
  // ⚠️ 씬이 키를 잡기 전에 누르면 씹힌다 — 반드시 준비를 기다린 뒤 누른다(한 번 여기서 헛돌았다).
  ok(await sceneActive("SaveSlotScene"), "SaveSlotScene(불러오기)이 열렸다");
  await press("c", 2500);
  ok(await sceneActive("WorldScene", 20000), "불러오기가 WorldScene으로 이어졌다");
  await page.waitForTimeout(2500);
  const back = await page.evaluate(() => ({
    ar: window.__game.registry.get("arSwitches") ?? {},
    ev: !!(window.__game.scene.getScene("WorldScene")?.events2 ?? []).find((x) => x.ev.id === 14),
  }));
  ok(back.ar[95] === true, `불러온 뒤에도 95번이 살아 있다 (받은 값: ${JSON.stringify(back.ar)})`);
  ok(back.ev === false, "⭐ 이긴 경호가 되살아나지 않았다");
});

// ── 4. 옛 세이브(v5) 호환 — 이벤트 필드가 없어도 안 깨진다 ─────────────────
await section("4. v5 옛 저장 호환(필드 없음 → 빈 값)", async () => {
  const madeV5 = await page.evaluate((pre) => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(pre)) continue;
      const raw = JSON.parse(localStorage.getItem(k) ?? "null");
      if (!raw) continue;
      raw.version = 5;
      delete raw.eventSelfSwitches;
      delete raw.arSwitches;
      localStorage.setItem(k, JSON.stringify(raw));
      return true;
    }
    return false;
  }, SLOT_PREFIX);
  ok(madeV5, "방금 저장을 v5 모양(이벤트 필드 없음)으로 되돌려 놓았다");

  await page.reload({ waitUntil: "networkidle" });
  await boot();
  await startScene("SaveSlotScene", { mode: "load", from: "MainMenuScene" });
  ok(await sceneActive("SaveSlotScene"), "SaveSlotScene(불러오기)이 열렸다");
  await press("c", 2500);
  ok(await sceneActive("WorldScene", 20000), "v5 저장도 그대로 불러진다(안 깨진다)");
  const st = await page.evaluate(() => {
    const g = window.__game;
    return {
      self: g.registry.get("eventSelfSwitches"),
      ar: g.registry.get("arSwitches"),
      name: g.registry.get("playerName"),
    };
  });
  ok(!!st.self && Object.keys(st.self).length === 0, `셀프스위치가 빈 객체로 채워졌다 (받은 값: ${JSON.stringify(st.self)})`);
  ok(!!st.ar && Object.keys(st.ar).length === 0, `전역 스위치도 빈 객체다 (받은 값: ${JSON.stringify(st.ar)})`);
  ok(st.name === "테스트", `나머지 필드는 그대로 복원된다 (이름: ${st.name})`);
  // 진행이 없으니 경호는 다시 p0부터 = v5 저장에 대해서는 예전과 똑같이 동작한다(호환).
  ok(await waitEv(), "경호 sprite가 올라왔다");
  await press("c", 700);
  let got = null;
  for (let i = 0; i < 8; i++) {
    const d = await dialogText();
    if (d.visible && d.text.length > 0) { got = d.text; break; }
    await press("c", 300);
  }
  ok(got !== null && P0_LINE.startsWith(got),
    `v5 저장은 p0부터 시작한다 = 예전과 같은 동작 (받은 값: "${got}")`);
});

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
console.log(fail === 0 ? "\n✅ 전부 통과" : `\n❌ 실패 ${fail}건`);
await browser.close();
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
