// 야외 맵들을 하나로 이어붙인 "리전" 정의.
//
// 왜 이렇게 하나:
//   AR 원본의 map_connections.dat를 읽어보면 태초마을·1번도로·상록시티가 **오프셋 0으로 정확히 수직으로** 붙는다.
//     55(태초) N ↔ 10(1번도로) S,  56(상록) S ↔ 10(1번도로) N   — 셋 다 폭 52칸
//     56(상록) W ↔ 49(22번도로) E, 오프셋 0                     — 22번도로는 폭 58칸이라 왼쪽으로 58만큼
//   그래서 큰 PNG를 새로 굽지 않고 **PNG를 오프셋 위치에 그대로 놓고**, 충돌/풀숲 격자만 런타임에 이어붙인다.
//   덕분에 맵 경계에서 암전 없이 그냥 걸어서 넘어간다(HGSS 감성).
//
// 좌표계 두 가지 — 헷갈리면 버그난다:
//   · **로컬 좌표** = 맵 한 장 기준 (예: 태초마을 연구소 문 = (28,14))
//   · **글로벌 좌표** = 리전 전체(110×100) 기준. 태초는 ox=58·oy=80이라 같은 문이 (86,94)
//   WorldScene 안에서는 전부 글로벌을 쓴다. 다른 씬이 로컬로 말할 땐 map 이름을 같이 준다.

/**
 * 배틀 배경 종류 = AR map_metadata의 battle_background 값 그대로.
 * 파일은 `assets/battlebacks/<값>_bg.png` + `<값>_message.png` (AR Graphics/Battlebacks 원본).
 * ⚠️ 값을 추가하려면 그 png 두 장을 먼저 넣을 것 — 없으면 배틀 배경이 안 뜬다.
 */
export type Backdrop = "town" | "route" | "gym" | "mountain";

export interface RegionMap {
  name: string;        // 텍스처 키 겸 저장파일에 남는 이름
  label: string;       // 화면에 보여줄 한글 이름 (AR map_metadata의 real_name)
  img: string;
  data: string;
  ox: number;          // 리전 안에서의 왼쪽 위 칸 위치
  oy: number;
  cols: number;
  rows: number;
  battleBg: Backdrop;  // 이 맵에서 배틀 걸리면 쓸 배경 (AR map_metadata의 battle_background)
  bgm: string;         // 이 맵의 BGM 키 (AR 맵 데이터의 @bgm 그대로)
  arMapId?: number;    // AR 원본 맵 번호 = encounters.json의 키. 없으면 그 맵엔 야생 조우가 없다.
  // 전경(priority) 레이어 PNG가 있으면 true. AR의 나무 캐노피·지붕처럼 **캐릭터 위에** 그려지는 타일 모음
  //  (extract-map.py가 <name>_over.png로 뽑는다). WorldScene이 캐릭터보다 높은 depth로 덮어 그린다.
  overImg?: string;
  // 움직이는 오토타일(물결)이 있는 맵. tools/ar-map/extract-water.py가 <animFile>.png/.json을 만든다.
  //  ⚠️ 원본에서 **실제로 움직이는 맵만** true다 — 태초마을 물(NOANIMSEA)은 원본도 1프레임이라 정지다.
  animWater?: boolean;
  animFile?: string;
  // 이 맵의 고정 날씨 (AR map_metadata의 `weather` = `[:Rain, 100]` 형식 그대로 = [심볼, 확률%]).
  //  ⚠️ 원본 382맵 중 이게 있는 맵은 3개뿐이다(Route 2·15번도로·쌍둥이섬 지하4층).
  //     우리가 지금 쓰는 3맵은 전부 없음 = **항상 맑음이 원본 그대로**다. 날씨 있는 맵을 추가하면 여기 적으면 된다.
  weather?: [string, number];
}

