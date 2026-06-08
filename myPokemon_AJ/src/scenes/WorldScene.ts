import Phaser from "phaser";  // Phaser 도구 모음을 통째로 가져온다

// 맵 장면 — 진짜 포켓몬(FRLG) 트레이너 스프라이트로 돌아다닌다.
export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private facing: "down" | "left" | "right" | "up" = "down";

  constructor() {
    super("WorldScene");
  }

  preload(): void {
    // 잔디 배경 타일
    this.load.image("tiles", "assets/tilesets/town.png");
    // FRLG 트레이너 시트: 한 캐릭터 한 프레임이 24x32 (3열 x 4행)
    this.load.spritesheet("trainer", "assets/sprites/trainers.png", {
      frameWidth: 24, frameHeight: 32,
    });
  }

  create(): void {
    const { width, height } = this.scale;

    // 잔디를 화면 전체에 깐다
    this.add.tileSprite(0, 0, width, height, "tiles").setOrigin(0, 0);

    // 트레이너는 도트 그림이라 또렷하게(픽셀 보존). 잔디·일러스트는 부드럽게.
    this.textures.get("trainer").setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 시트의 첫 번째 캐릭터(빨간 모자 남주인공) 프레임으로 4방향 걷기 애니메이션
    // 12칸 가로 시트 기준: 아래=0~2, 왼쪽=12~14, 오른쪽=24~26, 위=36~38
    const mk = (key: string, a: number, b: number, c: number) =>
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers("trainer", { frames: [a, b, c, b] }),
        frameRate: 6, repeat: -1,
      });
    mk("walk-down", 0, 1, 2);
    mk("walk-left", 12, 13, 14);
    mk("walk-right", 24, 25, 26);
    mk("walk-up", 36, 37, 38);

    this.player = this.add.sprite(width / 2, height / 2, "trainer", 1).setScale(4);
    this.cursors = this.input.keyboard!.createCursorKeys();

    // 안내 + B키로 배틀 데모 진입 (9세대 애니 스프라이트 확인용)
    this.add.text(12, 12, "방향키: 이동   |   B: 배틀 데모(9세대)", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#ffffff",
      backgroundColor: "#00000066", padding: { x: 8, y: 4 },
    });
    this.input.keyboard!.on("keydown-B", () => this.scene.start("BattleScene"));
  }

  update(): void {
    const speed = 4;
    let moving = true;

    if (this.cursors.left.isDown) {
      this.player.x -= speed; this.facing = "left"; this.player.play("walk-left", true);
    } else if (this.cursors.right.isDown) {
      this.player.x += speed; this.facing = "right"; this.player.play("walk-right", true);
    } else if (this.cursors.up.isDown) {
      this.player.y -= speed; this.facing = "up"; this.player.play("walk-up", true);
    } else if (this.cursors.down.isDown) {
      this.player.y += speed; this.facing = "down"; this.player.play("walk-down", true);
    } else {
      moving = false;
    }

    // 멈추면 애니메이션 끄고 그 방향 정지 프레임으로
    if (!moving) {
      this.player.stop();
      const idle = { down: 1, left: 13, right: 25, up: 37 }[this.facing];
      this.player.setFrame(idle);
    }
  }
}
