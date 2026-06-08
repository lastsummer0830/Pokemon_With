import Phaser from "phaser";
import { frontPath, makeAnimatedFront } from "../game/pokemonSprite";

// 배틀 화면 (임시 데모) — Another Red 의 9세대 애니메이션 스프라이트가 진짜 움직이는지 보여준다.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  preload(): void {
    // 9세대 애니메이션 배틀 스프라이트
    this.load.image("mon_enemy", frontPath("koraidon"));   // 상대: 코라이돈
    this.load.image("mon_ally", frontPath("sprigatito"));  // 내 쪽: 나오하 (앞모습으로 임시)
  }

  create(): void {
    const { width, height } = this.scale;

    // 간단한 배경 (위 하늘 / 아래 땅)
    this.add.rectangle(0, 0, width, height, 0x9bd1e8).setOrigin(0);
    this.add.rectangle(0, height * 0.62, width, height * 0.38, 0xcde3a0).setOrigin(0);

    // 9세대 포켓몬 2마리 — 각각 애니메이션 재생
    makeAnimatedFront(this, "mon_enemy", width * 0.72, height * 0.32, 1.6); // 상대
    makeAnimatedFront(this, "mon_ally", width * 0.28, height * 0.62, 2.0);  // 내 쪽

    this.add.text(width / 2, 24,
      "⚔️ 배틀 데모 — 9세대 애니메이션 스프라이트 (ESC로 맵으로)", {
        fontFamily: "sans-serif", fontSize: `${Math.round(height * 0.035)}px`,
        color: "#2a2a2a",
      }).setOrigin(0.5, 0);

    this.input.keyboard!.once("keydown-ESC", () => this.scene.start("WorldScene"));
  }
}
