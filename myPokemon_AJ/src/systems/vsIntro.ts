import Phaser from "phaser";
import { BGM } from "../game/sfx";
import { playBgm } from "../game/bgm";

// VS 연출 — Another Red의 HGSS "VS 트레이너" 배틀 진입 전환을 그대로 옮긴다.
//
// 원본 위치(Scripts.rxdata에서 뽑은 루비 원문):
//   · `Transitions::VSTrainer` (0096_Transitions.rb) — 실제 4초짜리 연출·타이밍·좌표
//   · `SpecialBattleIntroAnimations.register("vs_trainer_animation", 60, …)`
//     (0257_Overworld_BattleIntroAnim.rb) — **언제 이 연출이 뜨는가**
//
// ⭐ 원본이 정한 발동 조건 그대로 간다:
//    "`hgss_vs_<트레이너타입>` 초상 그림이 있는 1:1 트레이너전"에만 뜬다.
//    원본에 초상이 있는 상대 = 관장 19 + 챔피언 그린 + 로켓보스 = **21종뿐**이고,
//    반바지꼬마 같은 잡트레이너는 그림이 없어서 **자동으로 평범한 전환**이 된다.
//    → 우리도 아래 VS_PORTRAITS에 있는 상대만 VS가 뜬다. 관장을 새로 만들면
//      `public/assets/transitions/vs_<키>.png`를 넣고 이 목록에 한 줄 더하면 끝이다.
//
// ⚠️ 원본 실측(2026-08-02): `hgss_vsBar_*` 21장이 **픽셀까지 전부 같다** → 띠는 공용 1장(vs_bar).
//    `black_half.png`는 512x192 **순수 검정 단색**이라 파일로 안 가져오고 사각형으로 덮는다.
//
// 좌표계: 원본 화면 512x384를 가상좌표로 쓴다(배틀 화면 battleView.ts와 같은 방식).
//    s = 화면높이/384 로 통째로 확대하고, 가로는 화면이 더 넓으므로
//    VS 로고·이름은 **왼쪽 기준**, 상대 초상은 **오른쪽 기준**으로 붙인다(원본 512에선 값이 일치).

const VW = 512, VH = 384;

/** VS 연출을 쓸 수 있는 상대 — `assets/transitions/vs_<키>.png`가 있는 상대만 적는다. */
export const VS_PORTRAITS: Record<string, string> = {
  // 상록체육관 관장 그린 — AR 원본 초상 그대로(192x128).
  LEADER_Green: "vs_LEADER_Green",
  // 라이벌 네모 — AR엔 네모용 hgss_vs 초상이 없어서 **배틀 전신 그림의 상반신을 잘라** 만들었다
  //  (사용자 확정 2026-08-02 'B안'. 덧그리기 없이 자르기+확대만 — tools/ar-vs/extract-vs.py).
  NEMONA: "vs_NEMONA",
};

/** 이 상대에게 VS 연출이 있나. 없으면 부르는 쪽이 기존 페이드로 넘어가면 된다(원본과 같은 분기). */
export function hasVsIntro(key: string | null | undefined): boolean {
  return !!key && key in VS_PORTRAITS;
}

/**
 * 씬 preload()에서 부를 것. 그 상대의 초상 + 공용 그림(띠·VS로고)을 읽는다.
 * 배틀 BGM도 같이 받아둔다 — 원본은 **전환이 시작되기 전에** 배틀 음악을 튼다(pbBattleAnimation).
 */
export function preloadVsIntro(scene: Phaser.Scene, key: string | null | undefined): void {
  if (!hasVsIntro(key)) return;
  loadFiles(scene, ["vs_bar", "vs1", "vs2", VS_PORTRAITS[key!]]);
}

/**
 * 상대를 미리 알 수 없는 씬(월드 — 어느 트레이너와 눈이 마주칠지 모른다)에서 쓴다.
 * 초상까지 **전부** 받아 둔다(그림 다섯 장이라 가볍다).
 */
export function preloadVsIntroAll(scene: Phaser.Scene): void {
  loadFiles(scene, ["vs_bar", "vs1", "vs2", ...Object.values(VS_PORTRAITS)]);
}

function loadFiles(scene: Phaser.Scene, texs: string[]): void {
  for (const tex of texs) {
    if (!scene.textures.exists(tex)) scene.load.image(tex, `assets/transitions/${tex}.png`);
  }
  if (!scene.cache.audio.exists(BGM.battle)) scene.load.audio(BGM.battle, "assets/audio/bgm_battle.ogg");
}

/** 트레이너 id("LEADER_Green:그린")에서 VS 키(=트레이너 타입)만 떼어낸다. */
export function vsKeyFromTrainerId(id: string | null | undefined): string | null {
  const type = (id ?? "").split(":")[0];
  return hasVsIntro(type) ? type : null;
}

