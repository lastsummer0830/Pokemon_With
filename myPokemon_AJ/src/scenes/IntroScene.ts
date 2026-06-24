import Phaser from "phaser";
import { Gender } from "../data/Player";

// 게임 인트로 — 옛날 픽셀 포켓몬 게임 오프닝 감성.
// 어두운 스포트라이트 배경 → "…" → "여기는 어디지…?" → 오박사 등장 →
// 성별(주인공) 선택 → 이름 입력(+확인) → 월드로.
// 대사는 갈무리(Galmuri11) 도트 한글 폰트로 한 글자씩 타이핑된다.
// - 말하는 사람이 있으면 대화박스 위에 "이름창"이 붙고, 나레이션(상황 설명)은 이름창이 없다.
export default class IntroScene extends Phaser.Scene {
  // 화면 내내 유지되는 요소들
  private bg!: Phaser.GameObjects.Image;
  private boxG!: Phaser.GameObjects.Graphics;       // 대화 박스(직접 그림)
  private boxText!: Phaser.GameObjects.Text;        // 대화 글자
  private namePlate!: Phaser.GameObjects.Graphics;  // 이름창(작은 박스)
  private nameTag!: Phaser.GameObjects.Text;        // 이름창 안 글자
  private arrow!: Phaser.GameObjects.Text;          // 다음 안내 ▼
  private oak?: Phaser.GameObjects.Image;           // 오박사 스프라이트

  private speaker: string | null = null;            // 현재 말하는 사람(없으면 나레이션)
  private dialogShown = true;                       // 대화 UI가 보이는 상태인가

  // 대화 박스 위치/크기(리사이즈 때 다시 계산)
  private boxRect = { x: 0, y: 0, w: 0, h: 0, pad: 0, font: 18 };

  private readonly FONT = "Galmuri11";              // 픽셀 한글 폰트

  constructor() {
    super("IntroScene");
  }

  preload(): void {
    this.load.image("intro_bg", "assets/intro/intro_bg.png");   // 중앙 스포트라이트
    this.load.image("oak", "assets/intro/oak.png");             // 오박사(FRLG 도트)
    this.load.image("boy_red", "assets/intro/boy_red.png");     // 남=1세대 RED
    this.load.image("girl_dawn", "assets/intro/girl_dawn.png"); // 여=4세대 DAWN
  }

  create(): void {
    const { width, height } = this.scale;

    // 1) 배경 — 화면을 꽉 채우되 비율 유지(cover)
    this.bg = this.add.image(width / 2, height / 2, "intro_bg").setOrigin(0.5);

    // 도트 에셋은 또렷하게(픽셀 보존)
    ["oak", "boy_red", "girl_dawn"].forEach((k) =>
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST)
    );

