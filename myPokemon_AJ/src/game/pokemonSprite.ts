import Phaser from "phaser";

// Another Red 의 포켓몬 Front 스프라이트는 "가로로 이어붙인 정사각 프레임" 애니메이션 시트다.
// (프레임 크기 = 이미지 높이, 프레임 개수 = 너비 / 높이)  예: SPRIGATITO 5088x96 → 96x96 프레임 53장.

// 포켓몬 이름 → Front 이미지 경로 (파일명은 대문자)
export function frontPath(name: string): string {
  return `assets/pokemon/front/${name.toUpperCase()}.png`;
}

// preload 에서 frontPath 로 image 를 먼저 불러온 뒤, create 에서 이 함수로 애니메이션 스프라이트를 만든다.
// imageKey = preload 때 쓴 키.
export function makeAnimatedFront(
  scene: Phaser.Scene,
  imageKey: string,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Sprite {
  const img = scene.textures.get(imageKey).getSourceImage() as HTMLImageElement;
  const h = img.height;                              // 프레임 크기 = 높이(정사각)
  const total = Math.max(1, Math.floor(img.width / h)); // 프레임 개수

  // 불러온 이미지를 같은 소스로 "스프라이트시트" 텍스처로 다시 등록 (프레임 크기를 이제야 알 수 있으므로)
  const sheetKey = imageKey + "__sheet";
  if (!scene.textures.exists(sheetKey)) {
    scene.textures.addSpriteSheet(sheetKey, img as any, { frameWidth: h, frameHeight: h });
    scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST); // 도트 또렷하게
  }

  const animKey = imageKey + "__anim";
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: total - 1 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  return scene.add.sprite(x, y, sheetKey).setScale(scale).play(animKey);
}
