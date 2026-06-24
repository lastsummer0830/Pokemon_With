import Phaser from "phaser";
import { Gender } from "../data/Player";

// 시작 장면 — 주인공의 방(4세대 DP 침실)에서 게임이 시작된다.
// 정식 DP 침실 도트(public/assets/house/bedroom_dp.png) 위를 주인공이 돌아다니고,
// 아래로 나가면 마을(WorldScene)로 이어진다. 가구·벽은 충돌로 막는다.
export default class BedroomScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private facing: "down" | "left" | "right" | "up" = "down";

  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<string, number> = { down: 0, left: 4, right: 8, up: 12 };

  // 방 이미지의 화면상 위치/크기(리사이즈 때 재계산)
  private room = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
  private speed = 3;
  private exiting = false;

  // 방 이미지(200x150) 기준 비율 좌표들 ── 실제 그림에 맞춰 잡음
  private readonly WALK = { x0: 0.10, y0: 0.54, x1: 0.96, y1: 0.94 };   // 걸어다닐 수 있는 바닥
  private readonly BLOCKS = [
    { x0: 0.66, y0: 0.66, x1: 1.00, y1: 1.00 },   // 침대(오른쪽 아래)
    { x0: 0.00, y0: 0.70, x1: 0.21, y1: 0.97 },   // 화분(왼쪽 아래)
  ];
  private readonly EXIT = { x0: 0.34, y0: 0.90, x1: 0.62, y1: 1.0 };    // 아래쪽 나가는 곳
  private readonly START = { x: 0.45, y: 0.66 };

  constructor() {
    super("BedroomScene");
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    this.load.image("bedroom", "assets/house/bedroom_dp.png");
    const file = this.gender === "girl"
      ? "assets/characters/trainer_DAWN.png"
      : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    // 도트는 또렷하게(픽셀 보존)
    this.textures.get("bedroom").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 방 이미지
    this.add.image(0, 0, "bedroom").setOrigin(0, 0).setName("roomImg");

    // 걷기 애니메이션(행0=아래,1=왼쪽,2=오른쪽,3=위, 각 4프레임)
    const mk = (key: string, f: number[]) => this.anims.create({
      key, frames: this.anims.generateFrameNumbers(this.texKey, { frames: f }), frameRate: 8, repeat: -1,
    });
    mk("walk-down", [0, 1, 2, 3]); mk("walk-left", [4, 5, 6, 7]);
    mk("walk-right", [8, 9, 10, 11]); mk("walk-up", [12, 13, 14, 15]);

    // 주인공 — 발 밑이 기준점(origin 0.5,1)
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.down).setOrigin(0.5, 1);
    this.cursors = this.input.keyboard!.createCursorKeys();

    // 안내
    const name = (this.registry.get("playerName") as string) ?? "";
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  아래로 나가면 밖으로`, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff",
      backgroundColor: "#00000077", padding: { x: 8, y: 4 },
    }).setName("hud").setScrollFactor(0).setDepth(10);

    this.layout(true);
    this.scale.on("resize", () => this.layout(false), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize"));

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // 방 이미지를 화면 중앙에 비율 유지로 배치 + 좌표 갱신
  private layout(resetPlayer: boolean): void {
    const { width, height } = this.scale;
    const img = this.children.getByName("roomImg") as Phaser.GameObjects.Image;
    const src = this.textures.get("bedroom").getSourceImage();
    const scale = Math.min((width * 0.96) / src.width, (height * 0.92) / src.height);
    const w = src.width * scale, h = src.height * scale;
    const x = (width - w) / 2, y = (height - h) / 2;
    this.room = { x, y, w, h, scale };
    img.setPosition(x, y).setScale(scale);

    this.player.setScale(scale * 0.55);          // 방 비율에 맞춘 주인공 크기
    this.speed = Math.max(2, scale * 0.7);

    if (resetPlayer) {
      this.player.setPosition(x + this.START.x * w, y + this.START.y * h);
    }
  }

  // 방 비율좌표 → 화면좌표
  private fx(f: number): number { return this.room.x + f * this.room.w; }
  private fy(f: number): number { return this.room.y + f * this.room.h; }

  // 발 밑 좌표(fxp, fyp)가 걸을 수 있는 곳인지
  private canStand(px: number, py: number): boolean {
    if (px < this.fx(this.WALK.x0) || px > this.fx(this.WALK.x1)) return false;
    if (py < this.fy(this.WALK.y0) || py > this.fy(this.WALK.y1)) return false;
    for (const b of this.BLOCKS) {
      if (px > this.fx(b.x0) && px < this.fx(b.x1) && py > this.fy(b.y0) && py < this.fy(b.y1)) return false;
    }
    return true;
  }

  update(): void {
    if (this.exiting) return;
    let dx = 0, dy = 0, moving = true;
    if (this.cursors.left.isDown) { dx = -this.speed; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = this.speed; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -this.speed; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = this.speed; this.facing = "down"; }
    else moving = false;

    if (moving) {
      // 축별로 이동 시도(벽 슬라이드)
      if (dx && this.canStand(this.player.x + dx, this.player.y)) this.player.x += dx;
      if (dy && this.canStand(this.player.x, this.player.y + dy)) this.player.y += dy;
      this.player.play(`walk-${this.facing}`, true);

      // 나가는 곳 도착 → 마을로
      const px = this.player.x, py = this.player.y;
      if (px > this.fx(this.EXIT.x0) && px < this.fx(this.EXIT.x1) &&
          py > this.fy(this.EXIT.y0) && py < this.fy(this.EXIT.y1)) {
        this.exiting = true;
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("WorldScene"));
      }
    } else {
      this.player.stop();
      this.player.setFrame(this.idleFrame[this.facing]);
    }
  }
}
