import Phaser from "phaser";          // Phaser 도구 모음을 통째로 가져온다
import TitleScene from "./scenes/TitleScene";
import WorldScene from "./scenes/WorldScene";
import BattleScene from "./scenes/BattleScene";
import HouseScene from "./scenes/HouseScene";

// 게임을 켜는 시작 파일 (예전 스윙의 GameMain 역할)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,         // WebGL이 되면 WebGL, 안 되면 Canvas로 자동 선택
  backgroundColor: "#000000",
  parent: "game",            // index.html의 <div id="game">에 붙는다
  scale: {
    mode: Phaser.Scale.RESIZE,  // 캔버스를 브라우저 창 크기에 꽉 맞춤 (검은 여백 없음)
    width: "100%",
    height: "100%",
  },
  scene: [TitleScene, WorldScene, BattleScene, HouseScene], // 맨 앞 씬이 가장 먼저 실행됨
};

// ★ 둥근 폰트(Baloo 2)를 게임이 시작되기 전에 확실히 로드한다.
//   (이렇게 안 하면 글자가 기본 폰트로 먼저 그려져서 "안 둥글게" 보임 — 오프라인 exe에서 특히)
function boot() {
  new Phaser.Game(config);
}
try {
  const baloo = new FontFace("Baloo 2", "url(assets/fonts/Baloo2-700.ttf)", {
    weight: "700",
    style: "normal",
  });
  baloo
    .load()
    .then((f) => document.fonts.add(f))
    .catch(() => {})        // 못 받아도 게임은 켠다
    .finally(boot);
} catch {
  boot();                   // FontFace 미지원 등 예외 시에도 게임은 켠다
}
