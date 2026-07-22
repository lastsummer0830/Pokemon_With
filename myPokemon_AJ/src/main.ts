import Phaser from "phaser";          // Phaser 도구 모음을 통째로 가져온다
import TitleScene from "./scenes/TitleScene";
import MainMenuScene from "./scenes/MainMenuScene";
import IntroScene from "./scenes/IntroScene";
import BedroomScene from "./scenes/BedroomScene";
import InteriorScene from "./scenes/InteriorScene";
import DebugMenuScene from "./scenes/DebugMenuScene";
import WorldScene from "./scenes/WorldScene";
import LabScene from "./scenes/LabScene";
import GymScene from "./scenes/GymScene";
import BuildingScene from "./scenes/BuildingScene";
import BattleScene from "./scenes/BattleScene";
import MenuScene from "./scenes/MenuScene";
import BagScene from "./scenes/BagScene";
import PokedexScene from "./scenes/PokedexScene";
import SummaryScene from "./scenes/SummaryScene";
import DebugCheckBarScene from "./scenes/DebugCheckBarScene";
import { loadArDb } from "./data/ar";

// 게임을 켜는 시작 파일 (예전 스윙의 GameMain 역할)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,         // WebGL이 되면 WebGL, 안 되면 Canvas로 자동 선택
  backgroundColor: "#000000",
  // dev에서만: WebGL 캔버스가 스크린샷에 검게 나오는 것 방지(preserveDrawingBuffer). 배포 exe엔 영향 없음.
  render: { preserveDrawingBuffer: import.meta.env.DEV },
  parent: "game",            // index.html의 <div id="game">에 붙는다
  scale: {
    mode: Phaser.Scale.RESIZE,  // 캔버스를 브라우저 창 크기에 꽉 맞춤 (검은 여백 없음)
    width: "100%",
    height: "100%",
  },
  // 맨 앞 씬이 가장 먼저 실행됨. Title → Intro(성별·이름) → Interior(시작 집: 방2층↔거실1층) → World 순서.
  scene: [TitleScene, MainMenuScene, IntroScene, InteriorScene, BedroomScene, DebugMenuScene, WorldScene, LabScene, GymScene, BuildingScene, BattleScene, MenuScene, BagScene, PokedexScene, SummaryScene, DebugCheckBarScene],
};

// ★ 게임 시작 전에 폰트를 확실히 로드한다.
//   (이렇게 안 하면 글자가 기본 폰트로 먼저 그려졌다가 바뀜 — 오프라인 exe에서 특히)
//   - Baloo 2: 타이틀의 둥근 영문 로고용
//   - Galmuri11: 옛날 픽셀 포켓몬 게임 감성의 한글 도트 폰트(인트로 대사용)
function boot() {
  const game = new Phaser.Game(config);
  // dev 전용: 자동 플레이테스트(playwright)에서 씬 상태를 읽기 위해 노출. 배포에 영향 없음.
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
function loadFont(family: string, url: string, weight = "400") {
  // FontFace 로 폰트 하나를 받아서 document에 등록(실패해도 무시)
  try {
    const f = new FontFace(family, `url(${url})`, { weight, style: "normal" });
    return f.load().then((face) => { document.fonts.add(face); }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}
// AR 배틀 데이터(타입·종족·기술)도 미리 데워둔다(배틀 진입 지연 방지). 실패해도 게임은 켠다.
loadArDb().catch(() => {});
Promise.all([
  loadFont("Baloo 2", "assets/fonts/Baloo2-700.ttf", "700"),
  loadFont("Galmuri11", "assets/fonts/Galmuri11.ttf", "400"),
  loadFont("Galmuri11", "assets/fonts/Galmuri11-Bold.ttf", "700"),
]).finally(boot);   // 폰트를 다 받았든 못 받았든 게임은 켠다
