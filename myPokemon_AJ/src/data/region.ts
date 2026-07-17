// 야외 맵들을 하나로 이어붙인 "리전" 정의.
//
// 왜 이렇게 하나:
//   AR 원본의 map_connections.dat를 읽어보면 태초마을·1번도로·상록시티가 **오프셋 0으로 정확히 수직으로** 붙는다.
//     55(태초) N ↔ 10(1번도로) S,  56(상록) S ↔ 10(1번도로) N   — 셋 다 폭 52칸
//   그래서 큰 PNG를 새로 굽지 않고 **PNG 3장을 오프셋 위치에 그대로 놓고**, 충돌/풀숲 격자만 런타임에 이어붙인다.
//   덕분에 맵 경계에서 암전 없이 그냥 걸어서 넘어간다(HGSS 감성).
//
// 좌표계 두 가지 — 헷갈리면 버그난다:
//   · **로컬 좌표** = 맵 한 장 기준 (예: 태초마을 연구소 문 = (28,14))
//   · **글로벌 좌표** = 리전 전체(52×100) 기준. 태초는 oy=80이라 같은 문이 (28,94)
//   WorldScene 안에서는 전부 글로벌을 쓴다. 다른 씬이 로컬로 말할 땐 map 이름을 같이 준다.

/**
 * 배틀 배경 종류 = AR map_metadata의 battle_background 값 그대로.
 * 파일은 `assets/battlebacks/<값>_bg.png` + `<값>_message.png` (AR Graphics/Battlebacks 원본).
 * ⚠️ 값을 추가하려면 그 png 두 장을 먼저 넣을 것 — 없으면 배틀 배경이 안 뜬다.
 */
export type Backdrop = "town" | "route" | "gym";

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
}

// ⚠️ 이름 "pallet"은 바꾸지 말 것 — 기존 세이브(v3)의 loc.map 값이자 텍스처 키다.
// ⚠️ cols/rows는 맵 JSON의 값과 **반드시 같아야 한다.** 어긋나면 격자가 조용히 깨지므로
//    WorldScene.create()가 로드 직후 대조해서 다르면 바로 에러를 던진다(assertRegionMatches).
export const REGION_MAPS: RegionMap[] = [
  {
    name: "viridian_city", label: "상록시티",
    img: "assets/world/viridian_city.png", data: "assets/world/viridian_city.json",
    ox: 0, oy: 0, cols: 52, rows: 40, battleBg: "town", bgm: "bgm_viridian",
  },
  {
    name: "route1", label: "1번도로",
    img: "assets/world/route1.png", data: "assets/world/route1.json",
    ox: 0, oy: 40, cols: 52, rows: 40, battleBg: "route", bgm: "bgm_route1",
    arMapId: 10,   // 태초/상록은 풀숲이 없어 조우표도 없다(맵 JSON에 grass 키 자체가 없음).
  },
  {
    name: "pallet", label: "태초마을",
    img: "assets/world/pallet_town.png", data: "assets/world/pallet_town.json",
    ox: 0, oy: 80, cols: 52, rows: 20, battleBg: "town", bgm: "bgm_town",
  },
];

// 리전 크기는 **맵 목록에서 계산한다** — 손으로 적어두면 맵을 추가·수정할 때 같이 안 고쳐져 격자가 깨진다.
export const REGION_COLS = Math.max(...REGION_MAPS.map(m => m.ox + m.cols));
export const REGION_ROWS = Math.max(...REGION_MAPS.map(m => m.oy + m.rows));

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
