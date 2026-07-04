// 스타팅 선택 액자 후보 렌더 — LabScene을 preview 데이터로 직접 띄워 캡처.
//  사용: node tools/shot-lab.mjs [출력폴더]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = process.argv[2] || "/tmp/lab-shots";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5180";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--enable-webgl", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game && window.__game.isBooted, { timeout: 15000 });

async function startLab(data) {
  await page.evaluate((d) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
    g.scene.start("LabScene", d);
  }, data);
  await page.waitForTimeout(2600);
}
async function shot(name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p });
  console.log("saved", p);
}

// 1) 탁자+포켓볼 배치 검증(창 없이)
await startLab({ preview: "cream", pick: -1 });
await shot("00_table_balls");
// 2) 크림/남색 액자
await startLab({ preview: "cream", pick: 1 });
await shot("01_frame_cream");
// 3) 라벤더 액자
await startLab({ preview: "lavender", pick: 1 });
await shot("02_frame_lavender");
// 4) 성별카드 팔레트 액자
await startLab({ preview: "card", pick: 1 });
await shot("03_frame_card");

await browser.close();
console.log("DONE →", OUT);
