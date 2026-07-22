import Phaser from "phaser";
import { checksOfDate, currentDebugCheck, stepDebugCheck } from "../data/debugChecks";

// 확인 항목을 실행하면 **어느 씬 위에도** 뜨는 상단 바.
//  별도 씬이라 scene.start로 화면을 갈아타도 살아 있는다 → 하루치를 ◀이전 / 다시 / 다음▶ 으로 순서대로 훑는다.
//  키: [ = 이전 · ] = 다음 · \ = 목록(디버그 메뉴). (게임이 안 쓰는 키만 골랐다.)
export default class DebugCheckBarScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;

  constructor() { super("DebugCheckBarScene"); }

  create(): void {
    this.scene.bringToTop();
    this.build();
    // 항목이 바뀌면(다음/이전) 바 내용도 새로 그린다.
    this.registry.events.on("changedata-debugCheck", this.build, this);
    this.scale.on("resize", this.build, this);
    this.events.once("shutdown", () => {
      this.registry.events.off("changedata-debugCheck", this.build, this);
      this.scale.off("resize", this.build, this);
    });

    const kb = this.input.keyboard!;
    kb.on("keydown-OPEN_BRACKET", () => stepDebugCheck(this.gameScene(), -1));
    kb.on("keydown-CLOSED_BRACKET", () => stepDebugCheck(this.gameScene(), +1));
    kb.on("keydown-BACK_SLASH", () => this.backToMenu());
  }

  // 지금 돌고 있는 '진짜' 씬(이 바 자신은 제외). 이동·복귀는 그 씬을 기준으로 해야 한다
  //  — 바에서 scene.start를 부르면 바가 죽고 옛 씬이 남는다.
  private gameScene(): Phaser.Scene {
    const others = this.scene.manager.getScenes(true).filter((s) => s.scene.key !== this.scene.key);
    return others[others.length - 1] ?? this;
  }

  private backToMenu(): void {
    const g = this.gameScene();
    const pos = currentDebugCheck(this.registry);
    this.registry.remove("debugCheck");
    // 목록으로 돌아가면 방금 보던 항목에 커서를 둔다(그다음 항목을 바로 이어 보게).
    if (g !== this) g.scene.start("DebugMenuScene", { checkDate: pos?.date, checkIdx: pos?.idx });
    this.scene.stop();
  }

  private build(): void {
    this.root?.destroy();
    const pos = currentDebugCheck(this.registry);
    if (!pos) { this.scene.stop(); return; }
    const list = checksOfDate(pos.date);
    const c = list[pos.idx];
    if (!c) { this.scene.stop(); return; }

    const { width } = this.scale;
    const FONT = "Galmuri11";
    const H = 50;
    this.root = this.add.container(0, 0);
    this.root.add(this.add.rectangle(0, 0, width, H, 0x0b1020, 0.92).setOrigin(0, 0)
      .setStrokeStyle(2, 0xffe27a, 0.5));

    const head = `[${pos.date}] ${pos.idx + 1}/${list.length}  ${c.title}`;
    this.root.add(this.add.text(12, 6, head, {
      fontFamily: FONT, fontSize: "16px", color: "#ffe27a",
    }));
    const extra = pos.extra?.demoMove ? `  (기술: ${String(pos.extra.demoMove)})` : "";
    // 한 줄로만 보여준다(바가 두꺼워지면 게임 화면을 가린다) → 화면 폭에 맞춰 잘라 쓴다.
    const maxCh = Math.max(20, Math.floor(width * 0.62 / 8));
    const see = `${c.see}${extra}`;
    this.root.add(this.add.text(12, 27, `👀 ${see.length > maxCh ? see.slice(0, maxCh - 1) + "…" : see}`, {
      fontFamily: FONT, fontSize: "13px", color: "#cfe0ff",
    }));

    // 오른쪽 버튼들 — 오른쪽부터 왼쪽으로 쌓는다.
    let x = width - 10;
    const btn = (label: string, onClick: () => void, color = "#ffffff") => {
      const t = this.add.text(x, H / 2, label, {
        fontFamily: FONT, fontSize: "14px", color,
        backgroundColor: "#26365a", padding: { x: 10, y: 6 },
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#ffe27a"));
      t.on("pointerout", () => t.setColor(color));
      t.on("pointerdown", onClick);
      x -= t.width + 6;
      this.root.add(t);
    };
    btn("목록 [\\]", () => this.backToMenu(), "#9fb3d8");
    btn("다음 ▶ []]", () => stepDebugCheck(this.gameScene(), +1));
    btn("다시", () => stepDebugCheck(this.gameScene(), 0));
    btn("◀ 이전 [[]", () => stepDebugCheck(this.gameScene(), -1));
  }
}
