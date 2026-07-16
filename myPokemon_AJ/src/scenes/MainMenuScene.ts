import Phaser from "phaser";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";
import { hasSave, loadGame } from "../systems/save";

// 메인 메뉴 화면 — 타이틀(로고+PRESS START)에서 엔터/클릭하면 이 화면이 뜬다.
// 톤 = 화이트/블루. 밝은 하늘 그라데 배경 + 몬스터볼(우하단) + AR식 가로 메뉴 바.
// 메뉴 바 = 흰색 반투명 채움 + 블루 테두리 + 좌상/우하 코너 화살표(베벨). AR 새게임 화면의 비율·코너를 그대로 따른다.
//  새 게임 / 이어하기 / 옵션 / 게임 종료 — ↑↓·마우스 이동, Enter/클릭 선택.
export default class MainMenuScene extends Phaser.Scene {
  private readonly FONT = '"Galmuri11", sans-serif';
  private readonly BAR_AR = 64 / 560; // 바 에셋 비율(높이/너비) — 스트레치 없이 비율 고정
  private items = [
    { label: "새 게임", action: "new" },
    { label: "이어하기", action: "continue" },
    { label: "옵션", action: "options" },
    { label: "게임 종료", action: "quit" },
  ];
  private idx = 0;

  private bars: Phaser.GameObjects.Image[] = [];   // 항목별 바(평소/선택 텍스처를 갈아끼움)
  private rows: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private barRects: { x: number; y: number; w: number; h: number }[] = [];
  private toast?: Phaser.GameObjects.Text;

  constructor() {
    super("MainMenuScene");
  }

  preload(): void {
    this.load.image("menu_dither", "assets/title/menu_dither.png");     // 노을 파스텔 디더 배경(풀해상도, 볼 없음)
    this.load.image("menu_ball", "assets/title/menu_ball.png");         // 몬스터볼 스프라이트(별도)
    this.load.image("menu_bar", "assets/title/menu_bar.png");           // 메뉴 바(평소)
    this.load.image("menu_bar_sel", "assets/title/menu_bar_sel.png");   // 메뉴 바(선택)
    preloadCommonAudio(this);
  }

  create(): void {
    for (const k of ["menu_ball", "menu_bar", "menu_bar_sel"])
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.roundPixels = true;

    this.add.image(0, 0, "menu_dither").setOrigin(0.5).setName("bg");
    this.add.image(0, 0, "menu_ball").setOrigin(1, 1).setName("ball").setDepth(1); // 우하단 고정

    // 항목별 바 1장(선택되면 텍스처만 선택본으로 교체). 비율 고정이라 코너 화살표가 안 깨진다.
    this.bars = this.items.map(() => this.add.image(0, 0, "menu_bar").setOrigin(0, 0).setDepth(2));
    // 선택 표시 화살표(커서) — 노란색. 코너 삼각 위에 또렷하게 올라오도록 외곽선 살짝.
    this.cursor = this.add.text(0, 0, "▶", { fontFamily: this.FONT, color: "#2f7bf0", stroke: "#0e2a66", strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(5);
    this.rows = this.items.map((_, i) => {
      // 블루 글씨 + 방향성 드롭 그림자 = AR식 또렷한 메뉴 폰트.
      const t = this.add.text(0, 0, this.items[i].label, { fontFamily: this.FONT, color: "#2f6fd0" }).setOrigin(0, 0.5).setDepth(4);
      t.setShadow(3, 3, "#8d96a6", 1, false, true);
      return t;
    });

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));

    // 어나더레드식 키보드 전용 조작: ↑↓ 이동 / Z·Enter·Space 확인 / X·Esc 뒤로. (마우스 안 씀)
    this.input.keyboard!.on("keydown-UP", () => this.move(-1));
    this.input.keyboard!.on("keydown-DOWN", () => this.move(1));
    this.input.keyboard!.on("keydown-ENTER", () => this.choose());
    this.input.keyboard!.on("keydown-SPACE", () => this.choose());
    this.input.keyboard!.on("keydown-Z", () => this.choose());
    this.input.keyboard!.on("keydown-X", () => this.scene.start("TitleScene"));
    this.input.keyboard!.on("keydown-ESC", () => this.scene.start("TitleScene"));
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;

    // 배경 — 화면 꽉 채움(cover). 디더는 무늬라 잘려도 무방.
    const bg = this.children.getByName("bg") as Phaser.GameObjects.Image;
    const s = this.textures.get("menu_dither").getSourceImage();
    bg.setPosition(W / 2, H / 2).setScale(Math.max(W / s.width, H / s.height));

    // 몬스터볼 — 우하단 고정, 화면 높이에 비례. 항상 완전히 보임.
    const ball = this.children.getByName("ball") as Phaser.GameObjects.Image;
    ball.setScale(Math.max(0.8, (H / 720) * 1.15)).setPosition(W - W * 0.03, H - H * 0.04);

    // 메뉴 바 — 가로로 길게, 가운데 정렬, 윗쪽(볼과 안 겹치게). 높이는 너비 비율로 고정.
    const bw = Math.min(Math.max(W * 0.74, 540), 920); // 가로로 훨씬 크게
    const bh = Math.round(bw * this.BAR_AR);
    const gap = Math.round(bh * 0.24);           // 메뉴 간격 좁게
    const font = Math.round(Math.min(bh * 0.42, 30));
    const total = this.items.length * bh + (this.items.length - 1) * gap;
    const cx = W / 2;
    const top = Math.round((H - total) / 2 - H * 0.04); // 살짝 위, 가운데 정렬

    this.barRects = [];
    this.bars.forEach((bar, i) => {
      const by = top + i * (bh + gap);
      const r = { x: Math.round(cx - bw / 2), y: by, w: bw, h: bh };
      this.barRects.push(r);
      bar.setPosition(r.x, by).setDisplaySize(bw, bh);
      this.rows[i].setFontSize(font).setPosition(r.x + bh * 0.82, by + bh / 2);
    });
    this.cursor.setFontSize(Math.round(font * 0.8));
    this.refresh();
  }

