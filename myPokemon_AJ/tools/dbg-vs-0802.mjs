// 0802 VS 연출 검증 — AR Transitions::VSTrainer의 타이밍·좌표대로 도는지.
//  사용: node tools/dbg-vs-0802.mjs   (tools/ 안에서 실행, dev서버 5180 필요)
//  캡처: ../../.claude/.verify/0802_VS_*.png
//
// ⚠️ headless(swiftshader)는 ~3fps다 → 프레임을 세는 대신 **연출의 갱신 함수에 시각 t를 직접 먹여**
//    각 시점의 상태를 읽는다(0802 언덕 검증에서 배운 방법 — 프레임 샘플링은 값이 튄다).
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("../../.claude/.verify");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5180", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game?.isBooted, { timeout: 30000 });

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK " : "❌ "}${m}`); if (!c) fail++; };

/** 월드를 띄우고, VS 연출을 **시각 t를 직접 먹여** 훑을 수 있게 갈고리를 건다. */
async function armWorld() {
  await page.evaluate(() => {
    const g = window.__game;
    const old = g.scene.getScene("WorldScene");
    if (old?.__origUpdate) { old.events.off("update", old.__probe); old.__origUpdate = null; }
    g.registry.set("playerName", "레드");
    g.registry.set("playerGender", "boy");
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("WorldScene", { map: "route1", spawn: [25, 25], face: "down" });
  });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("WorldScene");
    return s?.scene.isActive() && s.player && !s.busy && !s.cameras.main.fadeEffect.isRunning;
  }, { timeout: 90000 });
}

/**
 * VS 연출을 직접 띄우되 **배틀로 넘어가지 않게** 막고, 내부 시계를 손으로 돌려 가며 상태를 읽는다.
 * playVsIntro는 scene.time.now 기준으로 도니까, time.now를 가짜로 밀어 원하는 시점을 재현한다.
 */
