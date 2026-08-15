// PWH-004 A — 0810 상록시티 아일라(EV10) 자동실행 이벤트의 **오늘 화면** 4단계 캡처 + 증거 기록.
//  사용: node tools/shot-pwh004-0810.mjs            (myPokemon_AJ/ 에서 실행)
//        node tools/shot-pwh004-0810.mjs --diag     (캡처 없이 상태만 훑는 진단 모드)
//  ⚠️ dev 서버(http://127.0.0.1:5180)는 **밖에서 이미 떠 있어야 한다** — 이 스크립트는 서버를 켜지도 끄지도 않는다.
//
// ── 왜 별도 도구인가 ──────────────────────────────────────────────────────
//  회귀 판정은 tools/dbg-illa-pwh004.mjs가 한다(합격/불합격). 이 파일은 **그림 증거**를 만든다:
//   1) 아일라가 보이는 자동 대사 화면   2) ILLA/??? 배틀 화면
//   3) 이긴 뒤 이어실행(이동/최종 상태) + 상단 확인바에 [0810]  4) 진 뒤 다시 걸리는 재도전 화면
//  각 장마다 **찍기 전에** 씬·확인항목·좌표·통행값·대사/배틀 상태를 프로그램으로 남기고,
//  찍은 뒤 PNG의 밝기·색 수를 재서 **검은 화면/빈 화면을 스스로 걸러낸다**(사람이 눈으로 또 본다).
//  파일 이름에는 실행 시각을 넣는다 — 예전 캡처를 다시 쓰는 사고를 원천봉쇄한다.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { snap } from "./_snap.mjs";

const DIAG = process.argv.includes("--diag");
const HERE = path.dirname(fileURLToPath(import.meta.url));       // <repo>/myPokemon_AJ/tools
const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT = path.resolve(HERE, `../../.claude/.verify/pwh004a-0810-${STAMP}`);
if (!DIAG) fs.mkdirSync(OUT, { recursive: true });

const URL = "http://127.0.0.1:5180";
const MAP = "viridian_city";
const EV_ID = 10;
const CHECK_DATE = "0810";
const SPAWN = [23, 38];          // 확인 항목(debugChecks 0810)이 쓰는 칸 — 노란 평지 한가운데
const TRAINER_ID = "ILLA:???";
const START_TILE = [23, 35];     // 원본 EV10 자리
const END_TILE = [21, 28];       // 컷신이 끝나고 아일라가 서는 칸
const SELF_KEY = `${MAP}:${EV_ID}:A`;
const NARRATION = "(누군가가 서있다.)";   // 첫 줄 나레이션 — 화자가 없어 **이름창이 안 뜬다**
const AILA_LINE = "너!? 너가 어떻게?";     // 아일라가 처음 입을 여는 줄(이름창 ???)

const manifest = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => errors.push(`요청 실패 ${r.url()} — ${r.failure()?.errorText}`));

const until = async (fn, arg, timeout = 10000, polling = 100) => {
  try { await page.waitForFunction(fn, arg, { timeout, polling }); return true; }
  catch { return false; }
};
const press = async (k, ms = 220) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };

/** 지금 화면 한 묶음 — 씬·확인항목·좌표·통행값·대사/배틀 상태. 캡처 직전에 부른다. */
const state = () => page.evaluate(([map, id, selfKey, endTile]) => {
  const g = window.__game;
  const scenes = g.scene.getScenes(true).map((s) => s.scene.key);
  const w = g.scene.getScene("WorldScene");
  const b = g.scene.getScene("BattleScene");
  const out = {
    scenes,
    debugCheck: g.registry.get("debugCheck") ?? null,
    selfA: !!(g.registry.get("eventSelfSwitches") ?? {})[selfKey],
    eventContinue: g.registry.get("eventContinue") ?? null,
  };
  if (w && w.scene.isActive()) {
    const e = (w.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
    // 원본 맵 데이터 그대로의 통행값(extract-map.py 결과). 씬의 blocked는 **이벤트가 선 칸을 1로 덮으므로**
    //  "그 칸이 원래 걸을 수 있는 땅인가"는 이 원본값으로 판정해야 한다. 상록시티는 오프셋 0 = 로컬좌표 = 글로벌좌표.
    const col = g.cache.json.get(`${map}_col`) ?? {};
    const at = (tx, ty) => ({
      tile: [tx, ty],
      blocked: w.blocked?.[ty]?.[tx] ?? null, ledge: w.ledge?.[ty]?.[tx] ?? null,
      mapBlocked: col.blocked?.[ty]?.[tx] ?? null, mapLedge: col.ledge?.[ty]?.[tx] ?? null,
      mapGrass: col.grass?.[ty]?.[tx] ?? null,
    });
    out.world = {
      player: { ...at(w.tx, w.ty), facing: w.facing },
      // faceDir/frame = 아일라가 향한 방향(RMXP 2=아래·8=위)과 **실제로 그려지는 시트 프레임**
      //  (mapEvents.dirFrame: 아래 줄 = 0~3, 위 줄 = 12~15). 플레이어가 아래(23,38)에 있으니 2/0~3이어야 한다.
      npc: e ? {
        ...at(e.gx, e.gy), sprite: !!e.sprite,
        spriteXY: e.sprite ? [Math.round(e.sprite.x), Math.round(e.sprite.y)] : null,
        faceDir: e.faceDir ?? null,
        frame: e.sprite?.frame?.name === undefined ? null : Number(e.sprite.frame.name),
      } : null,
      // 아일라가 걸어갈 길(원본 이동 루트)의 통행값 — "갈 수 없는 칸"을 눈대중이 아니라 데이터로 남긴다.
      route: [[23, 34], [23, 33], [22, 33], [21, 33], [21, 32], [21, 31], [21, 30], [21, 29], [21, 28]]
        .map(([x, y]) => at(x, y)),
      endTile: at(endTile[0], endTile[1]),
      busy: !!w.busy, moving: !!w.moving,
      // 이름창은 **숨겨도 옛 글자가 남는다**(DialogBox.applySpeaker는 visible만 끈다) →
      //  글자(nameText)만 보면 안 되고 speaker(=say가 받은 값, null이면 나레이션)와 visible을 같이 남긴다.
      dialog: w.dlg ? {
        visible: !!w.dlg.visible, text: w.dlg.boxText?.text ?? "",
        speaker: w.dlg.speaker ?? null,
        nameShown: !!w.dlg.nameTag?.visible, plateShown: !!w.dlg.namePlate?.visible,
        nameText: w.dlg.nameTag?.text ?? "",
      } : null,
      eventCount: (w.events2 ?? []).length,
      spriteCount: (w.events2 ?? []).filter((x) => x.sprite).length,
    };
  }
  if (b && b.scene.isActive()) {
    out.battle = {
      trainerId: b.trainerId ?? null,
      trainerName: b.trainerDef?.name ?? null,
      typeName: b.trainerDef?.typeName ?? null,
      enemySpecies: b.enemyTeam?.map((p) => `${p.speciesId ?? p.id ?? "?"}Lv${p.level}`) ?? null,
      enemyIdx: b.enemyIdx ?? null,
      enemyBoxName: b.enemyBox?.nameText?.text ?? null,
      msg: b.msgText?.text ?? "",
      outcome: b.outcome ?? null,
    };
  }
  return out;
}, [MAP, EV_ID, SELF_KEY, END_TILE]);

/**
 * 이미 저장된 PNG를 재보고 증거 목록에 올린다 — 크기·SHA-256·시각·씬 상태 + **검은/빈 화면 자동 탈락**.
 * (찍는 시점은 부르는 쪽이 정한다. 한 프레임짜리 장면은 페이지 안에서 직접 스냅샷을 걸기 때문이다.)
 */
const recordShot = async (stage, file, note) => {
  const st = await state();
  const buf = fs.readFileSync(file);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  // 픽셀 통계는 **저장한 그 PNG 파일 자체**를 다시 읽어서 낸다(캔버스의 지금 프레임이 아니다 —
  //  찍고 나서 화면이 바뀌었어도 통계와 파일이 어긋나지 않는다). 디코딩은 브라우저 것을 빌려 쓴다.
  const px = await page.evaluate(async (b64) => {
    const im = new Image();
    await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = `data:image/png;base64,${b64}`; });
    const s = document.createElement("canvas");
    s.width = 160; s.height = 90;
    s.getContext("2d").drawImage(im, 0, 0, 160, 90);
    const d = s.getContext("2d").getImageData(0, 0, 160, 90).data;
    let sum = 0; const set = new Set();
    for (let i = 0; i < d.length; i += 4) {
      sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      set.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    }
    return { mean: +(sum / (d.length / 4)).toFixed(1), colors: set.size };
  }, buf.toString("base64"));
  const entry = {
    stage, note, file, bytes: buf.length, sha256: sha,
    at: new Date().toISOString(), pixels: px,
    fresh: !fs.existsSync(file) ? false : true,
    state: st,
  };
  // 검은 화면(평균 밝기 8 미만)·단색 화면(색 5가지 미만)은 증거로 인정하지 않는다.
  entry.pixelsOk = px.mean >= 8 && px.colors >= 5;
  manifest.push(entry);
  log(`\n=== ${stage} ===`);
  log(`  파일 ${file}\n  ${buf.length} bytes · sha256 ${sha}\n  픽셀 평균밝기 ${px.mean} · 색 ${px.colors}종 → ${entry.pixelsOk ? "OK" : "❌ 검은/빈 화면"}`);
  log(`  상태 ${JSON.stringify(st)}`);
  return entry;
};

