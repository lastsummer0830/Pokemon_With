import Phaser from "phaser";

// 날씨(필드) — 비·폭풍·눈·싸락눈·모래바람·안개를 화면에 뿌린다.
//
// 왜 필요한가:
//   원본(Another Red)은 `Graphics/Weather`에 날씨 그림 23장을 갖고 있고, **맵 메타데이터**에
//   `weather = [:Rain, 100]`처럼 맵별 날씨를 적어 둔다. 우리 게임엔 그 개념이 통째로 없었다.
//
// ⚠️ 알아둘 것(원본 실측): AR 382개 맵 중 날씨가 적힌 맵은 **단 3개**다
//    (`Route 2`·`15번도로` = Rain 100%, `쌍둥이섬 지하4층` = Rain 0%).
//    **우리가 지금 쓰는 3맵(태초마을·1번도로·상록시티)은 전부 weather 없음** = 항상 맑음이 원본 그대로다.
//    그래서 이 파일은 "지금 화면에 비를 뿌리려고" 만든 게 아니라, 2번도로처럼 **날씨가 있는 맵을 추가하는 순간
//    저절로 동작하도록** 만들어 둔 것이다. 눈으로 보려면 디버그 확인 항목(강제)으로 본다.
//
// 설계 원칙(밤낮 systems/daynight.ts와 같다):
//   - 세이브에 날씨를 저장하지 않는다. 맵에 적힌 값 + 확률로 그때그때 정한다.
//   - 그림은 전부 AR 원본 파일 그대로(직접 그리지 않는다 — AGENTS.md §4).

type Reg = Phaser.Data.DataManager;

/** 날씨 종류. 원본 심볼(:Rain, :Storm, :Snow, :Blizzard, :Sandstorm, :Fog)과 1:1이다. */
export type WeatherKind = "none" | "rain" | "storm" | "snow" | "blizzard" | "hail" | "sandstorm" | "fog";

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  none: "맑음", rain: "비", storm: "폭풍", snow: "눈",
  blizzard: "눈보라", hail: "싸락눈", sandstorm: "모래바람", fog: "안개",
};

/** 원본 심볼 이름(:Rain) → 우리 종류. 맵 메타데이터를 읽어 붙일 때 쓴다. */
export function weatherFromSymbol(sym: string | null | undefined): WeatherKind {
  const k = (sym ?? "").replace(/^:/, "").toLowerCase();
  return (["rain", "storm", "snow", "blizzard", "hail", "sandstorm", "fog"] as const)
    .find(w => w === k) ?? "none";
}

/** preload에서 부를 것 — 날씨 그림(AR 원본 23장 중 쓰는 것)을 읽는다. */
export function preloadWeather(scene: Phaser.Scene): void {
  const files = [
    "rain_1", "rain_2", "rain_3", "rain_4",
    "storm_1", "storm_2", "storm_3", "storm_4",
    "blizzard_1", "blizzard_2", "blizzard_3", "blizzard_4", "blizzard_tile",
    "hail_1", "hail_2", "hail_3",
    "sandstorm_1", "sandstorm_2", "sandstorm_3", "sandstorm_4", "sandstorm_tile",
    "fog_tile", "fog_tile_2",
  ];
  for (const f of files) {
    if (!scene.textures.exists(`wt_${f}`)) scene.load.image(`wt_${f}`, `assets/weather/${f}.png`);
  }
}

// 날씨 한 가지의 '레시피' — 어떤 그림을 몇 개, 어느 방향으로, 화면을 무슨 색으로 덮는가.
//  particles = 떨어지는 알갱이 그림들(없으면 알갱이 없음)
//  count = 화면에 동시에 떠 있는 개수 · vx/vy = 초당 이동 픽셀(비는 비스듬히 내린다)
//  tile = 화면을 덮고 흐르는 큰 무늬(모래바람·눈보라·안개) · tileSpeed = 초당 흐르는 픽셀
//  tint/tintAlpha = 화면 전체 색조(비 오면 어둑해진다)
interface Recipe {
  particles?: string[];
  count?: number;
  vx?: number;
  vy?: number;
  tile?: string;
  tileAlpha?: number;
  tileSpeed?: [number, number];
  tint?: number;
  tintAlpha?: number;
}

