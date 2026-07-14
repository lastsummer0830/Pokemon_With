import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createFromSpecies, Pokemon } from "../data/Pokemon";
import { markOwn, markSeen } from "../data/Pokedex";
import { START_BAG, START_MONEY } from "../systems/save";

// 개발용 — 씬 바로가기 메뉴. 타이틀에서 D 키로 진입.
// 매번 처음부터(타이틀→인트로→…) 안 거치고 원하는 화면을 바로 확인하기 위함.
// 테스트용 이름/성별을 자동으로 채워서 어느 씬이든 바로 뜬다.
export default class DebugMenuScene extends Phaser.Scene {
  private gender: Gender = "boy";

  constructor() {
    super("DebugMenuScene");
  }

  create(): void {
    const { width, height } = this.scale;
    const FONT = "Galmuri11";

    this.add.rectangle(0, 0, width, height, 0x10141e, 1).setOrigin(0, 0);
    this.add.text(width / 2, height * 0.1, "🔧 디버그 — 씬 바로가기", {
      fontFamily: FONT, fontSize: "30px", color: "#ffe27a",
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.16, "원하는 화면을 눌러 바로 이동 (숫자키도 가능 · ESC=타이틀)", {
      fontFamily: FONT, fontSize: "16px", color: "#9fb3d8",
    }).setOrigin(0.5);

    // 성별 토글(테스트용)
    const genderTxt = this.add.text(width / 2, height * 0.24, "", {
      fontFamily: FONT, fontSize: "20px", color: "#ffffff",
      backgroundColor: "#2a3550", padding: { x: 14, y: 8 },
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
      ["5. 마을(World)", "WorldScene"],
      // 야생 데모 = 풀숲 조우 → 배경도 풀숲(route). 도시 배경(town)은 마을에서 싸울 때만.
      ["6. 배틀(Battle) - 야생 데모", "BattleScene", { wild: true, testParty: true, backdrop: "route" }],
      // 집 꾸미기는 별도 화면이 아니라 '내 방(2F)에서 F키'로 한다 → 침실로 바로 보낸다(테스트 파티 포함).
      ["7. 집 꾸미기(내 방 2F에서 F키)", "InteriorScene", { room: "bedroom", skipIntro: true, testParty: true }],
      ["8. 시작 집 - 침실 바로가기(skip)", "InteriorScene", { room: "bedroom", skipIntro: true }],
      ["9. 포켓몬 연구소(스타팅 선택)", "LabScene"],
      ["0. 인게임 메뉴(파티/가방/저장)", "__MENU__"],
      // 바로가기(클릭) — 색(look)은 버터 크림으로 확정됐다(시안 A~C 분기는 제거).
      ["가방", "BagScene", { testParty: true }],
      ["도감", "PokedexScene", { testParty: true }],
    ];
    const go = (key: string, data?: object) => {
      // 테스트용 기본값 — 인트로를 건너뛰어도 씬이 동작하도록
      if (!this.registry.get("playerName")) this.registry.set("playerName", "테스트");
      this.registry.set("playerGender", this.gender);
      // 집 꾸미기 확인용: 타입별 효과(불꽃/물/풀)를 바로 보려면 파티가 있어야 한다.
      if ((data as { testParty?: boolean } | undefined)?.testParty) {
        const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
        if (!party.length) this.registry.set("playerParty", [
          createFromSpecies("CHARMANDER", 5), createFromSpecies("SQUIRTLE", 5), createFromSpecies("BULBASAUR", 5),
        ]);
      }
      // 가방·도감·배틀을 바로 볼 땐 가방 내용물·소지금·도감 기록이 있어야 화면이 채워진다.
      //  (배틀에서 '가방'을 눌렀을 때 쓸 게 없어 "닫는다"만 뜨던 문제 — 실게임은 IntroScene이 START_BAG을 넣어준다.)
      if (key === "BagScene" || key === "PokedexScene" || key === "BattleScene") {
        if (!this.registry.get("money")) this.registry.set("money", START_MONEY);
        if (!(this.registry.get("bag") as unknown[])?.length)
          this.registry.set("bag", [...START_BAG, { itemId: "SUPERPOTION", count: 2 }, { itemId: "ANTIDOTE", count: 1 },
            { itemId: "GREATBALL", count: 3 }, { itemId: "REVIVE", count: 1 }]);
        if (!(this.registry.get("dexSeen") as unknown[])?.length) {
          // 초반 진행 느낌으로: 스타터 3종은 잡았고, 1번도로 야생 몇 종은 본 상태
          for (const id of ["CHARMANDER", "SQUIRTLE", "BULBASAUR"]) markOwn(this.registry, id);
          for (const id of ["PIDGEY", "RATTATA", "CATERPIE", "WEEDLE", "SPEAROW"]) markSeen(this.registry, id);
        }
      }
      if (key === "__MENU__") {
        // 인게임 메뉴 확인용: 테스트 파티가 없으면 채워넣고 메뉴 오버레이를 띄운다.
        const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
        if (!party.length) this.registry.set("playerParty", [
          createFromSpecies("CHARMANDER", 5), createFromSpecies("PIDGEY", 3),
          createFromSpecies("BULBASAUR", 5), createFromSpecies("SQUIRTLE", 4),
          createFromSpecies("RATTATA", 2), createFromSpecies("CATERPIE", 3),
        ]); // 파티 UI(2열×3행 6칸) 레이아웃 검증용 풀 파티
        // 마을(WorldScene)을 띄운 뒤 그 위에 메뉴 오버레이를 연다(검은 배경 방지 — 실제 게임과 동일).
        this.scene.start("WorldScene", { openMenu: true });
        return;
      }
      this.scene.start(key, data);
    };

    const keyNames = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
    // 항목 수에 맞춰 자동으로 화면 안에 다 들어오게(캔버스라 스크롤 없음).
    const startY = height * 0.30;
    const gap = Math.min(height * 0.07, (height * 0.66) / scenes.length);
    const fs = `${Math.max(16, Math.min(22, Math.round(gap * 0.42)))}px`;
    const padY = Math.max(5, Math.round(gap * 0.14));
    scenes.forEach(([label, key, data], i) => {
      const t = this.add.text(width / 2, startY + i * gap, label, {
        fontFamily: FONT, fontSize: fs, color: "#ffffff",
        backgroundColor: "#21314f", padding: { x: 18, y: padY },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#ffe27a"));
      t.on("pointerout", () => t.setColor("#ffffff"));
      t.on("pointerdown", () => go(key, data));
      if (keyNames[i]) this.input.keyboard!.on(`keydown-${keyNames[i]}`, () => go(key, data));
    });

    this.input.keyboard!.once("keydown-ESC", () => this.scene.start("TitleScene"));
  }
}