    // 2) 대화 박스 + 이름창 + 글자(빈 채로 만들고 layout으로 위치 잡기)
    this.boxG = this.add.graphics();
    this.namePlate = this.add.graphics();
    this.boxText = this.add.text(0, 0, "", {
      fontFamily: this.FONT, fontSize: "18px", color: "#ffffff", lineSpacing: 8,
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

    const src = this.textures.get("intro_bg").getSourceImage();
    const scale = Math.max(width / src.width, height / src.height);
    this.bg.setPosition(width / 2, height / 2).setScale(scale);

    const w = Math.min(width * 0.92, 1100);
    const h = Math.max(height * 0.24, 140);
    const x = (width - w) / 2;
    const y = height - h - Math.max(height * 0.04, 18);
    const pad = Math.round(h * 0.16);
    const font = Math.max(18, Math.round(h * 0.16));
    this.boxRect = { x, y, w, h, pad, font };

    this.drawBox();

    this.boxText.setPosition(x + pad, y + pad).setFontSize(font).setWordWrapWidth(w - pad * 2);
    this.nameTag.setFontSize(font);
    this.arrow.setPosition(x + w - pad, y + h - pad * 0.4).setFontSize(font);

    this.applySpeaker();              // 이름창 위치/표시 갱신
    if (this.oak) this.placeOak();
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
    await this.wait(150);

    // 오박사 등장
    await this.showOak();
    await this.say("…! 드디어 깨어났구나!", "오박사");
    await this.say("정신이 드니?", "오박사");
    await this.say("후후, 그렇게 경계하지 않아도 된단다.", "오박사");
    await this.say("자, 먼저 너에 대해 한 가지 묻고 싶구나.", "오박사");
    await this.say("너는… 남자아이니, 여자아이니?", "오박사");

    // 1) 성별(주인공) 선택 — 전용 화면
    this.setDialogVisible(false);
    const gender = await this.askGender();
    this.setDialogVisible(true);
    await this.say(gender === "boy" ? "오호, 씩씩한 남자 아이로구나!" : "오호, 야무진 여자 아이로구나!", "오박사");

    // 2) 이름 입력 — 전용 화면(선택한 성별 카드와 함께) + 확인(예/아니오)
    let name = "";
    while (true) {
      await this.say("그럼, 너의 이름은 무엇이니?", "오박사");
      this.setDialogVisible(false);
      name = await this.askName(gender);
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
    try { localStorage.setItem("myPokemon.intro", JSON.stringify({ name, gender })); } catch { /* 무시 */ }

    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("BedroomScene"));
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
        else if (waitInput) { cleanup(); resolve(); }
      };
      if (waitInput) {
        this.input.keyboard!.on("keydown-SPACE", onAdvance);
        this.input.keyboard!.on("keydown-ENTER", onAdvance);
        this.input.on("pointerdown", onAdvance);
      }
    });
  }

  private showOak(): Promise<void> {
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
    const targetH = Math.min(this.boxRect.y * 0.78, src.height * 5);
    this.oak.setScale(targetH / src.height);
    this.oak.setPosition(width / 2, this.boxRect.y - 14);
  }

  // 카드 한 장(크림 테두리 + 캐릭터 도트 + 라벨)을 만들어 컨테이너로 반환
  private buildCard(x: number, y: number, key: string, label: string, cardW: number): Phaser.GameObjects.Container {
    const cardH = cardW * 1.34;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xc98a3c, 1); g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    g.fillStyle(0xf3e4c8, 1); g.fillRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, cardH - 16, 12);
    const src = this.textures.get(key).getSourceImage();
    const isc = Math.min((cardW - 40) / src.width, (cardH - 70) / src.height);
    const img = this.add.image(0, -cardH * 0.06, key).setOrigin(0.5).setScale(isc);
    const cap = this.add.text(0, cardH / 2 - 28, label, {
      fontFamily: this.FONT, fontSize: `${Math.max(18, Math.round(cardW * 0.1))}px`, color: "#3a2a14",
    }).setOrigin(0.5);
    c.add([g, img, cap]);
    c.setSize(cardW, cardH);
    return c;
  }

  // 성별(주인공) 선택 — 전용 화면. 처음엔 둘 다 평범한 카드(선택 표시 없음).
  // 마우스 호버/방향키로 고른 쪽만 밝아지고, 다른 쪽은 어두워진다(위 안내문은 안 가림).
  private askGender(): Promise<Gender> {
    const { width, height } = this.scale;
    const cx = width / 2;

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x0a0e18, 0.97); backdrop.fillRect(0, 0, width, height);
    backdrop.fillStyle(0x1a2740, 0.55); backdrop.fillEllipse(cx, height * 0.6, width * 0.95, height * 0.7);

    const header = this.add.text(cx, height * 0.085, "너는… 누구지?", {
      fontFamily: this.FONT, fontSize: `${Math.max(26, Math.round(height * 0.045))}px`, color: "#ffffff",
    }).setOrigin(0.5);
    const help = this.add.text(cx, height * 0.15, "마우스 / ← → 로 고르고  클릭·Enter", {
      fontFamily: this.FONT, fontSize: `${Math.max(15, Math.round(height * 0.024))}px`, color: "#9fb3d8",
    }).setOrigin(0.5);

    // 카드는 화면 아래쪽으로 내려서 위 안내문을 절대 안 가리게
    const cardW = Math.min(width * 0.22, 250);
    const gap = cardW * 1.28;
    const cyCard = height * 0.58;
    const boy = this.buildCard(cx - gap / 2, cyCard, "boy_red", "남자아이", cardW);
    const girl = this.buildCard(cx + gap / 2, cyCard, "girl_dawn", "여자아이", cardW);
    const cards = [boy, girl];
    [boy, girl].forEach((c) => {
      c.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -(cardW * 1.34) / 2, cardW, cardW * 1.34), Phaser.Geom.Rectangle.Contains);
    });
    const cursor = this.add.graphics();
    let idx = -1;                 // -1 = 아직 아무것도 안 고름

    const refresh = () => {
      cursor.clear();
      cards.forEach((c, i) => {
        const on = idx === -1 ? true : i === idx;     // 아무것도 안 골랐으면 둘 다 정상
        c.setAlpha(on ? 1 : 0.45);
        c.setScale(idx === i ? 1.04 : 1);             // 고른 것만 살짝 강조
      });
      if (idx >= 0) {
        const c = cards[idx];
        const hw = (cardW * 1.04) / 2 + 8;
        const hh = (cardW * 1.34 * 1.04) / 2 + 8;
        cursor.lineStyle(5, 0xffe27a, 1);
        cursor.strokeRoundedRect(c.x - hw, c.y - hh, hw * 2, hh * 2, 18);
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
        backdrop.destroy(); header.destroy(); help.destroy();
        boy.destroy(); girl.destroy(); cursor.destroy();
        resolve(g);
      };
      this.input.keyboard!.on("keydown-LEFT", goLeft);
      this.input.keyboard!.on("keydown-RIGHT", goRight);
      this.input.keyboard!.on("keydown-ENTER", confirm);
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

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x0a0e18, 0.97); backdrop.fillRect(0, 0, width, height);
    backdrop.fillStyle(0x1a2740, 0.55); backdrop.fillEllipse(cx, height * 0.5, width * 0.9, height * 0.8);

    const header = this.add.text(cx, height * 0.12, "네 이름을 알려다오", {
      fontFamily: this.FONT, fontSize: `${Math.max(26, Math.round(height * 0.045))}px`, color: "#ffffff",
    }).setOrigin(0.5);

    // 선택한 성별 카드(작게)
    const cardW = Math.min(width * 0.16, 190);
    const key = gender === "boy" ? "boy_red" : "girl_dawn";
    const card = this.buildCard(cx, height * 0.43, key, gender === "boy" ? "남자아이" : "여자아이", cardW);

    // HTML 입력창 + 결정 버튼(카드 아래)
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 8; input.value = "";
    input.setAttribute("autocomplete", "off");
    Object.assign(input.style, {
      position: "fixed", left: "50%", top: "70%", transform: "translate(-50%,-50%)",
      width: "min(40vw, 320px)", padding: "10px 14px", textAlign: "center",
      fontFamily: `"${this.FONT}", monospace`, fontSize: "26px", color: "#21314f",
      background: "#f6efd8", border: "4px solid #4a6aa5", borderRadius: "10px",
      outline: "none", zIndex: "9999", boxShadow: "0 6px 18px rgba(0,0,0,.45)",
    } as CSSStyleDeclaration);
    const btn = document.createElement("button");
    btn.textContent = "결정";
    Object.assign(btn.style, {
      position: "fixed", left: "50%", top: "calc(70% + 48px)", transform: "translate(-50%,-50%)",
      fontFamily: `"${this.FONT}", monospace`, fontSize: "20px", color: "#f6efd8",
      background: "#4a6aa5", border: "none", borderRadius: "8px", padding: "6px 22px",
      cursor: "pointer", zIndex: "9999",
    } as CSSStyleDeclaration);
    document.body.appendChild(input); document.body.appendChild(btn);
    input.focus();
    this.input.keyboard!.enabled = false;   // 입력 동안 Phaser 키 가로채기 끔

    return new Promise((resolve) => {
      const submit = () => {
        const v = input.value.trim() || (gender === "girl" ? "빛나" : "레드");
        input.remove(); btn.remove();
        this.input.keyboard!.enabled = true;
        backdrop.destroy(); header.destroy(); card.destroy();
        resolve(v);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
      });
      btn.addEventListener("click", submit);
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
