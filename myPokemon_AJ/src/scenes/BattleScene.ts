import Phaser from "phaser";
import { frontPath, backPath, makeStillFront } from "../game/pokemonSprite";
import { Pokemon, MoveSlot, createFromSpecies, displayName } from "../data/Pokemon";
import { loadArDb, getMove } from "../data/ar";
import { performMove, movesFirst, isFainted, effectivenessText } from "../systems/battle";
import DialogBox from "../ui/DialogBox";
import { playBgm, stopBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";

// HGSS 감성 색 (DialogBox와 통일)
const CREAM = 0xf6efd8;
const NAVY = 0x21314f;
const BLUE = 0x4a6aa5;
const GOLD = "#ffe27a";
const FONT = "Galmuri11";

// 씬으로 넘길 수 있는 데이터: 내/적 포켓몬. 없으면 데모용 기본값.
export interface BattleInit {
  ally?: Pokemon;
  enemy?: Pokemon;
  wild?: boolean;   // 야생 여부(도망 가능)
  returnPos?: [number, number]; // 배틀 끝나고 돌아갈 월드 좌표(승리/도망 시)
  returnFacing?: "down" | "left" | "right" | "up";
}

// HP 박스 한 개(이름/레벨/HP바)를 그리고 갱신하는 작은 헬퍼.
class HpBox {
  private g: Phaser.GameObjects.Graphics;
  private nameT: Phaser.GameObjects.Text;
  private hpT: Phaser.GameObjects.Text | null;
  private displayHp: number;
  constructor(
    private scene: Phaser.Scene,
    private mon: Pokemon,
    private x: number,
    private y: number,
    private w: number,
    private showNumbers: boolean,
  ) {
    this.displayHp = mon.currentHp;
    this.g = scene.add.graphics().setDepth(50);
    const fs = Math.max(15, Math.round(w * 0.075));
    this.nameT = scene.add.text(x + 14, y + 8, "", { fontFamily: FONT, fontSize: `${fs}px`, color: "#ffffff" }).setDepth(51);
    this.hpT = showNumbers
      ? scene.add.text(x + w - 14, y + w * 0.28, "", { fontFamily: FONT, fontSize: `${fs}px`, color: "#ffffff" }).setOrigin(1, 0.5).setDepth(51)
      : null;
    this.redraw();
  }
  private redraw(): void {
    const { g, x, y, w, mon } = this;
    const h = Math.round(w * 0.42);
    g.clear();
    // 패널 (크림 테두리 + 남색 본문)
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(x + 3, y + 5, w, h, 12);
    g.fillStyle(CREAM, 1); g.fillRoundedRect(x, y, w, h, 12);
    g.fillStyle(NAVY, 1); g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 9);
    // HP 바
    const barX = x + 16, barY = y + h - 20, barW = w - 32, barH = 10;
    g.fillStyle(0x101820, 1); g.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 5);
    const ratio = Math.max(0, this.displayHp / mon.maxHp);
    const col = ratio > 0.5 ? 0x6ede6a : ratio > 0.2 ? 0xf2d24b : 0xe85b4b;
    g.fillStyle(col, 1); g.fillRoundedRect(barX, barY, Math.max(0, barW * ratio), barH, 4);
    this.nameT.setText(`${displayName(mon)}  Lv.${mon.level}`);
    if (this.hpT) this.hpT.setText(`${Math.ceil(this.displayHp)}/${mon.maxHp}`);
  }
  // HP를 현재값까지 부드럽게 깎으며 갱신. 완료 시 resolve.
  animateTo(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this, displayHp: this.mon.currentHp, duration: 500, ease: "Sine.inOut",
        onUpdate: () => this.redraw(),
        onComplete: () => { this.displayHp = this.mon.currentHp; this.redraw(); resolve(); },
      });
    });
  }
}