async function runVs(key, name) {
  return page.evaluate(async ([k, n]) => {
    const s = window.__game.scene.getScene("WorldScene");
    // 시계를 우리가 쥔다 — scene.time.now를 고정해 두고 원하는 시점으로 밀어 준다.
    const base = s.time.now;
    let fake = base;
    // ⚠️ set도 같이 열어 둬야 한다 — scene.events.emit("update")가 Phaser의 Clock.update를 부르고
    //    그 안에서 this.now에 대입한다. getter만 두면 "has only a getter"로 죽는다(첫 실행에서 겪음).
    Object.defineProperty(s.time, "now", { get: () => fake, set: () => {}, configurable: true });
    window.__vsDone = false;
    // ⚠️ playVsIntro를 직접 부르지 않는다 — **씬이 실제로 쓰는 진입 경로**(startBattleWithVs)를 태워야
    //    HUD 숨김·busy 처리까지 같이 검증된다. 배틀로는 안 넘어가게 콜백만 비워 둔다.
    s.startBattleWithVs(k, n, () => { window.__vsDone = true; });
    // ⚠️ 원본 연출은 **매 프레임 도는 걸 전제로 한 상태 기계**다(예: 0.9~1.1초 사이에
    //    "잔상이 1.2배 아래로 줄면 본체를 켠다"가 일어난다). 시각을 껑충 뛰면 그 전환을 통째로 건너뛴다
    //    (첫 실행에서 0.8→1.2로 뛰었다가 VS 본체가 안 켜져 실패했다).
    //    → 60fps처럼 16ms씩 촘촘히 굴려서 실제 플레이와 같은 경로를 밟게 한다.
    let curT = 0;
    window.__vsStep = (t) => {
      for (let x = curT; x < t; x = Math.min(t, x + 0.016)) {
        fake = base + x * 1000;
        s.events.emit("update");
        if (x === t) break;
      }
      fake = base + t * 1000;
      s.events.emit("update");
      curT = t;
    };
    // 시계를 원래대로(그냥 쓰는 값으로) 돌려 놓는다 — delete만 하면 다음 프레임까지 undefined가 된다.
    window.__vsRelease = () => {
      Object.defineProperty(s.time, "now", { value: fake, writable: true, configurable: true });
    };
    // 연출이 만든 오브젝트만 골라내는 도우미
    window.__vsPeek = () => {
      const top = s.children.list.filter((o) => o.depth >= 5000);
      const layer = top.find((o) => o.type === "Container");
      const flash = top.find((o) => o.type === "Rectangle");
      const kids = layer ? layer.list : [];
      const byTex = (t) => kids.find((o) => o.texture && o.texture.key === t);
      const bar = kids.find((o) => o.type === "TileSprite");
      const foe = byTex(`vs_${k}`);
      const txt = kids.find((o) => o.type === "Text");
      const rects = kids.filter((o) => o.type === "Rectangle");
      return {
        layerScale: layer ? layer.scaleX : null,
        barTileX: bar ? bar.tilePositionX : null,
        barMasked: bar ? !!bar.mask : null,
        vsVisible: kids.filter((o) => o.texture && (o.texture.key === "vs1" || o.texture.key === "vs2") && o.visible)
                       .map((o) => ({ tex: o.texture.key, scale: +o.scaleX.toFixed(3) })),
        foeX: foe ? +foe.x.toFixed(1) : null,
        foeTinted: foe ? foe.isTinted : null,
        nameVisible: txt ? txt.visible : null,
        nameText: txt ? txt.text : null,
        rearBlackVisible: rects[0] ? rects[0].visible : null,
        frontBlackVisible: rects[1] ? rects[1].visible : null,
        flashAlpha: flash ? +flash.alpha.toFixed(3) : null,
        // ⚠️ 채우기 알파도 같이 본다 — alpha만 보면 "숫자는 맞는데 화면엔 안 그려지는" 버그를 놓친다(실제로 겪음).
        flashFill: flash ? flash.fillAlpha : null,
        alive: !!layer,
      };
    };
    return true;
  }, [key, name]);
}
const step = (t) => page.evaluate((tt) => { window.__vsStep(tt); return window.__vsPeek(); }, t);
// ⚠️ 시각을 손으로 민 직후에 찍으면 **아직 그 상태로 렌더되기 전 프레임**이 찍힌다(headless ~3fps).
//    실제로 화이트아웃 캡처가 하얗지 않게 나왔다 → 두 프레임 그려질 때까지 기다렸다 찍는다.
const shot = async (file) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, file) });
};

// ══ 1. 그린전 ══════════════════════════════════════════════════════════════
console.log("\n[1] 그린 — 원본 타이밍대로 도는가");
await armWorld();
await runVs("LEADER_Green", "그린");

const hud = await page.evaluate(() => {
  const h = window.__game.scene.getScene("WorldScene").children.getByName("hud");
  return h ? h.visible : null;
});
ok(hud === false, "VS가 시작되면 우리 HUD(방향키 안내)는 감춰진다 — 원본엔 없는 것이라 화면에 비치면 안 된다");

const at0 = await step(0.10);   // 띠가 깔리는 중
ok(at0.alive && at0.barMasked === true, "0.10s — 띠가 지그재그 마스크로 깔리는 중");
ok(at0.vsVisible.length === 0, "0.10s — VS 로고는 아직 안 보인다");

const at05 = await step(0.5);
ok(at05.barMasked === false, "0.50s — 0.2s에 마스크가 걷혀 띠가 다 보인다");
ok(at05.barTileX !== at0.barTileX, "띠가 실제로 흐른다(tilePosition이 변한다)");

const at08 = await step(0.8);
ok(at08.vsVisible.length > 0 && at08.vsVisible.every((v) => v.tex === "vs2"),
   `0.80s — VS 잔상(vs2)이 커진 채 등장 ${JSON.stringify(at08.vsVisible.map((v) => v.scale))}`);

const at12 = await step(1.2);
const main = await page.evaluate(() => {
  const s = window.__game.scene.getScene("WorldScene");
  const layer = s.children.list.find((o) => o.depth >= 5000 && o.type === "Container");
  const m = layer.list.find((o) => o.texture && o.texture.key === "vs1");
  return { visible: m.visible, scale: +m.scaleX.toFixed(2) };
});
ok(main.visible && main.scale === 1, "1.20s — 잔상이 사라지고 VS 본체(vs1)만 원래 크기로 남는다");

