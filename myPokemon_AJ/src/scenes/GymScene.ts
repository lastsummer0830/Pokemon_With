import Phaser from "phaser";
import { Gender } from "../data/Player";
import { josa } from "../data/josa";
import DialogBox from "../ui/DialogBox";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";
import { GREEN_BADGE, hasBadge, giveBadge } from "../data/Badges";

// 상록체육관(AR Map194) — 관장 그린과의 첫 체육관 배틀.
//
// 원본이 어떻게 생겼나(추측 아님 — Map194.rxdata 이벤트를 직접 판독):
//   · 이벤트가 **3개뿐**이다: 출구(10,11) · 간판(10,2) · 그린(10,5). **잡몹 트레이너도 퍼즐도 없다.**
//   · 그린은 `trigger=3`(자동실행) — 들어서면 말 걸 필요 없이 컷신이 저절로 시작된다.
//     그래서 이 씬엔 A버튼 상호작용이 없어도 된다(간판만 예외).
//   · 컷신 순서도 원본 명령 그대로다: 잠깐 대기 → "이런..." → 그린이 아래로 2칸 →
//     "배지가 7개가 아니면..." → 플레이어가 위로 3칸 → 소개장 → ... → 배틀.
//   · 이기면 `$player.badges[0] = true` = **그린 배지가 1번째 배지**(스위치 이름도 "Defeated Gym 1").
//     "원래라면 마지막 배지인 그린 배지를 먼저 따버렸다"는 게 AR의 설정이다.
//
// ⚠️ 원본에 있는데 **일부러 안 넣은 것**(넣을 수단이 없다 — 만들면 그때 여기에):
//   · TM92(트릭룸) 지급 — 우리 게임엔 기술머신 시스템이 아예 없다(items.json에 TM 0개).
//   · 포켓몬 도감 지급 — 원본은 `!$player.has_pokedex`일 때만 준다. 우리는 오박사가 이미 줬으니
//     그 조건이 애초에 거짓 = **안 도는 게 원본과 같은 동작**이다.
//   · 위 둘에 딸린 "선물 받아주세요" 선택지 — 줄 물건이 없어 뺐다.
//   · 배지 7개 게이트/경호(문지기)는 22번도로가 아직 없어 미구현(그 도로를 만들 때 함께).
type Dir = "down" | "left" | "right" | "up";
interface GymMap {
  img: string; cols: number; rows: number; blocked: number[][];
  spawn: [number, number];
  exit: { x: number; y: number; toCity: [number, number] };
}
interface GymInit {
  skipIntro?: boolean;
  testParty?: boolean;
  // 그린 배틀에서 돌아온 참인지 — BattleScene이 씬 데이터로 직접 준다(전역 플래그 아님).
  //  패배하면 화이트아웃으로 집에 가 이 씬으로 안 돌아오므로, fromBattle=true면 '실제로 이기고 온 것'이다.
  fromBattle?: boolean;
  battleOutcome?: "win" | "lose" | "run" | "catch";
}

const GREEN_TRAINER_ID = "LEADER_Green:그린";
const GREEN_START: [number, number] = [10, 5];   // 원본 EV3 위치
const GREEN_FACE_TILE: [number, number] = [10, 7];  // 아래로 2칸(원본 이동경로 209: 1,1)
const PLAYER_FACE_TILE: [number, number] = [10, 8]; // 위로 3칸(원본 이동경로 209: 4,4,4)
const SIGN_TILE: [number, number] = [10, 2];     // 원본 EV2(간판)
const STEP_MS = 150;                             // 한 칸 걷는 시간 — 다른 씬(연구소·월드)과 같게

export default class GymScene extends Phaser.Scene {
  private map!: GymMap;
  private mapImg!: Phaser.GameObjects.Image;
  private green!: Phaser.GameObjects.Sprite;
  private greenTile: [number, number] = [...GREEN_START];
  private greenGone = false;   // 배지를 주고 떠났으면 true(원본 셀프스위치 A = 그림 없는 page1)

  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero_gym";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "up";
  private tx = 10; private ty = 11;
  private moving = false; private busy = false;

  private zoom = 1; private origin = { x: 0, y: 0 }; private tile = 32;
  private dlg!: DialogBox;
  private initData: GymInit = {};

