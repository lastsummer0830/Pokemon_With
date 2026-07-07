import Phaser from "phaser";

// Another Red 의 포켓몬 Front 스프라이트는 "가로로 이어붙인 정사각 프레임" 애니메이션 시트다.
// (프레임 크기 = 이미지 높이, 프레임 개수 = 너비 / 높이)  예: SPRIGATITO 5088x96 → 96x96 프레임 53장.

// 포켓몬 이름 → Front 이미지 경로 (파일명은 대문자)
export function frontPath(name: string): string {
  return `assets/pokemon/front/${name.toUpperCase()}.png`;
}

// 포켓몬 이름 → Back(뒷모습) 이미지 경로. 내 포켓몬은 배틀에서 뒷모습을 쓴다.
// (AR Back도 Front와 동일한 "정사각 프레임 애니 시트"라 makeStillFront/makeAnimatedFront 그대로 사용 가능)
export function backPath(name: string): string {
  return `assets/pokemon/back/${name.toUpperCase()}.png`;
}

// 포켓몬 이름 → 파티/박스용 아이콘 경로. 아이콘 시트 = 128x64 (=64x64 2프레임, 까딱이는 애니).
export function iconPath(name: string): string {
  return `assets/pokemon/icons/${name.toUpperCase()}.png`;
}

// 아이콘(64x64 2프레임)을 스프라이트로 배치(2프레임 까딱 애니). preload에서 iconPath image를 먼저 로드해둘 것.
// 파티창·박스 그리드 양쪽에서 공용으로 쓴다.
export function makePartyIcon(
  scene: Phaser.Scene,
  imageKey: string,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Sprite {
  const img = scene.textures.get(imageKey).getSourceImage() as HTMLImageElement;
  const sheetKey = imageKey + "__icon";
  if (!scene.textures.exists(sheetKey)) {
    scene.textures.addSpriteSheet(sheetKey, img as any, { frameWidth: 64, frameHeight: 64 });
    scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const animKey = imageKey + "__iconanim";
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: 1 }),
      frameRate: 3, repeat: -1,
    });
  }
  return scene.add.sprite(x, y, sheetKey).setScale(scale).play(animKey);
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

// Front 시트의 "첫 프레임(정지컷)"만 안전하게 뽑아 이미지로 놓는다.
//  넓은 애니 시트(폭 5000px+)는 WebGL 텍스처 한계로 통째 업로드하면 깨진다 → 캔버스로 96x96만 잘라 addCanvas.
//  (배틀 배틀러처럼 애니 없이도 되는 곳에 쓴다. preload에서 frontPath image를 먼저 로드해둘 것.)
export function makeStillFront(
  scene: Phaser.Scene,
  imageKey: string,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Image {
  const src = scene.textures.get(imageKey).getSourceImage() as HTMLImageElement;
  const fh = src.height; // 프레임 = 정사각(높이)
  const stillKey = imageKey + "__still";
  if (!scene.textures.exists(stillKey)) {
    const cvs = document.createElement("canvas");
    cvs.width = fh; cvs.height = fh;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, fh, fh, 0, 0, fh, fh); // 왼쪽 첫 프레임만
    scene.textures.addCanvas(stillKey, cvs);
    scene.textures.get(stillKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return scene.add.image(x, y, stillKey).setScale(scale);
}
