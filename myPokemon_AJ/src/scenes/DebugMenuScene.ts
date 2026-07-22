import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createFromSpecies, Pokemon } from "../data/Pokemon";
import { loadArDb, getMove } from "../data/ar";
import { loadAnimIndex } from "../game/battleAnim";
import { checksOfDate, debugCheckDates, primeDebugRegistry, startDebugCheck } from "../data/debugChecks";

// 개발용 — 씬 바로가기 + "이번 작업 확인" 목록. 타이틀에서 D 키로 진입.
//  왼쪽 = 매번 처음부터(타이틀→인트로→…) 안 거치고 원하는 화면으로 가는 바로가기.
//  오른쪽 = 그날 작업한 것을 한 방에 확인하는 항목들(data/debugChecks.ts).
//    ⭐ 새 작업을 하면 그 확인 항목을 debugChecks.ts에 추가하는 것까지가 작업 완료다(사용자 규칙).
export default class DebugMenuScene extends Phaser.Scene {
  private gender: Gender = "boy";
  private dateIdx = 0;      // 보고 있는 날짜(debugCheckDates()의 인덱스)
  private checkIdx = 0;     // 확인 항목 커서
  private checkRows: Phaser.GameObjects.Text[] = [];
  private panel?: Phaser.GameObjects.Container;   // 확인 항목 패널(날짜를 바꾸면 다시 그린다)
  private pickerOpen = false;                     // 기술 고르기 오버레이가 떠 있나(ESC를 가로챈다)

  constructor() {
    super("DebugMenuScene");
  }

  init(data?: { checkDate?: string; checkIdx?: number }): void {
    // 확인 항목을 보다 돌아왔으면 그 자리에 커서를 둔다(다음 항목을 이어서 보게).
    const dates = debugCheckDates();
    if (data?.checkDate) {
      const i = dates.indexOf(data.checkDate);
      if (i >= 0) this.dateIdx = i;
    }
    if (typeof data?.checkIdx === "number") this.checkIdx = data.checkIdx;
    this.checkRows = [];
    this.panel = undefined;
    this.pickerOpen = false;
  }

  create(): void {
    const { width, height } = this.scale;
    const FONT = "Galmuri11";

    // 목록으로 돌아왔으면 상단 확인바는 치운다(항목을 실행할 때 다시 뜬다).
    if (this.scene.isActive("DebugCheckBarScene")) this.scene.stop("DebugCheckBarScene");

    this.add.rectangle(0, 0, width, height, 0x10141e, 1).setOrigin(0, 0);
    this.add.text(width / 2, height * 0.05, "🔧 디버그", {
      fontFamily: FONT, fontSize: "26px", color: "#ffe27a",
    }).setOrigin(0.5);

    this.buildSceneList(width, height, FONT);
    this.buildCheckPanel(width, height, FONT);

    // ESC = 타이틀. 단 기술 고르기 오버레이가 떠 있으면 그쪽이 먼저 닫힌다(같은 키를 쓴다).
    this.input.keyboard!.on("keydown-ESC", () => { if (!this.pickerOpen) this.scene.start("TitleScene"); });
  }

