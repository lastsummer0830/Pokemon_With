// PWH-004 A — 상록시티 아일라(EV10) 자동실행 스토리 이벤트 RED 테스트.
//  사용: node tools/dbg-illa-pwh004.mjs      (myPokemon_AJ/ 에서 실행 — 캡처 경로는 CWD와 무관하다)
//  ⚠️ dev 서버(http://localhost:5180)는 **밖에서 이미 떠 있어야 한다** — 이 스크립트는 서버를 켜지도 끄지도 않는다.
//
// ── 이 파일이 무엇을 고정하는가 ────────────────────────────────────────────
//  원본(AR Map56) EV010 "아일라" = **자동실행(trigger 3)** 스토리 이벤트다.
//  기대 흐름: 상록시티 남쪽 길에서 마주침 → 대사 → 트레이너 배틀(ILLA:???) →
//            이기고 돌아오면 이어서 실행 → 아일라가 (21,28)로 비켜서고 셀프스위치 A로 사라진다.
//            지면 A가 안 켜지니 다시 들어가면 또 걸린다(재도전).
//
// ── 이름 `???` 규칙 ────────────────────────────────────────────────────
//  AGENTS.md: 캐릭터 이름은 **본인의 첫 자기소개부터** 표시하고 그 전에는 `???`다.
//  아일라는 이 이벤트에서 아직 이름을 대지 않는다 → 대사 speaker가 전부 `???`이고,
//  AR 트레이너 정의 키도 `ILLA:???`다(public/assets/data/ar/trainers.json).
//  나중에 자기소개 장면이 붙어 키가 바뀌면 아래 TRAINER_ID 기대값도 같이 고쳐야 한다.
//
// ── 지금 RED가 나올 것으로 보는 지점(= 이 스크립트가 잡아야 하는 구멍) ─────────
//   (0) EV10 entry/sprite 자체가 없다 — viridian_city_events.json의 EV10 1페이지가 `partial: true`라
//       mapEvents.activePage()가 통째로 건너뛴다(추출기가 조건분기를 다 못 옮긴 페이지). Hermes가 말한 "현재 partial".
//   (1) 자동실행 실행 자체가 없다 — WorldScene에 AUTORUN_RANGE·EventHost·EventContinue·resume **선언만** 있고
//       trigger 3 페이지를 돌리는 자리가 없다 → busy가 안 켜진다.
//   (2) EV10 페이지에 battle 줄이 없다 → BattleScene 전환도, trainerId `ILLA:???`도 안 온다.
//   (3) 승리 continuation seam(registry `eventContinue` 소비 → runEventPage(startAt))이 WorldScene에 없다
//       → 이동·최종 좌표 (21,28)·셀프스위치 A·sprite 제거가 일어나지 않는다.
//   (4) 재진입 busy 재발 방지와 패배 재도전은 (1)~(3)에 딸린 것이라 같이 RED다.
//   (5) 0810 시각 검토에서 나온 EV10 데이터 결함 2건(구간 2-1) — 아일라가 등을 돌린 채 말을 걸고(turnUp),
//       나레이션에 speaker `{PLAYER}`가 붙어 이름창이 뜬다.
//   → 위가 메워지면 이 파일은 그대로 GREEN 회귀 테스트가 된다. 기대값을 낮춰 통과시키지 말 것.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

// 출력 경로는 **CWD가 아니라 이 파일 위치** 기준이다.
//  CWD 기준으로 잡으면 실행 위치(myPokemon_AJ/)에 따라 저장소 밖(GitHub/.claude/.verify)에 떨어진다.
const HERE = path.dirname(fileURLToPath(import.meta.url));   // <repo>/myPokemon_AJ/tools
const OUT = path.resolve(HERE, "../../.claude/.verify");     // <repo>/.claude/.verify
fs.mkdirSync(OUT, { recursive: true });
const SHOT = path.join(OUT, "pwh004-a-red.png");