  // 선택된 항목 = 선택 바(진한 블루 테두리)로 텍스처 교체 + 글씨 진하게.
  private refresh(): void {
    this.bars.forEach((b, i) => b.setTexture(i === this.idx ? "menu_bar_sel" : "menu_bar"));
    // 글자 효과(방향성 그림자)는 생성 시 고정 — 선택 표시는 바 테두리+커서가 담당.
    const r = this.barRects[this.idx];
    if (r) this.cursor.setPosition(Math.round(r.x + r.h * 0.28), Math.round(r.y + r.h / 2));
  }

  private move(d: number): void {
    this.idx = (this.idx + d + this.items.length) % this.items.length;
    this.refresh();
    playSfx(this, SFX.cursor, 0.4);
  }

  private choose(): void {
    playSfx(this, SFX.decision, 0.45);
    const action = this.items[this.idx].action;
    if (action === "new") {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("IntroScene"));
    } else if (action === "continue") {
      const data = hasSave() ? loadGame(this.registry) : null;
      if (!data) { this.showToast("저장된 게임이 없어요"); return; }
      // 저장 상태를 registry에 복원(loadGame이 처리) → 저장돼 있던 씬·위치로 이동.
      const loc = data.loc;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        if (loc.scene === "InteriorScene") this.scene.start("InteriorScene", { room: loc.room ?? "living", skipIntro: true });
        // 세이브의 tx/ty는 **그 맵 기준 로컬**이라 map을 같이 넘긴다(loadGame이 옛 세이브엔 "pallet"을 채워준다).
        else this.scene.start("WorldScene", { spawn: [loc.tx ?? 17, loc.ty ?? 8], map: loc.map ?? "pallet", face: loc.facing ?? "down" });
      });
    } else if (action === "options") {
      this.showToast("옵션은 준비 중이에요");
    } else if (action === "quit") {
      window.close();
    }
  }

  private showToast(msg: string): void {
    const { width: W, height: H } = this.scale;
    this.toast?.destroy();
    this.toast = this.add.text(W / 2, H * 0.9, msg, {
      fontFamily: this.FONT, fontSize: `${Math.round(H * 0.03)}px`, color: "#ffffff",
      backgroundColor: "#1c3a7acc", padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(10);
    this.time.delayedCall(1400, () => this.toast?.destroy());
  }
}