// ⚠️ 이름 "pallet"은 바꾸지 말 것 — 기존 세이브(v3)의 loc.map 값이자 텍스처 키다.
// ⚠️ cols/rows는 맵 JSON의 값과 **반드시 같아야 한다.** 어긋나면 격자가 조용히 깨지므로
//    WorldScene.create()가 로드 직후 대조해서 다르면 바로 에러를 던진다(assertRegionMatches).
export const REGION_MAPS: RegionMap[] = [
  // ⚠️ 22번도로가 들어오면서 **세로 한 줄이던 리전이 가로로 넓어졌다.** 22번도로가 서쪽 끝(ox=0)이고
  //    나머지 셋은 그 오른쪽(ox=58)으로 통째로 밀렸다. 글로벌 좌표는 전부 toGlobal/toLocal을 지나고
  //    세이브는 맵이름+로컬좌표로 저장하므로(WorldScene의 saveLoc) 기존 세이브는 그대로 열린다.
  {
    name: "route22", label: "22번도로",
    img: "assets/world/route22.png", data: "assets/world/route22.json",
    overImg: "assets/world/route22_over.png",
    // 원본 map_connections.dat: [56,'W',0, 49,'E',0] = 상록시티 서쪽 변 ↔ 22번도로 동쪽 변, 세로 오프셋 0.
    //  → 상록시티와 같은 행 band(oy=0)에 놓이고 폭 58칸만큼 왼쪽에 붙는다.
    ox: 0, oy: 0, cols: 58, rows: 40, battleBg: "mountain", bgm: "bgm_route3",
    // 물결 42칸(상록시티와 같은 오토타일 STILL = 11프레임).
    animWater: true, animFile: "route22_anim",
    // ⚠️ arMapId는 **아직** 없다 = 야생도 안 나오고 트레이너도 안 선다(둘 다 이 키로 찾는다 —
    //    조우는 WorldScene.maybeWildEncounter, 배치는 setupTrainers).
    //    ⛔ 2026-08-18 정정: 처음엔 "원본 encounters.dat에 map 49가 없다"고 적었는데 **틀렸다.**
    //       원본엔 `:49_0`이 있고 Land 21%(BIDOOF·SPEAROW·NIDORAN… Lv2~5)·Water 2%·SuperRod까지 들어 있다.
    //       내 조회가 Symbol 키를 문자열로 비교해(`str(k)`가 `Symbol("49_0")`) 늘 빈 결과를 준 탓이다.
    //       우리 encounters.json에 "49"가 없는 건 **아직 안 뽑아서**다 → 뽑은 뒤 `arMapId: 49`를 넣을 것(C단계).
  },
  {
    name: "viridian_city", label: "상록시티",
    img: "assets/world/viridian_city.png", data: "assets/world/viridian_city.json",
    overImg: "assets/world/viridian_city_over.png",
    ox: 58, oy: 0, cols: 52, rows: 40, battleBg: "town", bgm: "bgm_viridian",
    // 움직이는 물결 30칸(원본 오토타일 STILL = 11프레임). tools/ar-map/extract-water.py가 뽑는다.
    animWater: true, animFile: "viridian_city_anim",
  },
  {
    name: "route1", label: "1번도로",
    img: "assets/world/route1.png", data: "assets/world/route1.json",
    overImg: "assets/world/route1_over.png",
    ox: 58, oy: 40, cols: 52, rows: 40, battleBg: "route", bgm: "bgm_route1",
    arMapId: 10,   // 태초/상록은 풀숲이 없어 조우표도 없다(맵 JSON에 grass 키 자체가 없음).
  },
  {
    name: "pallet", label: "태초마을",
    img: "assets/world/pallet_town.png", data: "assets/world/pallet_town.json",
    overImg: "assets/world/pallet_town_over.png",
    ox: 58, oy: 80, cols: 52, rows: 20, battleBg: "town", bgm: "bgm_town",
  },
];

// 리전 크기는 **맵 목록에서 계산한다** — 손으로 적어두면 맵을 추가·수정할 때 같이 안 고쳐져 격자가 깨진다.
export const REGION_COLS = Math.max(...REGION_MAPS.map(m => m.ox + m.cols));
export const REGION_ROWS = Math.max(...REGION_MAPS.map(m => m.oy + m.rows));