const MAP = "viridian_city";        // region.ts: ox=0, oy=0 → 이 맵만은 로컬 좌표 = 글로벌 좌표다
const EV_ID = 10;
// 진입 칸은 blocked=0/ledge=0인 것만으로는 부족하다 — (23,36)은 수치는 통과해도 실제 renderer에서
//  플레이어 발이 수평 절벽 가장자리 그래픽에 겹쳤다(visual acceptance 실패). (23,38)은 노란 평지 길 한가운데이고
//  DebugMenu의 상록시티 바로가기가 쓰는 칸과 같다. EV10 원본 자리 (23,35)와 Chebyshev 거리 3 = AUTORUN_RANGE(4) 안이다.
const SPAWN = [23, 38];
const TRAINER_ID = "ILLA:???";      // trainers.json 정의 키(첫 자기소개 전이라 이름이 `???`)
// 셀프스위치 키 형식은 mapEvents.ts의 setSelfSwitch/selfSwitchOn 그대로 = `${map}:${id}:${ch}`
const SELF_KEY = `${MAP}:${EV_ID}:A`;
const END_TILE = [21, 28];          // 컷신이 끝난 뒤 아일라가 서 있어야 하는 최종 칸
// ── 0810 시각 결함 2건을 못박는 상수 ──────────────────────────────────────
//  플레이어는 (23,38), 아일라는 (23,35) = **아일라가 아래(플레이어 쪽)를 봐야** 마주친 그림이 된다.
//  RMXP 방향 번호(mapEvents.dirFrame): 2=아래, 4=왼, 6=오른, 8=위. 시트 줄 시작 프레임은 2→0, 8→12.
const DIR_DOWN = 2;
const DOWN_FRAMES = [0, 1, 2, 3];   // '아래' 줄의 4칸 — 실제 렌더 프레임까지 본다(faceDir 값만 믿지 않는다)
const NARRATION = "(누군가가 서있다.)";   // 나레이션 = 이름창이 **없어야** 하는 줄
const AILA_FIRST = "너!? 너가 어떻게?";   // 아일라가 **처음 입을 여는** 줄(이름창 ???)
const WORLD_DATA = { map: MAP, spawn: SPAWN, face: "up", testParty: true };
// headless swiftshader에서는 맵·캐릭터 시트 로드가 느려 EV10 entry/sprite가 8초쯤 뒤에 올라온다.
//  bounded 대기이므로 넉넉히 잡아도 정상일 때는 그만큼 기다리지 않는다(무한 대기는 하지 않는다).
const ENTRY_WAIT = 20000;
// 배틀에서 이기고 돌아와 **이어서 실행할 줄 번호**는 하드코딩하지 않는다.
//  EV10 JSON은 앞쪽 컷신 줄이 붙었다 빠졌다 하므로 고정 상수는 금방 낡는다(예전 값 6은 이미 틀렸다).
//  → 지금 데이터의 battle 줄을 찾아 **그 다음 줄**을 쓴다. 이는 runEventPage가 돌려주는
//    `battle.resumeAt`(= i + 1, systems/fieldEventRunner.ts)과 같은 정의다.
let resumeAt = null;   // computeResumeAt()이 채운다. null이면 battle 줄이 없다는 뜻 → 실패로 남긴다.

