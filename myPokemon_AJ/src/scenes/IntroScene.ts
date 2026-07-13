import Phaser from "phaser";
import { Gender } from "../data/Player";
import { stopBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX } from "../game/sfx";
import { DEFAULT_DIFFICULTY } from "../systems/difficulty";
import { START_BAG, START_MONEY } from "../systems/save";

// 게임 인트로 — 옛날 픽셀 포켓몬 게임 오프닝 감성.
// 어두운 스포트라이트 배경 → "…" → "여기는 어디지…?" → 오박사 등장 →
// 성별(주인공) 선택 → 이름 입력(+확인) → 월드로.
// 대사는 갈무리(Galmuri11) 도트 한글 폰트로 한 글자씩 타이핑된다.
// - 말하는 사람이 있으면 대화박스 위에 "이름창"이 붙고, 나레이션(상황 설명)은 이름창이 없다.
export default class IntroScene extends Phaser.Scene {
  // 화면 내내 유지되는 요소들
  private bg!: Phaser.GameObjects.Graphics;   // 오박사/선택 단계 그라데 배경
  private darkBg!: Phaser.GameObjects.Image;  // 도입부 스포트라이트 배경(공식 에셋)
  private boxG!: Phaser.GameObjects.Graphics;       // 대화 박스(직접 그림)
  private boxText!: Phaser.GameObjects.Text;        // 대화 글자
  private namePlate!: Phaser.GameObjects.Graphics;  // 이름창(작은 박스)
  private nameTag!: Phaser.GameObjects.Text;        // 이름창 안 글자
  private arrow!: Phaser.GameObjects.Text;          // 다음 안내 ▼
  private oak?: Phaser.GameObjects.Image;           // 오박사 스프라이트
  private oakShadow?: Phaser.GameObjects.Image;     // 오박사 발밑 발판(p1에서 뜬 부드러운 타원 스프라이트)
  // 배경 단계: open=도입부(어두운 깨어남) / oak=오박사(크림 p1) / select=성별·이름(핑크민트 p2·p3)
  private bgPhase: "open" | "oak" | "select" = "open";

  private speaker: string | null = null;            // 현재 말하는 사람(없으면 나레이션)
  private dialogShown = true;                       // 대화 UI가 보이는 상태인가

  // 대화 박스 위치/크기(리사이즈 때 다시 계산)
  private boxRect = { x: 0, y: 0, w: 0, h: 0, pad: 0, font: 18 };

  private readonly FONT = "Galmuri11";              // 픽셀 한글 폰트

  constructor() {
    super("IntroScene");
  }

  preload(): void {
    this.load.image("oak", "assets/intro/oak.png");             // 오박사(FRLG 도트)
    this.load.image("intro_base", "assets/intro/intro_base.png"); // 공식 발판(AR Pictures/introbase)
    this.load.image("intro_dark", "assets/intro/intro_dark.png"); // 시작 스포트라이트 배경
    this.load.image("boy_red", "assets/intro/boy_red.png");     // 남=1세대 RED
    this.load.image("girl_dawn", "assets/intro/girl_dawn.png"); // 여=4세대 DAWN
    preloadCommonAudio(this);
  }

  create(): void {
    const { width, height } = this.scale;

    // 인트로(나레이션)부터는 타이틀곡을 끈다 — 여기부터 무음, 이후 집/월드에서 상황별 BGM이 시작된다.
    stopBgm();

    // 1) 배경 — 단계별. 도입부는 공식 스포트라이트 이미지(intro_dark), 오박사/선택은 그라데(this.bg).
    this.bg = this.add.graphics().setDepth(-10);
    this.darkBg = this.add.image(0, 0, "intro_dark").setOrigin(0.5).setDepth(-9);

    // 도트 에셋은 또렷하게(픽셀 보존)
    ["oak", "boy_red", "girl_dawn"].forEach((k) =>
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST)
    );