// ── 원본 상수(Transitions::VSTrainer) ─────────────────────────────────────────
const DURATION = 4.0;            // 초
const BAR_Y = 80;                // 띠의 위쪽 y (가상좌표)
const BAR_H = 128;               // 띠 높이 = vs_bar.png 높이
const BAR_SCROLL_SPEED = 1800;   // 초당 가상픽셀, 왼쪽으로 흐른다
// 띠가 오른쪽→왼쪽으로 깔릴 때의 지그재그 가장자리(2px 줄마다 이만큼 ×4px 씩 당긴다)
const BAR_MASK = [8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7];
const FOE_X_LIMIT = 384;         // 슬라이드는 여기까지 오다가
const FOE_X = 428;               // 마지막엔 여기로 톡 튄다
const VS_X = 144;                // VS 로고 중심
// 타이밍(초) — 원본 set_up_timings 그대로
const T = {
  barAppearEnd: 0.2,
  vsAppearStart: 0.7,
  vsAppearStart2: 0.9,
  vsShrink: 0.2,                 // = vsAppearStart2 - vsAppearStart
  vsAppearFinal: 1.1,            // = vsAppearStart2 + vsShrink
  foeAppearStart: 1.25,
  foeAppearEnd: 1.4,
  flashStart: 1.9,
  flashDuration: 0.25,
  fadeToWhiteStart: 3.0,
  fadeToWhiteEnd: 3.5,
  fadeToBlackStart: 3.8,
};

const NAME_COLOR = "#f8f8f8";    // 원본 Color.new(248,248,248)
const NAME_SHADOW = "#485050";   // 원본 Color.new(72,80,80)

/**
 * VS 연출을 처음부터 끝까지 재생한다. 끝나면 **화면이 완전히 검다**(원본과 같다)
 * → 부르는 쪽은 이 Promise가 풀린 직후 `scene.start("BattleScene", …)` 하면 된다.
 *
 * @param key   VS_PORTRAITS의 키(예: "LEADER_Green")
 * @param name  띠에 적을 상대 이름(예: "그린")
 */