const browser = await chromium.launch({
  headless: true,
  // 소리는 끈다(--mute-audio) — 헤드리스 QA가 개발 PC에서 울리면 안 된다.
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };
/** 한 구간이 끊겨도 **실패로 세고** 다음 구간·콘솔 보고까지는 간다(숨기지 않는다). */
const section = async (title, fn) => {
  console.log(`\n── ${title} ──────────────────────────────`);
  try { await fn(); }
  catch (e) { fail++; console.log(`  ❌ 이 구간이 끊겼다(다음 구간은 계속한다): ${e?.message ?? e}`); }
};
const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
/** bounded 대기 — 고정 sleep 대신 조건을 본다. 시간 안에 안 되면 throw가 아니라 false를 돌려 assertion으로 남긴다. */
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
/**
 * 씬 전환은 **Game SceneManager(window.__game.scene)로 직접** 건다.
 *  `getScenes(true)[0].scene.start(...)`는 그 순간 active 배열이 비면(부팅 직후·전환 중) undefined가 되어
 *  `...scene`에서 TypeError로 구간이 통째로 끊긴다. SceneManager.start는 그 배열에 의존하지 않는다.
 *  다른 씬은 '막 켜지는 중'까지 훑어 내린다(dbg-keys-0803·dbg-water-0803과 같은 패턴) —
 *  안 그러면 이전 씬이 뒤에 살아남아 키 입력을 같이 먹는다.
 */
const startScene = async (key, data) => {
  // bounded 대기: 현재 active 씬이 하나 자리잡을 때까지 기다렸다 갈아치운다(실패해도 throw하지 않는다).
  //  '막 켜지는 중'인 씬을 앞질러 start하면 그 씬이 뒤늦게 살아나 뒤에 남는다.
  await until(() => window.__game.scene.getScenes(true).length > 0, undefined, 15000);
  await page.evaluate(([k, d]) => {
    const g = window.__game;
    g.scene.scenes.forEach((s) => {
      if (s.scene.key !== k && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
    });
    g.scene.start(k, d);
  }, [key, data]);
};
/** WorldScene을 **항상 같은 spawn**으로 시작한다(재진입 비교가 성립하도록). */
const goWorld = async () => {
  await startScene("WorldScene", WORLD_DATA);
  const okScene = await sceneActive("WorldScene");
  ok(okScene, `WorldScene이 ${MAP} (${SPAWN})에서 떴다`);
  return okScene;
};
/** 지금 WorldScene 상태 한 묶음 — 플레이어 칸, busy, EV10 entry/sprite, 셀프스위치 A. */
const worldState = () => page.evaluate(([map, id, selfKey]) => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  const e = (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  return {
    tx: s.tx, ty: s.ty, busy: !!s.busy,
    walkable: s.blocked?.[s.ty]?.[s.tx] === 0,
    ev10: e ? { gx: e.gx, gy: e.gy, sprite: !!e.sprite } : null,
    selfA: !!(window.__game.registry.get("eventSelfSwitches") ?? {})[selfKey],
  };
}, [MAP, EV_ID, SELF_KEY]);
/**
 * 지금 대사창과 EV10의 방향을 한 묶음으로 읽는다 — 캡처 없이도 "누가 말하고 어디를 보는가"가 남는다.
 *  · speaker  = DialogBox.say(text, speaker)가 받은 값 그대로. **null이면 나레이션**(이름창 없음)이다.
 *  · nameShown/plateShown = 이름창이 실제로 화면에 있는가. 숨겨도 nameTag.text는 옛 글자가 남으므로
 *    글자만 보면 안 되고 visible을 같이 봐야 한다.
 *  · faceDir/frame = 아일라가 향한 방향과 **실제로 그려지는 시트 프레임**.
 * 대사가 타자기로 찍히는 중이어도 speaker와 이름창은 say() 시작 시점에 이미 확정돼 있다.
 */
const dialogState = () => page.evaluate(([map, id]) => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  const e = (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  const d = s.dlg;
  const f = e?.sprite?.frame?.name;
  return {
    visible: !!d?.visible,
    text: d?.boxText?.text ?? "",
    speaker: d?.speaker ?? null,
    nameShown: !!d?.nameTag?.visible,
    plateShown: !!d?.namePlate?.visible,
    nameText: d?.nameTag?.text ?? "",
    faceDir: e?.faceDir ?? null,
    frame: f === undefined ? null : Number(f),
  };
}, [MAP, EV_ID]);
/** 대사창에 이 줄이 올라올 때까지 확인키로 넘긴다(타자 중이면 그 줄의 앞부분과 일치한다). */
const advanceToLine = async (want, tries = 12) => {
  for (let i = 0; i < tries; i++) {
    const st = await dialogState();
    if (st?.visible && (st.text === want || (want.startsWith(st.text) && st.text.length > 0))) return st;
    await press("c", 300);
  }
  return await dialogState();
};
/**
 * 이어실행 시작 줄(resumeAt)을 **지금 데이터에서** 계산한다 — 상수로 박지 않는다.
 *  1순위: 살아 있는 WorldScene이 들고 있는 EV10 entry의 자동실행 페이지(= 실제로 걸린 그 페이지).
 *  2순위: 배틀 등으로 씬을 떠났으면 로더 캐시의 EV10 정의(같은 JSON이다).
 * battle 줄이 없으면 `resumeAt: null`을 돌려주고, 부르는 쪽이 assertion 실패로 남긴다.
 * ⚠️ 2026-08-18부터 resumeAt은 **줄 번호의 경로(배열)**다 — 조건분기 안에서 배틀이 걸리는 이벤트(경호)가
 *    생겨서다. EV10의 배틀은 페이지 본문에 있으므로 경로는 한 칸(`[i + 1]`)이다.
 */
const computeResumeAt = async () => {
  const got = await page.evaluate(([map, id]) => {
    const g = window.__game;
    const s = g.scene.getScene("WorldScene");
    const live = s && s.scene.isActive()
      ? (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id)
      : null;
    const pages = live?.ev?.pages
      ?? g.cache.json.get(`${map}_events`)?.events?.find((e) => e.id === id)?.pages
      ?? null;
    return { source: live ? "live WorldScene" : "loader cache", pages };
  }, [MAP, EV_ID]);
  const pages = got.pages ?? [];
  // 자동실행(trigger 3) 페이지 중 battle 줄이 있는 첫 페이지가 이 이벤트의 배틀 페이지다.
  //  trigger가 3이 아니면 WorldScene.resumeEvent가 이어실행을 거부하므로 여기서도 세지 않는다.
  const p = pages.find((x) => x.trigger === 3 && (x.lines ?? []).some((l) => l.battle)) ?? null;
  const index = p ? p.lines.findIndex((l) => l.battle) : -1;
  return { source: got.source, pages: pages.length, index, resumeAt: index >= 0 ? [index + 1] : null };
};
/**
 * busy 값이 **바뀐 순서만** 모은다(짧은 폴링, bounded).
 *  [false, true]  = 자동실행이 한 번만 켜짐(원하는 모습)
 *  [false]        = 아예 안 켜짐(지금 예상되는 RED)
 *  [false, true, false, true …] = 재진입마다 다시 걸리는 무한 반복
 */
const busyTrace = async (ms) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const b = await page.evaluate(() => {
      const s = window.__game.scene.getScene("WorldScene");
      return s && s.scene.isActive() ? !!s.busy : null;
    });
    if (!seen.length || seen[seen.length - 1] !== b) seen.push(b);
    if (await inBattle()) break;   // 배틀로 넘어가면 더 볼 것이 없다
    await page.waitForTimeout(100);
  }
  return seen;
};
/**
 * EV10이 밟는 칸을 **순서대로** 기록하는 페이지 안 래치(requestAnimationFrame).
 *  왜 폴링이 아니라 래치인가: 한 칸 이동 tween은 수백 ms라 evaluate 폴링(200ms)으로 보면 중간 칸이 통째로 빈다.
 *  경로가 비면 아일라가 엉뚱한 길로 가거나 중간에 멈춰도 "마지막에 본 칸"만 맞으면 통과해 버린다.
 *  래치는 매 프레임 entry.gx/gy(WorldScene.moveEvent가 한 칸마다 갱신한다)를 읽어 **바뀔 때만** 담는다.
 *   · seen  = EV10을 한 번이라도 봤는가(없던 것을 "치워졌다"로 세지 않기 위해).
 *   · gone  = 봤다가 events2에서 빠졌는가(= 이벤트가 치웠다). gone 이후로는 더 담지 않으므로
 *             path의 **마지막 원소 = 사라지기 직전 칸**이다.
 *  ⚠️ 반드시 stopTilePathLatch()로 끈다 — 살려두면 재진입·다음 구간의 EV10까지 같은 배열에 섞인다.
 */