const at13 = await step(1.32);
const at15 = await step(1.5);
ok(at13.foeX > at15.foeX, `1.32s→1.50s 상대가 오른쪽에서 들어온다 (x ${at13.foeX} → ${at15.foeX})`);
ok(at15.foeTinted === true, "1.50s — 아직 **검은 실루엣**이다");
ok(at15.nameVisible === false, "1.50s — 이름은 아직 안 뜬다");
await shot("0802_VS_1_실루엣.png");

const at20 = await step(2.05);   // 플래시 절반 지점 이후
ok(at20.foeTinted === false, "2.05s — 번쩍인 뒤 상대에 **색이 들어온다**");
ok(at20.nameVisible === true && at20.nameText === "그린", `2.05s — 이름 "${at20.nameText}"이 뜬다`);
ok(at20.rearBlackVisible === true, "2.05s — 뒤 배경이 어두워진다(원본 opacity 224)");

const at25 = await step(2.5);
await shot("0802_VS_2_완성.png");
ok(at25.flashAlpha === 0, "2.50s — 플래시가 걷혀 화면이 안정된다");

const at33 = await step(3.3);
ok(at33.flashAlpha > 0.5, `3.30s — 화이트아웃 진행 중 (흰색 ${at33.flashAlpha})`);
ok(at33.flashFill === 1, "화이트아웃 사각형이 실제로 칠해진다(fillAlpha=1) — 화면에 안 그려지는 걸 막는 검사");
await shot("0802_VS_3_화이트아웃.png");

const at39 = await step(3.9);
ok(at39.frontBlackVisible === true, "3.90s — 검은 막이 덮이기 시작(블랙아웃)");

await step(4.05);
ok(await page.evaluate(() => window.__vsDone), "4.00s — 연출이 끝나고 약속(Promise)이 풀린다");
ok(!(await page.evaluate(() => window.__vsPeek().alive)), "끝나면 연출 오브젝트가 전부 정리된다");
await page.evaluate(() => window.__vsRelease());

// ══ 2. 네모 ════════════════════════════════════════════════════════════════
console.log("\n[2] 네모 — 잘라 만든 초상이 같은 연출로 도는가");
await armWorld();
await runVs("NEMONA", "네모");
await step(1.5);
const n20 = await step(2.05);
ok(n20.foeTinted === false && n20.nameText === "네모", `네모도 같은 연출로 색이 들어오고 이름이 뜬다`);
// ⚠️ 2.05s는 **플래시가 최대(순백)인 순간**이라 사진으론 아무것도 안 보인다 → 그린과 같은 2.5s에서 찍는다.
await step(2.5);
await shot("0802_VS_4_네모.png");
await step(4.05);
await page.evaluate(() => window.__vsRelease());

// ══ 3. 초상이 없는 상대는 VS가 안 뜬다(원본 규칙) ══════════════════════════
console.log("\n[3] 초상이 없는 잡트레이너는 VS가 안 뜬다");
const gate = await page.evaluate(async () => {
  const mod = await import("/src/systems/vsIntro.ts");
  return {
    green: mod.vsKeyFromTrainerId("LEADER_Green:그린"),
    nemona: mod.vsKeyFromTrainerId("NEMONA"),
    youngster: mod.vsKeyFromTrainerId("YOUNGSTER:한주"),
    lass: mod.vsKeyFromTrainerId("LASS:유정"),
  };
});
ok(gate.green === "LEADER_Green" && gate.nemona === "NEMONA", "그린·네모는 VS 대상이다");
ok(gate.youngster === null && gate.lass === null, "반바지꼬마·짧은치마는 VS 대상이 아니다(기존 페이드)");

console.log(errors.length ? "\n콘솔에러:\n" + errors.join("\n") : "\n콘솔에러 없음");
if (errors.length) fail++;
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
await browser.close();
process.exit(fail ? 1 : 0);