    // 2) 대화 박스 + 이름창 + 글자(빈 채로 만들고 layout으로 위치 잡기)
    this.boxG = this.add.graphics();
    this.namePlate = this.add.graphics();
    this.boxText = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffffff", lineSpacing: 5,
    }).setOrigin(0, 0);
    this.nameTag = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffe27a",
    }).setOrigin(0, 0.5);
    this.arrow = this.add.text(0, 0, "▼", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffffff",
    }).setOrigin(1, 1).setVisible(false);
    this.tweens.add({
      targets: this.arrow, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut",
    });

    this.setSpeaker(null);
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    // 3) 인트로 시퀀스 시작(검은 화면에서 서서히)
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.run();
  }

  // 배경/대화 박스/이름창을 현재 창 크기에 맞춰 다시 배치
  private layout(): void {
    const { width, height } = this.scale;

    const ds = this.textures.get("intro_dark").getSourceImage();
    this.darkBg.setPosition(width / 2, height / 2).setScale(Math.max(width / ds.width, height / ds.height));
    this.paintBg();

    const w = Math.min(width * 0.92, 1100);
    const h = Math.max(height * 0.24, 140);
    const x = (width - w) / 2;
    const y = height - h - Math.max(height * 0.04, 18);
    // 오프닝 나레이션에 최대 4줄 문단이 있어 여백·폰트를 조금 줄여 한 박스에 담기게 함(박스 높이·위치는 그대로 → 성별/이름 화면 영향 없음).
    const pad = Math.round(h * 0.13);
    const font = Math.max(18, Math.round(h * 0.135));
    this.boxRect = { x, y, w, h, pad, font };

    this.drawBox();

    this.boxText.setPosition(x + pad, y + pad).setFontSize(font).setWordWrapWidth(w - pad * 2);
    this.nameTag.setFontSize(font);
    this.arrow.setPosition(x + w - pad, y + h - pad * 0.4).setFontSize(font);

    this.applySpeaker();              // 이름창 위치/표시 갱신
    if (this.oak) this.placeOak();
  }

  // 단계별 배경 — 미리보기(p1/p2/p3)에서 뽑은 실제 색 그대로.
  private paintBg(): void {
    const { width: W, height: H } = this.scale;
    const g = this.bg; g.clear();
    if (this.bgPhase === "oak") {
      this.darkBg.setVisible(false);
      // 오박사 = 따뜻한 크림(p1 정밀): 위 #fff5dc → 아래 #f6dab0
      g.fillGradientStyle(0xfff5dc, 0xfff5dc, 0xf6dab0, 0xf6dab0, 1);
      g.fillRect(0, 0, W, H);
    } else if (this.bgPhase === "select") {
      this.darkBg.setVisible(false);
      // 성별·이름 = 핑크민트(p2/p3): TL #fde0eb, TR #e5e9e9, BL #e6e9e9, BR #cef3e8
      g.fillGradientStyle(0xfde0eb, 0xe5e9e9, 0xe6e9e9, 0xcef3e8, 1);
      g.fillRect(0, 0, W, H);
    } else {
      // 도입부 = 공식 스포트라이트 배경 이미지
      this.darkBg.setVisible(true);
    }
  }

  // HGSS 감성 대화 박스: 바깥 크림색 테두리 + 안쪽 남색 패널
  private drawBox(): void {
    const { x, y, w, h } = this.boxRect;
    const g = this.boxG;
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x + 4, y + 6, w, h, 18);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(x, y, w, h, 18);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 14);
    g.lineStyle(2, 0x4a6aa5, 0.8); g.strokeRoundedRect(x + 9, y + 9, w - 18, h - 18, 11);
  }

  // 현재 말하는 사람 설정(null이면 나레이션 → 이름창 없음)
  private setSpeaker(name: string | null): void {
    this.speaker = name;
    this.applySpeaker();
  }

  // speaker 상태에 맞춰 이름창을 그리거나 숨긴다
  private applySpeaker(): void {
    const show = this.dialogShown && !!this.speaker;
    if (!show) {
      this.namePlate.clear();
      this.namePlate.setVisible(false);
      this.nameTag.setVisible(false);
      return;
    }
    const { x, y, font } = this.boxRect;
    this.nameTag.setText(this.speaker!);
    const padX = Math.round(font * 0.7);
    const plateH = Math.round(font * 1.7);
    const plateW = Math.round(this.nameTag.width + padX * 2);
    const px = x + 18;
    const py = y - plateH + 8;                       // 박스 위에 살짝 겹쳐 올림
    const g = this.namePlate;
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(px + 3, py + 4, plateW, plateH, 10);
    g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(px, py, plateW, plateH, 10);
    g.fillStyle(0x21314f, 1); g.fillRoundedRect(px + 4, py + 4, plateW - 8, plateH - 8, 7);
    g.setVisible(true);
    this.nameTag.setPosition(px + padX, py + plateH / 2).setVisible(true);
  }

  // 오박사 + 대화박스 + 이름창을 한꺼번에 보이거나 숨긴다
  private setDialogVisible(v: boolean): void {
    this.dialogShown = v;
    this.boxG.setVisible(v);
    this.boxText.setVisible(v);
    if (this.oak) this.oak.setVisible(v);
    if (this.oakShadow) this.oakShadow.setVisible(v);
    if (v) this.applySpeaker();
    else { this.namePlate.setVisible(false); this.nameTag.setVisible(false); this.arrow.setVisible(false); }
  }

  // ─────────────────────────── 인트로 시나리오 ───────────────────────────
  private async run(): Promise<void> {
    await this.wait(600);
    await this.say("…");
    await this.say("…　…　…");
    await this.say("…　…　…　…？");
    await this.say("여기는… 어디지…?");
    await this.wait(400);

    // ── 오프닝 나레이션(시작의 숲 · 잊혀진 유대) — 오박사 등장 전.
    //    start02.txt 문단 그대로: 빈 줄=박스 하나, 박스 안 줄바꿈은 원문대로 \n 유지.
    await this.say("……정신이 드나?");
    await this.say("다행이군. 여긴 시작의 숲.\n아주 오래전, 인간과 포켓몬이\n처음 마음을 나누었다고 전해지는 곳이지.");
    await this.say("그 시절의 인간과 포켓몬은 서로를 두려워하지 않았다.\n포켓몬은 인간의 도구가 아니었고,\n인간도 포켓몬의 주인이 아니었다.");
    await this.say("하지만 시간이 흐르며 인간의 마음은 변해갔다.");
    await this.say("더 강한 힘.\n더 많은 승리.\n더 큰 명예.\n그리고 더 많은 이익.");
    await this.say("어느 순간부터 사람들은 포켓몬을\n친구가 아닌 수단으로 여기기 시작했다.");
    await this.say("강한 포켓몬은 끝없는 배틀에 내몰렸고,\n약한 포켓몬은 쓸모없다는 이유로 버려졌다.");
    await this.say("상처받은 포켓몬들은 하나둘 인간 곁을 떠났다.");
    await this.say("누군가는 깊은 숲으로 숨어들었고,\n누군가는 폐허가 된 마을을 떠돌았으며,\n또 누군가는 다시는 인간을 믿지 않게 되었다.");
    await this.say("그날 이후, 포켓몬과 마음을 나누는 일은\n더 이상 당연한 일이 아니게 되었다.");
    await this.say("몬스터볼을 던진다고 해서,\n모두가 네 곁에 와주는 시대는 끝난 것이다.");
    await this.say("너는 이제 여행을 떠나게 될 것이다.");
    await this.say("상처받은 포켓몬들의 마음을 마주하고,\n잊혀진 유대를 되찾기 위한 길을 찾아라.");
    await this.say("자, 이젠 눈을 떠야한다.\n네가 만들어갈 이야기는,\n이곳에서부터 시작된다.");
    await this.wait(300);

    // 오박사 등장
    await this.showOak();
    await this.say("…! 드디어 깨어났구나!", "오박사");
    await this.say("정신이 드니?", "오박사");
    await this.say("후후, 그렇게 경계하지 않아도 된단다.", "오박사");
    await this.say("자, 먼저 너에 대해 한 가지 묻고 싶구나.", "오박사");
    await this.say("너는… 남자아이니, 여자아이니?", "오박사");

    // 1) 성별(주인공) 선택 — 전용 화면(배경 핑크민트로)
    this.setDialogVisible(false);
    this.bgPhase = "select"; this.paintBg();
    const gender = await this.askGender();
    this.bgPhase = "oak"; this.paintBg();
    this.setDialogVisible(true);
    await this.say(gender === "boy" ? "오호, 씩씩한 남자 아이로구나!" : "오호, 야무진 여자 아이로구나!", "오박사");

    // 2) 이름 입력 — 전용 화면(선택한 성별 카드와 함께) + 확인(예/아니오)
    let name = "";
    while (true) {
      await this.say("그럼, 너의 이름은 무엇이니?", "오박사");
      this.setDialogVisible(false);
      this.bgPhase = "select"; this.paintBg();
      name = await this.askName(gender);
      this.bgPhase = "oak"; this.paintBg();
      this.setDialogVisible(true);
      await this.say(`그래, ${name}(이)구나. 이 이름이 맞니?`, "오박사", false);
      const ok = await this.askYesNo();
      if (ok) break;
      await this.say("그래? 그럼 다시 알려다오.", "오박사");
    }

    await this.say(`좋아 ${name}, 이제 너의 모험을 시작해 볼까!`, "오박사");

    // 선택 결과 저장 → 월드로
    this.registry.set("playerName", name);
    this.registry.set("playerGender", gender);
    // 새 게임의 시작 상태: 난이도·소지금·가방·도감·뱃지. (저장 v3 — systems/save.ts 가 registry를 그대로 직렬화한다)
    //  ⚠️ 난이도 선택 화면은 아직 없다(다음 스텝) → 지금은 기본값 '노말'. AR처럼 게임 시작 시 1회만 고르게 할 것.
    if (!this.registry.get("difficulty")) this.registry.set("difficulty", DEFAULT_DIFFICULTY);
    this.registry.set("money", START_MONEY);
    this.registry.set("bag", START_BAG.map(e => ({ ...e })));
    this.registry.set("dexSeen", []);
    this.registry.set("dexOwn", []);
    this.registry.set("badges", []);
    this.registry.set("trainersDefeated", []);
    try { localStorage.setItem("myPokemon.intro", JSON.stringify({ name, gender })); } catch { /* 무시 */ }

    // (타이틀곡은 인트로 시작 시 이미 정지됨) — 여기선 집으로 넘어가기만 한다.
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("InteriorScene"));
  }

  // ─────────────────────────── 공용 헬퍼 ───────────────────────────

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // 대사 출력(타자기). speaker=null이면 나레이션(이름창 없음).
  // waitInput=true면 글자 다 나온 뒤 클릭/엔터를 기다렸다 다음으로, false면 다 나오면 바로 resolve.
  private say(text: string, speaker: string | null = null, waitInput = true): Promise<void> {
    this.setSpeaker(speaker);
    return new Promise((resolve) => {
      this.arrow.setVisible(false);
      this.boxText.setText("");
      let i = 0;
      let typing = true;

      const cleanup = () => {
        this.input.keyboard!.off("keydown-SPACE", onAdvance);
        this.input.keyboard!.off("keydown-ENTER", onAdvance);
        this.input.keyboard!.off("keydown-Z", onAdvance);
        this.input.off("pointerdown", onAdvance);
      };
      const finishTyping = () => {
        timer.remove(); this.boxText.setText(text); typing = false;
        if (waitInput) this.arrow.setVisible(true);
        else { cleanup(); resolve(); }
      };
      const timer = this.time.addEvent({
        delay: 38, loop: true, callback: () => {
          i++; this.boxText.setText(text.slice(0, i));
          if (i >= text.length) finishTyping();
        },
      });
      const onAdvance = () => {
        if (typing) finishTyping();
        else if (waitInput) { playSfx(this, SFX.decision, 0.4); cleanup(); resolve(); }
      };
      if (waitInput) {
        this.input.keyboard!.on("keydown-SPACE", onAdvance);
        this.input.keyboard!.on("keydown-ENTER", onAdvance);
        this.input.keyboard!.on("keydown-Z", onAdvance);
        this.input.on("pointerdown", onAdvance);
      }
    });
  }

  private showOak(): Promise<void> {
    this.bgPhase = "oak"; this.paintBg();   // 오박사 등장 = 세상이 크림빛으로 또렷해짐
    // 공식 발판(introbase). 대화박스보다 뒤(depth -1)라 박스에 안 겹침.
    this.oakShadow = this.add.image(0, 0, "intro_base").setOrigin(0.5, 0.5).setDepth(-1);
    this.oak = this.add.image(0, 0, "oak").setOrigin(0.5, 1).setAlpha(0);
    this.placeOak();
    return new Promise((resolve) => {
      this.tweens.add({
        targets: this.oak, alpha: 1, y: this.oak!.y - 12,
        duration: 800, ease: "Sine.out", onComplete: () => resolve(),
      });
    });
  }

  private placeOak(): void {
    if (!this.oak) return;
    const { width } = this.scale;
    const src = this.textures.get("oak").getSourceImage();
    const targetH = Math.min(this.scale.height * 0.40, src.height * 5);  // p1 비율(화면 약 38%)
    this.oak.setScale(targetH / src.height);
    // 공식 발판(introbase 176x48) 크기
    const pw = this.oak.displayWidth * 1.45;
    const ph = pw * (48 / 176);
    // 오박사를 위로 올려 발판 전체가 대화박스 위에 보이게(p1처럼). 발은 발판 위쪽에 얹힘.
    const feetY = this.boxRect.y - 10 - ph * 0.6;
    this.oak.setPosition(width / 2, feetY);
    if (this.oakShadow) {
      this.oakShadow.setDisplaySize(pw, ph).setPosition(width / 2, feetY + ph * 0.12);
      this.oakShadow.setVisible(this.oak.visible);
    }
  }

  // 카드 한 장(크림 테두리 + 캐릭터 도트 + 라벨)을 만들어 컨테이너로 반환
  private buildCard(x: number, y: number, key: string, label: string, cardW: number): Phaser.GameObjects.Container {
    const cardH = cardW * 1.34;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xc98a3c, 1); g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    g.fillStyle(0xf3e4c8, 1); g.fillRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, cardH - 16, 12);
    const src = this.textures.get(key).getSourceImage();
    // 라벨 있으면 위쪽에 캐릭터+아래 캡션, 없으면(빈 문자열) 중앙 정렬
    const isc = Math.min((cardW - 40) / src.width, (cardH - (label ? 70 : 40)) / src.height);
    const img = this.add.image(0, label ? -cardH * 0.06 : 0, key).setOrigin(0.5).setScale(isc);
    c.add([g, img]);
    if (label) {
      const cap = this.add.text(0, cardH / 2 - 28, label, {
        fontFamily: this.FONT, fontSize: `${Math.max(18, Math.round(cardW * 0.1))}px`, color: "#3a2a14",
      }).setOrigin(0.5);
      c.add(cap);
    }
    c.setSize(cardW, cardH);
    return c;
  }

  // 성별(주인공) 선택 — 전용 화면. 처음엔 둘 다 평범한 카드(선택 표시 없음).
  // 마우스 호버/방향키로 고른 쪽만 밝아지고, 다른 쪽은 어두워진다(위 안내문은 안 가림).
  private askGender(): Promise<Gender> {
    const { width, height } = this.scale;
    const cx = width / 2;

    // 파스텔 배경(this.bg) 그대로. 오박사·발판 숨기고, 대화박스에 "너는… 누구지?" 나레이션.
    this.oak?.setVisible(false); this.oakShadow?.setVisible(false);
    this.setSpeaker(null);
    this.boxG.setVisible(true); this.boxText.setVisible(true); this.arrow.setVisible(true);
    this.boxText.setText("너는… 누구지?");

    // 카드 2장(라벨 없음) — 박스 위쪽에 배치
    const cardW = Math.min(width * 0.2, 230);
    const gap = cardW * 1.35;
    const cyCard = height * 0.42;
    const boy = this.buildCard(cx - gap / 2, cyCard, "boy_red", "", cardW);
    const girl = this.buildCard(cx + gap / 2, cyCard, "girl_dawn", "", cardW);
    const cards = [boy, girl];
    [boy, girl].forEach((c) => {
      c.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -(cardW * 1.34) / 2, cardW, cardW * 1.34), Phaser.Geom.Rectangle.Contains);
    });
    // 카드 아래 안내문구 — 안 튀는 차분한 회청색, 제대로 된 화살표(◀ ▶)
    const help = this.add.text(cx, cyCard + (cardW * 1.34) / 2 + Math.max(26, height * 0.04),
      "⬅  ➡  로 선택", {
        fontFamily: this.FONT, fontSize: `${Math.max(15, Math.round(height * 0.022))}px`, color: "#97a0b0",
      }).setOrigin(0.5);
    const cursor = this.add.graphics();
    let idx = 0;                  // 기본 = 남자(왼쪽) 선택됨

    const refresh = () => {
      cursor.clear();
      cards.forEach((c, i) => {
        const on = idx === -1 ? true : i === idx;     // 아무것도 안 골랐으면 둘 다 정상
        c.setAlpha(on ? 1 : 0.45);
        c.setScale(idx === i ? 1.04 : 1);             // 고른 것만 살짝 강조
      });
      if (idx >= 0) {
        const c = cards[idx];
        // 선택 카드(스케일 1.04)의 외곽선에 딱 맞춰 노란 테두리(이중 테두리 X)
        const sw = cardW * 1.04, sh = cardW * 1.34 * 1.04;
        cursor.lineStyle(4, 0xffe27a, 1);
        cursor.strokeRoundedRect(c.x - sw / 2 - 1, c.y - sh / 2 - 1, sw + 2, sh + 2, 16);
      }
    };
    refresh();

    return new Promise((resolve) => {
      const goLeft = () => { idx = 0; refresh(); };
      const goRight = () => { idx = 1; refresh(); };
      const confirm = () => {
        if (idx < 0) return;                          // 아무것도 안 골랐으면 무시
        const g: Gender = idx === 0 ? "boy" : "girl";
        this.input.keyboard!.off("keydown-LEFT", goLeft);
        this.input.keyboard!.off("keydown-RIGHT", goRight);
        this.input.keyboard!.off("keydown-ENTER", confirm);
        this.input.keyboard!.off("keydown-Z", confirm);
        boy.destroy(); girl.destroy(); cursor.destroy(); help.destroy();
        resolve(g);
      };
      this.input.keyboard!.on("keydown-LEFT", goLeft);
      this.input.keyboard!.on("keydown-RIGHT", goRight);
      this.input.keyboard!.on("keydown-ENTER", confirm);
      this.input.keyboard!.on("keydown-Z", confirm);
      cards.forEach((c, i) => {
        c.on("pointerover", () => { idx = i; refresh(); });
        c.on("pointerout", () => { idx = -1; refresh(); });
        c.on("pointerdown", () => { idx = i; refresh(); confirm(); });
      });
    });
  }

  // 이름 입력 — 전용 화면. 선택한 성별 카드와 함께, 한글 IME 지원 HTML <input> 사용.
  private askName(gender: Gender): Promise<string> {
    const { width, height } = this.scale;
    const cx = width / 2;

    // 파스텔 배경(this.bg) 그대로. 오박사·발판 숨기고, 대화박스에 "네 이름을 알려다오" 나레이션.
    this.oak?.setVisible(false); this.oakShadow?.setVisible(false);
    this.setSpeaker(null);
    this.boxG.setVisible(true); this.boxText.setVisible(true); this.arrow.setVisible(true);
    this.boxText.setText("네 이름을 알려다오");

    // 선택한 성별 카드(라벨 없음) — 성별 화면과 같은 크기
    const cardW = Math.min(width * 0.2, 230);
    const key = gender === "boy" ? "boy_red" : "girl_dawn";
    const card = this.buildCard(cx, height * 0.37, key, "", cardW);

    // HTML 입력창 + 결정 버튼(카드 아래)
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 8; input.value = "";
    input.setAttribute("autocomplete", "off");
    // 입력창 = 크림 바탕 + 황금 테두리(카드와 톤 맞춤). 카드 아래·대화박스 위에 배치.
    Object.assign(input.style, {
      position: "fixed", left: "50%", top: "57%", transform: "translate(-50%,-50%)",
      width: "min(40vw, 320px)", padding: "10px 14px", textAlign: "center",
      fontFamily: `"${this.FONT}", monospace`, fontSize: "26px", color: "#3a2a14",
      background: "#f3e4c8", border: "4px solid #c98a3c", borderRadius: "10px",
      outline: "none", zIndex: "9999", boxShadow: "0 6px 18px rgba(0,0,0,.25)",
    } as CSSStyleDeclaration);
    document.body.appendChild(input);
    input.focus();
    this.input.keyboard!.enabled = false;   // 입력 동안 Phaser 키 가로채기 끔

    return new Promise((resolve) => {
      const submit = () => {
        const v = input.value.trim() || (gender === "girl" ? "빛나" : "레드");
        input.remove();
        this.input.keyboard!.enabled = true;
        card.destroy();
        resolve(v);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
      });
    });
  }

  // 예/아니오 선택 — 대화박스 위 오른쪽에 작은 메뉴. ↑↓/클릭 + Enter.
  private askYesNo(): Promise<boolean> {
    const { width, height } = this.scale;
    const font = this.boxRect.font;
    const rowH = Math.round(font * 1.9);
    const boxW = Math.max(Math.round(font * 5), 140);
    const boxH = rowH * 2 + Math.round(font * 0.8);
    const bx = this.boxRect.x + this.boxRect.w - boxW;
    const by = this.boxRect.y - boxH - 12;

    const g = this.add.graphics();
    const drawFrame = () => {
      g.clear();
      g.fillStyle(0x000000, 0.3); g.fillRoundedRect(bx + 3, by + 5, boxW, boxH, 12);
      g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(bx, by, boxW, boxH, 12);
      g.fillStyle(0x21314f, 1); g.fillRoundedRect(bx + 5, by + 5, boxW - 10, boxH - 10, 8);
    };
    drawFrame();

    const opts = ["예", "아니오"];
    const labelX = bx + Math.round(font * 1.6);
    const rows = opts.map((t, i) =>
      this.add.text(labelX, by + Math.round(font * 0.6) + i * rowH, t, {
        fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffffff",
      }).setOrigin(0, 0)
    );
    const cursor = this.add.text(0, 0, "▶", {
      fontFamily: this.FONT, fontSize: `${font}px`, color: "#ffe27a",
    }).setOrigin(0, 0);
    let idx = 0;
    const place = () => cursor.setPosition(bx + Math.round(font * 0.5), rows[idx].y);
    place();

    return new Promise((resolve) => {
      const move = (d: number) => { idx = (idx + d + opts.length) % opts.length; place(); };
      const up = () => move(-1);
      const down = () => move(1);
      const confirm = () => {
        this.input.keyboard!.off("keydown-UP", up);
        this.input.keyboard!.off("keydown-DOWN", down);
        this.input.keyboard!.off("keydown-ENTER", confirm);
        g.destroy(); rows.forEach((r) => r.destroy()); cursor.destroy();
        resolve(idx === 0);
      };
      this.input.keyboard!.on("keydown-UP", up);
      this.input.keyboard!.on("keydown-DOWN", down);
      this.input.keyboard!.on("keydown-ENTER", confirm);
      rows.forEach((r, i) => {
        r.setInteractive({ useHandCursor: true });
        r.on("pointerover", () => { idx = i; place(); });
        r.on("pointerdown", () => { idx = i; place(); confirm(); });
      });
    });
  }
}