/**
 * 지금 화면을 찍어 `<단계>.png`로 저장하고 바로 증거 목록에 올린다.
 * 파일명은 단계 이름 그대로이고, **실행 시각이 들어간 새 폴더(OUT)** 안에 떨어지므로 지난 회차를 덮어쓰지 않는다.
 * 진단 모드(--diag)에서는 파일을 만들지 않고 상태만 남긴다.
 */
const capture = async (stage, note) => {
  if (DIAG) { log(`\n=== ${stage} (진단 모드 — 캡처 없음) ===\n  상태 ${JSON.stringify(await state())}`); return null; }
  const file = path.join(OUT, `${stage}.png`);
  await snap(page, file);
  return recordShot(stage, file, note);
};

// ── 부팅 ────────────────────────────────────────────────────────────────
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });
await page.waitForFunction(() => window.__game.scene.getScenes(true).length > 0, { timeout: 15000 });

const stopOthers = (keep) => page.evaluate((k) => {
  const g = window.__game;
  g.scene.scenes.forEach((s) => {
    if (s.scene.key !== k && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) g.scene.stop(s.scene.key);
  });
}, keep);

/** 오늘(0810) 확인 항목을 **디버그 메뉴에서 그대로** 실행한다 — 상단 확인바에 [0810]이 뜬다. */
const runTodayCheck = async () => {
  await stopOthers("DebugMenuScene");
  await page.evaluate(() => window.__game.scene.start("DebugMenuScene"));
  await until(() => window.__game.scene.getScene("DebugMenuScene")?.scene.isActive(), undefined, 15000);
  await page.waitForTimeout(600);
  await page.evaluate((d) => window.__game.scene.getScene("DebugMenuScene").runCheck(d, 0), CHECK_DATE);
  const ok = await until(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return !!s && s.scene.isActive() && s.sys.settings.status === 5;
  }, undefined, 20000);
  log(`  0810 확인 항목 실행 → WorldScene ${ok ? "OK" : "❌"}`);
  return ok;
};

/** 새 게임처럼 스위치를 비운다(아일라를 아직 안 만난 상태). */
const resetStory = () => page.evaluate(() => {
  const g = window.__game;
  g.registry.set("eventSelfSwitches", {});
  g.registry.set("arSwitches", {});
  g.registry.remove("eventContinue");
});

/** 대사창이 뜰 때까지 기다린다(자동실행이 실제로 말을 걸었다는 증거). */
const waitDialog = (timeout = 20000) => until(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!s && s.scene.isActive() && !!s.dlg?.visible && !!s.dlg.boxText?.text;
}, undefined, timeout);

/** 아일라 그림이 실제로 올라올 때까지 기다린다. */
const waitAila = (timeout = 25000) => until(([map, id]) => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!(s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id)?.sprite;
}, [MAP, EV_ID], timeout);

const inBattle = () => page.evaluate(() => {
  const b = window.__game.scene.getScene("BattleScene");
  return !!b && b.scene.isActive();
});

/** 대사를 넘겨 배틀까지 간다. */
const toBattle = async (tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await inBattle()) return true;
    await press("c", 250);
  }
  return inBattle();
};

