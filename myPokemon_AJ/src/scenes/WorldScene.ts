import Phaser from "phaser";  // Phaser 도구 모음을 통째로 가져온다
import { Gender } from "../data/Player";

// 맵 장면 — 인트로에서 고른 성별의 주인공으로 돌아다닌다.
//  - 남(boy): Another Red 오버월드 trainer_RED (정통 RED)
//  - 여(girl): Another Red 오버월드 trainer_DAWN (빛나)
//  둘 다 한 프레임 32x48, 4열 x 4행(행0=아래, 1=왼쪽, 2=오른쪽, 3=위) 동일 규격.
export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private facing: "down" | "left" | "right" | "up" = "down";

  private gender: Gender = "boy";
  private readonly texKey = "hero";                 // 주인공 텍스처 키(성별 무관 공통)
  // 멈췄을 때(정지) 보여줄 방향별 프레임 = 각 행의 첫 프레임
  private idleFrame: Record<string, number> = { down: 0, left: 4, right: 8, up: 12 };

  constructor() {
    super("WorldScene");
  }

  preload(): void {
    // 인트로에서 저장한 성별을 읽는다(없으면 남자 기본)
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";

    // 잔디 배경 타일
    this.load.image("tiles", "assets/tilesets/town.png");

    // 성별에 맞는 주인공 오버월드 시트(둘 다 32x48, 4x4)
    const file = this.gender === "girl"
      ? "assets/characters/trainer_DAWN.png"        // 빛나(DAWN)
      : "assets/characters/trainer_RED.png";        // 정통 RED
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    const { width, height } = this.scale;

    // 잔디를 화면 전체에 깐다
    this.add.tileSprite(0, 0, width, height, "tiles").setOrigin(0, 0);

    // 주인공 도트는 또렷하게(픽셀 보존)
    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 4방향 걷기 애니메이션(행0=아래, 1=왼쪽, 2=오른쪽, 3=위, 각 행 4프레임)
    const mkWalk = (key: string, frames: number[]) =>
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(this.texKey, { frames }),
        frameRate: 8, repeat: -1,
      });
    mkWalk("walk-down", [0, 1, 2, 3]);
    mkWalk("walk-left", [4, 5, 6, 7]);
    mkWalk("walk-right", [8, 9, 10, 11]);
    mkWalk("walk-up", [12, 13, 14, 15]);
    this.idleFrame = { down: 0, left: 4, right: 8, up: 12 };

    this.player = this.add.sprite(width / 2, height / 2, this.texKey, this.idleFrame.down).setScale(3);
    this.cursors = this.input.keyboard!.createCursorKeys();

    // 안내 + B키로 배틀 데모 진입 (9세대 애니 스프라이트 확인용)
    const name = (this.registry.get("playerName") as string) ?? "";
    const hud = name ? `${name}  |  방향키: 이동  |  B: 배틀 데모` : "방향키: 이동   |   B: 배틀 데모(9세대)";
    this.add.text(12, 12, hud, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "18px", color: "#ffffff",
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
      this.player.setFrame(this.idleFrame[this.facing]);
    }
  }
}