const startTilePathLatch = () => page.evaluate(([map, id]) => {
  window.__pwh004Latch?.stop?.();   // 앞의 래치가 남아 있으면 먼저 끊는다(경로가 섞이지 않게)
  const g = window.__game;
  const L = { path: [], seen: false, gone: false, running: true, raf: 0 };
  L.stop = () => { L.running = false; if (L.raf) cancelAnimationFrame(L.raf); L.raf = 0; };
  const tick = () => {
    if (!L.running) return;
    const s = g.scene.getScene("WorldScene");
    const e = s && s.scene.isActive()
      ? (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id)
      : null;
    if (L.gone) { /* 한 번 치워진 뒤는 기록하지 않는다 */ }
    else if (e) {
      L.seen = true;
      const last = L.path[L.path.length - 1];
      if (!last || last[0] !== e.gx || last[1] !== e.gy) L.path.push([e.gx, e.gy]);
    } else if (L.seen) L.gone = true;
    L.raf = requestAnimationFrame(tick);
  };
  window.__pwh004Latch = L;
  L.raf = requestAnimationFrame(tick);
}, [MAP, EV_ID]);
/** 래치가 지금까지 담은 것을 읽는다(래치가 없으면 "아무것도 못 봤다"로 돌려준다 — 조용히 통과시키지 않는다). */
const readTilePathLatch = () => page.evaluate(() => {
  const L = window.__pwh004Latch;
  return L
    ? { path: L.path.map((t) => [t[0], t[1]]), seen: L.seen, gone: L.gone }
    : { path: [], seen: false, gone: false };
});
/** 래치를 끄고 마지막 결과를 돌려준다. 구간이 중간에 끊겨도 finally에서 이걸 부른다. */
const stopTilePathLatch = () => page.evaluate(() => {
  const L = window.__pwh004Latch;
  if (!L) return { path: [], seen: false, gone: false };
  L.stop();
  return { path: L.path.map((t) => [t[0], t[1]]), seen: L.seen, gone: L.gone };
});

