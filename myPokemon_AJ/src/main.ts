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

new Phaser.Game(config);
