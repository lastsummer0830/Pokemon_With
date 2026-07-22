import Phaser from "phaser";
import { BattleView, VW } from "../scenes/battleView";

// ─────────────────────────────────────────────────────────────
// AR(Another Red) 기술 배틀 애니메이션 재생기
//
// 데이터는 tools/ar-anim/extract-animations.py 가 원본 PkmnAnimations.rxdata 에서 뽑는다:
//   assets/data/ar/anim/index.json   기술 → 애니 번호 (+ 상수·대타표)
//   assets/data/ar/anim/<번호>.json  프레임/셀/타이밍
//   assets/animations/<시트>.png     셀 그림(한 칸 192x192, 가로 5칸 고정)
//   assets/audio/anim/<이름>.ogg     효과음
//
// 원본 재생 규칙(AR 루비 PBAnimationPlayerX 그대로):
//   · 20fps 고정. frame = floor(경과초 * 20), frame >= 프레임수 면 끝.
//   · 셀 번호 0 = 사용자 스프라이트, 1 = 상대 스프라이트, 2부터 = 새로 만드는 파티클.
//     (그래서 기술 애니가 포켓몬 본체를 움직인다 — 몸통박치기의 돌진이 이것)
//   · pattern -1 = 사용자 그림, -2 = 상대 그림, 0 이상 = 시트의 칸 번호.
//   · focus 1=상대기준 2=사용자기준 3=둘을 잇는 선 기준 4=화면 절대좌표(512x384).
//
// 우리 화면은 512보다 넓다(가로 21.3칸). 그래서:
//   · focus 1·2 는 실제 스프라이트 중심에 붙이고(원본과 동일한 발상),
//   · focus 3 은 원본처럼 "두 기준점 사각형 → 실제 두 스프라이트 사각형" 아핀 변환,
//   · focus 4(화면)는 화면 중앙 기준으로 원본 픽셀 간격(view.s 배)을 유지한다.
// ─────────────────────────────────────────────────────────────

const CELL = 192;      // 셀 한 칸 크기 (AR pbSpriteSetAnimFrame: animwidth = 192)
const COLS = 5;        // 시트 가로 칸 수 (AR: pattern % 5)
const FPS = 20;        // AR: (경과초 * 20)

// 셀 배열의 칸 번호 — 추출기 CELL_ORDER 와 1:1 (x,y,zx,zy,angle,mirror,blend,visible,pattern,opacity,priority,focus,색RGBA,색조RGB+회색)
const enum C { X = 0, Y = 1, ZX = 2, ZY = 3, ANGLE = 4, MIRROR = 5, BLEND = 6, VISIBLE = 7,
  PATTERN = 8, OPACITY = 9, PRIORITY = 10, FOCUS = 11, CR = 12, CG = 13, CB = 14, CA = 15 }

type Cell = number[] | null;

interface Timing {
  f: number;            // 이 프레임에서
  t: number;            // 0=효과음 1=배경설정 2=배경변화 3=전경설정 4=전경변화
  n?: string;           // 효과음/그림 파일명
  vol?: number; pitch?: number;
  dur?: number; x?: number; y?: number; op?: number; c?: number[];
}

interface AnimDoc {
  id: number; name: string; graphic: string; hue: number; position: number;
  frames: Cell[][]; timings: Timing[];
}

interface AnimIndex {
  fps: number; cellSize: number; cols: number;
  focusUser: [number, number]; focusTarget: [number, number];
  moves: Record<string, [number, number]>;
  commons: Record<string, number>;
  typeDefault: Record<string, (string | null)[]>;
  anims: Record<string, { g: string; hue: number; len: number }>;
}

// ── 캐시(한 번 받은 건 다시 안 받는다) ───────────────────────
let indexCache: AnimIndex | null = null;
let indexPromise: Promise<AnimIndex | null> | null = null;
const docCache = new Map<number, AnimDoc | null>();

export async function loadAnimIndex(): Promise<AnimIndex | null> {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = fetch("assets/data/ar/anim/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (indexCache = j))
      .catch(() => null);
  }
  return indexPromise;
}