// ── 0. 부팅 + 결정론 초기화 ───────────────────────────────────────────────
try {
  await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
} catch {
  console.log("❌ dev 서버(http://localhost:5180)에 못 붙었다 — `npm run dev`를 먼저 띄워라(이 스크립트는 서버를 켜지 않는다).");
  await browser.close();
  process.exit(1);
}
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

await section("0. 결정론 초기화(이름·성별·스위치)와 테스트 파티", async () => {
  // 파티는 기존 debug helper 그대로 채운다 — DebugMenuScene의 "E. 1번도로"(testParty: true) 바로가기가
  //  primeDebugRegistry(party)를 부른다. 상록시티 바로가기(R)를 쓰면 EV10 근처에 떨어져
  //  자동실행이 여기서 소모될 수 있으므로 **일부러 다른 맵 바로가기**를 쓴다.
  await startScene("DebugMenuScene");
  ok(await sceneActive("DebugMenuScene"), "DebugMenuScene 진입(파티 채우기용)");
  await press("e", 500);
  const hasParty = await until(() => (window.__game.registry.get("playerParty") ?? []).length >= 1, undefined, 10000);
  const partyN = await page.evaluate(() => (window.__game.registry.get("playerParty") ?? []).length);
  ok(hasParty && partyN >= 1, `테스트 파티가 준비됐다(${partyN}마리 — 트레이너전을 걸 수 있어야 한다)`);

  await page.evaluate(() => {
    const g = window.__game;
    g.registry.set("playerName", "테스트");
    g.registry.set("playerGender", "boy");
    g.registry.set("eventSelfSwitches", {});   // 셀프스위치 전부 꺼진 상태에서 시작
    g.registry.set("arSwitches", {});          // 원본 전역 스위치도 초기화
    g.registry.set("eventContinue", undefined);
  });
  const clean = await page.evaluate(() => {
    const g = window.__game;
    return Object.keys(g.registry.get("eventSelfSwitches") ?? {}).length === 0
        && Object.keys(g.registry.get("arSwitches") ?? {}).length === 0;
  });
  ok(clean, "eventSelfSwitches·arSwitches가 빈 상태다");
});

// ── 1. 진입 + EV10이 거기 있는가 ─────────────────────────────────────────
await section("1. 상록시티 (23,38) 진입 — EV10 entry·sprite", async () => {
  await goWorld();
  const st = await worldState();
  ok(!!st && st.tx === SPAWN[0] && st.ty === SPAWN[1],
    `플레이어가 (${SPAWN}) 칸에 서 있다 (받은 값: ${st ? [st.tx, st.ty] : "없음"})`);
  ok(!!st?.walkable, "그 칸은 충돌상 walkable이다(스폰이 벽에 박히지 않았다)");
  // 여기가 (0)번 RED — EV10 1페이지가 partial이라 activePage()가 건너뛰어 entry 자체가 안 생긴다.
  const hasEntry = await until(([map, id]) => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!(s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  }, [MAP, EV_ID], ENTRY_WAIT);
  ok(hasEntry, "EV10(아일라) entry가 events2에 있다");
  const hasSprite = hasEntry && await until(([map, id]) => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!(s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id)?.sprite;
  }, [MAP, EV_ID], ENTRY_WAIT);
  ok(hasSprite, "EV10 sprite가 화면에 올라와 있다");
  const now = await worldState();
  ok(!!now?.ev10 && now.ev10.gy === 35 && now.ev10.gx === 23,
    `EV10은 원본 자리 (23,35)에 서 있다 (받은 값: ${now?.ev10 ? [now.ev10.gx, now.ev10.gy] : "없음"})`);
  // 이어실행 줄 번호는 씬이 살아 있는 지금 계산해 둔다 — 4번이 이 값으로 예약을 만든다.
  const rs = await computeResumeAt();
  resumeAt = rs.resumeAt;
  ok(resumeAt !== null,
    `EV10 자동실행 페이지에 battle 줄이 있다 → 이어실행은 lines[${rs.index}] 다음인 [${resumeAt}]부터다`
    + ` (출처: ${rs.source}, 페이지 ${rs.pages}장)`);
});

// ── 2. 자동실행이 시작되는가 + busy는 단발인가 ────────────────────────────
await section("2. 자동실행(trigger 3) 시작과 busy 단발성", async () => {
  const started = await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && !!s.busy;
  }, undefined, 6000);
  ok(started, "스폰 직후 자동실행이 걸려 busy가 켜졌다(플레이어 입력이 잠긴다)");
  const trace = await busyTrace(2500);
  ok(trace.filter((v) => v === true).length === 1,
    `busy가 한 번만 켜진다 = 자동실행이 겹쳐 돌지 않는다 (전이: ${JSON.stringify(trace)})`);
});

