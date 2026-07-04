// 스타팅 선택 대사 흐름 검증 — 별명 입력 경로까지 단계별 캡처.
//  사용: node tools/shot-lab-flow.mjs [출력폴더]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/tmp/lab-flow";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5180";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

await page.evaluate(() => {
  const g = window.__game;
  g.registry.set("playerName", "레드");
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start("LabScene", { preview: "cream", pick: 1 }); // 파이리
});
await page.waitForTimeout(2800);           // 씬 로드 + 첫 대사 타이핑 시작

let n = 0;
const shot = async (label) => {
  const p = `${OUT}/${String(++n).padStart(2, "0")}_${label}.png`;
  await page.screenshot({ path: p }); console.log("saved", p);
};
const key = async (k, w = 700) => { await page.keyboard.press(k); await page.waitForTimeout(w); };
// 타자기 완성 후 캡처 → 다음으로 진행
const capLine = async (label) => { await key("Space", 300); await shot(label); await key("Space", 700); };

await capLine("dex_intro");      // "파이리. 불꽃타입, 도롱뇽포켓몬."
await capLine("dex_flavor");     // 공식 도감 설명
// 오박사 확인
await key("Space", 300);         // 오박사 대사 타자기 완성
await shot("oak_confirm");
await key("Space", 600);         // → 예/아니오 메뉴
await shot("oak_yesno");
await key("Space", 700);   // 예(기본 커서 위치)
// 별명 질문
await key("Space", 300); await shot("nick_ask");
await key("Space", 600); await shot("nick_yesno");
await key("Space", 700);   // 예(기본 커서 위치) → HTML 입력창
await shot("nick_input_empty");
await page.fill("input", "불꽃이");
await page.waitForTimeout(300); await shot("nick_input_typed");
await page.keyboard.press("Enter"); await page.waitForTimeout(800);
// 배웅
await key("Space", 300); await shot("nick_praise");     // "불꽃이! 좋은 이름이구나."
await key("Space", 300); await shot("farewell");        // "불꽃이와 함께 좋은 여행이..."

await browser.close();
console.log("DONE →", OUT);