async function loadAnimDoc(id: number): Promise<AnimDoc | null> {
  if (docCache.has(id)) return docCache.get(id) ?? null;
  const doc = await fetch(`assets/data/ar/anim/${id}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  docCache.set(id, doc);
  return doc;
}

// 텍스처/오디오를 지금 받아온다(로드가 끝나야 재생 가능).
function loadNow(scene: Phaser.Scene, add: (l: Phaser.Loader.LoaderPlugin) => void): Promise<void> {
  return new Promise((resolve) => {
    add(scene.load);
    if (scene.load.list.size === 0 && !scene.load.isLoading()) { resolve(); return; }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

// 시트에서 pattern 번호 칸을 프레임으로 등록한다.
//  ⚠️ Phaser의 자동 슬라이스(load.spritesheet)를 쓰면 안 된다 — 시트 폭이 960이 아닌 것도 있는데
//     원본은 폭과 무관하게 항상 "가로 5칸"으로 계산한다(pattern%5). 자동 슬라이스는 열 수를
//     실제 폭으로 정하므로 칸 번호가 어긋난다. 원본과 같은 식으로 직접 등록한다.
//  칸이 시트 밖으로 나가면 원본(RGSS)은 잘려 그려진다 → 여기서도 잘라서 등록하고, 없는 칸은 건너뛴다.
function ensurePatternFrame(scene: Phaser.Scene, key: string, pattern: number): string | null {
  const tex = scene.textures.get(key);
  if (!tex || tex.key === "__MISSING") return null;
  const name = `p${pattern}`;
  if (tex.has(name)) return name;
  const src = tex.getSourceImage() as HTMLImageElement;
  const x = (pattern % COLS) * CELL;
  const y = Math.floor(pattern / COLS) * CELL;
  if (x >= src.width || y >= src.height) return null;
  tex.add(name, 0, x, y, Math.min(CELL, src.width - x), Math.min(CELL, src.height - y));
  return name;
}

// ── 어떤 애니를 쓸 것인가 (AR pbFindMoveAnimDetails / pbFindMoveAnimation) ──
export interface MoveInfoForAnim {
  type: string;                                  // 기술 타입 id (NORMAL 등)
  category: "Physical" | "Special" | "Status";
  target: string;                                // AR target id (User / NearOther ...)
}

// 반환 [애니번호, oppMove인가]. oppMove면 원본은 사용자/상대 자리를 바꿔서 재생한다.
function pickAnim(idx: AnimIndex, moveId: string, byAlly: boolean): [number, boolean] | null {
  const pair = idx.moves[moveId];
  if (!pair) return null;
  if (byAlly) return pair[0] >= 0 ? [pair[0], false] : null;
  if (pair[1] >= 0) return [pair[1], true];      // 상대 전용(OppMove) 애니가 있으면 그것
  return pair[0] >= 0 ? [pair[0], false] : null; // 없으면 일반 애니를 그대로
}

function resolveAnim(idx: AnimIndex, moveId: string, byAlly: boolean, info?: MoveInfoForAnim): [number, boolean] | null {
  const direct = pickAnim(idx, moveId, byAlly);
  if (direct) return direct;
  // 애니가 없는 기술 → 원본처럼 "타입별 대타"를 쓴다(칸: 0 단일물리 1 단일특수 2 자신변화 5 상대변화).
  //  광역(3·4)은 1:1 배틀에 없다.
  if (info) {
    const table = idx.typeDefault[info.type];
    if (table) {
      const selfOnly = info.target === "User" || info.target === "None" || info.target.startsWith("UserSide");
      const kind = info.category === "Physical" ? 0 : info.category === "Special" ? 1 : selfOnly ? 2 : 5;
      for (const cand of [table[kind], table[2]]) {
        if (!cand) continue;
        const hit = pickAnim(idx, cand, byAlly);
        if (hit) return hit;
      }
    }
  }
  return pickAnim(idx, "TACKLE", byAlly);        // 그래도 없으면 몸통박치기(원본 최후 폴백)
}

// ── 재생 ─────────────────────────────────────────────────────
export interface AnimTargets {
  user: Phaser.GameObjects.Image;     // 공격하는 쪽 스프라이트
  target: Phaser.GameObjects.Image;   // 맞는 쪽 스프라이트
}

// 스프라이트 원래 상태(애니가 끝나면 그대로 되돌린다)
function snapshot(s: Phaser.GameObjects.Image) {
  return { x: s.x, y: s.y, sx: s.scaleX, sy: s.scaleY, ox: s.originX, oy: s.originY,
    angle: s.angle, alpha: s.alpha, flipX: s.flipX, depth: s.depth, visible: s.visible,
    blend: s.blendMode, tint: s.tintTopLeft, tinted: s.isTinted };
}
type Snap = ReturnType<typeof snapshot>;

function restore(s: Phaser.GameObjects.Image, o: Snap): void {
  s.setOrigin(o.ox, o.oy);
  s.setPosition(o.x, o.y);
  s.setScale(o.sx, o.sy);
  s.setAngle(o.angle);
  s.setAlpha(o.alpha);
  s.setFlipX(o.flipX);
  s.setDepth(o.depth);
  s.setVisible(o.visible);
  s.setBlendMode(o.blend);
  if (o.tinted) s.setTint(o.tint); else s.clearTint();
}

// 스프라이트의 "중심" 화면좌표 (원본 getSpriteCenter 와 같은 개념)
function centerOf(s: Phaser.GameObjects.Image): [number, number] {
  return [s.x + (0.5 - s.originX) * s.displayWidth, s.y + (0.5 - s.originY) * s.displayHeight];
}

/**
 * 기술 애니메이션 하나를 끝까지 재생한다(끝나면 resolve).
 * 데이터·그림이 없으면 아무것도 안 하고 곧바로 끝난다(배틀이 멈추지 않게).
 */
export async function playMoveAnimation(
  scene: Phaser.Scene, view: BattleView, sprites: AnimTargets,
  moveId: string, byAlly: boolean, info?: MoveInfoForAnim,
): Promise<void> {
  const idx = await loadAnimIndex();
  if (!idx) return;
  const picked = resolveAnim(idx, moveId, byAlly, info);
  if (!picked) return;
  const [animId, oppMove] = picked;
  const doc = await loadAnimDoc(animId);
  if (!doc || doc.frames.length === 0) return;

  // OppMove 애니는 "사용자 자리 = 플레이어측"으로 그려져 있다(원본 pbAnimation: 인자를 바꿔 부른다).
  const user = oppMove ? sprites.target : sprites.user;
  const target = oppMove ? sprites.user : sprites.target;

  await playAnimDoc(scene, view, idx, doc, user, target);
}

/** Common:xxx 애니(HealthUp 등) 재생 — 기술이 아닌 공용 연출. */
export async function playCommonAnimation(
  scene: Phaser.Scene, view: BattleView, sprites: AnimTargets, name: string,
): Promise<void> {
  const idx = await loadAnimIndex();
  const id = idx?.commons[name];
  if (id === undefined) return;
  const doc = await loadAnimDoc(id);
  if (!doc || doc.frames.length === 0) return;
  await playAnimDoc(scene, view, idx!, doc, sprites.user, sprites.target);
}

async function playAnimDoc(
  scene: Phaser.Scene, view: BattleView, idx: AnimIndex, doc: AnimDoc,
  userSprite: Phaser.GameObjects.Image, targetSprite: Phaser.GameObjects.Image,
): Promise<void> {
  // ── 필요한 파일 먼저 받아둔다(시트 1장 + 효과음 + 배경/전경 그림) ──
  const sheetKey = doc.graphic ? `anim_${doc.graphic}` : "";
  const seKeys = new Map<string, string>();
  const bgKeys = new Map<string, string>();
  for (const t of doc.timings) {
    if (!t.n) continue;
    const base = t.n.replace(/\.[^.]+$/, "");
    if (t.t === 0) seKeys.set(t.n, `anims_${base}`);
    else bgKeys.set(t.n, `animbg_${base}`);
  }
  await loadNow(scene, (l) => {
    if (sheetKey && !scene.textures.exists(sheetKey)) {
      l.image(sheetKey, `assets/animations/${encodeURIComponent(doc.graphic)}.png`);
    }
    for (const [file, key] of seKeys) {
      if (!scene.cache.audio.exists(key)) {
        l.audio(key, `assets/audio/anim/${encodeURIComponent(file.replace(/\.[^.]+$/, ""))}.ogg`);
      }
    }
    for (const [file, key] of bgKeys) {
      if (!scene.textures.exists(key)) {
        l.image(key, `assets/animations/${encodeURIComponent(file.replace(/\.[^.]+$/, ""))}.png`);
      }
    }
  });
  if (sheetKey && scene.textures.exists(sheetKey)) {
    scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  const s = view.s;
  // 기준점은 index.json 이 원본 Battle::Scene 상수를 그대로 담고 있다(여기서 숫자를 또 적지 않는다).
  const [fuX, fuY] = idx.focusUser;
  const [ftX, ftY] = idx.focusTarget;

  const userSnap = snapshot(userSprite);
  const targetSnap = snapshot(targetSprite);
  const userOrig = centerOf(userSprite);
  const targetOrig = centerOf(targetSprite);
  // 애니 도중엔 중심 기준으로 다루는 게 원본(ox=폭/2, oy=높이/2)과 같다. 끝나면 되돌린다.
  for (const [sp, ctr] of [[userSprite, userOrig], [targetSprite, targetOrig]] as const) {
    sp.setOrigin(0.5, 0.5);
    sp.setPosition(ctr[0], ctr[1]);
  }

  // 셀 스프라이트 풀(0·1번은 포켓몬 본체라 만들지 않는다)
  const pool: Phaser.GameObjects.Image[] = [];
  const spriteFor = (i: number): Phaser.GameObjects.Image | null => {
    if (i === 0) return userSprite;
    if (i === 1) return targetSprite;
    if (!sheetKey || !scene.textures.exists(sheetKey)) return null;
    if (!pool[i]) {
      pool[i] = scene.add.image(0, 0, sheetKey).setVisible(false).setDepth(100);
    }
    return pool[i];
  };

  // 배경(뒤)·전경(앞) 판 — 색만 깔거나 그림을 깐다(AR bgColor/bgGraphic/foColor/foGraphic).
  //  대부분의 기술은 배경을 안 건드린다 → 필요할 때만 만든다(매 기술마다 빈 사각형 2개씩 만들지 않게).
  const { width: SW, height: SH } = scene.scale;
  const planes: Record<string, Phaser.GameObjects.GameObject & { setAlpha(v: number): unknown }> = {};
  const setPlane = (fore: boolean, t: Timing): void => {
    const key = t.n ? bgKeys.get(t.n) : undefined;
    const imgId = fore ? "foImg" : "bgImg";
    const colorId = fore ? "foColor" : "bgColor";
    if (key && scene.textures.exists(key)) {
      let img = planes[imgId] as Phaser.GameObjects.TileSprite | undefined;
      if (!img) {
        img = scene.add.tileSprite(0, 0, SW, SH, key).setOrigin(0).setDepth(fore ? 121 : 21);
        planes[imgId] = img;
      }
      img.setTexture(key);
      img.tilePositionX = -(t.x ?? 0) * s;
      img.tilePositionY = -(t.y ?? 0) * s;
      img.setAlpha((t.op ?? 255) / 255);
      planes[colorId]?.setAlpha(0);
    } else {
      planes[imgId]?.setAlpha(0);
      let rect = planes[colorId] as Phaser.GameObjects.Rectangle | undefined;
      if (!rect) {
        rect = scene.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000000, 0).setDepth(fore ? 120 : 20);
        planes[colorId] = rect;
      }
      const c = t.c ?? [0, 0, 0, 0];
      rect.setFillStyle(Phaser.Display.Color.GetColor(c[0], c[1], c[2]), 1);
      rect.setAlpha((t.op ?? c[3] ?? 0) / 255);
    }
  };

  // ── 프레임 적용 ──
  const applyFrame = (fi: number): void => {
    const frame = doc.frames[fi] ?? [];
    // 지난 프레임에 쓰던 파티클은 일단 숨긴다(원본도 매 프레임 전부 숨기고 다시 켠다)
    for (let i = 2; i < pool.length; i++) pool[i]?.setVisible(false);
    for (let i = 0; i < frame.length; i++) {
      const cel = frame[i];
      const sp = cel ? spriteFor(i) : null;
      if (!cel || !sp) { if (!cel && i < 2) spriteFor(i)?.setVisible(false); continue; }

      const pattern = cel[C.PATTERN];
      const isBattler = i < 2;
      if (!isBattler) {
        const fname = ensurePatternFrame(scene, sheetKey, Math.max(0, pattern));
        if (pattern < 0 || !fname) { sp.setVisible(false); continue; }
        sp.setTexture(sheetKey, fname);
        // 잘려 등록된 칸도 원본은 192 기준으로 중심을 잡는다 → 원점을 그에 맞춰 보정.
        sp.setOrigin(96 / sp.width, 96 / sp.height);
      } else if (pattern >= 0) {
        // 0·1번 자리에 시트 그림이 오는 애니는 드물다. 포켓몬 본체를 시트로 바꾸진 않고 숨긴다.
        sp.setVisible(false);
        continue;
      }

      // 위치 — 원본과 같은 focus 규칙
      let px: number, py: number;
      switch (cel[C.FOCUS]) {
        case 1:  // 상대 기준
          px = targetOrig[0] + (cel[C.X] - ftX) * s;
          py = targetOrig[1] + (cel[C.Y] - ftY) * s;
          break;
        case 2:  // 사용자 기준
          px = userOrig[0] + (cel[C.X] - fuX) * s;
          py = userOrig[1] + (cel[C.Y] - fuY) * s;
          break;
        case 3: { // 두 기준점을 잇는 사각형 → 실제 두 스프라이트 사각형으로 아핀 변환(원본 transformPoint)
          const tx = (cel[C.X] - fuX) / (ftX - fuX);
          const ty = (cel[C.Y] - fuY) / (ftY - fuY);
          px = userOrig[0] + tx * (targetOrig[0] - userOrig[0]);
          py = userOrig[1] + ty * (targetOrig[1] - userOrig[1]);
          break;
        }
        default: // 4 = 화면 절대좌표(512x384). 화면 중앙 기준으로 원본 간격을 유지한다.
          px = SW / 2 + (cel[C.X] - VW / 2) * s;
          py = cel[C.Y] * s;
      }
      sp.setPosition(px, py);
      sp.setVisible(cel[C.VISIBLE] === 1);
      sp.setAlpha(cel[C.OPACITY] / 255);
      sp.setAngle(-cel[C.ANGLE]);              // RGSS 각도는 반시계, Phaser는 시계
      sp.setFlipX(cel[C.MIRROR] > 0);

      const zx = (cel[C.ZX] / 100) * s;
      const zy = (cel[C.ZY] / 100) * s;
      if (isBattler) {
        // 포켓몬 본체는 원래 크기(배틀 스케일)에 확대율만 곱한다.
        const base = sp === userSprite ? userSnap : targetSnap;
        sp.setScale(base.sx * (cel[C.ZX] / 100), base.sy * (cel[C.ZY] / 100));
      } else {
        sp.setScale(zx, zy);
      }

      // blend: 1=가산 2=감산. Phaser에 감산이 없어 MULTIPLY로 근사한다(어두워지는 방향은 같다).
      sp.setBlendMode(cel[C.BLEND] === 1 ? Phaser.BlendModes.ADD
        : cel[C.BLEND] === 2 ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.NORMAL);

      // color(RGBA) = 원본은 그 색으로 "섞는" 효과. Phaser 틴트는 곱셈뿐이라 흰색→그 색으로 보간해 근사한다.
      const ca = cel[C.CA] ?? 0;
      if (ca > 0) {
        const k = ca / 255;
        const mix = (v: number) => Math.round(255 * (1 - k) + v * k);
        sp.setTint(Phaser.Display.Color.GetColor(mix(cel[C.CR] ?? 0), mix(cel[C.CG] ?? 0), mix(cel[C.CB] ?? 0)));
      } else {
        sp.clearTint();
      }

      // 깊이 — 원본 z(10/20/80)를 우리 배틀 화면 깊이로 옮긴 값
      if (!isBattler) {
        switch (cel[C.PRIORITY]) {
          case 0: sp.setDepth(30); break;                                   // 전부 뒤
          case 2: sp.setDepth((cel[C.FOCUS] === 1 ? targetSprite.depth : userSprite.depth) - 1); break;
          case 3: sp.setDepth((cel[C.FOCUS] === 1 ? targetSprite.depth : userSprite.depth) + 1); break;
          default: sp.setDepth(100);                                        // 전부 앞(HP박스 150보다는 아래)
        }
      }
    }
  };

  // 타이밍(효과음·배경) — 프레임이 바뀔 때마다 그 프레임 것을 실행
  const fireTimings = (fi: number): void => {
    for (const t of doc.timings) {
      if (t.f !== fi) continue;
      if (t.t === 0) {
        const key = t.n ? seKeys.get(t.n) : undefined;
        if (key && scene.cache.audio.exists(key)) {
          scene.sound.play(key, { volume: ((t.vol ?? 80) / 100) * 0.6, rate: (t.pitch ?? 100) / 100 });
        }
      } else if (t.t === 1 || t.t === 3) {
        setPlane(t.t === 3, t);
      }
      // 2·4(배경 서서히 변화)는 아직 안 붙였다 — 값이 바뀌는 마지막 상태만 1·3이 이미 깔아준다.
    }
  };

  // ── 20fps로 돌린다 ──
  //  registry의 animFps는 **검증용 느린 재생** 스위치다(tools/shot-moveanim.mjs가 프레임을 하나씩 캡처하려고 씀).
  //  평소엔 비어 있어 원본과 같은 20fps.
  const fps = Number(scene.registry.get("animFps")) || FPS;
  await new Promise<void>((resolve) => {
    let last = -1;
    const started = scene.time.now;
    const ev = scene.time.addEvent({
      delay: 1000 / 60, loop: true,
      callback: () => {
        const fi = Math.floor(((scene.time.now - started) / 1000) * fps);
        if (fi >= doc.frames.length) { ev.remove(); resolve(); return; }
        if (fi === last) return;
        last = fi;
        fireTimings(fi);
        applyFrame(fi);
      },
    });
  });

  // ── 뒷정리: 파티클 제거 + 포켓몬 본체 원상복구 ──
  for (const sp of pool) sp?.destroy();
  for (const p of Object.values(planes)) p.destroy();
  restore(userSprite, userSnap);
  restore(targetSprite, targetSnap);
}
