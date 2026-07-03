import Phaser from "phaser";
import { Gender } from "../data/Player";

// 첫 마을 = 어나더레드 '태초마을'(Map55)을 소스에서 그대로 추출한 실제 맵.
//  - 맵 이미지: assets/world/pallet_town.png (52x20칸, 32px 타일)
//  - 충돌격자: assets/world/pallet_town.json (blocked) — AR passages 데이터에서 추출
//  - 격자(칸) 단위 이동 + 카메라가 주인공을 따라감(맵이 화면보다 큼).
//  - 연구소 문(28,14)로 들어가면 LabScene(스타팅), 우리집 문(17,7)로 들어가면 집(InteriorScene).
type Dir = "down" | "left" | "right" | "up";
interface Warp { x: number; y: number; to: string; dir?: Dir; room?: string }

const SCALE = 2;                 // 화면 확대(타일 32→64px)
const START = { x: 17, y: 8 };   // 우리집 문 앞

export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "down";

  private cols = 0; private rows = 0;
  private blocked: number[][] = [];
  private tile = 32 * SCALE;
  private tx = START.x; private ty = START.y;
  private moving = false; private busy = false;

  private warps: Warp[] = [
    { x: 28, y: 14, to: "lab", dir: "up" },                         // 포켓몬 연구소
    { x: 17, y: 7, to: "house", room: "living", dir: "up" },        // 우리집(거실로)
  ];

  private spawn = { ...START, face: "down" as Dir };

  constructor() { super("WorldScene"); }

  init(data: { spawn?: [number, number]; face?: Dir }): void {
    if (data?.spawn) this.spawn = { x: data.spawn[0], y: data.spawn[1], face: data.face ?? "down" };
    else this.spawn = { ...START, face: "down" };
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    this.load.image("pallet", "assets/world/pallet_town.png?v=" + Date.now());
    this.load.json("pallet_col", "assets/world/pallet_town.json?v=" + Date.now());
    this.load.audio("sfx_door", "assets/audio/door.ogg");
    const file = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    const col = this.cache.json.get("pallet_col") as { cols: number; rows: number; blocked: number[][] };
    this.cols = col.cols; this.rows = col.rows; this.blocked = col.blocked;

    this.textures.get("pallet").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const map = this.add.image(0, 0, "pallet").setOrigin(0, 0).setScale(SCALE).setDepth(0);

    const mkWalk = (key: string, frames: number[]) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mkWalk("walk-down", [0, 1, 2, 3]); mkWalk("walk-left", [4, 5, 6, 7]);
    mkWalk("walk-right", [8, 9, 10, 11]); mkWalk("walk-up", [12, 13, 14, 15]);

    this.tx = this.spawn.x; this.ty = this.spawn.y; this.facing = this.spawn.face;
    this.player = this.add.sprite(this.cx(this.tx), this.cy(this.ty), this.texKey, this.idleFrame[this.facing])
      .setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
    this.cursors = this.input.keyboard!.createCursorKeys();

    // 카메라: 맵 경계 설정 + 주인공 추적, 픽셀 또렷하게
    this.cameras.main.setBounds(0, 0, this.cols * this.tile, this.rows * this.tile);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // HUD(화면 고정)
    const name = (this.registry.get("playerName") as string) ?? "";
    this.add.text(12, 12, `${name ? name + "  |  " : ""}방향키: 이동  |  연구소 문으로 들어가기`, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);
    this.input.keyboard!.on("keydown-B", () => this.scene.start("BattleScene"));
  }

  private cx(tx: number): number { return (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return (ty + 1) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.blocked[ty][tx] === 0;
  }
  private warpAt(tx: number, ty: number): Warp | undefined {
    return this.warps.find((w) => w.x === tx && w.y === ty);
  }

  update(): void {
    if (this.busy || this.moving) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    this.moving = true;
    this.player.play(`walk-${this.facing}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: 150,
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; this.handleWarp(); },
    });
  }

  private handleWarp(): void {
    const w = this.warpAt(this.tx, this.ty);
    if (!w) return;
    if (w.dir && this.facing !== w.dir) return;
    this.busy = true;
    this.player.stop();
    this.sound.play("sfx_door", { volume: 0.5 });
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.time.delayedCall(340, () => {
      if (w.to === "lab") this.scene.start("LabScene");
      else if (w.to === "house") this.scene.start("InteriorScene", { room: w.room ?? "living", skipIntro: true });
    });
  }
}