/**
 * 배틀을 **실제 입력으로** 끝낸다. 진행은 전부 확인키(c)이고, 판정·연출·복귀 경로는 게임 것 그대로다.
 *
 * ⚠️ QA 우회 하나만 쓴다 — headless에서 레벨 5끼리 수십 턴을 두들기면 시간이 너무 걸리고,
 *    기술 커서가 0번(파이리는 '울음소리')이라 위력 0인 기술만 나가 승부가 안 난다.
 *    → 지게 할 쪽 HP를 계속 0(내가 질 때는 1)으로 눌러 둔다. 기절 판정·다음 포켓몬·승패 분기는 게임이 한다.
 * ⚠️ 내 포켓몬이 쓰러지면 교체 화면(MenuScene)이 뜨고 BattleScene은 **pause**된다 →
 *    isActive()만 보면 "배틀이 끝났다"고 잘못 읽는다. pause까지 배틀로 센다.
 */
const finishBattle = async (want) => {
  await until(() => {
    const b = window.__game.scene.getScene("BattleScene");
    return !!b && b.scene.isActive() && (b.enemyTeam ?? []).length > 0 && (b.party ?? []).length > 0;
  }, undefined, 20000);
  let lastMsg = "";
  for (let i = 0; i < 240; i++) {
    const st = await page.evaluate((w) => {
      const g = window.__game;
      const b = g.scene.getScene("BattleScene");
      const on = !!b && (b.scene.isActive() || b.scene.isPaused());
      if (on) {
        if (w === "win") b.enemyTeam.forEach((p) => { p.currentHp = 0; });
        else b.party.forEach((p) => { if (p.currentHp > 1) p.currentHp = 1; });
      }
      return {
        on, scenes: g.scene.getScenes(true).map((s) => s.scene.key),
        msg: on ? (b.msgText?.text ?? "") : "",
        foe: on ? b.enemyTeam.map((p) => p.currentHp).join("/") : "",
        mine: on ? b.party.map((p) => p.currentHp).join("/") : "",
        outcome: on ? b.outcome : null,
      };
    }, want);
    if (!st.on) { log(`  배틀 종료 — 씬 ${st.scenes}`); return true; }
    if (st.msg !== lastMsg) { lastMsg = st.msg; log(`   · [${i}] 적HP ${st.foe} 내HP ${st.mine} · ${st.scenes} — ${st.msg}`); }
    await press("c", 200);
  }
  log("  ❌ 배틀이 안 끝났다");
  return false;
};

// ── 0. 결정론 초기화 ────────────────────────────────────────────────────
await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("playerName", "테스트");
  g.registry.set("playerGender", "boy");
});
await resetStory();

// ── 1. 아일라가 보이는 자동 대사 ─────────────────────────────────────────
log("\n── 1. 자동 대사 + 아일라 등장 ─────────────────────");
await runTodayCheck();
const sawAila = await waitAila();
const sawDialog = await waitDialog();
log(`  아일라 그림 ${sawAila ? "OK" : "❌"} · 자동 대사 ${sawDialog ? "OK" : "❌"}`);
// 첫 줄은 **나레이션**이다(이름창 없음). 한 줄 넘겨 **이름창이 "???"인** 아일라 대사에서 찍는다
//  (AGENTS.md: 첫 자기소개 전에는 `???`). 넘어갔는지 글자로 확인한다 — 고정 sleep으로 때려맞히지 않는다.
for (let i = 0; i < 8; i++) {
  const t = await page.evaluate(() => window.__game.scene.getScene("WorldScene")?.dlg?.boxText?.text ?? "");
  if (t === AILA_LINE) break;
  await press("c", 350);
}
await capture("stage1-aila-dialogue",
  `아일라가 (23,35)에서 **아래(플레이어 쪽)를 보고** 말을 건다 — 이름창 ??? · 플레이어(23,38)·NPC 발이 모두 원본 통행 가능 칸`);

// ── 2. ILLA:??? 배틀 ────────────────────────────────────────────────────
log("\n── 2. 트레이너 배틀 ILLA:??? ─────────────────────");
const gotBattle = await toBattle();
log(`  BattleScene 전환 ${gotBattle ? "OK" : "❌"}`);
await until(() => !!window.__game.scene.getScene("BattleScene")?.trainerDef, undefined, 15000);
await page.waitForTimeout(1200);
await capture("stage2-battle-illa", "BattleScene — trainerId ILLA:??? / 이름 ??? (첫 자기소개 전)");

