import Phaser from "phaser";
import { artworkUrl, JOHTO_STARTERS } from "../api/pokeapi";

// 게임 메인(타이틀) 화면 — 가장 먼저 뜨는 화면.
// PokeAPI에서 하트골드 스타팅 3마리 공식 일러스트를 실시간으로 불러와 보여준다.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload(): void {
    // 외부(깃허브) 이미지를 불러오려면 CORS 설정이 필요하다
    this.load.crossOrigin = "anonymous";
    JOHTO_STARTERS.forEach((id, i) => {
      this.load.image(`starter${i}`, artworkUrl(id));
    });
  }

  create(): void {
    const { width, height } = this.scale;

    // 배경: 위→아래 그라데이션 (하트골드 느낌의 금빛)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xf7da7f, 0xf7da7f, 0xe89986, 0xe89986, 1);
    bg.fillRect(0, 0, width, height);

    // 스타팅 3마리 일러스트 (그림이 안 받아지면 색깔 원으로 대체)
    const artH = height * 0.32;        // 일러스트 높이 = 화면 높이의 32%
    const spacing = width * 0.24;      // 좌우 간격
    JOHTO_STARTERS.forEach((_, i) => {
      const x = width / 2 + (i - 1) * spacing;
      const y = height * 0.56;
      const key = `starter${i}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key).setOrigin(0.5);
        img.setScale(artH / img.height); // 화면 크기에 맞춰 비율로 확대
        // 둥실둥실 떠다니는 효과
        this.tweens.add({
          targets: img, y: y - 12, duration: 1100 + i * 150,
          yoyo: true, repeat: -1, ease: "Sine.inOut",
        });
      } else {
        this.add.circle(x, y, artH * 0.4, 0xffffff, 0.6);
      }
    });

    // 제목
    this.add.text(width / 2, height * 0.18, "myPokemon", {
      fontFamily: "sans-serif", fontSize: `${Math.round(height * 0.13)}px`,
      fontStyle: "bold", color: "#4a3d1c",
    }).setOrigin(0.5).setShadow(0, 4, "#ffffff", 2);

    this.add.text(width / 2, height * 0.30, "집을 꾸미면 포켓몬이 강해진다", {
      fontFamily: "sans-serif", fontSize: `${Math.round(height * 0.04)}px`,
      color: "#7a4e2e",
    }).setOrigin(0.5);

    // 시작 안내 (깜빡임)
    const prompt = this.add.text(width / 2, height * 0.88,
      "▶  SPACE 또는 클릭으로 시작", {
        fontFamily: "sans-serif", fontSize: `${Math.round(height * 0.045)}px`,
        fontStyle: "bold", color: "#ffffff",
        backgroundColor: "#cf6f57", padding: { x: 20, y: 10 },
      }).setOrigin(0.5);
    this.tweens.add({
      targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1,
    });

    // 입력: 스페이스 또는 클릭 → 맵 화면으로
    const start = () => this.scene.start("WorldScene");
    this.input.keyboard!.once("keydown-SPACE", start);
    this.input.once("pointerdown", start);
  }
}