  // ── 왼쪽: 씬 바로가기 ──────────────────────────────────────
  private buildSceneList(width: number, height: number, FONT: string): void {
    const cx = width * 0.25;
    this.add.text(cx, height * 0.11, "씬 바로가기  (숫자·알파벳 키 · ESC=타이틀)", {
      fontFamily: FONT, fontSize: "15px", color: "#9fb3d8",
    }).setOrigin(0.5);

    // 성별 토글(테스트용)
    const genderTxt = this.add.text(cx, height * 0.16, "", {
      fontFamily: FONT, fontSize: "16px", color: "#ffffff",
      backgroundColor: "#2a3550", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const refreshGender = () => genderTxt.setText(`성별: ${this.gender === "boy" ? "남(RED)" : "여(빛나)"}  ▶ 클릭해 전환`);
    refreshGender();
    genderTxt.on("pointerdown", () => { this.gender = this.gender === "boy" ? "girl" : "boy"; refreshGender(); });

    // 씬 버튼들. 세 번째 값(data)이 있으면 scene.start에 함께 넘긴다(거실 바로가기 등).
    const scenes: [string, string, object?][] = [
      ["1. 타이틀", "TitleScene"],
      ["2. 인트로(성별·이름)", "IntroScene"],
      ["3. 시작 집 - 침실(인트로부터)", "InteriorScene"],
      ["4. 시작 집 - 거실 바로가기", "InteriorScene", { room: "living", skipIntro: true }],
      ["5. 태초마을(World)", "WorldScene"],
      // 야생 데모 = 풀숲 조우 → 배경도 풀숲(route). 도시 배경(town)은 마을에서 싸울 때만.
      ["6. 배틀(Battle) - 야생 데모", "BattleScene", { wild: true, testParty: true, backdrop: "route" }],
      // 집 꾸미기는 별도 화면이 아니라 '내 방(2F)에서 F키'로 한다 → 침실로 바로 보낸다(테스트 파티 포함).
      ["7. 집 꾸미기(내 방 2F에서 F키)", "InteriorScene", { room: "bedroom", skipIntro: true, testParty: true }],
      ["8. 시작 집 - 침실 바로가기(skip)", "InteriorScene", { room: "bedroom", skipIntro: true }],
      ["9. 포켓몬 연구소(스타팅 선택)", "LabScene"],
      ["0. 인게임 메뉴(파티/가방/저장)", "__MENU__"],
      // 바로가기 — 색(look)은 버터 크림으로 확정됐다(시안 A~C 분기는 제거).
      ["Q. 가방", "BagScene", { testParty: true }],
      ["W. 도감", "PokedexScene", { testParty: true }],
      // 야외 리전의 나머지 두 맵. spawn은 **그 맵 기준 로컬 좌표**라 map을 같이 준다(WorldScene.init 참고).
      //  좌표는 눈대중이 아니라 맵 json의 blocked에서 걸을 수 있는 칸으로 골랐다(둘 다 남쪽 입구 = 실제 도착 지점).
      ["E. 1번도로", "WorldScene", { map: "route1", spawn: [25, 39], face: "up", testParty: true }],
      ["R. 상록시티", "WorldScene", { map: "viridian_city", spawn: [23, 38], face: "up", testParty: true }],
      // 트레이너전 데모 — 팀 2마리(라타·구구) + 교체 + 그림 + 상금을 바로 시험한다.
      //  좌표·팀·대사는 안 넘긴다: trainerId만 주면 BattleScene이 AR 정의(trainers.json)에서 전부 가져온다.
      ["T. 배틀 - 트레이너전 데모(반바지꼬마 한주)", "BattleScene",
        { trainerId: "YOUNGSTER:한주", testParty: true, backdrop: "route" }],
      // 상록체육관 — 들어서면 관장 그린 컷신이 자동으로 돈다(원본 trigger=3). 이기면 그린 배지.
      //  ⚠️ testParty(L5 3마리)로는 그린(L10~13 4마리)을 못 이긴다 — 배지까지 보려면 파티를 키우거나
      //     검증 스크립트로 상대 HP를 낮춰야 한다.
      ["Y. 상록체육관(관장 그린)", "GymScene", { testParty: true }],
      // 상록시티 실내 건물 — 센터(회복)·마트(점원). testParty로 회복 확인용 파티 채움.
      ["U. 포켓몬 센터(회복)", "BuildingScene", { building: "pc", testParty: true }],
      ["I. 프렌들리 숍(마트)", "BuildingScene", { building: "mart", testParty: true }],
      // 포켓몬 상세정보(Summary) — 파티에서 열리는 오버레이. testParty로 채운 파티의 첫 마리를 연다.
      ["O. 상세정보(Summary)", "SummaryScene", { testParty: true, from: "DebugMenuScene" }],
    ];
    const go = (key: string, data?: object) => {
      // 테스트용 기본값 — 인트로를 건너뛰어도 씬이 동작하도록(가방·소지금·도감 기록까지 채운다).
      this.registry.set("playerGender", this.gender);
      primeDebugRegistry(this, { party: !!(data as { testParty?: boolean } | undefined)?.testParty });
      if (key === "__MENU__") {
        // 인게임 메뉴 확인용: 파티 UI(2열×3행 6칸) 레이아웃 검증용으로 6마리를 채운다.
        this.registry.set("playerParty", [
          createFromSpecies("CHARMANDER", 5), createFromSpecies("PIDGEY", 3),
          createFromSpecies("BULBASAUR", 5), createFromSpecies("SQUIRTLE", 4),
          createFromSpecies("RATTATA", 2), createFromSpecies("CATERPIE", 3),
        ] as Pokemon[]);
        // 마을(WorldScene)을 띄운 뒤 그 위에 메뉴 오버레이를 연다(검은 배경 방지 — 실제 게임과 동일).
        this.scene.start("WorldScene", { openMenu: true });
        return;
      }
      this.scene.start(key, data);
    };

    // 숫자 10개로는 모자라 알파벳까지 쓴다(항목 순서 = 이 배열 순서).
    const keyNames = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO", "Q", "W", "E", "R", "T", "Y", "U", "I", "O"];
    // 항목 수에 맞춰 자동으로 화면 안에 다 들어오게(캔버스라 스크롤 없음).
    const startY = height * 0.22;
    const gap = Math.min(height * 0.06, (height * 0.72) / scenes.length);
    const fs = `${Math.max(13, Math.min(18, Math.round(gap * 0.42)))}px`;
    const padY = Math.max(4, Math.round(gap * 0.12));
    scenes.forEach(([label, key, data], i) => {
      const t = this.add.text(cx, startY + i * gap, label, {
        fontFamily: FONT, fontSize: fs, color: "#ffffff",
        backgroundColor: "#21314f", padding: { x: 14, y: padY },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#ffe27a"));
      t.on("pointerout", () => t.setColor("#ffffff"));
      t.on("pointerdown", () => go(key, data));
      if (keyNames[i]) this.input.keyboard!.on(`keydown-${keyNames[i]}`, () => go(key, data));
    });
  }

  // ── 오른쪽: 이번 작업 확인 ────────────────────────────────
  private buildCheckPanel(width: number, height: number, FONT: string): void {
    this.panel?.destroy();
    this.checkRows = [];
    const panel = this.add.container(0, 0);
    this.panel = panel;

    const dates = debugCheckDates();
    const date = dates[this.dateIdx] ?? dates[0] ?? "";
    const list = checksOfDate(date);
    if (this.checkIdx >= list.length) this.checkIdx = 0;

    const left = width * 0.52;
    const right = width * 0.98;
    const panelW = right - left;

    panel.add(this.add.rectangle(left, height * 0.09, panelW, height * 0.86, 0x161d2e, 1)
      .setOrigin(0, 0).setStrokeStyle(2, 0x36507f));
    panel.add(this.add.text(left + 14, height * 0.105, "✅ 이번 작업 확인", {
      fontFamily: FONT, fontSize: "20px", color: "#9ff5a8",
    }));
    panel.add(this.add.text(left + 14, height * 0.145,
      "↑↓ 이동 · Enter 실행 · 클릭도 가능. 실행하면 상단 바에서 ◀이전 [ · 다음▶ ] 로 하루치를 순서대로 훑는다.", {
        fontFamily: FONT, fontSize: "12px", color: "#9fb3d8",
        wordWrap: { width: panelW - 28 },
      }));

    // 날짜 전환(작업일지 MMDD와 같은 값)
    const dy = height * 0.185;
    const dateTxt = this.add.text(left + 14, dy, `📅 ${date}  (${list.length}항목)`, {
      fontFamily: FONT, fontSize: "16px", color: "#ffe27a",
    });
    panel.add(dateTxt);
    if (dates.length > 1) {
      const mk = (label: string, step: number, x: number) => {
        const t = this.add.text(x, dy, label, {
          fontFamily: FONT, fontSize: "14px", color: "#ffffff",
          backgroundColor: "#26365a", padding: { x: 8, y: 3 },
        }).setInteractive({ useHandCursor: true });
        t.on("pointerdown", () => {
          this.dateIdx = (this.dateIdx + step + dates.length) % dates.length;
          this.checkIdx = 0;
          this.buildCheckPanel(width, height, FONT);
        });
        panel.add(t);
      };
      mk("◀", -1, left + panelW - 90);
      mk("▶", +1, left + panelW - 46);
    }

    // 항목들 — 제목 + "무엇을 고쳤나" 한 줄.
    const top = height * 0.23;
    const rowH = Math.min(height * 0.085, (height * 0.70) / Math.max(1, list.length));
    list.forEach((c, i) => {
      const y = top + i * rowH;
      const bg = this.add.rectangle(left + 10, y, panelW - 20, rowH - 6, 0x21314f, 1)
        .setOrigin(0, 0).setInteractive({ useHandCursor: true });
      panel.add(bg);
      const title = this.add.text(left + 20, y + 4,
        `${i + 1}. ${c.title}${c.pickMove ? "  (기술 고르기)" : ""}`, {
          fontFamily: FONT, fontSize: "15px", color: "#ffffff",
        });
      panel.add(title);
      const what = this.add.text(left + 20, y + 24, c.what, {
        fontFamily: FONT, fontSize: "11px", color: "#9fb3d8",
        wordWrap: { width: panelW - 44 },
      });
      // 줄이 길면 한 줄만 보이게 자른다(행 높이를 넘기지 않게).
      what.setFixedSize(panelW - 44, Math.max(12, rowH - 32));
      panel.add(what);
      this.checkRows.push(title);

      bg.on("pointerover", () => { this.checkIdx = i; this.highlight(); });
      bg.on("pointerdown", () => this.runCheck(date, i));
    });

    this.highlight();

    // 키보드: ↑↓ 커서 · Enter 실행 (숫자·알파벳은 왼쪽 씬 바로가기가 쓴다)
    const kb = this.input.keyboard!;
    kb.removeListener("keydown-UP");
    kb.removeListener("keydown-DOWN");
    kb.removeListener("keydown-ENTER");
    kb.on("keydown-UP", () => { this.checkIdx = (this.checkIdx - 1 + list.length) % list.length; this.highlight(); });
    kb.on("keydown-DOWN", () => { this.checkIdx = (this.checkIdx + 1) % list.length; this.highlight(); });
    kb.on("keydown-ENTER", () => this.runCheck(date, this.checkIdx));
  }

  private highlight(): void {
    this.checkRows.forEach((t, i) => t.setColor(i === this.checkIdx ? "#ffe27a" : "#ffffff"));
  }

  // 확인 항목 실행. 기술을 고르는 항목이면 먼저 고르기 오버레이를 띄운다.
  private runCheck(date: string, idx: number): void {
    const c = checksOfDate(date)[idx];
    if (!c) return;
    this.checkIdx = idx;
    if (c.pickMove) { void this.openMovePicker(date, idx); return; }
    startDebugCheck(this, date, idx);
  }

  // ── 기술 고르기 오버레이 (애니가 있는 기술만) ──────────────
  private async openMovePicker(date: string, idx: number): Promise<void> {
    const { width, height } = this.scale;
    const FONT = "Galmuri11";
    const [index] = await Promise.all([loadAnimIndex(), loadArDb()]);
    const ids = Object.keys(index?.moves ?? {}).sort();
    if (!ids.length) { startDebugCheck(this, date, idx); return; }   // 데이터가 없으면 기본 기술로 그냥 재생

    this.pickerOpen = true;
    const layer = this.add.container(0, 0).setDepth(1000);
    layer.add(this.add.rectangle(0, 0, width, height, 0x080c16, 0.97).setOrigin(0, 0)
      .setInteractive());   // 뒤쪽 버튼이 눌리지 않게 막는다

    let byAlly = true;
    let page = 0;
    const COLS = 5, ROWS = 9, PER = COLS * ROWS;
    const pages = Math.ceil(ids.length / PER);
    const gridTop = height * 0.28;
    const cellW = (width * 0.92) / COLS;
    const cellH = Math.min(28, (height * 0.58) / ROWS);
    let cells: Phaser.GameObjects.GameObject[] = [];

    const title = this.add.text(width / 2, height * 0.06,
      `기술 애니 재생 — 기술을 고르시오 (애니 있는 기술 ${ids.length}개)`, {
        fontFamily: FONT, fontSize: "20px", color: "#ffe27a",
      }).setOrigin(0.5);
    layer.add(title);

    const sideTxt = this.add.text(width / 2, height * 0.115, "", {
      fontFamily: FONT, fontSize: "15px", color: "#ffffff",
      backgroundColor: "#2a3550", padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const refreshSide = () => sideTxt.setText(`쓰는 쪽: ${byAlly ? "내 포켓몬" : "상대"}  ▶ 클릭해 전환`);
    refreshSide();
    sideTxt.on("pointerdown", () => { byAlly = !byAlly; refreshSide(); });
    layer.add(sideTxt);

    const pageTxt = this.add.text(width / 2, height * 0.90, "", {
      fontFamily: FONT, fontSize: "15px", color: "#9fb3d8",
    }).setOrigin(0.5);
    layer.add(pageTxt);
    layer.add(this.add.text(width / 2, height * 0.945,
      "← → 페이지 · 위 글자를 눌러 그 알파벳으로 점프 · ESC 취소", {
        fontFamily: FONT, fontSize: "13px", color: "#6f83a8",
      }).setOrigin(0.5));

    const pick = (id: string) => {
      this.pickerOpen = false;
      layer.destroy();
      startDebugCheck(this, date, idx, { demoMove: id, demoByAlly: byAlly });
    };

    const drawPage = () => {
      cells.forEach((c) => c.destroy());
      cells = [];
      const start = page * PER;
      ids.slice(start, start + PER).forEach((id, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = width * 0.04 + col * cellW;
        const y = gridTop + row * cellH;
        const name = getMove(id)?.name;
        const t = this.add.text(x, y, name ? `${name}` : id, {
          fontFamily: FONT, fontSize: "13px", color: "#ffffff",
          backgroundColor: "#21314f", padding: { x: 6, y: 3 },
          fixedWidth: cellW - 8,
        }).setInteractive({ useHandCursor: true });
        t.on("pointerover", () => { t.setColor("#ffe27a"); t.setText(id); });
        t.on("pointerout", () => { t.setColor("#ffffff"); t.setText(name ?? id); });
        t.on("pointerdown", () => pick(id));
        layer.add(t);
        cells.push(t);
      });
      pageTxt.setText(`${page + 1} / ${pages} 페이지   (${ids[start]} ~ ${ids[Math.min(start + PER, ids.length) - 1]})`);
    };

    // 알파벳 점프 줄 — 859개를 페이지로만 넘기면 못 찾는다.
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const lw = (width * 0.9) / letters.length;
    letters.forEach((ch, i) => {
      const t = this.add.text(width * 0.05 + i * lw, height * 0.19, ch, {
        fontFamily: FONT, fontSize: "14px", color: "#cfe0ff",
        backgroundColor: "#26365a", padding: { x: 5, y: 3 },
      }).setInteractive({ useHandCursor: true });
      t.on("pointerdown", () => {
        const at = ids.findIndex((id) => id.startsWith(ch));
        if (at >= 0) { page = Math.floor(at / PER); drawPage(); }
      });
      layer.add(t);
    });

    // 자주 쓰는 기술 빠른 버튼(일지에서 눈으로 확인한 것들)
    const presets = ["EMBER", "THUNDERSHOCK", "SCRATCH", "TACKLE", "EARTHQUAKE", "GROWL"];
    let px = width * 0.05;
    presets.filter((p) => ids.includes(p)).forEach((id) => {
      const t = this.add.text(px, height * 0.15, `${getMove(id)?.name ?? id}`, {
        fontFamily: FONT, fontSize: "13px", color: "#9ff5a8",
        backgroundColor: "#1d3a2a", padding: { x: 8, y: 3 },
      }).setInteractive({ useHandCursor: true });
      t.on("pointerdown", () => pick(id));
      layer.add(t);
      px += t.width + 6;
    });

    drawPage();

    const kb = this.input.keyboard!;
    const onLeft = () => { page = (page - 1 + pages) % pages; drawPage(); };
    const onRight = () => { page = (page + 1) % pages; drawPage(); };
    const onEsc = () => { close(); };
    const close = () => {
      this.pickerOpen = false;
      kb.off("keydown-LEFT", onLeft); kb.off("keydown-RIGHT", onRight); kb.off("keydown-ESC", onEsc);
      layer.destroy();
    };
    kb.on("keydown-LEFT", onLeft);
    kb.on("keydown-RIGHT", onRight);
    kb.on("keydown-ESC", onEsc);
  }
}
