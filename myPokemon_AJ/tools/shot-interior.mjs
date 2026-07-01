// 방/거실 실게임 캡처 — 타이틀 → D(디버그) → 8(침실)/4(거실) → 스크린샷.
// 사용: node tools/shot-interior.mjs [출력폴더]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/mnt/c/Users/user/Desktop/PokemonWith_shots";
mkdirSync(OUT, { recursive: true });

const URL = "http://localhost:5180";
const browser = await chromium.launch({
  args: [
    "--use-gl=angle", "--use-angle=swiftshader",
    "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader",
    "--enable-webgl", "--no-sandbox",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function capture(numKey, name) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);          // 타이틀 로드
  await page.keyboard.press("d");           // 타이틀 → 디버그메뉴
  await page.waitForTimeout(600);
  await page.keyboard.press(numKey);        // 씬 바로가기
  await page.waitForTimeout(1800);          // 씬 로드 + fadeIn
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p });
  console.log("saved", p);
}

await capture("8", "01_bedroom");           // 8 = 침실 바로가기(skip)
await capture("4", "02_living");            // 4 = 거실 바로가기
await browser.close();
console.log("DONE →", OUT);