/**
 * 그 맵에 서 있을 때 카메라가 비춰도 되는 영역(칸 단위).
 *
 * ⚠️ 리전 전체(REGION_COLS×REGION_ROWS) 직사각형으로 잡으면 안 된다. 22번도로가 들어오며 리전이 **L자**가 됐고
 *    (행 40~99의 x 0~57은 어느 맵도 안 덮는다) 그대로 두면 1번도로·태초 서쪽 변에서 **화면의 48%가 검게** 뜬다
 *    (2026-08-18 실측 — `tools/dbg-camera-0818.mjs`).
 * 원본(Essentials)은 카메라를 **그 맵과 연결된 맵**까지만 보여준다. 그래서 여기서도
 *   · 가로 = 같은 **행 band**를 공유하는 맵들의 합집합 (상록에 서면 서쪽 22번도로가 보여야 하니까)
 *   · 세로 = 같은 **열 band**를 공유하는 맵들의 합집합 (상록에 서면 남쪽 1번도로가 보여야 하니까)
 * 로 잡는다. 대각선으로만 이웃한 구석(상록 남서 모서리에서 보이는 x<58·y≥40)이 검은 것은
 * **원본도 같다** — Essentials도 대각선 이웃은 그리지 않는다.
 */
export function cameraBounds(name: string): { x: number; y: number; w: number; h: number } {
  const m = regionMap(name);
  if (!m) return { x: 0, y: 0, w: REGION_COLS, h: REGION_ROWS };
  const rowMates = REGION_MAPS.filter(o => o.oy < m.oy + m.rows && m.oy < o.oy + o.rows);
  const colMates = REGION_MAPS.filter(o => o.ox < m.ox + m.cols && m.ox < o.ox + o.cols);
  const x0 = Math.min(...rowMates.map(o => o.ox));
  const x1 = Math.max(...rowMates.map(o => o.ox + o.cols));
  const y0 = Math.min(...colMates.map(o => o.oy));
  const y1 = Math.max(...colMates.map(o => o.oy + o.rows));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 맵 JSON이 region.ts의 선언과 같은 크기인지 확인. 다르면 즉시 에러(조용히 깨지는 것보다 낫다). */
export function assertRegionMatches(name: string, cols: number, rows: number): void {
  const m = regionMap(name);
  if (!m) throw new Error(`region.ts에 없는 맵: ${name}`);
  if (m.cols !== cols || m.rows !== rows)
    throw new Error(
      `맵 크기 불일치: ${name} — region.ts는 ${m.cols}x${m.rows}인데 ${m.data}는 ${cols}x${rows}다. ` +
      `맵을 다시 추출했으면 region.ts의 cols/rows/oy도 같이 고칠 것.`);
}

/** 맵 이름으로 찾기. 못 찾으면 undefined. */
export function regionMap(name: string): RegionMap | undefined {
  return REGION_MAPS.find(m => m.name === name);
}

/** 글로벌 좌표가 어느 맵에 속하는지. 리전 밖이면 undefined. */
export function mapAtGlobal(gx: number, gy: number): RegionMap | undefined {
  return REGION_MAPS.find(m => gx >= m.ox && gx < m.ox + m.cols && gy >= m.oy && gy < m.oy + m.rows);
}

/** 로컬 → 글로벌. 모르는 맵이면 태초마을로 떨어뜨리되 **조용히 넘기지 않는다**(오타·이름변경을 잡으려고). */
export function toGlobal(mapName: string, x: number, y: number): [number, number] {
  const m = regionMap(mapName);
  if (!m) {
    console.warn(`[region] 모르는 맵 "${mapName}" — 태초마을 기준으로 처리한다. 맵 이름을 바꿨다면 세이브 마이그레이션이 필요하다.`);
    const fb = regionMap("pallet")!;
    return [x + fb.ox, y + fb.oy];
  }
  return [x + m.ox, y + m.oy];
}

/** 글로벌 → 로컬(+맵 이름). 리전 밖이면 태초마을로 떨어뜨린다. */
export function toLocal(gx: number, gy: number): { map: string; x: number; y: number } {
  const m = mapAtGlobal(gx, gy) ?? regionMap("pallet")!;
  return { map: m.name, x: gx - m.ox, y: gy - m.oy };
}
