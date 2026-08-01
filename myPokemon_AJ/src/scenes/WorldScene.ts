import Phaser from "phaser";
import { Gender } from "../data/Player";
import { Pokemon, createFromSpecies } from "../data/Pokemon";
import { playBgm } from "../game/bgm";
import { playSfx, playMe, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import { autoSaveWithToast } from "../game/saveIndicator";
import DialogBox from "../ui/DialogBox";
import { REGION_MAPS, REGION_COLS, REGION_ROWS, mapAtGlobal, toGlobal, toLocal, assertRegionMatches, RegionMap } from "../data/region";
import { getEncounters, getMapTrainers, loadArDb } from "../data/ar";
import type { TrainerPlacement } from "../data/ar";
import { encounterTriggered, chooseWildPokemon, resetEncounterSteps } from "../systems/encounter";
import { attachDayNight, applyDebugBand, BAND_LABEL, DayNightOverlay, TimeBand } from "../systems/daynight";
import { attachWeather, applyDebugWeather, preloadWeather, rollWeather, WeatherKind, WEATHER_LABEL, WeatherOverlay } from "../systems/weather";
import { preloadVsIntroAll, playVsIntro, vsKeyFromTrainerId } from "../systems/vsIntro";
import { settings, stepDurationMs } from "../systems/settings";
import { isActionDown, keysLabel, onAction } from "../systems/input";
import { activePage, talkablePage, visibleGraphic, dirFrame } from "../systems/mapEvents";
import type { EventPage, MapEvent, MapEventFile } from "../systems/mapEvents";
import { loadEventSheet, preloadEventAudio, runEventPage } from "../systems/fieldEventRunner";

// 야외 = 어나더레드에서 그대로 추출한 맵 3장을 **하나로 이어붙인 리전**(52×100칸).
//  - 위에서부터 상록시티(0~39) · 1번도로(40~79) · 태초마을(80~99). 배치 근거는 src/data/region.ts 주석 참고
//    (AR map_connections.dat에서 셋 다 오프셋 0으로 수직 연결인 걸 확인함).
//  - 맵 경계에 암전·로딩이 없다. 그냥 걸어서 넘어간다(HGSS 감성).
//  - 격자(칸) 단위 이동 + 카메라가 주인공을 따라감.
//
// ⚠️ 이 씬 안의 좌표(this.tx/ty, warps, walkable)는 전부 **리전 글로벌**이다.
//    다른 씬이 "태초마을의 (28,14)"처럼 맵 기준으로 말할 땐 map 이름을 같이 넘긴다(init 참고).
type Dir = "down" | "left" | "right" | "up";
interface Warp { x: number; y: number; to: string; dir?: Dir; room?: string }
/** 맵에 서 있는 원본 이벤트 하나(글로벌 좌표 + 화면에 올린 그림). */
interface FieldEvent { ev: MapEvent; map: string; gx: number; gy: number; sprite?: Phaser.GameObjects.Sprite }

// 카메라 프레이밍 — 원본(Another Red)은 내부해상도 512×384 / 타일 32px라 **창 크기와 무관하게 항상 16×12칸**이 보인다.
//  우리는 캔버스가 창 전체(main.ts의 Phaser.Scale.RESIZE)라 SCALE을 2로 고정하면 창이 클수록 보이는 칸이 늘어
//  건물이 상대적으로 작아 보였다(1280창=20칸, 1920창=30칸 → 원본의 0.8배·0.53배). → 창 크기에서 SCALE을 역산한다.
//  ⚠️ 카메라 zoom으로 하면 안 된다: setScrollFactor(0)인 UI(DialogBox·HUD)까지 같이 확대되고 화면 밖으로 나간다.
const VIEW_COLS = 16, VIEW_ROWS = 12;         // 원본 512×384 ÷ 32px
const fitScale = (w: number, h: number): number =>
  //  min = **세로맞춤**(사용자 확정, 01_Resources/Pick/14_카메라프레이밍 B안). 세로 12칸이 원본과 정확히 같고,
  //  원본이라면 좌우에 검은 여백이 생길 자리를 맵으로 채운다(16:9 창 기준 21.3×12칸).
  //  ⚠️ max로 바꾸면 가로 16칸에 맞춰져 세로가 9칸으로 잘린다(A안 — 사용자가 안 고름).
  Phaser.Math.Clamp(Math.min(w / (VIEW_COLS * 32), h / (VIEW_ROWS * 32)), 1, 8);
let SCALE = 2;                                // create()에서 창 크기로 다시 계산된다(타일 = 32*SCALE px)
// 사람·물건은 **아래(칸 y가 큰) 것이 앞에** 그려진다 — 원본 RMXP의 Y정렬 그대로.
//  (안 하면 위 칸의 몬스터볼이 주인공 머리 위에 덮여 그려진다. 실제로 그렇게 나왔다.)
//  5 = 캐릭터 층, 전경(나무 캐노피) 층은 6이라 5.x 범위를 넘지 않게 아주 작은 값을 더한다.
const yDepth = (ty: number): number => 5 + ty * 0.001;
const START_MAP = "pallet";
const START_LOCAL = { x: 17, y: 8 };          // 태초마을 기준 우리집 문 앞

// 첫 라이벌 배틀 — 네모는 연구소에서 **먼저 나가**(LabScene의 퇴장 컷신) 밖에서 기다리고 있다.
//  기다리는 자리는 고정좌표가 아니라 **플레이어가 서 있는 줄의 옆 칸들**로 잡는다(RIVAL_GAP칸 떨어져 대기 → 걸어옴).
//  ⚠️ 고정좌표로 박으면 안 된다: 라이벌전에서 지면 집으로 보내지고 예약은 남아 있어(이겼을 때만 소비) 집 앞에서 재대결이
//     걸리는데, 그때 네모가 연구소 앞 좌표에 서 있으면 화면 밖에서 혼자 걷고 플레이어만 얼어붙는다.
const RIVAL_GAP = 4;   // 처음 서서 기다리는 거리(칸)

// 방향 → 한 칸 벡터. 트레이너 시야가 어느 쪽으로 뻗는지 계산하는 데 쓴다.
const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

// 맵 위에 서 있는 트레이너 한 명(AR 맵 이벤트에서 그대로 가져온 것).
interface TrainerNpc {
  spot: TrainerPlacement;
  gx: number; gy: number;      // 리전 글로벌 좌표(spot.x/y는 맵 로컬이다)
  sheet: string;               // 오버월드 스프라이트시트 키
  sprite: Phaser.GameObjects.Sprite;
  defeated: boolean;           // 이미 이긴 상대 → 시야에 안 걸린다
}

export default class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "down";
  private shiftKey?: Phaser.Input.Keyboard.Key;   // 취소키와 함께 눌러 두면 반대 속도(걷기↔달리기)

  // 리전 전체 격자(맵 3장을 이어붙인 것). 좌표는 전부 글로벌.
  private cols = REGION_COLS; private rows = REGION_ROWS;
  private blocked: number[][] = [];
  private grass: number[][] = [];   // 1 = 풀숲(야생 조우 판정 칸). 풀숲 없는 맵은 전부 0으로 남는다.
  // 언덕(점프대). 0 = 아님 / 2·4·6·8 = **그 방향으로만** 뛰어내릴 수 있다(RMXP 방향번호: 2아래 4왼 6오 8위).
  //  원본 Game_Player#move_generic 과 같다 — 방향이 맞으면 걷는 대신 2칸 점프, 아니면 벽이다.
  //  ⚠️ 언덕 칸은 blocked에서도 1이다(그 위에 설 수 없다) → walkable()만 보는 코드는 자동으로 안전하다.
  private ledge: number[][] = [];
  private tile = 32 * SCALE;
  private tx = 0; private ty = 0;
  private moving = false; private busy = false;
  private lastBump = 0;   // 벽 부딪힘 효과음 연타 방지용
  private curMap?: RegionMap;   // 지금 서 있는 맵(배틀 배경·저장·위치표시에 쓴다)

  // 워프는 "어느 맵의 어느 칸"으로 적는다(로컬 좌표 — 원본 맵 기준이라 읽기 쉽다).
  // create()에서 글로벌로 바꿔 this.warps에 넣는다.
  private warpDefs: (Warp & { map: string })[] = [
    { map: "pallet", x: 28, y: 14, to: "lab", dir: "up" },                    // 포켓몬 연구소
    { map: "pallet", x: 17, y: 7, to: "house", room: "living", dir: "up" },   // 우리집(거실로)
    { map: "pallet", x: 27, y: 7, to: "house", room: "rival", dir: "up" },    // 라이벌(그린)의 집
    // 상록체육관 — 문 칸·도착 좌표 전부 AR 원본 Map56 이벤트(Home door)의 transfer 값이다(눈대중 아님).
    { map: "viridian_city", x: 35, y: 9, to: "gym", dir: "up" },
    // 상록 포켓몬센터(AR Map158)·프렌들리 숍(AR Map159) — 문 칸도 Map56 transfer 값 그대로.
    { map: "viridian_city", x: 26, y: 25, to: "pc", dir: "up" },
    { map: "viridian_city", x: 35, y: 25, to: "mart", dir: "up" },
    // 민가 4채(AR Map160·161·162·163) — 문 칸도 Map56의 'Home door' 이벤트 transfer 값 그대로다.
    { map: "viridian_city", x: 26, y: 18, to: "house1", dir: "up" },
    { map: "viridian_city", x: 35, y: 18, to: "house2", dir: "up" },
    { map: "viridian_city", x: 26, y: 11, to: "house3", dir: "up" },
    { map: "viridian_city", x: 8, y: 27, to: "house4", dir: "up" },
  ];
  private warps: Warp[] = [];   // create()에서 글로벌로 변환된 것

  private spawn = { x: 0, y: 0, face: "down" as Dir };
  private autoMenu = false;   // 디버그 '인게임 메뉴' 바로가기: 마을 위에 메뉴를 바로 연다
  // 확인 항목용 VS 연출 바로가기 — [상대 id, 화면에 적을 이름]. AR 정의가 있는 상대는 "TYPE:이름",
  //  정의가 없는 상대(네모)는 그림 파일 이름("NEMONA")을 준다.
  private debugVs: [string, string] | null = null;
  private trainers: TrainerNpc[] = [];          // 맵에 서 있는 트레이너들(1번도로 반바지꼬마·짧은치마)
  private setupRun = 0;                         // setupTrainers 실행 번호(씬 재시작 시 옛 실행을 무시하려고)
  // 필드 이벤트(NPC·팻말·바닥 아이템·열매나무). `events`는 Phaser 씬이 이미 쓰는 이름이라 events2로 둔다.
  private events2: FieldEvent[] = [];
  private nemona?: Phaser.GameObjects.Sprite;   // 첫 배틀 때 밖에서 기다리는 네모(그 외엔 없음)
  private rival?: { path: [number, number][]; from: "left" | "right" };   // 네모가 걸어올 길(플레이어 기준으로 잡음)
  private dlg!: DialogBox;
  private dayNight!: DayNightOverlay;   // 야외 시간대 색조(아침/낮/저녁/밤)
  private weather!: WeatherOverlay;     // 야외 날씨(비·눈·모래바람…) — 밤낮보다 아래에 그린다

  /** HUD 한 줄 — 조작 안내 + 지금 시간대. 시간대가 바뀌면 다시 불러 글자만 갈아끼운다. */
  private updateHudTime(): void {
    const hud = this.children.getByName("hud") as Phaser.GameObjects.Text | null;
    if (!hud) return;
    const name = (this.registry.get("playerName") as string) ?? "";
    // 날씨는 맑을 땐 안 적는다(항상 "맑음"이 붙어 있으면 잔소리다).
    const w = this.weather?.kind && this.weather.kind !== "none" ? `  |  ${WEATHER_LABEL[this.weather.kind]}` : "";
    // 메뉴 키는 옵션에서 바꿀 수 있으므로 **지금 걸린 키**를 그때그때 적는다(안내가 거짓말이 되지 않게).
    const menuKey = keysLabel("MENU").split(" · ")[0];
    hud.setText(`${name ? name + "  |  " : ""}방향키: 이동  |  ${menuKey}: 메뉴  |  ${BAND_LABEL[this.dayNight.band]}${w}`);
  }
  private onResize = (): void => { this.reframe(); this.dlg.layout(); };

  /** 창 크기가 바뀌어도 원본과 같은 16×12칸 프레이밍을 유지하도록 월드 전체를 다시 스케일한다.
   *  월드 오브젝트의 좌표는 전부 tile의 배수(cx/cy·ox*tile)라 **비율만 곱하면** 된다 — 개별 좌표를 다시 계산할 필요가 없다.
   *  HUD·대사창은 scrollFactor 0(화면 고정)이라 건드리지 않는다. */
  private reframe(): void {
    const s = fitScale(this.scale.gameSize.width, this.scale.gameSize.height);
    if (s === SCALE) return;
    const ratio = s / SCALE;
    SCALE = s; this.tile = 32 * SCALE;
    for (const obj of this.children.list) {
      const o = obj as Phaser.GameObjects.Sprite;
      if (o.scrollFactorX === 0 || typeof o.setScale !== "function") continue;
      o.x *= ratio; o.y *= ratio; o.setScale(SCALE);
    }
    this.cameras.main.setBounds(0, 0, this.cols * this.tile, this.rows * this.tile);
  }

  constructor() { super("WorldScene"); }

  // spawn 좌표의 의미가 두 가지다 — 안 지키면 엉뚱한 맵에 떨어진다:
  //   · map을 같이 주면  → spawn은 **그 맵 기준 로컬** (예: LabScene이 "태초마을 (28,15)"로 내보냄)
  //   · map이 없으면     → spawn은 **리전 글로벌** (예: BattleScene이 돌려주는 returnPos = 배틀 걸린 그 자리)
  init(data: { spawn?: [number, number]; map?: string; face?: Dir; openMenu?: boolean; debugTimeBand?: TimeBand; debugWeather?: WeatherKind; debugVs?: [string, string] }): void {
    // 확인 항목이 시간대·날씨를 강제로 넘겼으면 반영(없으면 실제 시계/맵 설정으로 되돌린다).
    applyDebugBand(this.registry, data);
    applyDebugWeather(this.registry, data);
    // ⚠️ Phaser 함정: `scene.start(key)`를 **data 없이** 부르면 지난번 data를 그대로 다시 넘긴다
    //    (settings.data가 남아 있다). 그래서 디버그로 한 번 밤·비를 강제하면 그 뒤 정상 입장에도
    //    계속 밤비가 따라왔다(실제로 검증에서 잡혔다). 읽은 즉시 지워 **1회용**으로 만든다.
    if (data) { delete data.debugTimeBand; delete data.debugWeather; }
    // ⚠️ Phaser는 씬을 다시 시작해도 **같은 인스턴스**를 쓴다 → 클래스 필드(= 위의 `busy = false`)는 다시 초기화되지 않는다.
    //    배틀·워프로 나갈 때 켜둔 busy를 여기서 안 되돌리면 돌아왔을 때 켜진 채로 남아 **플레이어가 영영 얼어붙는다**
    //    (update()가 busy면 입력을 통째로 무시한다). init은 scene.start마다 도는 유일한 자리다.
    this.busy = false;
    this.moving = false;
    const face = data?.face ?? "down";
    if (data?.spawn) {
      const [gx, gy] = data.map ? toGlobal(data.map, data.spawn[0], data.spawn[1]) : data.spawn;
      this.spawn = { x: gx, y: gy, face };
    } else {
      const [gx, gy] = toGlobal(START_MAP, START_LOCAL.x, START_LOCAL.y);
      this.spawn = { x: gx, y: gy, face: "down" };
    }
    this.autoMenu = !!data?.openMenu;
    // ⚠️ 0801 함정 6번과 같은 처리 — 읽은 즉시 지워 **1회용**으로 만든다.
    //    안 지우면 scene.start(key)를 data 없이 부를 때 Phaser가 지난 data를 다시 넘겨,
    //    한 번 본 VS 연출이 그 뒤 정상 플레이에도 계속 따라붙는다.
    this.debugVs = data?.debugVs ?? null;
    if (data) delete data.debugVs;
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    // 맵 3장을 각각 불러온다(큰 PNG를 새로 굽지 않는다 — region.ts 주석 참고).
    // ⚠️ 캐시에 남은 옛 격자를 먼저 지운다 — 안 지우면 맵 JSON을 고치고 씬을 다시 들어와도
    //    "고쳤는데 똑같다"가 된다(.claude/rules/maps-collision.md 5번).
    for (const m of REGION_MAPS) {
      this.cache.json.remove(`${m.name}_col`);
      this.cache.json.remove(`${m.name}_events`);
      this.load.image(m.name, `${m.img}?v=` + Date.now());
      this.load.json(`${m.name}_col`, `${m.data}?v=` + Date.now());
      // 원본 맵 이벤트(NPC 대사·팻말·바닥 아이템·열매나무) — tools/ar-map/extract-events.py가 뽑은 것.
      this.load.json(`${m.name}_events`, `${m.data.replace(".json", "_events.json")}?v=` + Date.now());
      // 움직이는 물결(오토타일) — tools/ar-map/extract-water.py.
      //  ⚠️ 원본에서 실제로 움직이는 맵만 파일이 있다(상록시티뿐 — 태초마을 물은 원본도 정지 오토타일이다).
      if (m.animWater) {
        this.cache.json.remove(`${m.name}_anim`);
        this.load.json(`${m.name}_anim`, `assets/world/${m.animFile}.json?v=` + Date.now());
        this.load.spritesheet(`${m.name}_anim`, `assets/world/${m.animFile}.png?v=` + Date.now(),
          { frameWidth: 32, frameHeight: 32 });
      }
      // 전경(나무 캐노피·지붕) 레이어 — 있으면 캐릭터 위로 그리려고 따로 불러온다.
      if (m.overImg) this.load.image(`${m.name}_over`, `${m.overImg}?v=` + Date.now());
    }
    preloadCommonAudio(this);
    preloadEventAudio(this);   // 원본 이벤트가 내는 소리(피카츄 울음 등)
    // VS 연출 — 월드에선 누구와 눈이 마주칠지 미리 모르므로 초상까지 전부 받아 둔다(그림 5장, 가볍다).
    preloadVsIntroAll(this);
    preloadWeather(this);   // 날씨 그림(AR 원본) — 맵에 날씨가 없으면 안 쓰이고 로드만 된다
    const file = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, file, { frameWidth: 32, frameHeight: 48 });
    // 라이벌(네모) 오버월드 스프라이트 — 스타터 선택 직후 첫 배틀 연출용.
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
  }

  create(): void {
    // 프레이밍 먼저 정한다 — 아래 맵 이미지·스프라이트 배치가 전부 this.tile 기준이라 순서가 중요하다.
    //  (this.tile의 필드 초기화는 씬 생성 때 한 번뿐이고 Phaser는 재시작해도 같은 인스턴스를 쓴다 → 여기서 매번 다시 잡는다)
    SCALE = fitScale(this.scale.gameSize.width, this.scale.gameSize.height);
    this.tile = 32 * SCALE;

    // 리전 격자를 "전부 막힘"으로 깔고, 맵 3장의 blocked를 각자 오프셋 위치에 찍어 넣는다.
    //  (맵이 안 덮는 칸은 막힌 채로 남아 밖으로 못 나간다 — 리전 가장자리 보호막 역할)
    this.blocked = Array.from({ length: REGION_ROWS }, () => new Array<number>(REGION_COLS).fill(1));
    // 풀숲은 반대로 "전부 아님(0)"으로 깔고 맵이 준 칸만 켠다(맵 밖은 풀숲이 아니다).
    this.grass = Array.from({ length: REGION_ROWS }, () => new Array<number>(REGION_COLS).fill(0));
    // 언덕도 "전부 아님(0)"으로 깔고 맵이 준 칸만 켠다(태초마을엔 언덕이 0칸이라 키가 아예 없다).
    this.ledge = Array.from({ length: REGION_ROWS }, () => new Array<number>(REGION_COLS).fill(0));
    for (const m of REGION_MAPS) {
      // grass·ledge는 그게 있는 맵에만 있다 — 없는 맵은 extract-map.py가 키를 아예 안 넣는다.
      const col = this.cache.json.get(`${m.name}_col`) as
        { cols: number; rows: number; blocked: number[][]; grass?: number[][]; ledge?: number[][] };
      assertRegionMatches(m.name, col.cols, col.rows);   // 크기가 어긋나면 조용히 깨지지 말고 여기서 죽어라
      for (let y = 0; y < col.rows; y++)
        for (let x = 0; x < col.cols; x++) {
          this.blocked[y + m.oy][x + m.ox] = col.blocked[y][x];
          if (col.grass) this.grass[y + m.oy][x + m.ox] = col.grass[y][x];
          if (col.ledge) this.ledge[y + m.oy][x + m.ox] = col.ledge[y][x];
        }
      this.textures.get(m.name).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.add.image(m.ox * this.tile, m.oy * this.tile, m.name).setOrigin(0, 0).setScale(SCALE).setDepth(0);
      // 전경 레이어: 나무 캐노피·지붕 등 AR에서 priority>0였던 타일. depth를 캐릭터(5)보다 높여
      //  플레이어·트레이너가 나무 뒤로 지나가게 한다(예전엔 캐릭터가 나무 위를 덮어 "나무 위에 선" 버그).
      if (m.overImg && this.textures.exists(`${m.name}_over`)) {
        this.textures.get(`${m.name}_over`).setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.add.image(m.ox * this.tile, m.oy * this.tile, `${m.name}_over`).setOrigin(0, 0).setScale(SCALE).setDepth(6);
      }
    }
    // 워프(로컬로 적어둔 것)를 글로벌로 바꾼다.
    this.warps = this.warpDefs.map(w => {
      const [gx, gy] = toGlobal(w.map, w.x, w.y);
      return { x: gx, y: gy, to: w.to, dir: w.dir, room: w.room };
    });

    this.textures.get(this.texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const mkWalk = (key: string, frames: number[]) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mkWalk("walk-down", [0, 1, 2, 3]); mkWalk("walk-left", [4, 5, 6, 7]);
    mkWalk("walk-right", [8, 9, 10, 11]); mkWalk("walk-up", [12, 13, 14, 15]);
    // 네모 걷기 애니(주인공과 같은 시트 배치). 애니는 게임 전역이라 재입장 시 이미 있을 수 있다.
    const mkNem = (key: string, frames: number[]) => {
      if (!this.anims.exists(`nem-${key}`))
        this.anims.create({ key: `nem-${key}`, frames: this.anims.generateFrameNumbers("nemona_ow", { frames }), frameRate: 8, repeat: -1 });
    };
    mkNem("down", [0, 1, 2, 3]); mkNem("left", [4, 5, 6, 7]); mkNem("right", [8, 9, 10, 11]); mkNem("up", [12, 13, 14, 15]);

    this.tx = this.spawn.x; this.ty = this.spawn.y; this.facing = this.spawn.face;
    this.curMap = mapAtGlobal(this.tx, this.ty);   // 시작 시점의 맵(이름 배너는 안 띄운다 — 들어온 게 아니라 원래 거기다)
    this.player = this.add.sprite(this.cx(this.tx), this.cy(this.ty), this.texKey, this.idleFrame[this.facing])
      .setOrigin(0.5, 1).setScale(SCALE).setDepth(yDepth(this.ty));
    this.cursors = this.input.keyboard!.createCursorKeys();
    // 이동 중 눌러 두면 '반대 속도'가 되는 키 = 원본의 Back 버튼(기본 X) — systems/input.ts의 BACK 액션.
    //  Shift는 원본에 없지만 손에 익은 사람을 위해 함께 받는다.
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.dlg = new DialogBox(this);
    // ⚠️ this.scale은 씬이 아니라 게임 전역 이벤트원이다 → off("resize")를 콜백 없이 부르면 '다른 씬 리스너까지' 다 지운다.
    this.scale.on("resize", this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.onResize); this.dlg.destroy(); });

    // 첫 라이벌 배틀이 예약돼 있으면 = 네모는 연구소를 먼저 나와 **밖에서 이미 기다리고 있다**.
    //  (플레이어가 문에서 나오는 순간 뒤에서 따라 내려오면 "안에 있다 따라나온" 꼴이라 흐름이 어긋난다.)
    if (this.registry.get("rivalBattlePending")) {
      this.rival = this.rivalApproach();
      if (this.rival) {
        const [wx, wy] = this.rival.path[0];   // 처음 서 있는 자리(가장 먼 칸)
        this.textures.get("nemona_ow").setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.nemona = this.add.sprite(this.cx(wx), this.cy(wy), "nemona_ow",
          this.rival.from === "left" ? this.idleFrame.right : this.idleFrame.left)   // 플레이어 쪽을 보고 선다
          .setOrigin(0.5, 1).setScale(SCALE).setDepth(5);
        this.busy = true;   // 컷신이 시작될 때까지 플레이어가 움직여 좌표가 어긋나지 않게 미리 잠근다
      }
    }

    // 카메라: 맵 경계 설정 + 주인공 추적, 픽셀 또렷하게
    this.cameras.main.setBounds(0, 0, this.cols * this.tile, this.rows * this.tile);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    playBgm(this, this.curMap?.bgm ?? BGM.town, 0.35);   // 시작한 맵의 BGM(태초=KM_Pallet, 1번도로=KM_Route1 …)

    // ★ 밤낮 — 야외는 실제 시계를 따라 아침/낮/저녁/밤으로 물든다(systems/daynight.ts).
    //   depth 900 = 맵·캐릭터보다 위, HUD(100)보다도 위지만 대화창(1000)·메뉴보다는 아래.
    //   ⚠️ HUD 글자까지 같이 어두워지는 게 맞다(원본도 화면 전체에 색조를 씌운다).
    // ★ 날씨 — 맵 메타데이터에 적힌 확률로 정한다(원본 방식). depth 880 = **밤낮 색조(900)보다 아래**라
    //   밤에 내리는 비도 함께 어두워진다.
    this.weather = attachWeather(this, rollWeather(this.registry, this.curMap?.weather), 880);
    //   구간이 바뀌면(예: 19시→20시) HUD 글자도 같이 갈아끼운다.
    this.dayNight = attachDayNight(this, 900, () => this.updateHudTime());

    // HUD(화면 고정)
    const name = (this.registry.get("playerName") as string) ?? "";
    // 조작 안내는 맵과 무관한 것만 적는다 — 리전이 3장이 되면서 "연구소 문으로" 안내가 1번도로·상록시티에서도 떠서 틀렸다.
    //  시간대도 함께 띄운다 — 화면이 왜 어두운지(밤이라서) 플레이어가 바로 알 수 있게.
    this.add.text(12, 12, "", {
      fontFamily: "Galmuri11, sans-serif", fontSize: "16px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100).setName("hud");
    this.updateHudTime();
    // 메뉴(기본 Z·Enter) = 인게임 메뉴(포켓몬/가방/저장) 오버레이 열기. 가방(기본 D)은 바로 가방으로.
    //  ⚠️ 원본도 필드 메뉴는 Input::ACTION(물리 Z)이다(Scene_Map.rb의 menu_calling).
    // 확인키(기본 C·Enter·Space) = 앞칸의 NPC·팻말·아이템에 말 걸기(원본 Input::USE → interact_calling).
    onAction(this, "USE", () => this.interact());
    onAction(this, "MENU", () => this.openMenu());
    onAction(this, "BAG", () => this.openMenu("bag"));
    // 메뉴 닫혀 이 씬이 재개되면 입력을 다시 켠다.
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.input.enabled = true; });

    // 디버그 '인게임 메뉴' 바로가기로 진입 시: 마을을 먼저 그린 뒤 그 위에 메뉴 오버레이를 연다
    //  (예전엔 MenuScene을 단독 start해 뒤에 아무것도 없어 '검은 배경 위 메뉴'로 보였다).
    if (this.autoMenu) this.time.delayedCall(80, () => this.openMenu());

    // 연구소에서 스타터를 고르고 나왔다면: 밖에서 기다리던 네모가 다가와 첫 라이벌 배틀을 건다.
    this.time.delayedCall(450, () => this.maybeStartRivalBattle());

    // 확인 항목용: VS 연출만 바로 본다(실제 배틀 진입 경로 그대로 — 연출 끝나면 그 배틀로 들어간다).
    if (this.debugVs) {
      const [id, name] = this.debugVs;
      this.time.delayedCall(400, () => this.startBattleWithVs(vsKeyFromTrainerId(id), name, () =>
        void this.scene.start("BattleScene", {
          ally: (this.registry.get("playerParty") as Pokemon[] | undefined)?.[0],
          trainerId: id.includes(":") ? id : undefined,
          trainer: id.includes(":") ? undefined : name,
          trainerSprite: id.includes(":") ? undefined : id,
          enemy: id.includes(":") ? undefined : createFromSpecies("CHARMANDER", 5),
          wild: false, testParty: true,
          backdrop: this.curMap?.battleBg ?? "town",
          returnPos: [this.tx, this.ty], returnFacing: this.facing,
        })));
    }

    // 첫 라이벌전을 방금 이기고 마을로 돌아왔다면(도입부 완결) → 자동저장(이정표).
    //  BattleScene이 승리 시 세운 원샷 플래그를 여기서 소비한다(스폰 좌표 확정 후 잠깐 뒤).
    if (this.registry.get("rivalJustWon")) {
      this.registry.set("rivalJustWon", false);
      this.time.delayedCall(600, () => {
        const at = toLocal(this.tx, this.ty);
        autoSaveWithToast(this, { scene: "WorldScene", map: at.map, tx: at.x, ty: at.y, facing: this.facing });
      });
    }

    // 트레이너 배치는 AR DB(비동기 fetch)가 있어야 알 수 있다 → 따로 띄운다.
    this.setupTrainers().catch((e) => console.error("[WorldScene] 트레이너 배치 실패:", e));
    this.setupEvents();   // 원본 맵 이벤트(NPC 대사·팻말·바닥 아이템·열매나무)
    this.setupWater();    // 움직이는 물결(원본 오토타일 애니)
  }

  // ── 물결(움직이는 오토타일) ──────────────────────────────
  /**
   * 원본의 움직이는 오토타일을 그 칸 위에 얹어 돌린다.
   *  · 맵 PNG는 오토타일의 **첫 프레임**만 구워져 있다(extract-map.py) → 그 위에 같은 크기로 덮는다.
   *  · 속도는 원본 `TilemapRenderer.rb`의 `AUTOTILE_FRAME_DURATION = 5`(1/20초) = **프레임당 0.25초**.
   *  · 상록시티 30칸뿐이다 — 태초마을 물(NOANIMSEA)은 **원본도 안 움직인다**(1프레임짜리 그림).
   */
  private setupWater(): void {
    for (const m of REGION_MAPS) {
      if (!m.animWater) continue;
      const meta = this.cache.json.get(`${m.name}_anim`) as
        { frameMs: number; frames: number; rows: number; cells: { x: number; y: number; row: number }[] } | undefined;
      if (!meta || !this.textures.exists(`${m.name}_anim`)) continue;
      this.textures.get(`${m.name}_anim`).setFilter(Phaser.Textures.FilterMode.NEAREST);
      // 모양(줄)마다 애니를 하나씩 만든다. 애니는 게임 전역이라 씬을 다시 열어도 남아 있다.
      for (let row = 0; row < meta.rows; row++) {
        const key = `water_${m.name}_${row}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`${m.name}_anim`, {
            frames: Array.from({ length: meta.frames }, (_, f) => row * meta.frames + f),
          }),
          frameRate: 1000 / meta.frameMs,   // 0.25초 → 4fps
          repeat: -1,
        });
      }
      for (const c of meta.cells) {
        const [gx, gy] = toGlobal(m.name, c.x, c.y);
        // depth 1 = 맵 바닥(0)보다 위, 캐릭터(5)·전경보다 아래.
        this.add.sprite(this.cx(gx), this.cy(gy), `${m.name}_anim`)
          .setOrigin(0.5, 1).setScale(SCALE).setDepth(1).play(`water_${m.name}_${c.row}`);
      }
    }
  }

  // ── 필드 이벤트(NPC·팻말·바닥 아이템·열매나무) ──────────────
  //  원본 이벤트를 그대로 뽑아 온 것이다(systems/mapEvents.ts 머리말 참고).
  //  ⚠️ 스프라이트시트 칸 크기는 파일마다 다르다 — AR 캐릭터 시트는 **가로 4칸 × 세로 4칸**이 규칙이라
  //     그림을 받아 크기를 재서 잘라야 한다(NPC 29는 48x48, 볼은 32x32, 열매나무는 32x64다).
  private setupEvents(): void {
    this.events2 = [];
    for (const m of REGION_MAPS) {
      const file = this.cache.json.get(`${m.name}_events`) as MapEventFile | undefined;
      if (!file?.events) continue;
      for (const ev of file.events) {
        const page = activePage(this.registry, m.name, ev);
        if (!page) continue;                     // 지금 조건에 맞는 페이지가 없다(스토리 진행 전 NPC 등)
        // 그림도 없고 말도 못 거는 페이지 = 지금은 없는 셈(원본이 NPC를 숨기는 방법).
        if (!page.graphic && !talkablePage(this.registry, m.name, ev)) continue;
        const [gx, gy] = toGlobal(m.name, ev.x, ev.y);
        const entry: FieldEvent = { ev, map: m.name, gx, gy };
        this.events2.push(entry);
        if (!page.graphic) continue;             // 팻말 — 이미 벽인 타일 위에 얹힌 것이라 그릴 것도 막을 것도 없다
        // 사람·볼·나무가 선 칸은 지나갈 수 없다(원본 이벤트도 통행 불가).
        if (this.blocked[gy]) this.blocked[gy][gx] = 1;
        void this.drawEventSprite(entry, page.graphic, page.dir);
      }
    }
  }

  /** 이벤트 그림 한 장을 화면에 올린다(시트 만드는 일은 fieldEventRunner가 게임 전역으로 관리한다). */
  private async drawEventSprite(entry: FieldEvent, gfx: string, dir?: number): Promise<void> {
    const run = this.setupRun;
    const sheetKey = await loadEventSheet(this, gfx);
    if (!sheetKey) return;
    if (run !== this.setupRun || !this.scene.isActive()) return;
    // 원본이 정해둔 방향으로 세운다(벽을 보고 선 사람·마주 보고 선 사람이 있다).
    entry.sprite = this.add.sprite(this.cx(entry.gx), this.cy(entry.gy), sheetKey, dirFrame(dir))
      .setOrigin(0.5, 1).setScale(SCALE).setDepth(yDepth(entry.gy));
  }

  /** 지금 바라보는 칸에 있는 이벤트(말 걸기용). 팻말처럼 그림 없는 것도 좌표로 찾는다. */
  private eventInFront(): FieldEvent | undefined {
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.facing];
    const fx = this.tx + d[0], fy = this.ty + d[1];
    return this.events2.find((e) => e.gx === fx && e.gy === fy);
  }

  /** 확인키 — 앞칸의 이벤트에 말을 건다. */
  private interact(): void {
    if (this.busy || this.moving) return;
    const entry = this.eventInFront();
    if (!entry) return;
    const page = talkablePage(this.registry, entry.map, entry.ev);
    if (!page) return;
    this.busy = true;
    // 실제 실행은 씬 밖의 공용 실행기가 한다(실내 민가도 같은 것을 쓴다 — systems/fieldEventRunner.ts).
    runEventPage(this, this.dlg, entry.map, entry.ev, page)
      .then((changed) => { if (changed) this.refreshEvent(entry); })
      .catch((e) => console.error("[WorldScene] 이벤트 오류:", e))
      .finally(() => { this.dlg.hide(); this.busy = false; });
  }

  /** 셀프스위치가 바뀐 뒤 모습을 다시 정한다(주운 볼은 사라지고, 그 칸도 다시 지나갈 수 있게 된다). */
  private refreshEvent(entry: FieldEvent): void {
    const gfx = visibleGraphic(this.registry, entry.map, entry.ev);
    if (gfx) return;                       // 아직 보이는 페이지가 있다
    entry.sprite?.destroy();
    entry.sprite = undefined;
    if (this.blocked[entry.gy]) this.blocked[entry.gy][entry.gx] = 0;
    this.events2 = this.events2.filter((e) => e !== entry);
  }

  // ── 트레이너 ────────────────────────────────────────────
  // AR 맵 이벤트에 적힌 그대로 트레이너를 세운다(좌표·방향·시야·대사 전부 trainers.json에서 온다).
  private async setupTrainers(): Promise<void> {
    // ⚠️ Phaser는 씬을 다시 시작해도 **같은 인스턴스**를 쓴다 → 지난번 목록을 비우지 않으면
    //    이미 파괴된 스프라이트가 남아 걷게 하려는 순간 죽는다(배틀에서 돌아올 때마다 재시작된다).
    this.trainers = [];
    // 같은 이유로 `scene.isActive()`만으로는 '이전 실행'을 못 거른다(재시작해도 계속 active다).
    //  → 실행마다 번호를 매겨, await 사이에 씬이 다시 시작됐으면 옛 실행은 조용히 물러난다.
    const run = ++this.setupRun;
    await loadArDb();
    if (run !== this.setupRun || !this.scene.isActive()) return;
    const done = (this.registry.get("trainersDefeated") as string[]) ?? [];

    for (const m of REGION_MAPS) {
      if (m.arMapId === undefined) continue;
      const spots = getMapTrainers(m.arMapId);
      if (!spots) continue;                       // 트레이너가 없는 맵은 키 자체가 없다
      for (const spot of spots) {
        const sheet = `ow_${spot.overworld}`;
        await this.ensureSheet(sheet, `assets/characters/${spot.overworld}.png`);
        if (run !== this.setupRun || !this.scene.isActive()) return;
        const [gx, gy] = toGlobal(m.name, spot.x, spot.y);
        this.textures.get(sheet).setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.mkTrainerAnims(sheet);
        const sprite = this.add.sprite(this.cx(gx), this.cy(gy), sheet, this.idleFrame[spot.dir])
          .setOrigin(0.5, 1).setScale(SCALE).setDepth(yDepth(gy));
        // 트레이너가 선 칸은 막는다(원본 이벤트도 통과 못 한다).
        this.blocked[gy][gx] = 1;
        this.trainers.push({ spot, gx, gy, sheet, sprite, defeated: done.includes(spot.id) });
      }
    }
  }

  // 스프라이트시트를 지금 받는다(어떤 트레이너가 있는지는 AR DB를 읽어야 알 수 있어 preload에선 못 한다).
  private ensureSheet(key: string, path: string): Promise<void> {
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise((resolve) => {
      this.load.spritesheet(key, path, { frameWidth: 32, frameHeight: 48 });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  // 걷기 애니(주인공과 같은 시트 배치). 애니는 게임 전역이라 재입장 시 이미 있을 수 있다.
  private mkTrainerAnims(sheet: string): void {
    const rows: [Dir, number[]][] = [
      ["down", [0, 1, 2, 3]], ["left", [4, 5, 6, 7]], ["right", [8, 9, 10, 11]], ["up", [12, 13, 14, 15]],
    ];
    for (const [dir, frames] of rows) {
      const key = `${sheet}-${dir}`;
      if (!this.anims.exists(key))
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { frames }), frameRate: 8, repeat: -1 });
    }
  }

  /** 나를 본 트레이너가 있으면 승부를 건다(한 보마다). */
  private checkTrainerSight(): void {
    if (this.busy) return;
    for (const t of this.trainers) {
      if (t.defeated) continue;
      const path = this.sightPath(t);
      if (!path) continue;
      this.startTrainerEncounter(t, path).catch((e) => console.error("[WorldScene] 트레이너 컷신 오류:", e));
      return;   // 한 번에 한 명만
    }
  }

  /**
   * 트레이너가 나를 볼 수 있는가 — 원본 `pbEventCanReachPlayer?` 그대로:
   *  ① 보는 방향 일직선 위에 내가 있고 ② 거리가 시야 이내이며 ③ 사이 칸이 전부 통행 가능해야 한다.
   *  (중간이 막혀 있으면 시야가 차단된다 — 벽 너머로는 못 본다.)
   * 반환 = 트레이너가 나에게 걸어올 칸들(바로 옆이면 빈 배열). 못 보면 null.
   */
  private sightPath(t: TrainerNpc): [number, number][] | null {
    const d = DIR_VEC[t.spot.dir];
    // 보는 축이 아닌 쪽 좌표가 다르면 = 일직선 위가 아니다
    if (d.dx !== 0 && this.ty !== t.gy) return null;
    if (d.dy !== 0 && this.tx !== t.gx) return null;
    // 보는 방향 기준 거리(뒤쪽이면 음수 → 안 보인다)
    const dist = d.dx !== 0 ? (this.tx - t.gx) * d.dx : (this.ty - t.gy) * d.dy;
    if (dist < 1 || dist > t.spot.sight) return null;

    const path: [number, number][] = [];
    for (let i = 1; i < dist; i++) {   // 트레이너와 나 '사이'의 칸들 = 걸어올 길
      const x = t.gx + d.dx * i, y = t.gy + d.dy * i;
      if (!this.walkable(x, y)) return null;   // 막혔다 = 안 보인다
      path.push([x, y]);
    }
    return path;
  }

  // 발견 "!" → 걸어와서 → 원본 대사 → 배틀. (라이벌 컷신과 같은 박자: 150ms/칸)
  private async startTrainerEncounter(t: TrainerNpc, path: [number, number][]): Promise<void> {
    this.busy = true;
    const dir = t.spot.dir;
    playSfx(this, SFX.exclaim, 0.5);
    await new Promise<void>((r) => this.time.delayedCall(420, r));

    if (path.length) {
      t.sprite.play(`${t.sheet}-${dir}`, true);
      for (const [nx, ny] of path) {
        await new Promise<void>((r) => this.tweens.add({
          targets: t.sprite, x: this.cx(nx), y: this.cy(ny), duration: 150, onComplete: () => r(),
        }));
      }
      t.sprite.stop();
    }
    t.sprite.setFrame(this.idleFrame[dir]);
    // 나는 트레이너 쪽을 돌아본다
    this.facing = OPPOSITE[dir];
    this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]);

    await this.dlg.say(t.spot.introText, t.spot.speaker);
    this.dlg.hide();
    this.startTrainerBattle(t);
  }

  // 트레이너 배틀 시작 — 팀·대사·상금·그림은 BattleScene이 trainerId로 AR 정의에서 가져간다.
  private startTrainerBattle(t: TrainerNpc): void {
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    const go = (): void =>
      void this.scene.start("BattleScene", {
        ally, trainerId: t.spot.id,
        backdrop: this.curMap?.battleBg ?? "town",
        returnPos: [this.tx, this.ty], returnFacing: this.facing,
      });
    // VS 초상이 등록된 상대만 VS 연출(원본 규칙 그대로 — 잡트레이너는 그림이 없어 그냥 페이드).
    //  나중에 관장을 추가하면 vs_<타입>.png 한 장 + VS_PORTRAITS 한 줄로 여기가 저절로 켜진다.
    this.startBattleWithVs(vsKeyFromTrainerId(t.spot.id), t.spot.speaker, go);
  }

  /** VS 초상이 있으면 VS 연출로, 없으면 기존 페이드로 배틀에 들어간다. */
  private startBattleWithVs(vsKey: string | null, name: string, go: () => void): void {
    this.busy = true;   // 연출 도중 한 칸 더 걷거나 메뉴가 열리는 것 방지
    if (vsKey) {
      // 우리 HUD("방향키: 이동 | Enter: 메뉴")는 원본에 없는 것이라 VS 화면에 비치면 흉하다 → 잠깐 끈다.
      //  (씬을 떠나면 어차피 새로 그려지므로 되돌릴 필요는 없다.)
      this.children.getByName("hud")?.setActive(false);
      (this.children.getByName("hud") as Phaser.GameObjects.Text | null)?.setVisible(false);
      void playVsIntro(this, vsKey, name).then(go);
      return;
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, go);
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

  /** 한 칸 움직일 때마다 호출. 맵이 바뀌면 이름을 띄우고 BGM을 갈아준다(암전·로딩 없음). */
  private onEnterTile(): void {
    const m = mapAtGlobal(this.tx, this.ty);
    if (m && m !== this.curMap) {
      const prev = this.curMap;
      this.curMap = m;
      this.showMapName(m.label);
      // BGM은 곡이 실제로 바뀔 때만 갈아준다(태초마을↔집처럼 같은 곡이면 끊지 않는다).
      if (prev?.bgm !== m.bgm) playBgm(this, m.bgm, 0.35);
      // 날씨는 맵마다 다르다(원본도 맵 메타데이터에 적혀 있다) → 새 맵의 확률로 다시 굴린다.
      this.weather.setKind(rollWeather(this.registry, m.weather));
      this.updateHudTime();
    }
    // 트레이너가 먼저다 — 눈이 마주쳤으면 풀숲 조우는 안 걸린다(busy가 되어 아래에서 걸러진다).
    this.checkTrainerSight();
    this.maybeWildEncounter();
  }

  /** 풀숲을 밟았으면 조우 판정(원본 pbBattleOnStepTaken과 같은 자리 = 한 보 걸을 때마다). */
  private maybeWildEncounter(): void {
    if (this.busy) return;                                   // 컷신·워프 중엔 안 걸린다
    if (this.grass[this.ty]?.[this.tx] !== 1) return;         // 풀숲이 아니면 끝
    const arMapId = this.curMap?.arMapId;
    if (arMapId === undefined) return;                        // 조우표가 없는 맵
    // 원본: $player.able_pokemon_count == 0 이면 조우 안 함(싸울 포켓몬이 없으면 배틀이 성립 안 된다)
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    if (!party?.some((p) => p.currentHp > 0)) return;

    const table = getEncounters(arMapId);
    if (!table) return;
    if (!encounterTriggered(table.stepChance)) return;
    const pick = chooseWildPokemon(table);
    if (!pick) return;

    resetEncounterSteps();   // 원본처럼 조우 직후엔 걸음수·누산기를 리셋(다음 몇 보는 유예)
    this.startWildBattle(pick.speciesId, pick.level);
  }

  /** 새 맵에 들어왔을 때 왼쪽 위에 이름을 잠깐 띄운다. */
  private showMapName(label: string): void {
    const t = this.add.text(16, 52, label, {
      fontFamily: "Galmuri11, sans-serif", fontSize: "20px", color: "#ffffff",
      backgroundColor: "#000000aa", padding: { x: 12, y: 6 },
    }).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.time.delayedCall(1800, () =>
      this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }));
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

    // ── 언덕(점프대) ─────────────────────────────────────────────────────
    //  원본 Game_Player#move_generic 과 같은 자리에서 본다 — **걷기보다 먼저** 판정한다.
    //  방향이 맞으면 걷는 대신 2칸 점프(jumpForward(2)), 안 맞으면 그냥 벽이다(못 기어올라감).
    const led = this.ledge[nty]?.[ntx] ?? 0;
    if (led) {
      const dir = dy === 1 ? 2 : dx === -1 ? 4 : dx === 1 ? 6 : 8;   // RMXP 방향번호
      const jtx = this.tx + dx * 2, jty = this.ty + dy * 2;          // 언덕 너머 착지칸
      // ⚠️ 착지칸 검사는 원본에 없는 안전장치다(원본 jump는 통과 여부를 안 본다).
      //    AR 3맵 100칸 전부 착지칸이 비어 있음을 tools/ar-map/verify-passability.py로 확인했으니
      //    실제로는 안 걸린다 — 나중에 맵을 잘못 손봤을 때 캐릭터가 벽에 처박히는 것만 막는다.
      if (led === dir && this.walkable(jtx, jty)) { this.jumpLedge(jtx, jty); return; }
      this.bump();
      return;
    }

    if (!this.walkable(ntx, nty)) { this.bump(); return; }

    this.moving = true;
    this.player.play(`walk-${this.facing}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: this.stepMs(),
      onComplete: () => this.landOn(ntx, nty),
    });
  }

  /**
   * 한 칸 가는 데 걸리는 시간 — 옵션의 '기본 이동'(걷기/달리기)을 따른다.
   * 원본 Options의 Default Movement와 같고, **이동 중 취소키(X/Shift)를 누르고 있으면 반대 속도**가 된다
   * (원본 설명 그대로: "Hold Back while moving to move at the other speed").
   */
  private stepMs(): number {
    const held = isActionDown(this, "BACK") || !!this.shiftKey?.isDown;
    const running = settings().moveStyle === "run" ? !held : held;
    return stepDurationMs(running);
  }

  /** 벽에 부딪힘 — 걷기·점프가 다 막혔을 때(연타로 효과음이 겹치지 않게 300ms 간격). */
  private bump(): void {
    this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]);
    if (this.time.now - this.lastBump > 300) { playSfx(this, SFX.bump, 0.4); this.lastBump = this.time.now; }
  }

  /** 한 칸(또는 점프 후) 도착 처리 — 걷기와 점프가 똑같이 쓴다. */
  private landOn(tx: number, ty: number): void {
    this.tx = tx; this.ty = ty; this.moving = false;
    this.player.setDepth(yDepth(this.ty));   // 아래 칸으로 갈수록 앞에(원본 Y정렬)
    this.onEnterTile();   // 맵 경계를 넘었는지 확인(암전 없이 그냥 넘어간다) + 풀숲 조우 판정
    // 조우가 걸렸으면(busy) 워프는 건너뛴다 — 지금은 풀숲과 워프 칸이 겹치지 않지만,
    //  겹치는 순간 배틀과 문 진입이 동시에 scene.start 되어 화면이 뒤엉킨다.
    if (!this.busy) this.handleWarp();
  }

  /**
   * 언덕을 뛰어넘는다 — 원본 수치 그대로(Game_Character#jump / update).
   *   · 걸리는 시간 = jump_speed 3의 @jump_time 0.25초 × 2칸 = **0.5초**
   *   · 뛰는 높이  = jump_peak = 2 × 32px × 3/8 = 24px = **0.75칸**
   *   · 높이 곡선  = jump_peak × (4·|f−0.5|² − 1)  (f = 0→1 진행도, 포물선)
   *   · 착지 = 걷기와 똑같이 한 보로 친다(원본 jump도 increase_steps 한다) → 풀숲 조우·워프 판정 그대로.
   */
  private jumpLedge(jtx: number, jty: number): void {
    this.moving = true;
    playSfx(this, SFX.jump, 0.5);
    this.player.play(`walk-${this.facing}`, true);
    const x0 = this.player.x, y0 = this.player.y;
    const x1 = this.cx(jtx), y1 = this.cy(jty);
    const peak = this.tile * 0.75;   // this.tile = 화면상 한 칸 크기(32 × SCALE)
    this.tweens.addCounter({
      from: 0, to: 1, duration: 500,
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 0;
        const arc = peak * ((4 * (f - 0.5) ** 2) - 1);   // f=0·1에서 0, f=0.5에서 -peak
        this.player.setPosition(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + arc);
      },
      onComplete: () => {
        this.player.setPosition(x1, y1);
        this.landOn(jtx, jty);
      },
    });
  }

  // 인게임 메뉴 열기: 이 씬을 멈추고 입력을 끈 뒤 MenuScene을 오버레이로 띄운다.
  //  what="bag"이면 메뉴를 거치지 않고 가방을 바로 연다(가방 단축키 — 닫으면 필드로 바로 돌아온다).
  private openMenu(what: "menu" | "bag" = "menu"): void {
    if (this.busy || this.moving) return;
    // 저장 위치 기록(메뉴 '저장'이 이 값을 직렬화한다). 월드는 정확한 타일·방향까지 저장.
    // ⚠️ 저장은 **맵 이름 + 그 맵 기준 로컬 좌표**로 남긴다(글로벌로 남기면 나중에 맵을 끼워넣을 때 옛 세이브가 전부 어긋난다).
    const at = toLocal(this.tx, this.ty);
    this.registry.set("saveLoc", { scene: "WorldScene", map: at.map, tx: at.x, ty: at.y, facing: this.facing });
    this.input.enabled = false;
    this.cameras.main.resetFX();  // 진행 중이던 fadeIn(400ms)이 pause로 얼어 월드가 어둑하게 멈추는 것 방지
    this.scene.pause();
    if (what === "bag") this.scene.launch("BagScene", { from: "WorldScene" });
    else this.scene.launch("MenuScene", { from: "WorldScene" });
  }

  // 야생 배틀 시작: 조우표가 뽑은 종족·레벨로 상대를 만들고, 내 파티 선두를 아군으로 넘긴다.
  private startWildBattle(speciesId: string, level: number): void {
    this.busy = true;   // 배틀로 넘어가는 동안 한 칸 더 걸어 좌표가 어긋나는 것 방지
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    const enemy = createFromSpecies(speciesId, level);
    // 배경 = 지금 서 있는 맵이 정한다(AR map_metadata의 battle_background 그대로: 마을=town, 1번도로=route).
    const backdrop = this.curMap?.battleBg ?? "town";
    playSfx(this, SFX.exclaim, 0.5);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () =>
      this.scene.start("BattleScene", {
        ally, enemy, wild: true, backdrop, returnPos: [this.tx, this.ty], returnFacing: this.facing,
      }));
  }

  // 스타터 선택 후 연구소에서 나오면: **이미 문 앞에서 기다리던** 네모가 다가와 말을 걸고 라이벌 배틀이 시작된다.
  //  (LabScene이 registry에 rivalBattlePending/rivalEnemySpecies를 예약하고, 네모는 그 씬에서 먼저 걸어 나갔다.)
  //  ⚠️ 입력을 통째로 끄면(this.input.enabled=false) 대사를 넘기는 키까지 죽는다 → busy 플래그만 쓴다(이동·메뉴는 busy로 막힘).
  private async maybeStartRivalBattle(): Promise<void> {
    if (!this.registry.get("rivalBattlePending")) return;
    // 양옆이 다 막혀 다가올 길이 없으면(거의 없음) 컷신을 건너뛰고 배틀만 시작한다 — 배틀이 통째로 사라지면 안 된다.
    if (!this.nemona || !this.rival) { this.startRivalBattle(); return; }
    // (F1) 예약은 여기서 소비하지 않는다 — 배틀에서 '이겼을 때만' BattleScene이 소비한다(지면 재대결).
    this.busy = true;
    const nem = this.nemona;
    const { path, from } = this.rival;
    // 네모는 플레이어 쪽을 보고 걷고(왼쪽에서 오면 오른쪽 보기), 플레이어는 그 반대쪽을 돌아본다.
    const nemDir: Dir = from === "left" ? "right" : "left";
    const youDir: Dir = from === "left" ? "left" : "right";

    // 나를 발견("!") → 기다리던 자리에서 옆 칸까지 한 칸씩 걸어온다(플레이어와 같은 150ms/칸).
    playSfx(this, SFX.exclaim, 0.5);
    await new Promise<void>((r) => this.time.delayedCall(420, r));
    nem.play(`nem-${nemDir}`, true);
    for (const [nx, ny] of path.slice(1)) {   // path[0] = 이미 서 있는 자리
      await new Promise<void>((r) => this.tweens.add({
        targets: nem, x: this.cx(nx), y: this.cy(ny), duration: 150, onComplete: () => r(),
      }));
    }
    nem.stop(); nem.setFrame(this.idleFrame[nemDir]);
    this.facing = youDir; this.player.stop(); this.player.setFrame(this.idleFrame[youDir]);

    // 대사 = SV 네모 공식 대사 기반(창작 아님).
    //  1줄: Bulbapedia 영문 정본 "we should battle right now—you and me!" / "see how great..." 를 옮김(한국어 공식판 미확인).
    //  2줄: SV 한국어판 verbatim(첫 배틀 개시 대사) — 확인됨.
    const you = (this.registry.get("playerName") as string) ?? "";
    await this.dlg.say(`${you}! 지금 당장 나랑 한판 하자. 네 파트너가 얼마나 굉장한지 보고 싶어!`, "네모");
    await this.dlg.say("처음 하는 포켓몬 승부니까 즐기면서 하자!", "네모");
    this.dlg.hide();
    this.startRivalBattle();
  }

  // 네모가 기다렸다 걸어올 길을 **플레이어 위치 기준**으로 잡는다(고정좌표 금지 — 재대결은 집 앞에서도 걸린다).
  //  플레이어와 같은 줄에서 옆으로 RIVAL_GAP칸까지 걸을 수 있는 데까지 잡고, 왼쪽이 막혔으면 오른쪽으로 뒤집는다.
  //  path[0] = 처음 서서 기다리는 자리(가장 먼 칸), 마지막 = 플레이어 바로 옆 칸(여기서 말을 건다).
  private rivalApproach(): { path: [number, number][]; from: "left" | "right" } | undefined {
    for (const from of ["left", "right"] as const) {
      const sign = from === "left" ? -1 : 1;
      const beside: [number, number][] = [];
      for (let d = 1; d <= RIVAL_GAP; d++) {
        const x = this.tx + sign * d;
        if (!this.walkable(x, this.ty)) break;
        beside.push([x, this.ty]);
      }
      if (beside.length >= 2) return { path: beside.reverse(), from };   // 먼 칸 → … → 플레이어 옆
    }
    return undefined;   // 양옆이 다 막힘(거의 없음) → 컷신 없이 바로 배틀
  }

  // 라이벌 트레이너 배틀 시작: 상대 = 예약된 카운터 스타터(Lv.5), wild:false(도망 불가·트레이너 인트로).
  private startRivalBattle(): void {
    const party = this.registry.get("playerParty") as Pokemon[] | undefined;
    const ally = party && party.length ? party[0] : undefined;
    const enemyKey = (this.registry.get("rivalEnemySpecies") as string) ?? "CHARMANDER";
    const enemy = createFromSpecies(enemyKey, 5);
    const go = (): void =>
      void this.scene.start("BattleScene", {
        // 배경은 서 있는 맵이 정한다(야생전과 같은 규칙 — 하드코딩하면 나중에 도로/시티 트레이너전에서 틀린 배경이 뜬다).
        //  네모는 AR에 트레이너 정의가 없다(원본엔 스타터 직후 라이벌전 자체가 없음) → 이름·그림만 직접 넘긴다.
        ally, enemy, wild: false, trainer: "네모", trainerSprite: "NEMONA",
        backdrop: this.curMap?.battleBg ?? "town",
        returnPos: [this.tx, this.ty], returnFacing: this.facing,
      });
    // 라이벌전도 VS 연출로 들어간다(초상은 전신 그림에서 잘라 만든 것 — vsIntro.ts 주석 참고).
    this.startBattleWithVs(vsKeyFromTrainerId("NEMONA"), "네모", go);
  }

  private handleWarp(): void {
    const w = this.warpAt(this.tx, this.ty);
    if (!w) return;
    if (w.dir && this.facing !== w.dir) return;
    this.busy = true;
    this.player.stop();
    playSfx(this, SFX.doorIn, 0.5);
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.time.delayedCall(340, () => {
      if (w.to === "lab") this.scene.start("LabScene");
      else if (w.to === "gym") this.scene.start("GymScene");
      else if (w.to === "pc") this.scene.start("BuildingScene", { building: "pc" });
      else if (w.to === "mart") this.scene.start("BuildingScene", { building: "mart" });
      // 상록시티 민가 4채 — 센터·마트와 같은 실내 씬을 쓴다(building 이름만 다르다).
      else if (/^house[1-4]$/.test(w.to)) this.scene.start("BuildingScene", { building: w.to });
      else if (w.to === "house") this.scene.start("InteriorScene", { room: w.room ?? "living", skipIntro: true });
      else {
        // 모르는 to = 워프를 추가하며 분기를 안 넣은 것. 그냥 두면 **암전된 채 얼어붙는다**
        //  (busy=true + 페이드아웃까지 해놓고 씬을 안 켠다) → 원위치로 되돌려 최소한 계속 놀 수 있게.
        console.error(`[WorldScene] 모르는 워프 대상 "${w.to}" — 분기를 안 넣었다.`);
        this.cameras.main.fadeIn(320, 0, 0, 0);
        this.busy = false;
      }
    });
  }
}
