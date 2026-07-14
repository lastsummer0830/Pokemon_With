import Phaser from "phaser";
import { frontPath, backPath, makeStillFront } from "../game/pokemonSprite";
import { Pokemon, MoveSlot, createFromSpecies, displayName } from "../data/Pokemon";
import { loadArDb, getMove } from "../data/ar";
import { markSeen } from "../data/Pokedex";
import { performMove, movesFirst, isFainted, effectivenessText } from "../systems/battle";
import { battleExpYield, gainExp } from "../systems/exp";
import type { BagResult } from "./BagScene";
import { BattleView, DataBox, CMD_SLOTS, josa, type Fit } from "./battleView";
import { playBgm, stopBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";

// HGSS 감성 색 (DialogBox와 통일)
const CREAM = 0xf6efd8;
const NAVY = 0x21314f;
const BLUE = 0x4a6aa5;
const GOLD = "#ffe27a";
const FONT = "Galmuri11";
const SPRITE_ZOOM = 2;   // AR 배틀 스프라이트 확대 배율(원본 프레임 44~48px)

// 이번 턴에 내가 고른 행동. (AR/본가의 커맨드 4개 = 싸운다·가방·포켓몬·도망)
type Command =
  | { kind: "move"; idx: number }   // 기술 사용
  | { kind: "item" }                // 가방 열기
  | { kind: "switch" }              // 포켓몬 교체
  | { kind: "run" };                // 도망

// 씬으로 넘길 수 있는 데이터: 내/적 포켓몬. 없으면 데모용 기본값.
export interface BattleInit {
  ally?: Pokemon;
  enemy?: Pokemon;
  wild?: boolean;   // 야생 여부(도망 가능)
  trainer?: string; // 트레이너 배틀이면 상대 트레이너 이름(예: "네모"). 있으면 wild 취급 안 함.
  returnPos?: [number, number]; // 배틀 끝나고 돌아갈 월드 좌표(승리/도망 시)
  returnFacing?: "down" | "left" | "right" | "up";
  backdrop?: "town" | "route";  // 배틀 배경(AR battleback). 마을=town, 1번도로=route.
  fit?: Fit;                    // 화면 채우기 방식(시안 비교용) — 사용자 결정 전 임시 옵션
}

export default class BattleScene extends Phaser.Scene {
  private ally!: Pokemon;
  private enemy!: Pokemon;
  private wild = true;
  private view!: BattleView;                 // AR 좌표계(512x384) → 화면 변환
  private bgLayer!: Phaser.GameObjects.Container;
  private allyBox!: DataBox;
  private enemyBox!: DataBox;
  private allySprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private backdrop: "town" | "route" = "town";
  private fit: Fit = "cover";

  private pendingAlly: Pokemon | null = null;
  private pendingEnemy: Pokemon | null = null;
  private trainer: string | null = null;   // 트레이너 배틀 상대 이름(야생이면 null)
  private allySpecies = "charmander";
  private enemySpecies = "pidgey";
  private outcome: "win" | "lose" | "run" = "win";  // 배틀 결과
  private returnPos: [number, number] | undefined;   // 승리/도망 시 돌아갈 좌표
  private returnFacing: "down" | "left" | "right" | "up" = "down";

  constructor() { super("BattleScene"); }

  init(data: BattleInit): void {
    // 데이터가 있으면 그걸, 없으면 데모(파이리 vs 구구) — 실제 스탯은 create에서 채운다.
    this.pendingAlly = data?.ally ?? null;
    this.pendingEnemy = data?.enemy ?? null;
    this.trainer = data?.trainer ?? null;
    // 트레이너 배틀이면 무조건 야생 아님(도망 불가). 아니면 넘어온 wild 값(기본 야생).
    this.wild = this.trainer ? false : (data?.wild ?? true);
    this.allySpecies = (data?.ally?.speciesId ?? "CHARMANDER").toLowerCase();
    this.enemySpecies = (data?.enemy?.speciesId ?? "PIDGEY").toLowerCase();
    this.returnPos = data?.returnPos;
    this.returnFacing = data?.returnFacing ?? "down";
    // 배경은 "어디서 싸우느냐"가 정한다(AR도 맵 메타데이터의 battle_background). 마을=town, 도로·풀숲=route.
    this.backdrop = data?.backdrop ?? "route";
    this.fit = data?.fit ?? "cover";
    this.outcome = "win";
  }

  preload(): void {
    // AR 원본 배틀 에셋 — 배경(배틀백)과 UI(HP박스·커맨드 버튼·대사창).
    //  ⚠️ assets/battlebacks·assets/ui/battle 는 새 폴더 → dev 서버를 재시작해야 png가 제대로 응답한다.
    this.load.image("bb_bg", `assets/battlebacks/${this.backdrop}_bg.png`);
    this.load.image("bb_msg", `assets/battlebacks/${this.backdrop}_message.png`);
    for (const k of ["databox_normal", "databox_normal_foe", "overlay_command", "cursor_command",
                     "overlay_message", "overlay_hp", "overlay_lv", "icon_numbers"]) {
      if (!this.textures.exists(`bt_${k}`)) this.load.image(`bt_${k}`, `assets/ui/battle/${k}.png`);
    }
    // Phaser 텍스처는 Game 전역에 캐시된다 → 이전 배틀의 스프라이트 키가 남아 있으면
    //  종족이 달라도 옛 그림을 재사용해 버린다(적이 안 바뀌는 버그). 매 배틀 새로 받도록 먼저 비운다.
    //  (makeStillFront가 만드는 "__still" 파생 텍스처까지 제거.)
    for (const k of ["battle_ally", "battle_enemy", "battle_ally__still", "battle_enemy__still"]) {
      if (this.textures.exists(k)) this.textures.remove(k);
    }
    this.load.image("battle_ally", backPath(this.allySpecies));   // 내 포켓몬 = 뒷모습
    this.load.image("battle_enemy", frontPath(this.enemySpecies)); // 상대 = 앞모습
    preloadCommonAudio(this);
    this.load.audio(BGM.battle, "assets/audio/bgm_battle.ogg"); // 배틀 전용 BGM
  }

  async create(): Promise<void> {
    await loadArDb(); // 종족·기술·상성 데이터 확보
    this.ally = this.pendingAlly ?? createFromSpecies(this.allySpecies, 5);
    this.enemy = this.pendingEnemy ?? createFromSpecies(this.enemySpecies, 3);
    markSeen(this.registry, this.enemy.speciesId);   // 마주친 종족 → 도감 '본 적 있음'

    // 도트 에셋은 NEAREST(확대해도 또렷하게)
    for (const k of this.textures.getTextureKeys())
      if (k.startsWith("bt_") || k.startsWith("bb_"))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.view = new BattleView(this, this.fit);
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
    const ss = v.s * SPRITE_ZOOM;
    // 가로는 화면 비율 기준(XC) — 배경이 화면을 채우므로 발판 위치도 비율로 따라간다.
    this.enemySprite = makeStillFront(this, "battle_enemy", v.XC(384), v.Y(176), ss).setDepth(45);
    this.allySprite = makeStillFront(this, "battle_ally", v.XC(128), v.Y(304), ss).setDepth(50);
    this.enemySprite.setOrigin(0.5, 1);
    this.allySprite.setOrigin(0.5, 1);
    // 살짝 등장 연출
    [this.enemySprite, this.allySprite].forEach((s) => {
      const y = s.y; s.y = y - 10 * v.s; s.alpha = 0;
      this.tweens.add({ targets: s, y, alpha: 1, duration: 350, ease: "Back.out" });
    });
  }

  private buildHud(): void {
    this.enemyBox = new DataBox(this, this.view, this.enemy, false);
    this.allyBox = new DataBox(this, this.view, this.ally, true);
  }

  // ── 배틀 진행(상태머신) ──────────────────────────────────
  private async runBattle(): Promise<void> {
    playSfx(this, SFX.exclaim, 0.5); // 조우 "!"
    if (this.trainer) {
      // 트레이너 배틀 인트로 — 승부를 걸고 포켓몬을 내보낸다.
      await this.say(`${this.trainer}이(가) 승부를 걸어왔다!`);
      await this.say(`${this.trainer}은(는) ${displayName(this.enemy)}을(를) 내보냈다!`);
    } else {
      await this.say(`앗! 야생 ${displayName(this.enemy)}이(가) 나타났다!`);
    }

    while (true) {
      const cmd = await this.selectCommand();

      if (cmd.kind === "run") {
        if (this.wild) { this.outcome = "run"; playSfx(this, SFX.flee, 0.5); await this.say("무사히 도망쳤다!"); break; }
        await this.say("도망칠 수 없다!");
        continue;
      }

      if (cmd.kind === "switch") {
        // 교체는 다음 단계(파티 교체 + 상대 팀 복수)에서 붙인다. 지금은 안내만 하고 커맨드로 돌아간다.
        await this.say("지금은 포켓몬을 교체할 수 없다!");
        continue;
      }

      // 가방: 아이템을 쓰면 그 턴에 기술은 못 쓴다(아이템 사용 = 턴 소비. AR·본가 동일).
      //  아무것도 안 쓰고 닫았으면 턴이 지나가지 않고 다시 커맨드 선택으로 돌아간다.
      if (cmd.kind === "item") {
        const bag = await this.openBag();
        if (!bag.used) continue;
        if (bag.text) await this.say(bag.text);     // "OO의 HP가 20 회복됐다!" — 가방이 만든 문장
        await this.allyBox.animateTo();                  // 회복된 HP를 HP바에 반영
        await this.doTurn(this.enemy, this.ally, this.pickEnemyMove(), this.allyBox, false);
        if (isFainted(this.ally)) { await this.lose(); break; }
        continue;
      }

      const allySlot = this.ally.moves[cmd.idx];
      const enemySlot = this.pickEnemyMove();

      // 턴 순서: 우선도 → 스피드
      const allyFirst = movesFirst(this.ally, allySlot, this.enemy, enemySlot);
      const order: ("ally" | "enemy")[] = allyFirst ? ["ally", "enemy"] : ["enemy", "ally"];

      let ended = false;
      for (const who of order) {
        if (who === "ally") {
          await this.doTurn(this.ally, this.enemy, allySlot, this.enemyBox, true);
          if (isFainted(this.enemy)) { await this.win(); ended = true; break; }
        } else {
          await this.doTurn(this.enemy, this.ally, enemySlot, this.allyBox, false);
          if (isFainted(this.ally)) { await this.lose(); ended = true; break; }
        }
      }
      if (ended) break;
    }

    await this.endBattle();
  }

  // 배틀 종료 처리: 패배=파티 전체 회복 후 집으로(화이트아웃) / 승리·도망=원위치 월드 복귀.
  private async endBattle(): Promise<void> {
    if (this.outcome === "lose") {
      await this.say("눈앞이 깜깜해졌다...");
      const party = this.registry.get("playerParty") as Pokemon[] | undefined;
      party?.forEach((p) => { p.currentHp = p.maxHp; p.status = null; }); // 집에서 요양 → 전원 회복
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start("InteriorScene", { room: "living", skipIntro: true }));
    } else {
      this.time.delayedCall(300, () =>
        this.scene.start("WorldScene", { spawn: this.returnPos, face: this.returnFacing }));
    }
  }

  // 한 포켓몬이 기술 하나 사용 → 메시지 + HP 연출
  private async doTurn(
    attacker: Pokemon, defender: Pokemon, slot: MoveSlot,
    defenderBox: DataBox, isAlly: boolean,
  ): Promise<void> {
    const who = isAlly ? displayName(attacker) : `상대 ${displayName(attacker)}`;
    const res = performMove(attacker, defender, slot);

    if (res.noPp) { await this.say(`${who}은(는) 기술을 쓸 수 없다!`); return; }
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

  private async win(): Promise<void> {
    this.outcome = "win";
    this.fadeOutSprite(this.enemySprite);
    await this.say(`상대 ${displayName(this.enemy)}을(를) 쓰러뜨렸다!`);
    // 트레이너 배틀이면 승부 마무리 대사 + F1: 라이벌(트레이너)전 예약은 '이겼을 때만' 소비(지면 재대결 가능).
    if (this.trainer) {
      await this.say(`${this.trainer}와(과)의 승부에서 이겼다!`);
      this.registry.set("rivalBattlePending", false);
    }
    // 경험치 지급(승리 시에만). this.ally는 registry 파티 선두와 동일 참조라 레벨업이 파티에 그대로 반영된다.
    const up = gainExp(this.ally, battleExpYield(this.enemy));
    await this.say(`${displayName(this.ally)}은(는) ${up.gained} 경험치를 얻었다!`);
    for (const lv of up.levels) {
      playSfx(this, SFX.decision, 0.4);
      await this.say(`${displayName(this.ally)}은(는) Lv.${lv}(으)로 올랐다!`);
    }
    if (up.levels.length) await this.allyBox.animateTo(); // 레벨업으로 바뀐 HP/Lv 표시 갱신
    for (const l of up.learned) {
      await this.say(`${displayName(this.ally)}은(는) 새로운 기술 ${l.move}을(를) 배웠다!`);
    }
  }
  private async lose(): Promise<void> {
    this.outcome = "lose";
    this.fadeOutSprite(this.allySprite);
    await this.say(`${displayName(this.ally)}은(는) 쓰러졌다...`);
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
        onResult: (r: BagResult) => resolve(r),   // 가방이 닫히며 결과를 돌려준다
      });
    });
  }

  private async selectMove(): Promise<number> {
    const labels = this.ally.moves.map((m) => {
      const md = getMove(m.id);
      return `${md?.name ?? m.id}  ${m.pp}/${m.maxPp}`;
    });
    while (labels.length < 4) labels.push("-");
    return this.menu(labels, true, this.ally.moves.length);
  }

  // 공용 메뉴: 대화박스 자리에 2열 패널. ↑↓←→ + Enter/Z 선택, X/ESC 취소(취소가능일 때 -1).
  private menu(labels: string[], cancelable: boolean, activeCount = labels.length): Promise<number> {
    const { width, height } = this.scale;
    const w = Math.min(width * 0.92, 1100);
    const h = Math.max(height * 0.22, 130);
    const x = (width - w) / 2;
    const y = height - h - Math.max(height * 0.04, 18);
    const g = this.add.graphics().setDepth(1100);
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 4, y + 6, w, h, 18);
    g.fillStyle(CREAM, 1); g.fillRoundedRect(x, y, w, h, 18);
    g.fillStyle(NAVY, 1); g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 14);
    g.lineStyle(2, BLUE, 0.8); g.strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, 11);

    const cols = 2;
    const fs = Math.max(18, Math.round(h * 0.17));
    const pad = Math.round(h * 0.22);
    const cellW = (w - pad * 2) / cols;
    const rowH = Math.round((h - pad * 1.4) / 2);
    const texts = labels.map((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return this.add.text(x + pad + c * cellW + 28, y + pad * 0.6 + r * rowH, t,
        { fontFamily: FONT, fontSize: `${fs}px`, color: "#ffffff" }).setDepth(1101);
    });
    const cursor = this.add.text(0, 0, "▶", { fontFamily: FONT, fontSize: `${fs}px`, color: GOLD }).setDepth(1101);
    let idx = 0;
    const place = () => cursor.setPosition(texts[idx].x - 26, texts[idx].y);
    place();

    return new Promise((resolve) => {
      const kb = this.input.keyboard!;
      const clamp = (n: number) => (n + activeCount) % activeCount;
      const move = (d: number) => { idx = clamp(idx + d); place(); playSfx(this, SFX.cursor, 0.4); };
      const onLeft = () => move(-1); const onRight = () => move(1);
      const onUp = () => move(-cols); const onDown = () => move(cols);
      const cleanup = () => {
        kb.off("keydown-LEFT", onLeft); kb.off("keydown-RIGHT", onRight);
        kb.off("keydown-UP", onUp); kb.off("keydown-DOWN", onDown);
        kb.off("keydown-ENTER", onConfirm); kb.off("keydown-Z", onConfirm); kb.off("keydown-SPACE", onConfirm);
        kb.off("keydown-X", onCancel); kb.off("keydown-ESC", onCancel);
        g.destroy(); texts.forEach((t) => t.destroy()); cursor.destroy();
      };
      const onConfirm = () => { playSfx(this, SFX.decision, 0.4); const r = idx; cleanup(); resolve(r); };
      const onCancel = () => { if (!cancelable) return; playSfx(this, SFX.cancel, 0.4); cleanup(); resolve(-1); };
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
