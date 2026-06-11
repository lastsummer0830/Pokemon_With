import Phaser from "phaser";

// 게임 메인(타이틀) 화면 — 가장 먼저 뜨는 화면.
// 노을 마을 배경 + "Pokémon With" 로고 + 아래에 PRESS START! 안내.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload(): void {
    // 타이틀 배경(노을 마을 수채화)과 로고. 둘 다 public/assets/title/ 에 있음.
    this.load.image("title_bg", "assets/title/title_bg.png");
    this.load.image("title_logo", "assets/title/logo.png");
  }

  create(): void {
    const { width, height } = this.scale;

    // 1) 배경 — 화면을 꽉 채우되 비율 유지(가장자리는 살짝 잘림 = cover 방식)
    const bg = this.add.image(width / 2, height / 2, "title_bg").setOrigin(0.5);
    const bgSrc = this.textures.get("title_bg").getSourceImage();
    const bgScale = Math.max(width / bgSrc.width, height / bgSrc.height);
    bg.setScale(bgScale);

    // 2) 로고 — 화면 위쪽 가운데. 폭의 약 46%에 맞추되 너무 커지지 않게 제한.
    const logo = this.add.image(width / 2, height * 0.40, "title_logo").setOrigin(0.5);
    const logoSrc = this.textures.get("title_logo").getSourceImage();
    const targetW = Math.min(width * 0.46, 560);          // 로고 목표 폭
    logo.setScale(targetW / logoSrc.width);
    // 둥실둥실 떠다니는 효과
    this.tweens.add({
      targets: logo, y: logo.y - 10, duration: 1600,
      yoyo: true, repeat: -1, ease: "Sine.inOut",
    });

    // 3) PRESS START! — 로고 "With"처럼 둥글고 무광인 글씨 + 주변이 은은하게 빛나는 느낌.
    const pressSize = Math.round(height * 0.045);   // 아까보다 더 작게
    const press = this.add.text(width / 2, height * 0.82, "PRESS START!", {
      fontFamily: '"Baloo 2", sans-serif',  // 통통하고 둥근 폰트(내장)
      fontSize: `${pressSize}px`,
      fontStyle: "700",
      color: "#ff7e9d",        // 부드러운 코랄핑크 (무광 단색)
      stroke: "#ffffff",       // 얇은 흰 외곽선
      strokeThickness: Math.max(3, Math.round(height * 0.005)),
    })
      .setOrigin(0.5)
      .setShadow(0, 3, "rgba(150,90,60,0.25)", 5, true, true); // 아주 옅은 그림자

    // 주변이 은은하게 빛나는 느낌 (WebGL일 때만 — 글로우 후처리). 따뜻한 흰빛.
    let glow: Phaser.FX.Glow | undefined;
    if (press.postFX) {
      glow = press.postFX.addGlow(0xffe7b3, 4, 0, false, 0.1, 16);
    }

    // 빛이 살짝 숨쉬듯 강해졌다 약해졌다 (깜빡임 대신 부드러운 반짝임)
    if (glow) {
      this.tweens.add({
        targets: glow, outerStrength: 1.5, duration: 900,
        yoyo: true, repeat: -1, ease: "Sine.inOut",
      });
    }
    // 글자 자체도 아주 살짝 깜빡 (시작하라는 신호)
    this.tweens.add({
      targets: press, alpha: 0.55, duration: 900,
      yoyo: true, repeat: -1, ease: "Sine.inOut",
    });

    // 내장 폰트가 늦게 준비되면 기본 글씨로 먼저 그려질 수 있어, 준비되면 다시 적용.
    if (document.fonts && document.fonts.load) {
      document.fonts
        .load(`700 ${pressSize}px "Baloo 2"`)
        .then(() => press.setFontFamily('"Baloo 2", sans-serif'))
        .catch(() => {});
    }

    // 입력: 스페이스/엔터 또는 클릭 → 맵 화면으로
    const start = () => this.scene.start("WorldScene");
    this.input.keyboard!.once("keydown-SPACE", start);
    this.input.keyboard!.once("keydown-ENTER", start);
    this.input.once("pointerdown", start);
  }
}