// ── 2-1. 마주친 그림이 맞는가 — 아일라의 방향과 나레이션 이름창 ─────────────
//  Hermes 시각 검토에서 나온 **실제 결함 2건**을 여기서 못박는다(둘 다 EV10 데이터 문제다).
//   (A) 플레이어는 아일라의 **아래**(23,38 vs 23,35)에 있는데 첫 이동 루트가 `turnUp`이라
//       아일라가 등을 돌린 채 "!"를 띄우고 말을 건다 → `turnDown`이어야 마주친 장면이 된다.
//   (B) 첫 줄 나레이션 `(누군가가 서있다.)`에 speaker `{PLAYER}`가 붙어 있어 이름창에 플레이어 이름
//       (여기서는 `테스트`)이 뜬다 → AGENTS.md "나레이션은 이름창 없이"에 어긋난다. speaker가 없어야 한다.
await section("2-1. 아일라가 플레이어 쪽(아래)을 보고, 나레이션에는 이름창이 없다", async () => {
  // (B) 나레이션 줄 — 데이터와 화면 양쪽으로 본다.
  const narr = await advanceToLine(NARRATION);
  ok(!!narr?.visible && NARRATION.startsWith(narr.text) && narr.text.length > 0,
    `첫 줄이 나레이션 "${NARRATION}"이다 (받은 값: "${narr?.text ?? "대사창 없음"}")`);
  ok(narr?.speaker === null,
    `나레이션에는 화자가 없다(speaker=null) — 받은 값: ${JSON.stringify(narr?.speaker ?? null)}`);
  ok(narr?.nameShown === false && narr?.plateShown === false,
    `나레이션 화면에 이름창이 안 뜬다 (글자 ${narr?.nameShown ? "보임" : "숨김"}·판 ${narr?.plateShown ? "보임" : "숨김"}`
    + `, 이름창 글자 "${narr?.nameText ?? ""}")`);

  // (A) 아일라가 처음 입을 여는 줄에서 **아래(플레이어 쪽)** 를 보고 있어야 한다.
  const aila = await advanceToLine(AILA_FIRST);
  ok(!!aila?.visible && AILA_FIRST.startsWith(aila.text) && aila.text.length > 0,
    `아일라 첫 대사 "${AILA_FIRST}"가 떴다 (받은 값: "${aila?.text ?? "대사창 없음"}")`);
  ok(aila?.speaker === "???", `그 줄의 이름창은 "???"다 (받은 값: ${JSON.stringify(aila?.speaker ?? null)})`);
  ok(aila?.faceDir === DIR_DOWN,
    `아일라가 아래(플레이어 쪽)를 보고 있다 — faceDir=${DIR_DOWN} (받은 값: ${aila?.faceDir ?? "없음"})`);
  ok(aila?.frame !== null && DOWN_FRAMES.includes(aila?.frame),
    `실제로 그려지는 시트 프레임도 '아래' 줄이다 — ${JSON.stringify(DOWN_FRAMES)} 중 하나 (받은 값: ${aila?.frame ?? "없음"})`);

  // 같은 두 가지를 **데이터에서도** 못박는다(화면 타이밍과 무관하게 회귀를 잡는다).
  const data = await page.evaluate(([map, id]) => {
    const g = window.__game;
    const s = g.scene.getScene("WorldScene");
    const live = s && s.scene.isActive() ? (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id) : null;
    const pages = live?.ev?.pages
      ?? g.cache.json.get(`${map}_events`)?.events?.find((e) => e.id === id)?.pages ?? [];
    const p = pages.find((x) => x.trigger === 3) ?? null;
    const lines = p?.lines ?? [];
    return {
      firstMove: lines.find((l) => l.move)?.move ?? null,
      narration: lines.find((l) => l.text === "(누군가가 서있다.)") ?? null,
      narrationHasSpeaker: Object.prototype.hasOwnProperty.call(
        lines.find((l) => l.text === "(누군가가 서있다.)") ?? {}, "speaker"),
    };
  }, [MAP, EV_ID]);
  ok(Array.isArray(data.firstMove) && data.firstMove.includes("turnDown") && !data.firstMove.includes("turnUp"),
    `EV10 첫 이동 루트가 turnDown이다(turnUp 아님) — 받은 값: ${JSON.stringify(data.firstMove)}`);
  ok(!!data.narration && data.narrationHasSpeaker === false,
    `나레이션 줄에 speaker 키가 아예 없다 — 받은 값: ${JSON.stringify(data.narration)}`);
});