// ── 3. 이기고 돌아와 이어실행 ───────────────────────────────────────────
log("\n── 3. 승리 후 이어실행 ─────────────────────────────");
const won = await finishBattle("win");
log(`  배틀 종료 ${won ? "OK" : "❌"}`);
await until(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!s && s.scene.isActive() && s.sys.settings.status === 5;
}, undefined, 25000);
// 돌아오자마자 **남은 대사부터 이어진다**(lines[10] "..."). 그 화면이 이어실행의 직접 증거다.
const contDlg = await until(() => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!s && s.scene.isActive() && !!s.dlg?.visible && s.dlg.boxText?.text === "...";
}, undefined, 20000);
log(`  이어실행 첫 대사("...") ${contDlg ? "OK" : "❌"}`);
await capture("stage3-after-win-dialogue", "승리 후 이어실행 — 배틀 뒤 남은 대사(lines[10] \"...\")부터 이어진다 · 아일라는 아직 (23,35)");

// 남은 대사를 넘기면 아일라가 원본 이동 루트로 (21,28)까지 걸어간다.
//  ⚠️ 목적지 (21,28)은 플레이어(23,38)에서 10칸 위 = **화면(세로 12칸) 밖**이라 도착한 모습은 찍을 수 없다.
//     원본 속도(speed5 = 한 칸 62.5ms)로 11칸을 0.7초에 지나가므로, 화면 안(23,34)~(21,33) 구간을
//     10ms 간격으로 지켜보다 **먼저 찍고 나중에 상태를 읽는다**.
const evTile = ([map, id]) => {
  const s = window.__game.scene.getScene("WorldScene");
  if (!s || !s.scene.isActive()) return null;
  const e = (s.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
  return { busy: !!s.busy, dlg: !!s.dlg?.visible, gx: e?.gx ?? null, gy: e?.gy ?? null, has: !!e };
};
// 마지막 대사까지 넘긴다(아일라가 아직 원래 칸에 있는 동안만).
for (let i = 0; i < 60; i++) {
  const st = await page.evaluate(evTile, [MAP, EV_ID]);
  if (!st || !st.has || st.gy !== START_TILE[1]) break;
  if (st.dlg) await press("c", 150); else await page.waitForTimeout(40);
}
// 걷는 모습은 **화면 안에 보이는 첫 칸 (23,34)** 에서 잡아야 한다.
//  카메라가 플레이어(23,38)를 가운데 두므로 (23,33) 위쪽은 상단 확인바에 가리고, 목적지 (21,28)은 아예 화면 밖이다.
//  한 칸이 62.5ms라 왕복 지연으로는 못 잡는다 → **페이지 안에서** rAF로 지켜보다 그 자리에서 스냅샷을 건다.
const moveTile = [23, 34];
const movedUrl = await page.evaluate(([map, id, tx, ty]) => new Promise((res) => {
  const g = window.__game;
  const t0 = Date.now();
  const tick = () => {
    if (Date.now() - t0 > 20000) return res(null);
    const s = g.scene.getScene("WorldScene");
    const e = (s?.events2 ?? []).find((x) => x.map === map && x.ev.id === id);
    if (!e) return res(null);                       // 벌써 사라졌다 = 놓쳤다
    if (e.gx === tx && e.gy === ty) { g.renderer.snapshot((im) => res(im?.src ?? null)); return; }
    requestAnimationFrame(tick);
  };
  tick();
}), [MAP, EV_ID, moveTile[0], moveTile[1]]);
let moveShot = null;
if (movedUrl && !DIAG) {
  const file = path.join(OUT, "stage3-after-win-move.png");
  fs.writeFileSync(file, Buffer.from(movedUrl.split(",")[1], "base64"));
  moveShot = await recordShot("stage3-after-win-move", file,
    `승리 후 이어실행 — 아일라가 원본 이동 루트(위2·왼2·위5)를 따라 (${moveTile})까지 걸어나감, 목적지 (21,28)`);
}
log(`  이동 중 캡처 ${movedUrl ? `OK — (${moveTile})에서 잡음` : "❌ (${moveTile}) 프레임을 못 잡았다"}`);

// 남은 줄(BGM 교체·셀프스위치 A)까지 끝날 때까지 둔다.
for (let i = 0; i < 120; i++) {
  const st = await page.evaluate(evTile, [MAP, EV_ID]);
  if (!st || !st.has) break;
  if (st.dlg) await press("c", 150); else await page.waitForTimeout(80);
}
await page.waitForTimeout(600);
await capture("stage3-after-win-final", "승리 후 최종 상태 — 아일라가 (21,28)로 비켜선 뒤 셀프스위치 A로 사라짐 · 상단 확인바 [0810]");

// 재진입해도 다시 안 걸린다(같은 확인 항목을 다시 실행).
await runTodayCheck();
await page.waitForTimeout(2500);
const rerun = await state();
log(`  재진입: EV10 ${rerun.world?.npc ? "❌ 아직 있다" : "OK 없다"} · busy=${rerun.world?.busy}`);

// ── 4. 지면 재도전 ──────────────────────────────────────────────────────
log("\n── 4. 패배 후 재도전 ───────────────────────────────");
await resetStory();
// 패배는 **파티가 전멸**해야 성립한다. 3마리를 다 재우려면 쓰러질 때마다 교체 화면(MenuScene)에서
//  살아 있는 칸을 골라야 하는데 그건 이 이벤트 검증과 상관없는 절차다 → 파티를 1마리로 줄여 둔다
//  (게임에서도 첫 포켓몬만 데리고 다니는 상태와 같다). 이후 판정·화이트아웃은 전부 게임 것 그대로다.
const partyN = await page.evaluate(() => {
  const g = window.__game;
  const p = (g.registry.get("playerParty") ?? []).slice(0, 1);
  g.registry.set("playerParty", p);
  return p.length;
});
log(`  패배용 파티 ${partyN}마리로 축소(전멸 = 패배)`);
await runTodayCheck();
await waitAila();
await waitDialog();
await toBattle();
await until(() => !!window.__game.scene.getScene("BattleScene")?.trainerDef, undefined, 15000);
const lost = await finishBattle("lose");
log(`  패배 처리 ${lost ? "OK" : "❌"}`);
// 원본대로 화이트아웃 → 집(InteriorScene). 셀프스위치 A는 꺼진 채여야 한다.
const home = await until(() => window.__game.scene.getScene("InteriorScene")?.scene.isActive(), undefined, 30000);
log(`  화이트아웃 → 집(InteriorScene) ${home ? "OK" : "❌"}`);
const afterLose = await page.evaluate((k) => ({
  selfA: !!(window.__game.registry.get("eventSelfSwitches") ?? {})[k],
  cont: window.__game.registry.get("eventContinue") ?? null,
  scenes: window.__game.scene.getScenes(true).map((s) => s.scene.key),
}), SELF_KEY);
log(`  패배 직후: 셀프스위치 A=${afterLose.selfA} (false여야 함) · 이어실행 예약=${JSON.stringify(afterLose.cont)} · 씬 ${afterLose.scenes}`);
// 다시 그 자리로 가면 아일라가 또 있고 자동실행이 다시 걸린다.
await runTodayCheck();
const againAila = await waitAila();
const againDlg = await waitDialog();
log(`  재도전: 아일라 ${againAila ? "OK" : "❌"} · 자동 대사 ${againDlg ? "OK" : "❌"}`);
// 이 장은 **나레이션 줄에서** 찍는다 — 화자가 없어졌으니 이름창(플레이어 이름 `테스트`)이 아예 없어야 한다.
//  타자기는 저절로 끝나므로 키를 누르지 않고 글자가 다 찍히기를 기다린다(눌러 넘기면 다음 줄로 가버린다).
const onNarration = await until((t) => {
  const s = window.__game.scene.getScene("WorldScene");
  return !!s && s.scene.isActive() && !!s.dlg?.visible && s.dlg.boxText?.text === t;
}, NARRATION, 15000);
log(`  나레이션 줄 정지 ${onNarration ? "OK" : "❌"} — 이름창은 없어야 한다`);
await capture("stage4-loss-retry",
  `패배(화이트아웃) 후 재진입 — 셀프스위치 A가 꺼져 아일라가 다시 서 있고 자동실행이 또 걸린다 · 나레이션 "${NARRATION}"에는 이름창이 없다`);

// ── 마무리 ──────────────────────────────────────────────────────────────
if (!DIAG) {
  const mf = path.join(OUT, "manifest.json");
  fs.writeFileSync(mf, JSON.stringify({ url: URL, at: new Date().toISOString(), consoleErrors: errors, stages: manifest }, null, 1));
  log(`\n증거 목록: ${mf}`);
  log(`캡처 폴더: ${OUT}`);
}
log(`\n콘솔 에러 ${errors.length}건`);
for (const e of errors.slice(0, 8)) log("   " + e);
const bad = manifest.filter((m) => !m.pixelsOk).map((m) => m.stage);
log(bad.length ? `❌ 픽셀 검사 탈락: ${bad.join(", ")}` : "픽셀 검사 전부 통과");
await browser.close();
process.exit(bad.length ? 1 : 0);