  constructor() { super("GymScene"); }

  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  // ⚠️ Phaser는 scene.start로 다시 시작해도 **같은 인스턴스를 재사용한다** → 클래스 필드 초기화식이 다시 안 돈다.
  //    상태 필드는 반드시 여기서 되돌린다(안 하면 busy=true가 남아 입력이 통째로 먹통 — 틀3에서 실제로 겪은 버그).
  init(data: GymInit): void {
    this.initData = data ?? {};
    this.busy = false; this.moving = false;
    this.greenTile = [...GREEN_START];
    this.greenGone = false;
    this.facing = "up";
  }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    const v = "?v=" + Date.now();
    // 맵/격자를 고쳐도 반영되게 캐시를 먼저 비운다(안 그러면 Phaser가 옛 것을 그대로 쓴다).
    this.cache.json.remove("gym_col");
    if (this.textures.exists("gym_map")) this.textures.remove("gym_map");
    this.load.image("gym_map", "assets/world/viridian_gym.png" + v);
    this.load.json("gym_col", "assets/world/viridian_gym.json" + v);
    this.load.spritesheet("green_ow", "assets/characters/trainer_RIVAL2.png", { frameWidth: 32, frameHeight: 48 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    preloadCommonAudio(this);
    this.load.audio(BGM.gym, "assets/audio/bgm_gym.ogg");  // AR Gym.mid를 원본 사운드폰트로 렌더한 것
  }

  create(): void {
    this.map = this.cache.json.get("gym_col") as GymMap;
    this.tx = this.map.spawn[0]; this.ty = this.map.spawn[1]; this.facing = "up";
    // 이미 이겨서 배지가 있으면 그린은 떠난 뒤다(원본 셀프스위치 A + 스위치4).
    if (hasBadge(this.registry, GREEN_BADGE)) this.greenGone = true;

    for (const k of ["gym_map", "green_ow", this.texKey])
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    playBgm(this, BGM.gym, 0.4);
    this.mapImg = this.add.image(0, 0, "gym_map").setOrigin(0, 0).setDepth(0);

    // 걷기 애니 — 애니는 게임 전역에 등록돼 재입장 시 이미 있다 → exists로 중복 등록 경고를 막는다.
    const mk = (prefix: string, tex: string, key: string, frames: number[]) => {
      if (!this.anims.exists(`${prefix}-${key}`))
        this.anims.create({ key: `${prefix}-${key}`, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: 8, repeat: -1 });
    };
    for (const [prefix, tex] of [["gym", this.texKey], ["grn", "green_ow"]] as const) {
      mk(prefix, tex, "down", [0, 1, 2, 3]); mk(prefix, tex, "left", [4, 5, 6, 7]);
      mk(prefix, tex, "right", [8, 9, 10, 11]); mk(prefix, tex, "up", [12, 13, 14, 15]);
    }

    this.green = this.add.sprite(0, 0, "green_ow", 0).setOrigin(0.5, 1).setDepth(4).setVisible(!this.greenGone);
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1).setDepth(7);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.layout, this); this.dlg.destroy(); });

    this.input.keyboard!.on("keydown-SPACE", this.onKey, this);
    this.input.keyboard!.on("keydown-ENTER", this.onKey, this);
    this.input.keyboard!.on("keydown-Z", this.onKey, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // 배틀에서 이기고 돌아온 참이면 그 뒷대사부터 이어간다. 아니면 처음 들어온 것 → 원본처럼 자동 컷신.
    //  fromBattle은 BattleScene이 씬 데이터로 직접 넘긴다(전역 플래그 아님) → 패배 후 재입장으로 새는 일이 없다.
    if (this.initData.fromBattle && this.initData.battleOutcome === "win") {
      void this.afterBattle();
    } else if (!this.greenGone && !this.initData.skipIntro) {
      void this.runIntro();
    }
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    const src = this.textures.get("gym_map").getSourceImage();
    this.zoom = Math.min((W * 0.98) / src.width, (H * 0.92) / src.height);
    const w = src.width * this.zoom, h = src.height * this.zoom;
    this.origin = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
    this.tile = 32 * this.zoom;
    this.mapImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    // 그린은 컷신에서 움직인다 → 원위치가 아니라 '지금 서 있는 칸'으로 그린다(창 크기 바뀔 때 되돌아가지 않게).
    this.green.setPosition(this.cx(this.greenTile[0]), this.cy(this.greenTile[1])).setScale(this.zoom * 0.92);
    if (this.greenGone) this.green.setVisible(false);
    this.player.setPosition(this.cx(this.tx), this.cy(this.ty)).setScale(this.zoom * 0.92);
    this.dlg.layout();
  }

  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.cols || ty >= this.map.rows) return false;
    if (this.map.blocked[ty][tx] !== 0) return false;
    if (!this.greenGone && tx === this.greenTile[0] && ty === this.greenTile[1]) return false;
    return true;
  }

  update(): void {
    if (this.busy || this.moving) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    // 입구 칸에서 아래를 누르면 나간다(원본 출구 EV1이 도착칸과 같은 칸이다).
    if (this.tx === this.map.exit.x && this.ty === this.map.exit.y && this.facing === "down") { this.tryExit(); return; }
    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    this.moving = true;
    this.player.play(`gym-${this.facing}`, true);
    this.tweens.add({
      targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: STEP_MS,
      onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; },
    });
  }

  // 앞칸 상호작용 — 원본에 있는 건 간판(10,2)뿐이다.
  private onKey(): void {
    if (this.busy) return;
    const d: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const fx = this.tx + d[this.facing][0], fy = this.ty + d[this.facing][1];
    if (fx === SIGN_TILE[0] && fy === SIGN_TILE[1]) {
      this.busy = true;
      // 원본 EV2 대사 그대로(나레이션 = 이름창 없음).
      void (async () => {
        await this.dlg.say("(체육관 시설이 있는 곳 같다.)");
        await this.dlg.say("(그린이 열어주는게 아니면 못 들어갈 것 같다.)");
        this.dlg.hide(); this.busy = false;
      })();
    }
  }

  /** 캐릭터를 한 칸씩 걷게 한다(원본 이동경로 명령 209 + 완료대기 210). */
  private walkTo(spr: Phaser.GameObjects.Sprite, animPrefix: string,
                 from: [number, number], path: [number, number][],
                 onTile: (t: [number, number]) => void): Promise<void> {
    return new Promise((done) => {
      let cur = from, i = 0;
      const step = (): void => {
        if (i >= path.length) { spr.stop(); done(); return; }
        const [nx, ny] = path[i];
        const dir: Dir = nx > cur[0] ? "right" : nx < cur[0] ? "left" : ny > cur[1] ? "down" : "up";
        spr.play(`${animPrefix}-${dir}`, true);
        this.tweens.add({
          targets: spr, x: this.cx(nx), y: this.cy(ny), duration: STEP_MS,
          onComplete: () => { cur = [nx, ny]; onTile(cur); i++; step(); },
        });
      };
      step();
    });
  }

  // ── 입장 컷신(원본 EV3 page0 명령 순서 그대로) ──────────────────────
  private async runIntro(): Promise<void> {
    this.busy = true;
    await this.wait(340);                        // 원본 `106: 20`(20프레임)
    await this.dlg.say("이런...", "그린");

    // 원본 `209: 3, [아래, 아래]` → 그린이 (10,5)에서 (10,7)로
    await this.walkTo(this.green, "grn", this.greenTile,
      [[GREEN_START[0], GREEN_START[1] + 1], GREEN_FACE_TILE],
      (t) => { this.greenTile = t; });
    this.green.setFrame(0);                      // 아래를 본 채로 멈춤

    await this.dlg.say("도전자님, 죄송하지만 상록체육관은 배지가 7개가 아니면 도전하실 수 없습니다.", "그린");

    // 원본 `209: -1, [위, 위, 위]` → 플레이어가 (10,11)에서 (10,8)로
    await this.walkTo(this.player, "gym", [this.tx, this.ty],
      [[this.tx, this.ty - 1], [this.tx, this.ty - 2], PLAYER_FACE_TILE],
      (t) => { this.tx = t[0]; this.ty = t[1]; });
    this.facing = "up"; this.player.setFrame(this.idleFrame.up);

    const you = this.playerName();
    await this.dlg.say(`${you}${josa(you, "은는")} 오박사의 소개장을 그린에게 건냈다!`);
    await this.dlg.say("이게 뭐죠?", "그린");
    await this.dlg.say("하... 할아버지가 보낸거에요?", "그린");
    await this.dlg.say("약한 트레이너랑 배틀하기 싫다니까...", "그린");
    await this.dlg.say("그 쪽, 배지는 몇 개나 있어요?", "그린");
    // 원본 선택지 `102: ['배지는 없는데...', '그게 아니라...']` — 어느 쪽이든 배틀로 간다.
    const noBadge = await this.dlg.askChoice(["배지는 없는데...", "그게 아니라..."]);
    await this.dlg.say(noBadge === 0 ? "심지어 배지가 아예 없다고?" : "설마 첫 체육관인거에요?", "그린");
    await this.dlg.say("어휴... 어쩔 수 없지.", "그린");
    await this.dlg.say("협회한테 슬슬 눈치 보이기도 하니까.", "그린");
    await this.dlg.say("후딱 끝내버리자고요.", "그린");
    this.dlg.hide();
    this.startBattle();
  }

  private startBattle(): void {
    // returnScene="GymScene"만 주면 된다 — 이기고 돌아올 때 BattleScene이 fromBattle/battleOutcome을
    //  씬 데이터로 넘겨 우리 create()가 뒷대사를 잇는다(전역 플래그를 안 써 패배 후 누수가 없다).
    this.cameras.main.fadeOut(340, 0, 0, 0);
    this.time.delayedCall(360, () => {
      // trainerId만 주면 팀(랜덤 3버전)·대사·상금·그림을 전부 AR 정의에서 가져온다.
      this.scene.start("BattleScene", {
        trainerId: GREEN_TRAINER_ID,
        backdrop: "gym",
        testParty: this.initData.testParty,
        returnScene: "GymScene",
      });
    });
  }

  // ── 배틀에서 이기고 돌아온 뒤(원본 EV3의 배틀 성공 분기) ──────────────
  private async afterBattle(): Promise<void> {
    this.busy = true;
    // 컷신 대면 위치 그대로 다시 세운다(배틀 다녀오면 씬이 새로 그려지므로).
    this.tx = PLAYER_FACE_TILE[0]; this.ty = PLAYER_FACE_TILE[1]; this.facing = "up";
    this.greenTile = [...GREEN_FACE_TILE];
    this.green.setVisible(true).setFrame(0);
    this.layout();

    await this.wait(300);
    await this.dlg.say("이야, 대단했는걸요.", "그린");
    await this.dlg.say("그래도 대충 하진 않은 것 같은데...", "그린");
    await this.dlg.say("네? 그게 아니라고요?", "그린");
    await this.dlg.say("소개장을 읽어보라고요?", "그린");
    await this.dlg.say("...", "그린");
    await this.dlg.say("하하... 제가 실수를 했네요.", "그린");
    await this.dlg.say("기억을 잃고 말았다라...", "그린");
    await this.dlg.say("확실히 요새 근처 생긴 생태 변화나 수상한 집단을 조사하고 있긴 하지만 기억 상실에 관한 건 잘 모르겠네요.", "그린");
    const topic = await this.dlg.askChoice(["전생에 대해", "차원 이동에 대해"]);
    await this.dlg.say(topic === 0 ? "전생이요...? 잘 모르겠네요." : "차원 이동이요...? 잘 모르겠네요.", "그린");
    await this.dlg.say("그건 그렇고, 아무리 오해라지만 체육관 배틀을 승리했다는 점.", "그린");
    await this.dlg.say("이 그린 배지를 받아주세요.", "그린");

    giveBadge(this.registry, GREEN_BADGE);
    playSfx(this, SFX.pkmnGet, 0.6);   // 원본은 ME 'Badge get' — 우리에겐 그 파일이 없어 획득 팡파레로 낸다
    const you = this.playerName();
    await this.dlg.say(`${you}${josa(you, "은는")} 그린 배지를 얻었다!`);
    await this.dlg.say("혹시나 조사 중 기억 상실이나 차원 이동에 관한 걸 알게 되면 연락 드리도록 하겠습니다.", "그린");
    await this.dlg.say("그럼 이만 다시 조사를 하러 가볼게요. 혹시 알게 된 게 있으면 연락 드릴게요!", "그린");
    this.dlg.hide();

    // 원본: 화면을 잠깐 어둡게 → 셀프스위치 A(그린 사라짐) + 문 소리 → 화면 복귀 → 독백.
    await this.fade(true);
    this.greenGone = true;
    this.green.setVisible(false);
    playSfx(this, SFX.doorOut, 0.5);
    await this.wait(500);
    await this.fade(false);
    await this.dlg.say("(번호가 없는데 어떻게 연락한다는거지...?)", you);
    this.dlg.hide();
    this.busy = false;
  }

  private fade(out: boolean): Promise<void> {
    return new Promise((done) => {
      const cam = this.cameras.main;
      cam.once(out ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => done());
      if (out) cam.fadeOut(200, 0, 0, 0); else cam.fadeIn(200, 0, 0, 0);
    });
  }

  private tryExit(): void {
    this.busy = true; this.player.stop();
    playSfx(this, SFX.doorOut, 0.5);
    this.cameras.main.fadeOut(340, 0, 0, 0);
    const [tx, ty] = this.map.exit.toCity;
    // ⚠️ toCity는 **상록시티 기준 로컬 좌표**다 → map을 같이 넘겨야 한다.
    //    (WorldScene은 맵 3장을 이어붙인 리전이라, map 없이 주면 글로벌로 읽혀 엉뚱한 곳에 떨어진다.)
    this.time.delayedCall(360, () => this.scene.start("WorldScene", { spawn: [tx, ty], map: "viridian_city", face: "down" }));
  }

  private wait(ms: number): Promise<void> { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