// ⚠️ 값은 원본 그림의 성격(빗줄기는 길쭉하고 빠르다, 눈은 작고 느리다)에 맞춘 것이다.
//    화면을 못 알아볼 만큼 덮지 않는다 — 길이 안 보이면 게임이 안 된다.
const RECIPES: Record<WeatherKind, Recipe> = {
  none: {},
  rain: { particles: ["wt_rain_1", "wt_rain_2", "wt_rain_3"], count: 90, vx: -160, vy: 900, tint: 0x2b3a5a, tintAlpha: 0.18 },
  storm: { particles: ["wt_storm_1", "wt_storm_2", "wt_storm_3"], count: 70, vx: -320, vy: 1100, tint: 0x1a2440, tintAlpha: 0.3 },
  snow: { particles: ["wt_blizzard_1", "wt_blizzard_2", "wt_blizzard_3"], count: 70, vx: -30, vy: 130, tint: 0xdfe9ff, tintAlpha: 0.10 },
  blizzard: { particles: ["wt_blizzard_1", "wt_blizzard_2", "wt_blizzard_4"], count: 120, vx: -260, vy: 320, tile: "wt_blizzard_tile", tileAlpha: 0.25, tileSpeed: [-90, 60], tint: 0xdfe9ff, tintAlpha: 0.16 },
  hail: { particles: ["wt_hail_1", "wt_hail_2", "wt_hail_3"], count: 80, vx: -60, vy: 520, tint: 0xcfe4ff, tintAlpha: 0.12 },
  sandstorm: { particles: ["wt_sandstorm_1", "wt_sandstorm_2", "wt_sandstorm_3"], count: 90, vx: -400, vy: 90, tile: "wt_sandstorm_tile", tileAlpha: 0.3, tileSpeed: [-160, 20], tint: 0xd8a95a, tintAlpha: 0.22 },
  fog: { tile: "wt_fog_tile", tileAlpha: 0.42, tileSpeed: [-14, 0], tint: 0xdcdcdc, tintAlpha: 0.10 },
};

/** 붙여 둔 날씨 한 벌. 씬이 꺼질 때 알아서 정리된다. */
export interface WeatherOverlay {
  kind: WeatherKind;
  /** 날씨를 바꾼다(같은 값이면 아무것도 안 한다). */
  setKind(kind: WeatherKind): void;
}

/**
 * 씬에 날씨를 붙인다. 밤낮 색조(depth 900)보다 **아래**에 둬야 밤에 내리는 비도 같이 어두워진다.
 *
 * ⚠️ 알갱이는 Phaser 파티클이 아니라 **스프라이트를 직접 돌린다**:
 *    화면 밖으로 나가면 반대쪽 위에서 다시 시작(래핑). 파티클 시스템보다 단순하고,
 *    창 크기가 바뀌어도(RESIZE 스케일) 그 자리에서 바로 맞출 수 있다.
 */