// ── 3. 대사 → 배틀 전환 → 상대가 ILLA:??? 인가 ───────────────────────────
await section("3. 대사 진행 후 BattleScene 전환과 trainerId", async () => {
  // 고정 sleep 대신 **bounded 반복**: 확인키(c)로 대사를 넘기며 배틀로 넘어가는지 본다.
  let battle = false;
  for (let i = 0; i < 40 && !battle; i++) {
    battle = await inBattle();
    if (battle) break;
    await press("c", 250);
  }
  battle = battle || await inBattle();
  ok(battle, "대사를 끝까지 넘기면 BattleScene으로 넘어간다");
  if (!battle) return;
  ok(await sceneActive("BattleScene"), "BattleScene이 실제로 돌고 있다");
  const tid = await page.evaluate(() => window.__game.scene.getScene("BattleScene")?.trainerId ?? null);
  ok(tid === TRAINER_ID, `상대 trainerId가 정확히 "${TRAINER_ID}"다 (받은 값: ${tid})`);
});

// ── 4. 승리 continuation — 이기고 돌아와 이어서 실행 ───────────────────────
await section("4. 승리 후 이어실행 → (21,28)로 비켜서고 셀프스위치 A로 사라진다", async () => {
  // ⚠️ 지금은 "이겨서 돌아오는" seam(WorldScene의 resume 소비)이 코드에 없다.
  //    그래서 **기대 계약을 여기 코드로 못박는다** — 배틀에서 이긴 쪽이 남겨야 하는 예약과 복귀 방식:
  //      registry "eventContinue" = { map, evId, resumeAt } → WorldScene이 같은 자리로 다시 시작하면
  //      그 예약을 소비해 runEventPage(startAt = resumeAt)로 **이어서** 돌려야 한다.
  // resumeAt은 상수가 아니라 EV10 페이지의 battle 줄에서 계산한 값이다.
  //  1번에서 못 구했으면(그 구간이 끊겼거나 씬이 없었으면) 로더 캐시로 한 번 더 본다.
  if (resumeAt === null) resumeAt = (await computeResumeAt()).resumeAt;
  ok(resumeAt !== null, `이어실행 시작 줄을 battle 줄에서 계산했다 (받은 값: [${resumeAt}])`);
  if (resumeAt === null) {
    // battle 줄이 없으면 예약 자체를 만들 수 없다 — 아무 값이나 넣어 진행하지 않고 남은 항목을 실패로 남긴다.
    ok(false, "이어실행 이후 acceptance(이동·최종 좌표·셀프스위치 A·sprite 제거·재진입)를 검증하지 못했다");
    return;
  }
  await page.evaluate(([c]) => window.__game.registry.set("eventContinue", c),
    [{ map: MAP, evId: EV_ID, resumeAt }]);
  // 아일라가 밟는 칸을 프레임 단위로 기록한다 — 폴링으로 훑으면 한 칸 tween(수백 ms)이 통째로 지나가
  //  중간 경로가 비고, 끝 칸만 우연히 맞아도 통과해 버린다.
  //  이어실행은 복귀 **직후** 이동부터 시작할 수 있으므로 래치를 goWorld() 전에 건다
  //  (지금은 BattleScene이라 WorldScene EV10이 없다 = 빈 상태에서 시작한다).
  await startTilePathLatch();
  // tilePath = 래치가 담은 칸 순서. (`path`는 위에서 import한 모듈 이름이라 쓰지 않는다.)
  let seen = false, gone = false, tilePath = [];
  try {
    await goWorld();

    // 이어실행이 시작되면 다시 busy가 되고, 아일라가 걸어서 비켜선다.
    ok(await until(() => {
      const s = window.__game.scene.getScene("WorldScene");
      return !!s && s.scene.isActive() && !!s.busy;
    }, undefined, 6000), "복귀 직후 이어실행이 시작된다(busy)");

    // 남은 대사를 bounded로 넘기는 **그 동안** 래치가 계속 칸을 담는다.
    for (let i = 0; i < 60; i++) {
      if ((await readTilePathLatch()).gone) break;   // 아일라가 치워지면 더 볼 것이 없다
      const st = await worldState();
      if (st?.busy) await press("c", 200); else await page.waitForTimeout(200);
    }
    ({ seen, gone, path: tilePath } = await readTilePathLatch());
    // ⚠️ **없어서 안 보이는 것(no-entry)** 과 **이벤트가 치웠기 때문에 사라진 것(gone)** 을 구분한다.
    //    EV10을 한 번도 못 봤으면 "치워졌다"는 관찰이 성립하지 않는다 → OK로 세지 않고 명시적으로 실패로 남긴다.
    const noSeenNote = " — EV10을 한 번도 못 봤다(애초에 없던 것은 제거로 인정하지 않는다)";
    // 끝 칸 계약은 느슨하게 잡지 않는다: (21,28)이 경로 **어딘가에** 있는 것으로는 부족하고
    //  기록된 **마지막 칸**이어야 한다(지나가다 밟고 딴 데서 멈춘 것은 실패다).
    const endTile = tilePath.length ? tilePath[tilePath.length - 1] : null;
    const endOk = seen && !!endTile && endTile[0] === END_TILE[0] && endTile[1] === END_TILE[1];
    ok(endOk, `아일라가 이어실행에서 **마지막으로** 선 칸이 (${END_TILE})다`
      + (endOk ? ` (기록된 칸 ${tilePath.length}개)` : ` — 관찰된 칸 순서: ${JSON.stringify(tilePath)}`));
    ok(await until(([k]) => !!(window.__game.registry.get("eventSelfSwitches") ?? {})[k], [SELF_KEY], 6000),
      `셀프스위치 "${SELF_KEY}"가 켜졌다(원본 A — 이제 빈 페이지)`);
    const st = await worldState();
    ok(seen && (gone || !!(st && !st.ev10)),
      `EV10 sprite와 entry가 치워졌다(그 칸도 다시 지나갈 수 있다)${seen ? "" : noSeenNote}`);
    ok(seen && !st?.ev10?.sprite, `화면에 아일라 그림이 남아 있지 않다${seen ? "" : noSeenNote}`);
  } finally {
    // 래치는 이 구간을 넘기지 않는다 — 중간에 끊겨도 여기서 끈다(5번의 재도전 관찰에 섞이면 안 된다).
    await stopTilePathLatch();
  }

  // 한 번 더 같은 자리로 들어간다 — **다시 걸리면 안 된다**(자동실행 무한 반복 방지).
  await goWorld();
  const trace = await busyTrace(2500);
  ok(!trace.includes(true), `재진입해도 자동실행이 다시 걸리지 않는다 (busy 전이: ${JSON.stringify(trace)})`);
  const after = await worldState();
  ok(seen && !after?.ev10, `재진입 화면에도 EV10이 없다(셀프스위치 A로 숨겨졌다)${seen ? "" : noSeenNote}`);
});