export function playVsIntro(scene: Phaser.Scene, key: string, name: string): Promise<void> {
  if (!hasVsIntro(key)) return Promise.resolve();

  // 원본은 전환 **전에** 배틀 BGM을 튼다 → VS 화면과 음악이 같이 시작한다.
  //  playBgm은 같은 곡이면 아무것도 안 하므로 BattleScene이 다시 불러도 안 끊긴다.
  playBgm(scene, BGM.battle, 0.35);

  const { width, height } = scene.scale;
  const s = height / VH;         // 세로를 원본에 맞춘다(배틀 화면과 같은 규칙)
  const vw = width / s;          // 화면이 넓으면 가상 가로도 그만큼 넓다
  const X_R = (vx: number) => vw - (VW - vx);   // 오른쪽 기준 좌표(원본 512에선 그대로)

  const DEPTH = 5000;            // 밤낮 색조(900)·대화창보다 확실히 위
  const layer = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0).setScale(s);

  // 뒤쪽 검정 — 플래시 순간부터 켜져 바깥 풍경을 어둡게 눌러 준다(원본 opacity 224/255).
  const rearBlack = scene.add.rectangle(0, 0, vw, VH, 0x000000, 224 / 255).setOrigin(0, 0).setVisible(false);
  layer.add(rearBlack);

  // 흐르는 띠 — 원본은 512짜리 스프라이트를 여러 장 이어 굴린다. TileSprite가 같은 그림이다.
  const bar = scene.add.tileSprite(0, BAR_Y, vw, BAR_H, "vs_bar").setOrigin(0, 0);
  layer.add(bar);

  // VS 로고 3장 — 본체(vs1) + 커졌다 줄어드는 잔상 2장(vs2)
  const vsY = BAR_Y + BAR_H / 2;
  const vsMain = scene.add.image(VS_X, vsY, "vs1").setVisible(false);
  const vs1 = scene.add.image(VS_X, vsY, "vs2").setScale(2).setVisible(false);
  const vs2 = scene.add.image(VS_X, vsY, "vs2").setScale(2).setVisible(false);
  layer.add([vsMain, vs1, vs2]);

  // 상대 초상 — 아래쪽 가운데 기준. 처음엔 **새까만 실루엣**으로 오른쪽에서 들어온다.
  const foe = scene.add.image(vw + 200, BAR_Y + BAR_H - 12, VS_PORTRAITS[key]).setOrigin(0.5, 1);
  foe.setTintFill(0x000000);
  layer.add(foe);

  // 상대 이름 — 원본은 띠 그림 안에 (244, 86) 위치에 그린다 → 절대좌표 (244, BAR_Y+86).
  const label = scene.add.text(244, BAR_Y + 86, name, {
    fontFamily: "Galmuri11, sans-serif", fontSize: "26px", color: NAME_COLOR,
  }).setOrigin(0, 0).setVisible(false);
  label.setShadow(1, 1, NAME_SHADOW, 0, false, true);
  layer.add(label);

  // 앞쪽 검정(맨 마지막에 화면을 덮는다) + 흰 플래시(항상 제일 위)
  const black = scene.add.rectangle(0, 0, vw, VH, 0x000000, 1).setOrigin(0, 0).setVisible(false);
  layer.add(black);
  // ⚠️ 채우기 알파는 **1로 만들고** 오브젝트 alpha로 껐다 켠다.
  //    fillAlpha를 0으로 만들어 두면 setAlpha를 아무리 올려도 화면엔 아무것도 안 그려진다
  //    (숫자상 alpha 0.6인데 화면은 그대로 — 실제로 이 버그를 캡처 밝기로 잡았다).
  const flash = scene.add.rectangle(0, 0, width, height, 0xffffff, 1)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1).setAlpha(0);

  // 띠가 깔리는 동안 쓰는 지그재그 마스크(화면좌표로 그린다 — 마스크는 컨테이너 축소를 안 따라간다)
  const maskG = scene.make.graphics({ x: 0, y: 0 });
  bar.setMask(maskG.createGeometryMask());

  const barW = scene.textures.get("vs_bar").getSourceImage().width;   // 512
  let barX = 0;

  return new Promise<void>((resolve) => {
    const started = scene.time.now;
    const tick = (): void => {
      const t = (scene.time.now - started) / 1000;

      // 띠 흐름 — 원본은 매 프레임 timer로 위치를 다시 잡는다(누적 오차 없음)
      barX = -t * BAR_SCROLL_SPEED;
      barX = ((barX % barW) + barW) % barW;
      bar.tilePositionX = -barX;

      // VS 로고 떨림 — 원본: (timer*30) 정수부 %3 → +2/-2 로 톡톡 튄다
      const phase = Math.floor(t * 30) % 3;
      vsMain.setPosition(VS_X + [0, 4, 0][phase], vsY + [0, 0, -4][phase]);

      if (t >= T.fadeToBlackStart) {
        // 흰 화면이 걷히며 검정이 드러난다 = 화이트아웃 → 블랙아웃
        black.setVisible(true);
        flash.setAlpha(1 - (t - T.fadeToBlackStart) / (DURATION - T.fadeToBlackStart));
      } else if (t >= T.fadeToWhiteStart) {
        flash.setAlpha(Math.min(1, (t - T.fadeToWhiteStart) / (T.fadeToWhiteEnd - T.fadeToWhiteStart)));
      } else if (t >= T.flashStart + T.flashDuration) {
        flash.setAlpha(0);
      } else if (t >= T.flashStart) {
        // 화면이 번쩍 — 그 절반 지점에서 상대에 색이 들어오고 이름이 뜬다(원본 그대로)
        const p = (t - T.flashStart) / T.flashDuration;
        if (p >= 0.5) {
          flash.setAlpha(Math.min(1, (320 / 255) * 2 * (1 - p)));
          rearBlack.setVisible(true);
          foe.clearTint();
          label.setVisible(true);
        } else {
          flash.setAlpha(Math.min(1, (320 / 255) * 2 * p));
        }
      } else if (t >= T.foeAppearEnd) {
        foe.x = X_R(FOE_X);
      } else if (t >= T.foeAppearStart) {
        const p = (t - T.foeAppearStart) / (T.foeAppearEnd - T.foeAppearStart);
        const startX = vw + foe.width / 2;
        foe.x = startX + (X_R(FOE_X_LIMIT) - startX) * p;
      } else if (t >= T.vsAppearFinal) {
        vs1.setVisible(false);
      } else if (t >= T.vsAppearStart2) {
        if (vs2.visible) {
          const z = 1.6 - (0.8 * (t - T.vsAppearStart2)) / T.vsShrink;
          vs2.setScale(z);
          if (z <= 1.2) { vs2.setVisible(false); vsMain.setVisible(true); }
        }
        vs1.setScale(2.0 - (0.8 * (t - T.vsAppearStart2)) / T.vsShrink);
      } else if (t >= T.vsAppearStart) {
        vs2.setVisible(true);
        const z = 2.0 - (0.8 * (t - T.vsAppearStart)) / T.vsShrink;
        vs2.setScale(z);
        if (vs1.visible || z <= 1.6) {
          vs1.setVisible(true);
          vs1.setScale(2.0 - (0.8 * (t - T.vsAppearStart - T.vsShrink / 2)) / T.vsShrink);
        }
      } else {
        // 띠가 오른쪽에서 왼쪽으로 지그재그로 깔린다(원본은 반대로 '풍경 복사본을 지운다')
        const startVx = vw * (1 - t / T.barAppearEnd);
        maskG.clear().fillStyle(0xffffff);
        for (let i = 0; i < BAR_H / 2; i++) {
          const x = startVx - BAR_MASK[i % BAR_MASK.length] * 4;
          maskG.fillRect(x * s, (BAR_Y + i * 2) * s, (vw - x) * s, 2 * s + 1);
        }
      }
      if (t >= T.barAppearEnd && bar.mask) { bar.clearMask(); maskG.destroy(); }

      if (t >= DURATION) {
        scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
        layer.destroy();          // 검은 사각형까지 같이 사라진다 —
        flash.destroy();          //  다음 씬(BattleScene)이 자기 화면을 그리므로 문제 없다
        resolve();
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  });
}