export default class BattleScene extends Phaser.Scene {
  private ally!: Pokemon;
  private enemy!: Pokemon;
  private wild = true;
  private allyBox!: HpBox;
  private enemyBox!: HpBox;
  private dlg!: DialogBox;
  private allySprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  private pendingAlly: Pokemon | null = null;
  private pendingEnemy: Pokemon | null = null;
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
    this.wild = data?.wild ?? true;
    this.allySpecies = (data?.ally?.speciesId ?? "CHARMANDER").toLowerCase();
    this.enemySpecies = (data?.enemy?.speciesId ?? "PIDGEY").toLowerCase();
    this.returnPos = data?.returnPos;
    this.returnFacing = data?.returnFacing ?? "down";
    this.outcome = "win";
  }

  preload(): void {
    this.load.image("battle_ally", backPath(this.allySpecies));   // 내 포켓몬 = 뒷모습
    this.load.image("battle_enemy", frontPath(this.enemySpecies)); // 상대 = 앞모습
    preloadCommonAudio(this);
    this.load.audio(BGM.battle, "assets/audio/bgm_battle.ogg"); // 배틀 전용 BGM
  }

  async create(): Promise<void> {
    await loadArDb(); // 종족·기술·상성 데이터 확보
    this.ally = this.pendingAlly ?? createFromSpecies(this.allySpecies, 5);
    this.enemy = this.pendingEnemy ?? createFromSpecies(this.enemySpecies, 3);

    this.buildBackground();
    this.buildSprites();
    this.buildHud();
    this.dlg = new DialogBox(this);
    this.scale.on("resize", () => this.dlg.layout());

    playBgm(this, BGM.battle, 0.35); // 야생 배틀 BGM
    this.runBattle().catch((e) => console.error("[BattleScene] 진행 오류:", e));
  }

  // ── 화면 구성 ────────────────────────────────────────────
  private buildBackground(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x9bd1e8).setOrigin(0);          // 하늘
    this.add.rectangle(0, height * 0.6, width, height * 0.4, 0xc7e39a).setOrigin(0); // 땅
    // 발판(타원)
    const g = this.add.graphics();
    g.fillStyle(0x9bc46a, 1);
    g.fillEllipse(width * 0.74, height * 0.5, width * 0.34, height * 0.09);
    g.fillEllipse(width * 0.26, height * 0.78, width * 0.42, height * 0.11);
  }

  private buildSprites(): void {
    const { width, height } = this.scale;
    this.enemySprite = makeStillFront(this, "battle_enemy", width * 0.74, height * 0.42, this.spriteScale(height, 1.5));
    this.allySprite = makeStillFront(this, "battle_ally", width * 0.26, height * 0.7, this.spriteScale(height, 1.9));
    this.enemySprite.setOrigin(0.5, 1);
    this.allySprite.setOrigin(0.5, 1);
    // 살짝 등장 연출
    [this.enemySprite, this.allySprite].forEach((s) => {
      const y = s.y; s.y = y - 10; s.alpha = 0;
      this.tweens.add({ targets: s, y, alpha: 1, duration: 350, ease: "Back.out" });
    });
  }
  private spriteScale(height: number, base: number): number {
    return (height / 480) * base; // 480 기준 비율
  }

  private buildHud(): void {
    const { width, height } = this.scale;
    const boxW = Math.min(width * 0.34, 360);
    this.enemyBox = new HpBox(this, this.enemy, width * 0.05, height * 0.08, boxW, false);
    this.allyBox = new HpBox(this, this.ally, width * 0.61, height * 0.5, boxW, true);
  }

  // ── 배틀 진행(상태머신) ──────────────────────────────────
  private async runBattle(): Promise<void> {
    const foe = this.wild ? `야생 ${displayName(this.enemy)}` : displayName(this.enemy);
    playSfx(this, SFX.exclaim, 0.5); // 조우 "!"
    await this.dlg.say(`앗! ${foe}이(가) 나타났다!`);

    while (true) {
      const choice = await this.selectCommand();
      if (choice === "run") {
        if (this.wild) { this.outcome = "run"; playSfx(this, SFX.flee, 0.5); await this.dlg.say("무사히 도망쳤다!"); break; }
        await this.dlg.say("도망칠 수 없다!");
        continue;
      }

      const allySlot = this.ally.moves[choice];
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
      await this.dlg.say("눈앞이 깜깜해졌다...");
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
    defenderBox: HpBox, isAlly: boolean,
  ): Promise<void> {
    const who = isAlly ? displayName(attacker) : `상대 ${displayName(attacker)}`;
    const res = performMove(attacker, defender, slot);

    if (res.noPp) { await this.dlg.say(`${who}은(는) 기술을 쓸 수 없다!`); return; }
    await this.dlg.say(`${who}의 ${res.moveName}!`);

    if (res.missed) { await this.dlg.say("하지만 빗나갔다!"); return; }

    if (res.damage > 0) {
      // 데미지 효과음 — 상성에 따라 다른 소리
      const hit = res.effectiveness > 1 ? SFX.hitSuper : res.effectiveness > 0 && res.effectiveness < 1 ? SFX.hitWeak : SFX.hitNormal;
      playSfx(this, hit, 0.5);
      this.flash(isAlly ? this.enemySprite : this.allySprite);
      await defenderBox.animateTo();
    }
    if (res.crit) await this.dlg.say("급소에 맞았다!");
    const eff = effectivenessText(res.effectiveness);
    if (eff) await this.dlg.say(eff);
  }

  private async win(): Promise<void> {
    this.outcome = "win";
    this.fadeOutSprite(this.enemySprite);
    await this.dlg.say(`상대 ${displayName(this.enemy)}을(를) 쓰러뜨렸다!`);
  }
  private async lose(): Promise<void> {
    this.outcome = "lose";
    this.fadeOutSprite(this.allySprite);
    await this.dlg.say(`${displayName(this.ally)}은(는) 쓰러졌다...`);
  }

  // 적 AI: PP 있는 기술 중 무작위(없으면 첫 기술)
  private pickEnemyMove(): MoveSlot {
    const usable = this.enemy.moves.filter((m) => m.pp > 0);
    const pool = usable.length ? usable : this.enemy.moves;
    return pool[Math.floor(Math.random() * pool.length)] ?? { id: "TACKLE", pp: 1, maxPp: 35 };
  }

  // ── 명령/기술 선택 메뉴 ──────────────────────────────────
  // "싸운다 / 도망친다" → 싸운다면 기술 인덱스, 도망이면 "run"
  private async selectCommand(): Promise<number | "run"> {
    const pick = await this.menu(["싸운다", "도망친다"], false);
    if (pick === 1) return "run";
    const mv = await this.selectMove();
    if (mv < 0) return this.selectCommand(); // 뒤로가기
    return mv;
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