// ── 5. 패배 재도전 — A가 안 켜졌으면 다시 걸린다 ──────────────────────────
await section("5. 패배 재도전 — 셀프스위치 A가 꺼진 상태면 EV10이 다시 걸린다", async () => {
  // 원본은 지면 화이트아웃이라 이벤트로 **돌아오지 않는다** → 셀프스위치 A가 안 켜진 채로 남는다.
  //  실제 배틀 UI를 다 두들기는 대신 그 결과 상태(A가 꺼짐)만 만들어 재도전이 성립하는지 본다.
  await page.evaluate(() => {
    window.__game.registry.set("eventSelfSwitches", {});
    window.__game.registry.set("eventContinue", undefined);
  });
  await goWorld();
  const back = await until(([map, id]) => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!(s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  }, [MAP, EV_ID], ENTRY_WAIT);
  ok(back, "EV10(아일라)이 다시 그 자리에 있다");
  ok(await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && !!s.busy;
  }, undefined, 6000), "자동실행이 다시 걸린다(busy) = 재도전이 된다");
});

// ── 6. 화면 증거 1장 ─────────────────────────────────────────────────────
await section("6. renderer 캡처", async () => {
  await page.waitForTimeout(400);
  await snap(page, SHOT);   // page.screenshot은 WebGL 캔버스가 검게 나온다 → _snap.mjs의 renderer.snapshot()
  ok(fs.existsSync(SHOT), `캡처 저장: ${SHOT}`);
});

console.log(`\n콘솔 에러 ${errors.length}건`);
for (const e of errors.slice(0, 5)) console.log("   " + e);
ok(errors.length === 0, "콘솔 에러 없음");
console.log(`\n=== 실패 ${fail}건 ===`);
await browser.close();
process.exit(fail ? 1 : 0);