export function attachWeather(scene: Phaser.Scene, kind: WeatherKind, depth = 880): WeatherOverlay {
  let cur: WeatherKind = "none";
  let sprites: Phaser.GameObjects.Image[] = [];
  let vel: Array<[number, number]> = [];
  let tile: Phaser.GameObjects.TileSprite | undefined;
  let tint: Phaser.GameObjects.Rectangle | undefined;
  let tileSpeed: [number, number] = [0, 0];

  const clear = (): void => {
    sprites.forEach(s => s.destroy()); sprites = []; vel = [];
    tile?.destroy(); tile = undefined;
    tint?.destroy(); tint = undefined;
  };

  const build = (k: WeatherKind): void => {
    clear();
    cur = k;
    const r = RECIPES[k];
    if (!r) return;
    const { width: W, height: H } = scene.scale;

    if (r.tint !== undefined && r.tintAlpha) {
      tint = scene.add.rectangle(0, 0, W, H, r.tint, r.tintAlpha)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(depth).setName("weatherTint");
    }
    if (r.tile && scene.textures.exists(r.tile)) {
      tile = scene.add.tileSprite(0, 0, W, H, r.tile)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(depth + 1).setAlpha(r.tileAlpha ?? 0.3).setName("weatherTile");
      tileSpeed = r.tileSpeed ?? [0, 0];
    }
    const pics = (r.particles ?? []).filter(p => scene.textures.exists(p));
    if (pics.length && r.count) {
      for (let i = 0; i < r.count; i++) {
        const key = pics[i % pics.length];
        const s = scene.add.image(Math.random() * W, Math.random() * H, key)
          .setScrollFactor(0).setDepth(depth + 2).setAlpha(0.55 + Math.random() * 0.45);
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        sprites.push(s);
        // 알갱이마다 속도를 조금씩 다르게 — 전부 같은 속도면 '판때기'처럼 보인다.
        const j = 0.75 + Math.random() * 0.5;
        vel.push([(r.vx ?? 0) * j, (r.vy ?? 0) * j]);
      }
    }
  };

  const step = (_t: number, dtMs: number): void => {
    const dt = dtMs / 1000;
    const { width: W, height: H } = scene.scale;
    if (tile) { tile.tilePositionX += tileSpeed[0] * dt; tile.tilePositionY += tileSpeed[1] * dt; }
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      s.x += vel[i][0] * dt;
      s.y += vel[i][1] * dt;
      // 화면을 벗어나면 반대편에서 다시 들어온다(무한히 내리는 것처럼 보이게).
      if (s.y > H + s.displayHeight) { s.y = -s.displayHeight; s.x = Math.random() * (W + 200) - 100; }
      if (s.x < -s.displayWidth) s.x = W + s.displayWidth;
      if (s.x > W + s.displayWidth) s.x = -s.displayWidth;
    }
  };

  const fit = (): void => {
    const { width: W, height: H } = scene.scale;
    tint?.setSize(W, H);
    tile?.setSize(W, H);
  };

  build(kind);
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.scale.on("resize", fit);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    scene.scale.off("resize", fit);
    clear();
  });

  return {
    get kind(): WeatherKind { return cur; },
    setKind(k: WeatherKind): void { if (k !== cur) build(k); },
  };
}

/**
 * 이 맵에서 지금 어떤 날씨인가 — 원본과 같은 규칙.
 *  맵 메타데이터의 `[:Rain, 확률%]`을 그대로 굴린다(확률 0이면 안 뜬다).
 *  ⚠️ 확인 항목이 `debugWeather`를 넘겼으면 그 값을 쓴다(비를 보려고 비 오는 맵까지 갈 순 없다).
 */
export function rollWeather(reg: Reg, mapWeather?: [string, number] | null): WeatherKind {
  const forced = reg.get("debugWeather") as WeatherKind | undefined;
  if (forced && forced in WEATHER_LABEL) return forced;
  if (!mapWeather) return "none";
  const [sym, chance] = mapWeather;
  if (!(Math.random() * 100 < (chance ?? 0))) return "none";
  return weatherFromSymbol(sym);
}

/** 확인 항목이 넘긴 날씨 강제값을 반영(없으면 지운다 — 밤낮 applyDebugBand와 같은 이유). */
export function applyDebugWeather(reg: Reg, data?: { debugWeather?: WeatherKind }): void {
  if (data?.debugWeather) reg.set("debugWeather", data.debugWeather);
  else reg.remove("debugWeather");
}
