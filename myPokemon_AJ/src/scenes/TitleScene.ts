import Phaser from "phaser";

// 게임 메인(타이틀) 화면 — 가장 먼저 뜨는 화면.
// 노을 마을 배경 + "Pokémon With" 로고 + 아래에 PRESS START! 안내.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload(): void {
    // 타이틀 배경(새 시작화면)과 로고. 둘 다 public/assets/title/ 에 있음.
    this.load.image("title_bg", "assets/title/title_bg_new.png");
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

    // 3) PRESS START — 로고 "With"처럼: 둥근 무광 파스텔 글씨 + 연한 체크그리드 색감 + 흰빛 후광(클릭 유도)
    const pressSize = Math.round(height * 0.034);   // 더 작게
    const py = height * 0.83;
    const fam = '"Baloo 2", sans-serif';            // 통통하고 둥근 폰트(내장)
    const strokeW = Math.max(4, Math.round(height * 0.006));

    // (a) 연한 파스텔 "체크 그리드" 텍스처 한 번만 생성 (연분홍/연민트 번갈아)
    const checkKey = "pastel_check";
    if (!this.textures.exists(checkKey)) {
      const s = 12;                                  // 한 칸 크기
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffe3ef, 1); g.fillRect(0, 0, s, s); g.fillRect(s, s, s, s); // 연분홍
      g.fillStyle(0xdaf4ec, 1); g.fillRect(s, 0, s, s); g.fillRect(0, s, s, s); // 연민트
      g.generateTexture(checkKey, s * 2, s * 2);
      g.destroy();
    }

    // (b) 글자 본체 — 무광 파스텔 핑크 + 흰 외곽선 + 흰빛 후광(offset 0 그림자 = glow, 캔버스에서도 보임)
    const press = this.add.text(width / 2, py, "PRESS START", {
      fontFamily: fam,
      fontSize: `${pressSize}px`,
      fontStyle: "700",
      color: "#ff9fb8",                 // 무광 파스텔 핑크
      stroke: "#ffffff",
      strokeThickness: strokeW,
    })
      .setOrigin(0.5)
      .setShadow(0, 0, "#ffffff", 14, true, true);  // 하얀 후광

    // (c) 체크그리드를 글자 "안쪽에만" 은은하게 (비트맵 마스크는 WebGL 전용이라 가드)
    const isWebGL = this.renderer.type === Phaser.WEBGL;
    let check: Phaser.GameObjects.TileSprite | undefined;
    if (isWebGL) {
      const maskText = this.add.text(width / 2, py, "PRESS START", {
        fontFamily: fam, fontSize: `${pressSize}px`, fontStyle: "700", color: "#ffffff",
      }).setOrigin(0.5).setVisible(false);
      check = this.add.tileSprite(width / 2, py, press.width, press.height, checkKey)
        .setOrigin(0.5)
        .setAlpha(0.5);
      check.setMask(maskText.createBitmapMask());
      // 진짜 글로우도 추가 (더 또렷한 후광)
      if (press.postFX) press.postFX.addGlow(0xffffff, 4, 0, false, 0.1, 16);
    }

    // (e) 클릭 유도 — 글자(+체크)가 같이 부드럽게 숨쉬듯 깜빡
    const blink = { v: 1 };
    this.tweens.add({
      targets: blink, v: 0.55, duration: 950, yoyo: true, repeat: -1, ease: "Sine.inOut",
      onUpdate: () => { press.setAlpha(blink.v); check?.setAlpha(0.5 * blink.v); },
    });

    // 입력: 스페이스/엔터 또는 클릭 → 게임 인트로(이름·성별)로
    const start = () => this.scene.start("IntroScene");
    this.input.keyboard!.once("keydown-SPACE", start);
    this.input.keyboard!.once("keydown-ENTER", start);
    this.input.once("pointerdown", start);

    // 개발용 — D 키로 씬 바로가기 메뉴(매번 처음부터 안 거치고 특정 화면 확인)
    this.input.keyboard!.once("keydown-D", () => this.scene.start("DebugMenuScene"));
    this.add.text(width - 12, height - 10, "[D] 디버그", {
      fontFamily: '"Galmuri11", sans-serif', fontSize: `${Math.round(height * 0.022)}px`,
      color: "#ffffff",
    }).setOrigin(1, 1).setAlpha(0.6);
  }
}
