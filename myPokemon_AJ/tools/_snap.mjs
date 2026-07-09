// 공용 캡처: WebGL 캔버스를 화면에 보이는 그대로 저장(page.screenshot은 검게 나옴).
import fs from "fs";
export async function snap(page, path) {
  const u = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; let done = false;
    const f = (x) => { if (!done) { done = true; res(x); } };
    try { g.renderer.snapshot((im) => f(im && im.src ? im.src : null)); } catch (e) { f(null); }
    setTimeout(() => { const c = document.querySelector("canvas"); f(c ? c.toDataURL("image/png") : null); }, 1500);
  }));
  if (!u) throw new Error("canvas capture 실패");
  fs.writeFileSync(path, Buffer.from(u.split(",")[1], "base64"));
}
