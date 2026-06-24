import Phaser from "phaser";
import { Gender } from "../data/Player";

// 개발용 — 씬 바로가기 메뉴. 타이틀에서 D 키로 진입.
// 매번 처음부터(타이틀→인트로→…) 안 거치고 원하는 화면을 바로 확인하기 위함.
// 테스트용 이름/성별을 자동으로 채워서 어느 씬이든 바로 뜬다.
export default class DebugMenuScene extends Phaser.Scene {
  private gender: Gender = "boy";

  constructor() {
    super("DebugMenuScene");
  }

  create(): void {
    const { width, height } = this.scale;
    const FONT = "Galmuri11";

    this.add.rectangle(0, 0, width, height, 0x10141e, 1).setOrigin(0, 0);
    this.add.text(width / 2, height * 0.1, "🔧 디버그 — 씬 바로가기", {
      fontFamily: FONT, fontSize: "30px", color: "#ffe27a",
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.16, "원하는 화면을 눌러 바로 이동 (숫자키도 가능 · ESC=타이틀)", {
      fontFamily: FONT, fontSize: "16px", color: "#9fb3d8",
    }).setOrigin(0.5);

    // 성별 토글(테스트용)
    const genderTxt = this.add.text(width / 2, height * 0.24, "", {
      fontFamily: FONT, fontSize: "20px", color: "#ffffff",
      backgroundColor: "#2a3550", padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const refreshGender = () => genderTxt.setText(`성별: ${this.gender === "boy" ? "남(RED)" : "여(빛나)"}  ▶ 클릭해 전환`);
    refreshGender();
    genderTxt.on("pointerdown", () => { this.gender = this.gender === "boy" ? "girl" : "boy"; refreshGender(); });

    // 씬 버튼들
    const scenes: [string, string][] = [
      ["1. 타이틀", "TitleScene"],
      ["2. 인트로(성별·이름)", "IntroScene"],
      ["3. 시작 집(방2층↔거실1층)", "InteriorScene"],
      ["4. 마을(World)", "WorldScene"],
      ["5. 배틀(Battle)", "BattleScene"],
      ["6. 집 꾸미기(House)", "HouseScene"],
    ];
    const go = (key: string) => {
      // 테스트용 기본값 — 인트로를 건너뛰어도 씬이 동작하도록
      if (!this.registry.get("playerName")) this.registry.set("playerName", "테스트");
      this.registry.set("playerGender", this.gender);
      this.scene.start(key);
    };

    const startY = height * 0.34, gap = height * 0.085;
    scenes.forEach(([label, key], i) => {
      const t = this.add.text(width / 2, startY + i * gap, label, {
        fontFamily: FONT, fontSize: "22px", color: "#ffffff",
        backgroundColor: "#21314f", padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#ffe27a"));
      t.on("pointerout", () => t.setColor("#ffffff"));
      t.on("pointerdown", () => go(key));
      this.input.keyboard!.on(`keydown-${["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"][i]}`, () => go(key));
    });

    this.input.keyboard!.once("keydown-ESC", () => this.scene.start("TitleScene"));
  }
}
