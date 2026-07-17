import Phaser from "phaser";
import { frontPath, backPath, makeStillFront } from "../game/pokemonSprite";
import { Pokemon, MoveSlot, createFromSpecies, displayName } from "../data/Pokemon";
import { josa } from "../data/josa";
import { loadArDb, getMove, getType, getItem, dexKanto, getTrainer, trainerFullName, trainerTeam } from "../data/ar";
import { Backdrop } from "../data/region";
import { getBadges } from "../data/Badges";
import type { TrainerDef } from "../data/ar";
import { markSeen, markOwn } from "../data/Pokedex";
import { removeItem, addMoney, getMoney } from "../data/Bag";
import { performMove, movesFirst, isFainted, effectivenessText } from "../systems/battle";
import { captureShakes, SHAKE_FAIL_TEXT } from "../systems/capture";
import { battleExpYield, gainExp } from "../systems/exp";
import type { BagResult } from "./BagScene";
import {
  BattleView, DataBox, CMD_SLOTS,
  FIGHT_SLOTS, FIGHT_BTN_W, FIGHT_BTN_H, TYPE_ICON_W, TYPE_ICON_H, PP_COLORS, ppStage, moveNameColor, fightRow,
  PAUSE_W, PAUSE_H, PAUSE_VX, PAUSE_VY, PAUSE_MS,
} from "./battleView";
import { playBgm, stopBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";

const FONT = "Galmuri11";
const SPRITE_ZOOM = 2;   // AR 배틀 스프라이트 확대 배율(원본 프레임 44~48px)
const MAX_PARTY = 6;     // 파티 상한. 이 게임엔 아직 박스가 없어서 꽉 차면 포획을 거절한다.
// 상대 포켓몬이 서는 자리(AR 좌표계 512x384 기준). 등장·포획 실패 복귀가 같은 값을 써야 해서 상수로 둔다.
const ENEMY_VY = 176;
// 배틀에 진 뒤 잃는 돈 = 내 파티 최고레벨 × 이 배수(뱃지 개수로 결정). AR pbLoseMoney의 multiplier 그대로.
const LOSE_MONEY_MULT = [8, 16, 24, 36, 48, 64, 80, 100, 120];

// 배틀 스프라이트 텍스처 키 — 반드시 종족별로 다르게 둔다.
//  키를 "battle_enemy" 하나로 돌려쓰면 종족이 바뀌어도 Phaser가 옛 그림을 재사용한다(교체·다음 상대가 안 바뀜).
const frontKey = (species: string) => `bsp_front_${species.toUpperCase()}`;
const backKey = (species: string) => `bsp_back_${species.toUpperCase()}`;
// ⚠️ 트레이너 그림은 **파일명을 대소문자 그대로** 써야 한다 — AR 파일명이 곧 트레이너 타입 id다.
//    (예전엔 대문자로 바꿔 URL을 만들었다. YOUNGSTER·LASS·NEMONA가 원래 대문자라 우연히 통했을 뿐,
//     LEADER_Green.png 같은 혼합 대소문자는 404 → Phaser "Failed to process file" → 배틀이 안 뜬다.)
const trainerKey = (file: string) => `bsp_trainer_${file}`;

// 이번 턴에 내가 고른 행동. (AR/본가의 커맨드 4개 = 싸운다·가방·포켓몬·도망)
type Command =
  | { kind: "move"; idx: number }   // 기술 사용
  | { kind: "item" }                // 가방 열기
  | { kind: "switch" }              // 포켓몬 교체
  | { kind: "run" };                // 도망

// 씬으로 넘길 수 있는 데이터: 내/적 포켓몬. 없으면 데모용 기본값.
export interface BattleInit {
  ally?: Pokemon;
  enemy?: Pokemon;        // 상대 1마리(야생). 팀으로 싸우려면 enemyTeam을 쓴다.
  enemyTeam?: Pokemon[];  // 상대 팀 — 앞에서부터 순서대로 내보낸다.
  wild?: boolean;   // 야생 여부(도망 가능)
  trainer?: string; // 트레이너 배틀이면 상대 트레이너 이름(예: "네모"). 있으면 wild 취급 안 함.
  // ── AR 트레이너(1번도로 반바지꼬마 등) ──
  //  trainerId를 주면 팀·대사·상금·배틀 그림을 전부 AR 정의(trainers.json)에서 가져온다 → 다른 건 안 넘겨도 된다.
  trainerId?: string;      // 예: "YOUNGSTER:한주"
  trainerSprite?: string;  // AR 정의가 없는 상대(라이벌 네모)의 배틀 그림 = assets/trainers/<이름>.png
  returnPos?: [number, number]; // 배틀 끝나고 돌아갈 월드 좌표(승리/도망 시)
  // 승리 후 돌아갈 씬. 안 주면 WorldScene(야외 트레이너·야생전).
  //  실내 씬에서 부른 배틀(체육관)은 그 씬으로 돌아가야 한다 — 안 그러면 건물 밖으로 튕겨난다.
  //  ⚠️ 패배는 예외 — 원본대로 화이트아웃해서 집으로 간다(returnScene 무시).
  returnScene?: string;
  returnFacing?: "down" | "left" | "right" | "up";
  backdrop?: Backdrop;  // 배틀 배경(AR battleback). 마을=town, 1번도로=route, 체육관=gym.
}

export default class BattleScene extends Phaser.Scene {
  // 내 파티 = registry "playerParty"와 **같은 배열**. allyIdx = 지금 내보낸 칸.
  //  (예전엔 ally를 따로 들고 "파티 선두와 같은 참조"라고 가정했는데, 교체가 생기면 그 가정이 깨진다.)
  private party: Pokemon[] = [];
  private allyIdx = 0;
  // 상대 팀 — 야생이면 1마리. enemyIdx = 지금 나와 있는 칸.
  private enemyTeam: Pokemon[] = [];
  private enemyIdx = 0;
  private get ally(): Pokemon { return this.party[this.allyIdx]; }
  private get enemy(): Pokemon { return this.enemyTeam[this.enemyIdx]; }
  private allyTurns = 0;   // 지금 포켓몬이 나와 있은 턴 수(거둬들일 때 대사가 갈린다 — AR pbMessageOnRecall)
  private wild = true;
  private view!: BattleView;                 // AR 좌표계(512x384) → 화면 변환
  private bgLayer!: Phaser.GameObjects.Container;
  private allyBox!: DataBox;
  private enemyBox!: DataBox;
  private allySprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private backdrop: Backdrop = "town";

  private trainerImg?: Phaser.GameObjects.Image;   // 상대 트레이너 그림(포켓몬을 내보내면 물러난다)

  private pendingAlly: Pokemon | null = null;
  private pendingEnemyTeam: Pokemon[] | null = null;
  private trainerId: string | null = null;      // AR 트레이너 정의 키(없으면 라이벌/야생)
  private trainerDef: TrainerDef | null = null; // trainerId로 찾은 정의(create에서 채운다 — ArDb가 있어야 한다)
  private trainerNameRaw: string | null = null; // 정의가 없는 상대(라이벌 네모)의 이름
  private trainerSpriteName: string | null = null;
  private allySpecies = "charmander";
  private enemySpecies = "pidgey";
  private outcome: "win" | "lose" | "run" | "catch" = "win";  // 배틀 결과(catch = 잡아서 끝남 — 복귀는 승리와 같다)
  private returnPos: [number, number] | undefined;   // 승리/도망 시 돌아갈 좌표
  private returnFacing: "down" | "left" | "right" | "up" = "down";
  private returnScene: string | null = null;         // 승리 후 돌아갈 씬(실내 배틀). null이면 WorldScene.

  constructor() { super("BattleScene"); }

  init(data: BattleInit): void {
    // 데이터가 있으면 그걸, 없으면 데모(파이리 vs 구구) — 실제 스탯은 create에서 채운다.
    this.pendingAlly = data?.ally ?? null;
    // 상대는 팀으로 받거나(트레이너) 1마리로 받는다(야생). 둘 다 없으면 create가 정의/데모로 채운다.
    this.pendingEnemyTeam = data?.enemyTeam ?? (data?.enemy ? [data.enemy] : null);
    this.trainerId = data?.trainerId ?? null;
    this.trainerNameRaw = data?.trainer ?? null;
    this.trainerSpriteName = data?.trainerSprite ?? null;
    this.trainerDef = null;
    // 트레이너 배틀이면 무조건 야생 아님(도망 불가). 아니면 넘어온 wild 값(기본 야생).
    this.wild = (this.trainerId || this.trainerNameRaw) ? false : (data?.wild ?? true);
    this.allySpecies = (data?.ally?.speciesId ?? "CHARMANDER").toLowerCase();
    this.enemySpecies = (this.pendingEnemyTeam?.[0]?.speciesId ?? "PIDGEY").toLowerCase();
    this.returnPos = data?.returnPos;
    this.returnFacing = data?.returnFacing ?? "down";
    this.returnScene = data?.returnScene ?? null;
    // 배경은 "어디서 싸우느냐"가 정한다(AR도 맵 메타데이터의 battle_background). 마을=town, 도로·풀숲=route.
    this.backdrop = data?.backdrop ?? "route";
    this.outcome = "win";
    this.allyIdx = 0;
    this.enemyIdx = 0;
    this.allyTurns = 0;
    // ⚠️ Phaser는 씬을 다시 시작해도 **같은 인스턴스**를 쓴다 → 지난 배틀의 트레이너 그림이 남아 있으면
    //    (트레이너전 → 야생전처럼) 그림이 없는 배틀에서 buildSprites가 새로 안 만들어 **파괴된 옛 객체**를 물고 간다.
    this.trainerImg = undefined;
  }

  // 트레이너 배틀인가(AR 정의든 라이벌이든).
  private get isTrainerBattle(): boolean { return !!(this.trainerDef || this.trainerNameRaw); }
  // 화면에 띄우는 상대 이름 — AR 정의가 있으면 "반바지꼬마 한주", 없으면 넘어온 이름("네모").
  private get trainerName(): string {
    return this.trainerDef ? trainerFullName(this.trainerDef) : (this.trainerNameRaw ?? "");
  }
  // 배틀 그림 파일명(assets/trainers/<이름>.png). 없으면 그림 없이 대사만.
  private get trainerSpriteFile(): string | null {
    return this.trainerDef?.sprite ?? this.trainerSpriteName;
  }

  preload(): void {
    // AR 원본 배틀 에셋 — 배경(배틀백)과 UI(HP박스·커맨드 버튼·대사창).
    //  ⚠️ assets/battlebacks·assets/ui/battle 는 새 폴더 → dev 서버를 재시작해야 png가 제대로 응답한다.
    this.load.image("bb_bg", `assets/battlebacks/${this.backdrop}_bg.png`);
    this.load.image("bb_msg", `assets/battlebacks/${this.backdrop}_message.png`);
    for (const k of ["databox_normal", "databox_normal_foe", "overlay_command", "cursor_command",
                     "overlay_message", "overlay_fight", "cursor_fight", "overlay_hp", "overlay_lv", "icon_numbers"]) {
      if (!this.textures.exists(`bt_${k}`)) this.load.image(`bt_${k}`, `assets/ui/battle/${k}.png`);
    }
    // 타입 아이콘 시트(기술 선택 화면 오른쪽) — 배틀 UI가 아니라 공용 UI 폴더에 있다.
    if (!this.textures.exists("bt_types")) this.load.image("bt_types", "assets/ui/types.png");
    // 대사창 "계속" 화살표 — AR 원본 Graphics/UI/pause_arrow.png(80x28 = 20x28 4프레임).
    //  프레임마다 삼각형이 그려진 높이가 달라서, 프레임만 돌리면 위아래로 까딱인다(원본과 동일).
    if (!this.textures.exists("bt_pause_arrow")) {
      this.load.spritesheet("bt_pause_arrow", "assets/ui/pause_arrow.png",
                            { frameWidth: PAUSE_W, frameHeight: PAUSE_H });
    }
    // ★ 포켓몬·트레이너 그림은 여기서 안 받는다 — 교체하거나 상대가 다음 포켓몬을 내면
    //   그 종족을 preload 시점엔 알 수 없다. 필요할 때 ensureBattleSprite()로 그때그때 받는다.
    preloadCommonAudio(this);
    this.load.audio(BGM.battle, "assets/audio/bgm_battle.ogg"); // 배틀 전용 BGM
  }

  async create(): Promise<void> {
    await loadArDb(); // 종족·기술·상성·트레이너 데이터 확보
    if (this.trainerId) {
      this.trainerDef = getTrainer(this.trainerId) ?? null;
      if (!this.trainerDef) console.warn(`[BattleScene] 트레이너 정의를 못 찾았다: ${this.trainerId}`);
    }

    // 내 파티 — registry의 배열을 그대로 쓴다(레벨업·회복·포획이 파티에 바로 반영돼야 한다).
    const saved = this.registry.get("playerParty") as Pokemon[] | undefined;
    if (saved?.length) {
      this.party = saved;
      // 넘어온 ally가 파티의 몇 번째인지 찾는다(못 찾으면 선두).
      const i = this.pendingAlly ? saved.indexOf(this.pendingAlly) : 0;
      this.allyIdx = i >= 0 ? i : 0;
    } else {
      this.party = [this.pendingAlly ?? createFromSpecies(this.allySpecies, 5)];  // 디버그 데모
      this.allyIdx = 0;
    }
    // 내보내려던 포켓몬이 기절해 있으면 싸울 수 있는 첫 마리로 바꾼다.
    if (isFainted(this.ally)) {
      const able = this.party.findIndex((p) => !isFainted(p));
      if (able >= 0) this.allyIdx = able;
    }

    // 상대 팀 — 넘어온 팀 > AR 트레이너 정의 > 데모 1마리.
    //  trainerTeam()은 팀이 여러 버전이면(그린) 무작위로 하나를 고른다 → 여기서 딱 한 번만 부른다.
    this.enemyTeam = this.pendingEnemyTeam
      ?? (this.trainerDef ? trainerTeam(this.trainerDef).map((m) => createFromSpecies(m.id, m.level)) : null)
      ?? [createFromSpecies(this.enemySpecies, 3)];
    this.enemyIdx = 0;

    // 첫 대면에 필요한 그림만 먼저 받는다(나머지는 내보낼 때).
    await this.ensureBattleSprite(backKey(this.ally.speciesId), backPath(this.ally.speciesId));
    await this.ensureBattleSprite(frontKey(this.enemy.speciesId), frontPath(this.enemy.speciesId));
    const tf = this.trainerSpriteFile;
    if (tf) await this.ensureBattleSprite(trainerKey(tf), `assets/trainers/${tf}.png`);

    // 도트 에셋은 NEAREST(확대해도 또렷하게)
    //  (bsp_ = 트레이너 그림. 포켓몬은 makeStillFront가 잘라낸 __still 텍스처에 직접 걸어준다.)
    for (const k of this.textures.getTextureKeys())
      if (k.startsWith("bt_") || k.startsWith("bb_") || k.startsWith("bsp_"))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 대사창 "계속" 화살표 애니메이션 — 게임 전역에 한 번만 등록한다(씬은 재사용되므로).
    //  프레임마다 삼각형 높이가 달라서 프레임만 돌리면 위아래로 까딱인다(AR 원본과 동일).
    if (this.textures.exists("bt_pause_arrow") && !this.anims.exists("pause_arrow")) {
      this.anims.create({
        key: "pause_arrow",
        frames: this.anims.generateFrameNumbers("bt_pause_arrow", { start: 0, end: 3 }),
        duration: PAUSE_MS * 4,   // 프레임당 150ms
        repeat: -1,
      });
    }

    this.view = new BattleView(this);
    this.buildBackground();
    this.buildSprites();
    this.buildHud();

    playBgm(this, BGM.battle, 0.35); // 야생 배틀 BGM
    this.runBattle().catch((e) => console.error("[BattleScene] 진행 오류:", e));
  }

  // ── 화면 구성 (전부 AR 원본 에셋 — 직접 그리는 도형 없음) ──
  private buildBackground(): void {
    this.bgLayer = this.add.container(0, 0).setDepth(0);
    this.view.drawBackdrop(this.bgLayer, "bb_bg", "bb_msg");
  }

  // AR 좌표: 내 포켓몬(back) (128,304) · 상대(front) (384,176), 둘 다 하단중앙 기준.
  //  AR 스프라이트는 프레임이 44~48px로 작고, 소스의 위치보정이 전부 *2다(SpeciesMetrics) → 배틀에선 2배로 그린다.
  private buildSprites(): void {
    const v = this.view;
    // 가로는 화면 비율 기준(XC) — 배경이 화면을 채우므로 발판 위치도 비율로 따라간다.
    //  상대는 아직 안 보인다(alpha 0) — sendOutEnemy()가 "나타났다/내보냈다" 대사와 함께 띄운다.
    this.enemySprite = this.makeEnemySprite();
    this.enemySprite.setAlpha(0);
    this.allySprite = this.makeAllySprite();
    this.appear(this.allySprite);
    // 트레이너 배틀이면 상대 자리에 트레이너가 먼저 서 있는다(포켓몬은 내보낸 뒤에 나온다).
    const tf = this.trainerSpriteFile;
    if (tf) {
      // AR 트레이너 그림은 128px 원본을 그대로 쓴다(포켓몬처럼 2배로 키우지 않는다 — 원본도 등신대로 그린다).
      this.trainerImg = this.add.image(v.XC(384), v.Y(ENEMY_VY), trainerKey(tf))
        .setOrigin(0.5, 1).setScale(v.s).setDepth(45);
      this.appear(this.trainerImg);
    }
  }

  // 지금 나와 있는 포켓몬으로 스프라이트를 만든다(교체 때마다 새 종족이라 새로 만든다).
  //  AR 좌표: 상대(front) (384,176) · 내 포켓몬(back) (128,304), 둘 다 하단중앙 기준.
  private makeEnemySprite(): Phaser.GameObjects.Image {
    const v = this.view;
    return makeStillFront(this, frontKey(this.enemy.speciesId), v.XC(384), v.Y(ENEMY_VY), v.s * SPRITE_ZOOM)
      .setOrigin(0.5, 1).setDepth(45);
  }
  private makeAllySprite(): Phaser.GameObjects.Image {
    const v = this.view;
    return makeStillFront(this, backKey(this.ally.speciesId), v.XC(128), v.Y(304), v.s * SPRITE_ZOOM)
      .setOrigin(0.5, 1).setDepth(50);
  }
  // 살짝 떠오르며 등장
  private appear(s: Phaser.GameObjects.Image): void {
    const v = this.view, y = s.y;
    s.y = y - 10 * v.s; s.alpha = 0;
    this.tweens.add({ targets: s, y, alpha: 1, duration: 350, ease: "Back.out" });
  }

  // 텍스처를 지금 받는다. 교체·다음 상대의 종족은 preload 시점에 알 수 없어서 런타임 로드가 필요하다.
  private ensureBattleSprite(key: string, path: string): Promise<void> {
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise((resolve) => {
      this.load.image(key, path);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  private buildHud(): void {
    // 상대 HP박스는 포켓몬이 나올 때 만든다(트레이너 그림만 서 있는 동안엔 없어야 한다).
    this.allyBox = new DataBox(this, this.view, this.ally, true);
  }

  // ── 배틀 진행(상태머신) ──────────────────────────────────
  private async runBattle(): Promise<void> {
    playSfx(this, SFX.exclaim, 0.5); // 조우 "!"
    if (this.isTrainerBattle) {
      const t = this.trainerName;
      await this.say(`${t}${josa(t, "이가")} 승부를 걸어왔다!`);
    }
    await this.sendOutEnemy(true);

    while (true) {
      const cmd = await this.selectCommand();

      if (cmd.kind === "run") {
        if (this.wild) { this.outcome = "run"; playSfx(this, SFX.flee, 0.5); await this.say("무사히 도망쳤다!"); break; }
        await this.say("도망칠 수 없다!");
        continue;
      }

      // 포켓몬 교체 — 교체는 턴을 쓴다(상대가 한 번 공격한다). AR·본가 동일.
      if (cmd.kind === "switch") {
        const pick = await this.choosePartyIdx(true);
        if (pick < 0) continue;                     // 취소 → 턴이 지나가지 않는다
        await this.switchAlly(pick);
        await this.doTurn(this.enemy, this.ally, this.pickEnemyMove(), this.allyBox, false);
        if (await this.resolveFaints()) break;
        continue;
      }

      // 가방: 아이템을 쓰면 그 턴에 기술은 못 쓴다(아이템 사용 = 턴 소비. AR·본가 동일).
      //  아무것도 안 쓰고 닫았으면 턴이 지나가지 않고 다시 커맨드 선택으로 돌아간다.
      if (cmd.kind === "item") {
        const bag = await this.openBag();
        if (!bag.used) continue;
        // 볼을 골랐다 → 던진다. 잡으면 배틀 끝, 놓치면 아이템과 똑같이 상대에게 한 턴을 준다.
        if (bag.ball && bag.item) {
          const thrown = await this.throwBall(bag.item);
          if (!thrown) continue;                    // 못 던진 경우(파티 만석) — 턴이 지나가지 않는다
          if (this.outcome === "catch") break;      // 잡았다
          await this.doTurn(this.enemy, this.ally, this.pickEnemyMove(), this.allyBox, false);
          if (await this.resolveFaints()) break;
          continue;
        }
        if (bag.text) await this.say(bag.text);     // "OO의 HP가 20 회복됐다!" — 가방이 만든 문장
        await this.allyBox.animateTo();                  // 회복된 HP를 HP바에 반영
        await this.doTurn(this.enemy, this.ally, this.pickEnemyMove(), this.allyBox, false);
        if (await this.resolveFaints()) break;
        continue;
      }

      const allySlot = this.ally.moves[cmd.idx];
      const enemySlot = this.pickEnemyMove();

      // 턴 순서: 우선도 → 스피드
      const allyFirst = movesFirst(this.ally, allySlot, this.enemy, enemySlot);
      const order: ("ally" | "enemy")[] = allyFirst ? ["ally", "enemy"] : ["enemy", "ally"];

      this.allyTurns++;
      for (const who of order) {
        if (who === "ally") await this.doTurn(this.ally, this.enemy, allySlot, this.enemyBox, true);
        else await this.doTurn(this.enemy, this.ally, enemySlot, this.allyBox, false);
        // 누가 쓰러지면 남은 행동은 취소된다(쓰러진 포켓몬은 못 때리고, 못 맞는다).
        if (isFainted(this.enemy) || isFainted(this.ally)) break;
      }
      if (await this.resolveFaints()) break;
    }

    await this.endBattle();
  }

  // 쓰러진 쪽을 처리한다(다음 포켓몬 내보내기 포함). 반환 true = 배틀이 끝났다.
  //  상대부터 본다 — 상대가 쓰러졌으면 그 반격은 이미 취소됐다.
  private async resolveFaints(): Promise<boolean> {
    if (isFainted(this.enemy) && await this.onEnemyFainted()) return true;
    if (isFainted(this.ally) && await this.onAllyFainted()) return true;
    return false;
  }

  // 상대가 쓰러졌다 → 경험치 → 남은 포켓몬이 있으면 다음 마리, 없으면 승리.
  private async onEnemyFainted(): Promise<boolean> {
    this.fadeOutSprite(this.enemySprite);
    this.enemyBox.destroy();          // 쓰러진 상대의 HP박스는 치운다(원본도 기절하면 databox가 사라진다)
    const foe = displayName(this.enemy);
    await this.say(`상대 ${foe}${josa(foe, "을를")} 쓰러뜨렸다!`);
    await this.awardExp();
    // 원본 AI는 상성을 따져 고르지만, 우리는 순서대로 낸다(AI 교체는 미구현).
    const next = this.enemyTeam.findIndex((p, i) => i > this.enemyIdx && !isFainted(p));
    if (next < 0) { await this.winBattle(); return true; }
    this.enemyIdx = next;
    await this.sendOutEnemy(false);
    return false;
  }

  // 내 포켓몬이 쓰러졌다 → 남은 포켓몬이 있으면 강제 교체(취소 불가), 없으면 패배.
  private async onAllyFainted(): Promise<boolean> {
    this.fadeOutSprite(this.allySprite);
    const me = displayName(this.ally);
    await this.say(`${me}${josa(me, "은는")} 쓰러졌다...`);
    if (!this.party.some((p, i) => i !== this.allyIdx && !isFainted(p))) {
      await this.loseBattle();
      return true;
    }
    await this.switchAlly(await this.choosePartyIdx(false));
    return false;
  }

  // 배틀 종료 처리: 패배=파티 전체 회복 후 집으로(화이트아웃) / 승리·도망=원위치 월드 복귀.
  private async endBattle(): Promise<void> {
    // 부른 쪽이 결과를 확인할 수 있게 남긴다.
    //  ⚠️ 없으면 안 된다: 체육관은 "배틀 다녀옴" 표시만 보고 뒷대사(=배지 지급)를 잇는데,
    //     지면 화이트아웃으로 집에 가버려 그 표시가 registry에 남는다 → 다시 들어오면 안 싸우고 배지를 먹는다.
    this.registry.set("lastBattleOutcome", this.outcome);
    if (this.outcome === "lose") {
      await this.loseMoney();
      await this.say("눈앞이 깜깜해졌다...");
      this.party.forEach((p) => { p.currentHp = p.maxHp; p.status = null; }); // 집에서 요양 → 전원 회복
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start("InteriorScene", { room: "living", skipIntro: true }));
    } else if (this.returnScene) {
      // 실내 씬(체육관)이 부른 배틀 — 그 씬이 알아서 뒷대사를 이어간다. 좌표는 그 씬이 정한다.
      this.time.delayedCall(300, () => this.scene.start(this.returnScene!));
    } else {
      this.time.delayedCall(300, () =>
        this.scene.start("WorldScene", { spawn: this.returnPos, face: this.returnFacing }));
    }
  }

  // 지면 상금을 뺏긴다 — 내 파티 최고레벨 × 뱃지수별 배수(AR pbLoseMoney). 가진 돈보다 많으면 가진 만큼만.
  private async loseMoney(): Promise<void> {
    const top = Math.max(...this.party.map((p) => p.level));
    const badges = getBadges(this.registry).length;
    const mult = LOSE_MONEY_MULT[Math.min(badges, LOSE_MONEY_MULT.length - 1)];
    const lost = Math.min(top * mult, getMoney(this.registry));
    if (lost <= 0) return;
    addMoney(this.registry, -lost);
    await this.say(`상대에게 ${lost}원을 상금으로 주었다...`);
  }

  // 한 포켓몬이 기술 하나 사용 → 메시지 + HP 연출
  private async doTurn(
    attacker: Pokemon, defender: Pokemon, slot: MoveSlot,
    defenderBox: DataBox, isAlly: boolean,
  ): Promise<void> {
    const who = isAlly ? displayName(attacker) : `상대 ${displayName(attacker)}`;
    const res = performMove(attacker, defender, slot);

    if (res.noPp) { await this.say(`${who}${josa(who, "은는")} 기술을 쓸 수 없다!`); return; }
    await this.say(`${who}의 ${res.moveName}!`);

    if (res.missed) { await this.say("하지만 빗나갔다!"); return; }

    if (res.damage > 0) {
      // 데미지 효과음 — 상성에 따라 다른 소리
      const hit = res.effectiveness > 1 ? SFX.hitSuper : res.effectiveness > 0 && res.effectiveness < 1 ? SFX.hitWeak : SFX.hitNormal;
      playSfx(this, hit, 0.5);
      this.flash(isAlly ? this.enemySprite : this.allySprite);
      await defenderBox.animateTo();
    }
    if (res.crit) await this.say("급소에 맞았다!");
    const eff = effectivenessText(res.effectiveness);
    if (eff) await this.say(eff);
  }

  // 볼을 던진다 — 판정은 systems/capture.ts(AR 원본 공식), 여기선 연출·소비·파티 편입만.
  //  반환 false = 못 던졌다(턴이 지나가지 않는다). true = 던졌다(잡았으면 this.outcome === "catch").
  private async throwBall(itemId: string): Promise<boolean> {
    const party = this.party;
    // 원본은 파티가 꽉 차면 박스로 보내지만 이 게임엔 박스가 없다 →
    //  박스까지 만원일 때 원본이 쓰는 그 문장으로 거절한다("Can't catch any more..."의 한국어판).
    if (party.length >= MAX_PARTY) { await this.say("더는 잡을 수 없습니다..."); return false; }

    const def = getItem(itemId);
    const itemName = def?.name ?? itemId;
    if (!removeItem(this.registry, itemId, 1)) return false;   // 개수가 안 맞으면(있을 수 없지만) 조용히 무시

    const me = (this.registry.get("playerName") as string) ?? "";
    await this.say(`${me}${josa(me, "은는")} ${itemName}${josa(itemName, "을를")} 던졌다!`);

    const shakes = captureShakes(this.enemy, itemId);
    // 볼에 들어가는 연출 — 전용 볼 스프라이트가 아직 없어서 상대가 사라졌다 흔들림만큼 기다린다.
    playSfx(this, SFX.decision, 0.4);
    this.fadeOutSprite(this.enemySprite);
    for (let i = 0; i < Math.max(1, shakes); i++) {
      await new Promise<void>((r) => this.time.delayedCall(450, r));
      playSfx(this, SFX.cursor, 0.5);
    }

    if (shakes < 4) {
      // 빠져나온다 — 스프라이트를 되돌린다.
      //  ⚠️ 먼저 트윈을 죽여야 한다: fadeOutSprite의 500ms 트윈이 아직 돌고 있으면
      //     alpha를 1로 되돌려도 트윈이 그 값을 다시 0으로 끌고 가 상대가 사라진 채로 배틀이 계속된다.
      this.tweens.killTweensOf(this.enemySprite);
      this.enemySprite.setAlpha(1).setY(this.view.Y(ENEMY_VY));
      await this.say(SHAKE_FAIL_TEXT[shakes] ?? SHAKE_FAIL_TEXT[0]);
      return true;
    }

    const foe = displayName(this.enemy);
    playSfx(this, SFX.decision, 0.5);
    await this.say(`좋았어! ${foe}${josa(foe, "을를")} 잡았다!`);
    // 도감 등록 + 파티 편입. 도감번호(id)는 칸토 도감에 있는 종족만 채운다(9세대 종족은 0으로 남는다).
    markOwn(this.registry, this.enemy.speciesId);
    const dexNo = dexKanto().indexOf(this.enemy.speciesId.toUpperCase());
    this.enemy.id = dexNo >= 0 ? dexNo + 1 : 0;
    party.push(this.enemy);
    this.registry.set("playerParty", party);
    await this.say(`${foe}${josa(foe, "이가")} 파티에 추가되었습니다.`);
    // 경험치는 주지 않는다(잡으면 경험치가 없던 5세대까지의 규칙 — 별명 짓기도 아직 없다).
    this.outcome = "catch";
    return true;
  }

  // 상대 한 마리를 쓰러뜨릴 때마다 경험치를 준다(지금 나와 있는 포켓몬에게만 — 참전 분배는 미구현).
  private async awardExp(): Promise<void> {
    const up = gainExp(this.ally, battleExpYield(this.enemy));
    const me = displayName(this.ally);
    await this.say(`${me}${josa(me, "은는")} ${up.gained} 경험치를 얻었다!`);
    for (const lv of up.levels) {
      playSfx(this, SFX.decision, 0.4);
      await this.say(`${me}${josa(me, "은는")} Lv.${lv}${josa(String(lv), "로")} 올랐다!`);
    }
    if (up.levels.length) await this.allyBox.animateTo(); // 레벨업으로 바뀐 HP/Lv 표시 갱신
    for (const l of up.learned) {
      await this.say(`${me}${josa(me, "은는")} 새로운 기술 ${l.move}${josa(l.move, "을를")} 배웠다!`);
    }
  }

  // 상대를 전부 쓰러뜨렸다 → 승리 마무리(트레이너면 그림 + 패배대사 + 상금. AR pbGainMoney 순서 그대로).
  private async winBattle(): Promise<void> {
    this.outcome = "win";
    if (!this.isTrainerBattle) return;

    if (this.trainerDef) {
      // AR 트레이너 — 원본 문장 그대로: "…에게 승리했다!" → 상대 패배대사 → "승부에서 N원을 얻었다!"
      await this.say(`${this.trainerName}에게 승리했다!`);
      await this.showTrainerAgain();
      await this.say(this.trainerDef.loseText);
      // 상금 = 상대 팀 최고레벨 × baseMoney (AR pbGainMoney).
      const top = Math.max(...this.enemyTeam.map((p) => p.level));
      const prize = top * this.trainerDef.baseMoney;
      addMoney(this.registry, prize);
      await this.say(`승부에서 ${prize}원을 얻었다!`);
      this.markTrainerDefeated();
    } else {
      // 라이벌(네모) — AR에 정의가 없는 상대. 기존 대사를 그대로 둔다.
      const t = this.trainerName;
      await this.say(`${t}${josa(t, "과와")}의 승부에서 이겼다!`);
      // 라이벌전 예약은 '이겼을 때만' 소비(지면 재대결 가능).
      this.registry.set("rivalBattlePending", false);
    }
  }

  // 이 트레이너는 다시 덤비지 않는다(재도전 방지). WorldScene이 이 목록을 보고 시야 판정을 건너뛴다.
  private markTrainerDefeated(): void {
    if (!this.trainerId) return;
    const done = (this.registry.get("trainersDefeated") as string[]) ?? [];
    if (!done.includes(this.trainerId)) {
      done.push(this.trainerId);
      this.registry.set("trainersDefeated", done);
    }
  }

  // 승부가 끝나면 트레이너가 다시 화면에 선다(AR pbShowOpponent) — 여기서 패배대사를 한다.
  private async showTrainerAgain(): Promise<void> {
    if (!this.trainerImg) return;
    this.tweens.killTweensOf(this.trainerImg);
    this.trainerImg.setVisible(true);
    this.trainerImg.setX(this.view.XC(384));
    this.appear(this.trainerImg);
    await new Promise<void>((r) => this.time.delayedCall(360, r));
  }

  // 싸울 수 있는 포켓몬이 다 떨어졌다 → 패배.
  private async loseBattle(): Promise<void> {
    this.outcome = "lose";
    await this.say("더 이상 싸울 수 있는 포켓몬이 없습니다!");
  }

  // ── 내보내기 / 교체 ─────────────────────────────────────
  // 상대 포켓몬을 내보낸다. first = 배틀 시작(야생 조우 포함), false = 앞의 포켓몬이 쓰러져 다음 마리.
  private async sendOutEnemy(first: boolean): Promise<void> {
    const e = displayName(this.enemy);
    if (this.isTrainerBattle) {
      const t = this.trainerName;
      await this.say(`${t}${josa(t, "은는")} ${e}${josa(e, "을를")} 내보냈다!`);
    } else if (first) {
      await this.say(`앗! 야생 ${e}${josa(e, "이가")} 나타났다!`);
    }
    markSeen(this.registry, this.enemy.speciesId);   // 마주친 종족 → 도감 '본 적 있음'

    // 트레이너 그림은 첫 포켓몬을 낼 때 물러난다(승부가 끝나면 다시 나온다).
    if (first && this.trainerImg) {
      this.tweens.add({
        targets: this.trainerImg, alpha: 0, x: this.trainerImg.x + 60 * this.view.s,
        duration: 300, ease: "Sine.in",
        onComplete: () => this.trainerImg?.setVisible(false),
      });
    }
    if (!first) {
      // 종족이 바뀌었다 → 텍스처를 받아 스프라이트를 새로 만든다(쓰러진 그림은 버린다).
      await this.ensureBattleSprite(frontKey(this.enemy.speciesId), frontPath(this.enemy.speciesId));
      this.tweens.killTweensOf(this.enemySprite);
      this.enemySprite.destroy();
      this.enemySprite = this.makeEnemySprite();
    }
    this.appear(this.enemySprite);
    // HP박스는 낼 때마다 새로 만든다 — 쓰러질 때 치우므로(onEnemyFainted) 되살려 쓸 게 없다.
    this.enemyBox = new DataBox(this, this.view, this.enemy, false);
  }

  // 내 포켓몬을 파티의 next번째로 바꾼다(기절해서 강제로 바꾸는 경우 포함).
  private async switchAlly(next: number): Promise<void> {
    const cur = this.ally;
    // 거둬들이는 대사 — 기절했으면 안 한다. 문장은 AR pbMessageOnRecall 조건 그대로.
    if (!isFainted(cur)) await this.say(this.recallText(cur));
    this.tweens.killTweensOf(this.allySprite);
    this.allySprite.destroy();

    this.allyIdx = next;
    this.allyTurns = 0;
    const p = this.ally;
    await this.ensureBattleSprite(backKey(p.speciesId), backPath(p.speciesId));
    this.allySprite = this.makeAllySprite();
    this.appear(this.allySprite);
    this.allyBox.setMon(p);
    await this.say(this.sendOutText(displayName(p)));
  }

  // 거둬들일 때 — HP가 적을수록 격려, 오래 싸웠으면 수고. (AR pbMessageOnRecall)
  private recallText(p: Pokemon): string {
    const n = displayName(p);
    if (p.currentHp <= p.maxHp / 4) return `잘했어, ${n}! 돌아와!`;
    if (p.currentHp <= p.maxHp / 2) return `좋아, ${n}! 돌아와!`;
    if (this.allyTurns >= 5) return `${n}, 잘했어! 돌아와!`;
    if (this.allyTurns >= 2) return `${n}, 돌아와!`;
    return `${n}, 교체야! 돌아와!`;
  }
  // 교체로 내보낼 때 — 상대 HP에 따라 갈린다. (AR pbMessagesOnReplace)
  private sendOutText(n: string): string {
    const foe = this.enemy;
    if (isFainted(foe) || foe.currentHp === foe.maxHp) return `네 차례야, ${n}!`;
    if (foe.currentHp >= foe.maxHp / 2) return `힘내, ${n}!`;
    if (foe.currentHp >= foe.maxHp / 4) return `조금 남았어! 힘내, ${n}!`;
    return `상대가 약해져 있어! 가랏, ${n}!`;
  }

  // 교체할 포켓몬을 고르게 한다. 못 내보내는 걸 고르면 이유를 말하고 다시 묻는다.
  //  canCancel=false(기절해서 강제 교체)면 취소해도 안 닫힌다.
  private async choosePartyIdx(canCancel: boolean): Promise<number> {
    while (true) {
      const i = await this.openParty(canCancel);
      if (i < 0) {
        if (canCancel) return -1;
        continue;   // 강제 교체 — 반드시 골라야 한다
      }
      const p = this.party[i];
      if (!p) continue;
      const n = displayName(p);
      if (i === this.allyIdx) { await this.say(`${n}${josa(n, "은는")} 이미 배틀에 나가 있다!`); continue; }
      if (isFainted(p)) { await this.say(`${n}${josa(n, "은는")} 기절해서 나갈 수 없다!`); continue; }
      return i;
    }
  }

  // 배틀 위에 파티 화면을 띄운다 — 가방과 같은 방식으로 필드 UI(MenuScene)를 그대로 재사용한다.
  //  반환: 고른 파티 칸, 취소면 -1.
  private openParty(canCancel: boolean): Promise<number> {
    return new Promise((resolve) => {
      this.scene.pause();
      this.scene.launch("MenuScene", {
        from: "BattleScene",
        mode: "switch",
        canCancel,
        onPick: (i: number) => resolve(i),
      });
    });
  }

  // 적 AI: PP 있는 기술 중 무작위(없으면 첫 기술)
  private pickEnemyMove(): MoveSlot {
    const usable = this.enemy.moves.filter((m) => m.pp > 0);
    const pool = usable.length ? usable : this.enemy.moves;
    return pool[Math.floor(Math.random() * pool.length)] ?? { id: "TACKLE", pp: 1, maxPp: 35 };
  }

  // ── 명령/기술 선택 메뉴 ──────────────────────────────────
  // 커맨드 4개 — AR 원본 배치 그대로 2x2 (위: 싸운다·가방 / 아래: 포켓몬·도망).
  //  menu()가 2열이라 배열 순서가 곧 그 배치가 된다.
  private async selectCommand(): Promise<Command> {
    const pick = await this.commandMenu();
    if (pick === 1) return { kind: "item" };
    if (pick === 2) return { kind: "switch" };
    if (pick === 3) return { kind: "run" };
    const mv = await this.selectMove();
    if (mv < 0) return this.selectCommand(); // 기술 선택에서 취소 → 커맨드로 뒤로가기
    return { kind: "move", idx: mv };
  }

  // 대사창 — AR 원본 overlay_message(512x96) 위에 글자만 얹는다(직접 그린 박스 아님).
  //  글자 시작 (32,306) · 색 base(80,80,88)/shadow(160,160,168) — 전부 AR 소스 값.
  private say(text: string): Promise<void> {
    return new Promise((resolve) => {
      const v = this.view;
      const layer = this.add.container(0, 0).setDepth(195);
      v.bottomOverlay(layer, "bt_overlay_message");     // 화면 폭 전체
      const t = this.add.text(v.XL(32), v.Y(306), text, {
        fontFamily: FONT, fontSize: `${Math.round(20 * v.s)}px`, color: "#505058",
        wordWrap: { width: 448 * v.s }, lineSpacing: Math.round(6 * v.s),
      }).setOrigin(0);
      t.setShadow(Math.max(1, v.s), Math.max(1, v.s), "#a0a0a8", 0, false, true);
      layer.add(t);

      // "계속" 화살표 — AR 원본 그림·좌표·속도 그대로(battleView의 PAUSE_* 주석에 근거).
      //  ★ 대사창은 화면 폭을 꽉 채우니 화살표도 오른쪽 끝 기준(XR) — 커맨드 버튼과 같은 앵커.
      //  그림이 없으면 화살표만 건너뛴다 — 장식 하나 때문에 배틀 진행이 멈추면 안 된다.
      if (this.anims.exists("pause_arrow")) {
        const arrow = this.add.sprite(v.XR(PAUSE_VX), v.Y(PAUSE_VY), "bt_pause_arrow")
          .setOrigin(0).setScale(v.s);
        arrow.play("pause_arrow");
        layer.add(arrow);
      }

      const kb = this.input.keyboard!;
      const done = () => {
        kb.off("keydown-ENTER", done); kb.off("keydown-Z", done); kb.off("keydown-SPACE", done);
        playSfx(this, SFX.decision, 0.35);
        layer.destroy();
        resolve();
      };
      kb.on("keydown-ENTER", done); kb.on("keydown-Z", done); kb.on("keydown-SPACE", done);
    });
  }

  // 커맨드 메뉴 — AR 원본 overlay_command + cursor_command(버튼 시트).
  //  ★ 버튼 그림에 "싸운다/가방/포켓몬/도망" 한글이 이미 그려져 있다(AR 한글판) → 글자를 얹지 않는다.
  //  좌열=기본 / 우열(x=130)=선택.  반환 0=싸운다 1=가방 2=포켓몬 3=도망.
  private commandMenu(): Promise<number> {
    return new Promise((resolve) => {
      const v = this.view;
      const layer = this.add.container(0, 0).setDepth(200);
      v.bottomOverlay(layer, "bt_overlay_command");     // 화면 폭 전체
      const name = displayName(this.ally);
      const prompt = this.add.text(v.XL(32), v.Y(306), `${name}${josa(name, "은는")}\n무엇을 할까?`, {
        fontFamily: FONT, fontSize: `${Math.round(20 * v.s)}px`, color: "#505058",
        lineSpacing: Math.round(6 * v.s),
      }).setOrigin(0);
      prompt.setShadow(Math.max(1, v.s), Math.max(1, v.s), "#a0a0a8", 0, false, true);
      layer.add(prompt);

      let idx = 0;
      // 버튼은 화면 오른쪽 끝 기준(XR) — AR도 화면 우측에 붙여 놓는다.
      const btns = CMD_SLOTS.map((slot) => {
        const im = this.add.image(v.XR(slot.vx), v.Y(slot.vy), "bt_cursor_command").setOrigin(0).setScale(v.s);
        layer.add(im);
        return im;
      });
      const paint = () => {
        CMD_SLOTS.forEach((slot, i) => {
          const sx = i === idx ? 130 : 0;              // 우열 = 선택된 모습
          btns[i].setCrop(sx, slot.row * 46, 130, 46);
          btns[i].setPosition(v.XR(slot.vx) - sx * v.s, v.Y(slot.vy) - slot.row * 46 * v.s);
        });
      };
      paint();

      const kb = this.input.keyboard!;
      const move = (d: number) => { idx = (idx + d + 4) % 4; playSfx(this, SFX.cursor, 0.4); paint(); };
      const onLeft = () => move(-1), onRight = () => move(1), onUp = () => move(-2), onDown = () => move(2);
      const onConfirm = () => {
        kb.off("keydown-LEFT", onLeft); kb.off("keydown-RIGHT", onRight);
        kb.off("keydown-UP", onUp); kb.off("keydown-DOWN", onDown);
        kb.off("keydown-ENTER", onConfirm); kb.off("keydown-Z", onConfirm); kb.off("keydown-SPACE", onConfirm);
        playSfx(this, SFX.decision, 0.4);
        layer.destroy();
        resolve(idx);
      };
      kb.on("keydown-LEFT", onLeft); kb.on("keydown-RIGHT", onRight);
      kb.on("keydown-UP", onUp); kb.on("keydown-DOWN", onDown);
      kb.on("keydown-ENTER", onConfirm); kb.on("keydown-Z", onConfirm); kb.on("keydown-SPACE", onConfirm);
    });
  }

  // 배틀 위에 가방 화면을 띄우고, 아이템을 쓰거나 그냥 닫을 때까지 기다린다.
  //  ★ AR·3세대와 같은 방식: 배틀 전용 가방을 새로 만들지 않고 필드 가방(BagScene)을 그대로 재사용한다.
  //    (배틀 전용 4카테고리 화면은 HGSS 방식인데, 그건 DS 하단 터치스크린이 따로 있어서 가능했던 것.)
  //  배틀 씬은 pause — 안 그러면 키 입력이 두 씬에 동시에 먹는다.
  private openBag(): Promise<BagResult> {
    return new Promise((resolve) => {
      this.scene.pause();
      this.scene.launch("BagScene", {
        from: "BattleScene",
        mode: "battle",
        wild: this.wild,                          // 야생전에서만 볼 포켓이 열린다(트레이너 포켓몬은 못 잡는다)
        onResult: (r: BagResult) => resolve(r),   // 가방이 닫히며 결과를 돌려준다
      });
    });
  }

  // 기술 선택 — AR 원본 overlay_fight + cursor_fight(타입별 버튼 시트). 직접 그리는 도형 없음.
  //  ★ 버튼 행 = 그 기술 타입의 iconPosition(types.json). 좌열=기본 / 우열=선택.
  //  ★ 기술명 글자색 = 그 버튼 그림에서 뽑은 타입 테두리색(battleView.moveNameColor).
  //  오른쪽 흰 칸 = 선택한 기술의 타입 아이콘(types.png) + 남은 PP(색이 PP 비율에 따라 변한다).
  //  반환: 고른 기술 인덱스, X/ESC로 취소하면 -1(커맨드로 뒤로가기).
  private selectMove(): Promise<number> {
    return new Promise((resolve) => {
      const v = this.view;
      const layer = this.add.container(0, 0).setDepth(200);
      v.bottomOverlay(layer, "bt_overlay_fight");

      const slots = this.ally.moves.slice(0, 4);
      // 타입의 iconPosition — 타입 아이콘 시트(20행)는 이 값을 그대로,
      //  버튼 시트(19행)는 스텔라가 없으므로 fightRow()로 걸러 쓴다.
      const rows = slots.map((m) => getType(getMove(m.id)?.type ?? "NORMAL")?.iconPosition ?? 0);
      const btnRows = rows.map(fightRow);

      // 기술 버튼 + 기술명
      const btns = slots.map((_, i) => {
        const im = this.add.image(v.XL(FIGHT_SLOTS[i].vx), v.Y(FIGHT_SLOTS[i].vy), "bt_cursor_fight")
          .setOrigin(0).setScale(v.s);
        layer.add(im);
        return im;
      });
      slots.forEach((m, i) => {
        const md = getMove(m.id);
        const t = this.add.text(v.XL(FIGHT_SLOTS[i].vx + FIGHT_BTN_W / 2), v.Y(FIGHT_SLOTS[i].vy + 14),
          md?.name ?? m.id, {
            fontFamily: FONT, fontSize: `${Math.round(18 * v.s)}px`,
            color: moveNameColor(this, "bt_cursor_fight", btnRows[i]),
          }).setOrigin(0.5, 0);
        t.setShadow(Math.max(1, v.s), Math.max(1, v.s), "#a0a0a8", 0, false, true);
        layer.add(t);
      });

      // 오른쪽 흰 칸: 선택한 기술의 타입 아이콘 + PP
      const typeIcon = this.add.image(v.XR(416), v.Y(308), "bt_types").setOrigin(0).setScale(v.s);
      layer.add(typeIcon);
      const ppText = this.add.text(v.XR(448), v.Y(344), "", {
        fontFamily: FONT, fontSize: `${Math.round(18 * v.s)}px`,
      }).setOrigin(0.5, 0);
      layer.add(ppText);

      let idx = 0;
      const paint = () => {
        slots.forEach((_, i) => {
          const sx = i === idx ? FIGHT_BTN_W : 0;              // 우열 = 선택된 모습
          btns[i].setCrop(sx, btnRows[i] * FIGHT_BTN_H, FIGHT_BTN_W, FIGHT_BTN_H);
          btns[i].setPosition(v.XL(FIGHT_SLOTS[i].vx) - sx * v.s,
                              v.Y(FIGHT_SLOTS[i].vy) - btnRows[i] * FIGHT_BTN_H * v.s);
        });
        // 타입 아이콘(시트에서 그 타입 행만 잘라 쓴다)
        typeIcon.setCrop(0, rows[idx] * TYPE_ICON_H, TYPE_ICON_W, TYPE_ICON_H);
        typeIcon.setPosition(v.XR(416), v.Y(308) - rows[idx] * TYPE_ICON_H * v.s);
        // PP
        const m = slots[idx];
        const [base, shadow] = PP_COLORS[ppStage(m.pp, m.maxPp)];
        ppText.setText(`PP: ${m.pp}/${m.maxPp}`).setColor(base);
        ppText.setShadow(Math.max(1, v.s), Math.max(1, v.s), shadow, 0, false, true);
      };
      paint();

      const kb = this.input.keyboard!;
      const n = slots.length;
      const move = (d: number) => { idx = (idx + d + n) % n; playSfx(this, SFX.cursor, 0.4); paint(); };
      const onLeft = () => move(-1), onRight = () => move(1), onUp = () => move(-2), onDown = () => move(2);
      const cleanup = () => {
        kb.off("keydown-LEFT", onLeft); kb.off("keydown-RIGHT", onRight);
        kb.off("keydown-UP", onUp); kb.off("keydown-DOWN", onDown);
        kb.off("keydown-ENTER", onConfirm); kb.off("keydown-Z", onConfirm); kb.off("keydown-SPACE", onConfirm);
        kb.off("keydown-X", onCancel); kb.off("keydown-ESC", onCancel);
        layer.destroy();
      };
      const onConfirm = () => { playSfx(this, SFX.decision, 0.4); const r = idx; cleanup(); resolve(r); };
      const onCancel = () => { playSfx(this, SFX.cancel, 0.4); cleanup(); resolve(-1); };
      kb.on("keydown-LEFT", onLeft); kb.on("keydown-RIGHT", onRight);
      kb.on("keydown-UP", onUp); kb.on("keydown-DOWN", onDown);
      kb.on("keydown-ENTER", onConfirm); kb.on("keydown-Z", onConfirm); kb.on("keydown-SPACE", onConfirm);
      kb.on("keydown-X", onCancel); kb.on("keydown-ESC", onCancel);
    });
  }

  // ── 연출 ─────────────────────────────────────────────────
  private flash(sprite: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: sprite, alpha: 0.2, duration: 60, yoyo: true, repeat: 2 });
  }
  private fadeOutSprite(sprite: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: sprite, alpha: 0, y: sprite.y + 20, duration: 500, ease: "Sine.in" });
  }
}
