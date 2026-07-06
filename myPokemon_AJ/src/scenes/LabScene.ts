import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createPokemon, Pokemon } from "../data/Pokemon";
import { frontPath } from "../game/pokemonSprite";
import DialogBox from "../ui/DialogBox";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";

// 포켓몬 연구소(오박사 랩) — 어나더레드 실제 내부맵(Map157) 추출본.
//  실제 FRLG/AR 스타팅 방식: 탁자 위에 "포켓볼 3개"가 놓여 있고, 플레이어가 포켓볼 하나 앞에 서서
//  A(Space)를 누르면 → 액자 프레임에 그 포켓몬 정지스프라이트가 뜨고 하단 대화창 "○○은 불꽃포켓몬
//  파이리로 하는 거니? 예/아니오". (커서로 훑는 게 아니라 포켓볼별 개별 선택 — 원작 그대로)
type Dir = "down" | "left" | "right" | "up";
type FrameStyle = "cream" | "lavender" | "card";
interface LabMap { img: string; cols: number; rows: number; blocked: number[][]; spawn: [number, number]; exit: { x: number; y: number; toTown: [number, number] }; }
interface PreviewData { preview?: FrameStyle; pick?: number; }

interface StarterDef { key: string; name: string; type: string; id: number; category: string; dex: string; }
// 분류·도감 = PokeAPI/공식 SV 도감에서 받은 한국어 원문(추측 아님).
const STARTERS: StarterDef[] = [
  { key: "SPRIGATITO", name: "나오하",  type: "풀",   id: 906, category: "풀고양이포켓몬",
    dex: "몸에서 나오는 달콤한 향기로 주위를 매료시킨다. 햇빛에 닿으면 향기가 더욱 강해진다." },
  { key: "CHARMANDER", name: "파이리",  type: "불꽃", id: 4,   category: "도롱뇽포켓몬",
    dex: "태어날 때부터 꼬리의 불꽃이 타오르고 있다. 불꽃이 꺼지면 그 생명이 다하고 만다." },
  { key: "FROAKIE",    name: "개구마르", type: "물",   id: 656, category: "거품개구리포켓몬",
    dex: "가슴과 등에서 거품을 내뿜는다. 탄력 있는 거품으로 공격을 막아내고 데미지를 줄인다." },
];

const OAK_TILE: [number, number] = [8, 3];      // 스타팅 탁자 바로 뒤(중앙)
const NEMONA_TILE: [number, number] = [11, 3];
// 초록 탁자 = 칸 (8,4)(9,4)(10,4). 그 위에 포켓볼 3개를 올림. 플레이어는 (8,5)(9,5)(10,5)에서 위 보고 선택.
const BALL_TILES: [number, number][] = [[8, 4], [9, 4], [10, 4]];
const BALL_TOP = 0.62;   // 포켓볼 발 위치(칸 세로비율) — 초록 상판에 얹히도록

export default class LabScene extends Phaser.Scene {
  private map!: LabMap;
  private mapImg!: Phaser.GameObjects.Image;
  private oak!: Phaser.GameObjects.Sprite;
  private nemona!: Phaser.GameObjects.Sprite;
  private balls: Phaser.GameObjects.Sprite[] = [];

  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gender: Gender = "boy";
  private readonly texKey = "hero_lab";
  private idleFrame: Record<Dir, number> = { down: 0, left: 4, right: 8, up: 12 };
  private facing: Dir = "up";
  private tx = 6; private ty = 12;
  private moving = false; private busy = false;
  private chosen = false;

  private zoom = 1; private origin = { x: 0, y: 0 }; private tile = 32;
  private dlg!: DialogBox;
  private hint!: Phaser.GameObjects.Text;

  // 선택 액자(프레임 + 정지 스프라이트)
  private frameStyle: FrameStyle = "card";   // 인트로 성별카드와 통일된 크림 카드(사용자 선택)
  private winG!: Phaser.GameObjects.Graphics;
  private winSpr!: Phaser.GameObjects.Sprite;
  private winOpen = false;

  private previewData: PreviewData = {};

  constructor() { super("LabScene"); }
  private playerName(): string { return (this.registry.get("playerName") as string) ?? "너"; }

  init(data: PreviewData): void { this.previewData = data ?? {}; }

  preload(): void {
    this.gender = (this.registry.get("playerGender") as Gender) ?? "boy";
    const v = "?v=" + Date.now();
    // ⚠️ Phaser는 같은 키가 캐시에 있으면 다시 안 받는다 → 맵/충돌 갱신이 반영되게 먼저 제거(재입장 시 최신 격자).
    this.cache.json.remove("lab_col");
    if (this.textures.exists("lab_map")) this.textures.remove("lab_map");
    this.load.image("lab_map", "assets/world/oak_lab.png" + v);
    this.load.json("lab_col", "assets/world/oak_lab.json" + v);
    this.load.spritesheet("oak", "assets/characters/trainer_PROFESSOR.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("obj_ball", "assets/characters/Object ball.png", { frameWidth: 32, frameHeight: 32 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    preloadCommonAudio(this);
    this.load.audio(BGM.lab, "assets/audio/bgm_lab.ogg"); // 연구소 전용 BGM(AR Lab 테마)
    for (const s of STARTERS) this.load.image(s.key, frontPath(s.key));
  }

  create(): void {
    this.map = this.cache.json.get("lab_col") as LabMap;
    this.tx = this.map.spawn[0]; this.ty = this.map.spawn[1]; this.facing = "up";
    if (this.previewData.preview) this.frameStyle = this.previewData.preview;

    for (const k of ["lab_map", "oak", "nemona_ow", "obj_ball", this.texKey, ...STARTERS.map(s => s.key)])
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    playBgm(this, BGM.lab, 0.4); // 연구소 BGM — AR Map157의 실제 곡 'Lab'
    this.mapImg = this.add.image(0, 0, "lab_map").setOrigin(0, 0).setDepth(0);
    const mk = (key: string, frames: number[]) =>
      this.anims.create({ key: `lab-${key}`, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mk("down", [0, 1, 2, 3]); mk("left", [4, 5, 6, 7]); mk("right", [8, 9, 10, 11]); mk("up", [12, 13, 14, 15]);

    this.oak = this.add.sprite(0, 0, "oak", 0).setOrigin(0.5, 1).setDepth(4);
    this.nemona = this.add.sprite(0, 0, "nemona_ow", 0).setOrigin(0.5, 1).setDepth(4);
    // 탁자 위 포켓볼 3개(닫힌 볼 = obj_ball 프레임 0)
    this.balls = BALL_TILES.map(() => this.add.sprite(0, 0, "obj_ball", 0).setOrigin(0.5, 1).setDepth(3));
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1).setDepth(7);

    // 선택 액자
    this.winG = this.add.graphics().setScrollFactor(0).setDepth(1010).setVisible(false);
    this.winSpr = this.add.sprite(0, 0, "SPRIGATITO", 0).setScrollFactor(0).setDepth(1011).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.dlg = new DialogBox(this);
    this.hint = this.add.text(12, 12, "", {
      fontFamily: "Galmuri11, sans-serif", fontSize: "15px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100).setVisible(false);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off("resize", this.layout, this); this.dlg.destroy(); });

    this.input.keyboard!.on("keydown-SPACE", this.onKey, this);
    this.input.keyboard!.on("keydown-ENTER", this.onKey, this);
    this.input.keyboard!.on("keydown-Z", this.onKey, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // 프리뷰 모드(playwright 렌더용): 인트로 건너뜀. pick>=0이면 선택창 바로 띄움(pick<0이면 맵만).
    if (this.previewData.preview) {
      const i = this.previewData.pick ?? 1;
      if (i >= 0) this.time.delayedCall(120, () => this.openWindow(i));
      return;
    }
    this.runIntro();
  }

  // Front 애니 시트(가로로 긴 5088px 등)를 GL에 그대로 올리면 WebGL 최대 텍스처폭(≈4096) 초과로
  //  텍스처가 뭉개진다(나오하 스머지 버그). → frame0만 잘라 새 텍스처로 등록해 사용.
  // ⚠️ 캔버스 텍스처(addCanvas)는 WebGL에서 setFilter(NEAREST)가 잘 안 먹혀 업스케일 시 흐려진다.
  //   → 캔버스 안에서 미리 정수배(UP)로 nearest 확대해 고해상도로 구운 뒤, 표시 땐 항상 축소만 하게 한다(또렷).
  private static readonly STILL_UP = 6;
  private ensureStill(key: string): string {
    const stillKey = key + "__still";
    if (this.textures.exists(stillKey)) return stillKey;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const fh = src.height;
    const UP = LabScene.STILL_UP;
    const cvs = document.createElement("canvas"); cvs.width = fh * UP; cvs.height = fh * UP;
    const ctx = cvs.getContext("2d")!; ctx.imageSmoothingEnabled = false;   // 픽셀 보존(계단식 확대)
    ctx.drawImage(src, 0, 0, fh, fh, 0, 0, fh * UP, fh * UP);   // 프레임0(왼쪽 정사각)을 UP배로 nearest 확대
    this.textures.addCanvas(stillKey, cvs);
    this.textures.get(stillKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return stillKey;
  }

  // 포켓몬 Front 스프라이트 실제 내용 세로경계 측정(정지컷 크기/위치 정규화)
  private frontMetrics(key: string): { frameH: number; frameW: number; top: number; bottom: number } {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const cvs = document.createElement("canvas"); cvs.width = src.height; cvs.height = src.height;   // 프레임 0(정사각)만
    const ctx = cvs.getContext("2d")!; ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, src.height, src.height).data;
    let top = src.height, bottom = 0;
    for (let y = 0; y < src.height; y++) {
      let op = false;
      for (let x = 0; x < src.height; x += 2) if (d[(y * src.height + x) * 4 + 3] > 20) { op = true; break; }
      if (op) { if (y < top) top = y; if (y > bottom) bottom = y; }
    }
    if (bottom < top) { top = 0; bottom = src.height - 1; }
    return { frameH: src.height, frameW: src.height, top, bottom };
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    const src = this.textures.get("lab_map").getSourceImage();
    this.zoom = Math.min((W * 0.98) / src.width, (H * 0.92) / src.height);
    const w = src.width * this.zoom, h = src.height * this.zoom;
    this.origin = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
    this.tile = 32 * this.zoom;
    this.mapImg.setPosition(this.origin.x, this.origin.y).setScale(this.zoom);
    this.oak.setPosition(this.cx(OAK_TILE[0]), this.cy(OAK_TILE[1])).setScale(this.zoom * 0.92);
    this.nemona.setPosition(this.cx(NEMONA_TILE[0]), this.cy(NEMONA_TILE[1])).setScale(this.zoom * 0.92);
    // 포켓볼: 탁자 칸 가로중앙, 초록 상판 위(BALL_TOP)에 발을 얹음
    this.balls.forEach((b, i) => {
      const [bx, by] = BALL_TILES[i];
      b.setPosition(this.origin.x + (bx + 0.5) * this.tile, this.origin.y + (by + BALL_TOP) * this.tile)
        .setScale(this.zoom * 0.95);
    });
    this.player.setPosition(this.cx(this.tx), this.cy(this.ty)).setScale(this.zoom * 0.92);
    this.dlg.layout();
    if (this.winOpen) this.drawWindow();
  }

  private cx(tx: number): number { return this.origin.x + (tx + 0.5) * this.tile; }
  private cy(ty: number): number { return this.origin.y + (ty + 1) * this.tile; }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.cols || ty >= this.map.rows) return false;
    if (this.map.blocked[ty][tx] !== 0) return false;
    if (tx === OAK_TILE[0] && ty === OAK_TILE[1]) return false;
    if (tx === NEMONA_TILE[0] && ty === NEMONA_TILE[1]) return false;
    return true;
  }

  update(): void {
    if (this.busy || this.moving || this.winOpen) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown) { dx = -1; this.facing = "left"; }
    else if (this.cursors.right.isDown) { dx = 1; this.facing = "right"; }
    else if (this.cursors.up.isDown) { dy = -1; this.facing = "up"; }
    else if (this.cursors.down.isDown) { dy = 1; this.facing = "down"; }
    else { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    if (this.ty === this.map.spawn[1] && this.tx === this.map.spawn[0] && this.facing === "down") { this.tryExit(); return; }
    const ntx = this.tx + dx, nty = this.ty + dy;
    if (!this.walkable(ntx, nty)) { this.player.stop(); this.player.setFrame(this.idleFrame[this.facing]); return; }

    this.moving = true;
    this.player.play(`lab-${this.facing}`, true);
    this.tweens.add({ targets: this.player, x: this.cx(ntx), y: this.cy(nty), duration: 150, onComplete: () => { this.tx = ntx; this.ty = nty; this.moving = false; } });
  }

  // 앞칸 상호작용: 포켓볼이면 그 포켓몬 선택창, 오박사면 안내.
  private onKey(): void {
    if (this.busy || this.winOpen) return;
    const d: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const fx = this.tx + d[this.facing][0], fy = this.ty + d[this.facing][1];
    const bi = BALL_TILES.findIndex(t => t[0] === fx && t[1] === fy);
    if (bi >= 0 && !this.chosen) { this.openWindow(bi); return; }
    if (fx === OAK_TILE[0] && fy === OAK_TILE[1]) {
      this.busy = true;
      const msg = this.chosen ? "좋은 파트너를 골랐구나. 아래 문으로 나가 모험을 시작하렴!" : "탁자 위 세 포켓볼 중에서 마음에 드는 녀석을 골라보렴.";
      this.dlg.say(msg, "오박사").then(() => { this.dlg.hide(); this.busy = false; });
    }
  }

  // 한국어 조사 자동선택: 마지막 글자 받침 유무로 고른다. kind 문자열은 [받침있음, 받침없음] 순서.
  private josa(word: string, kind: "은는" | "이가" | "을를" | "과와" | "로"): string {
    const ch = word.charCodeAt(word.length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return kind === "로" ? "로" : kind[1];   // 한글 아니면 무난하게
    const jong = (ch - 0xac00) % 28;
    const hasJong = jong !== 0;
    if (kind === "로") return !hasJong || jong === 8 ? "로" : "으로";          // 받침없음/ㄹ받침 → 로
    return hasJong ? kind[0] : kind[1];
  }

  // ── 선택 액자: 정지 스프라이트 + 프레임, 공식 도감 → 오박사 확인 → 별명 ──
  private async openWindow(i: number): Promise<void> {
    const pick = STARTERS[i];
    this.busy = true; this.winOpen = true;
    this.winSpr.setTexture(this.ensureStill(pick.key));   // 정지컷(프레임0) 전용 소형 텍스처
    this.drawWindow();
    this.winG.setVisible(true); this.winSpr.setVisible(true);

    const you = this.playerName();
    // 1) 공식 도감 소개(나레이션 — 이름창 없음)
    await this.dlg.say(`${pick.name}. ${pick.type}타입, ${pick.category}.`);
    await this.dlg.say(pick.dex);
    // 2) 오박사 확인
    await this.dlg.say(`오, ${you}${this.josa(you, "은는")} ${pick.name}${this.josa(pick.name, "이가")} 마음에 드는 거니?`, "오박사");
    if (!(await this.dlg.askYesNo())) { await this.dlg.say("그래, 천천히 골라보렴.", "오박사"); this.closeWindow(); this.dlg.hide(); this.busy = false; return; }
    // 3) 별명 지어주기
    await this.dlg.say(`그래! 그럼 ${pick.name}에게 별명을 지어주겠니?`, "오박사");
    let nickname: string | undefined;
    if (await this.dlg.askYesNo()) nickname = await this.askNickname(pick.name);

    const mon: Pokemon = createPokemon(pick.name, pick.type); mon.id = pick.id;
    if (nickname) mon.nickname = nickname;
    const party = (this.registry.get("playerParty") as Pokemon[]) ?? [];
    party.push(mon); this.registry.set("playerParty", party); this.registry.set("starterChosen", pick.key);
    this.chosen = true;
    playSfx(this, SFX.pkmnGet, 0.6); // 포켓몬 획득 팡파레
    // 고른 포켓볼은 탁자에서 사라짐(플레이어가 가져감)
    this.tweens.add({ targets: this.balls[i], alpha: 0, duration: 250, onComplete: () => this.balls[i].setVisible(false) });
    this.closeWindow();

    const disp = nickname ?? pick.name;
    if (nickname) await this.dlg.say(`${nickname}! 좋은 이름이구나.`, "오박사");
    await this.dlg.say(`${disp}${this.josa(disp, "과와")} 함께 좋은 여행이 되길 바란다!`, "오박사");
    await this.dlg.say(`좋았어, 결정했구나! ${you}, 이제 우린 라이벌이야.`, "네모");
    await this.dlg.say("언젠가 서로 전력을 다해 부딪히는 최고의 배틀 — 꼭 하자! 약속이야!", "네모");
    this.dlg.hide();
    this.hint.setText("아래 문으로 나가 마을로!").setVisible(true);
    this.busy = false;
  }

  // 별명 입력 — 인트로 이름입력과 동일한 한글 IME용 HTML <input>. 빈칸이면 별명 없음(종족명 사용).
  private askNickname(species: string): Promise<string | undefined> {
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 8; input.value = "";
    input.setAttribute("autocomplete", "off");
    input.placeholder = species;
    Object.assign(input.style, {
      position: "fixed", left: "50%", top: "62%", transform: "translate(-50%,-50%)",
      width: "min(40vw, 300px)", padding: "10px 14px", textAlign: "center",
      fontFamily: "Galmuri11, monospace", fontSize: "24px", color: "#3a2a14",
      background: "#f3e4c8", border: "4px solid #c98a3c", borderRadius: "10px",
      outline: "none", zIndex: "9999", boxShadow: "0 6px 18px rgba(0,0,0,.25)",
    } as CSSStyleDeclaration);
    document.body.appendChild(input); input.focus();
    this.input.keyboard!.enabled = false;
    return new Promise((resolve) => {
      const submit = () => {
        const v = input.value.trim();
        input.remove(); this.input.keyboard!.enabled = true;
        resolve(v || undefined);
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); } });
    });
  }

  private closeWindow(): void {
    this.winOpen = false;
    this.winG.setVisible(false); this.winSpr.setVisible(false);
  }

  // 액자 그리기(스타일 2종) + 정지 스프라이트 배치
  private drawWindow(): void {
    const { width: W, height: H } = this.scale;
    const boxW = Math.min(W * 0.42, 360), boxH = boxW;               // 정사각 액자
    const bx = Math.round(W / 2 - boxW / 2);
    const by = Math.round(H * 0.30 - boxH / 2 + H * 0.06);           // 상단쪽(하단 대화창 위)
    const g = this.winG; g.clear();
    if (this.frameStyle === "lavender") {
      // Image #2 라벤더/보라 액자: 그림자 → 진보라 테두리 → 라벤더 → 밝은 내부
      g.fillStyle(0x000000, 0.30); g.fillRoundedRect(bx + 5, by + 7, boxW, boxH, 22);
      g.fillStyle(0x6f4d94, 1); g.fillRoundedRect(bx, by, boxW, boxH, 22);
      g.fillStyle(0xc9a9e6, 1); g.fillRoundedRect(bx + 7, by + 7, boxW - 14, boxH - 14, 17);
      g.fillStyle(0xf7f0fb, 1); g.fillRoundedRect(bx + 16, by + 16, boxW - 32, boxH - 32, 11);
    } else if (this.frameStyle === "card") {
      // 인트로 성별 선택 카드와 동일 팔레트: 황금브라운 테두리 + 따뜻한 크림 속
      g.fillStyle(0x000000, 0.30); g.fillRoundedRect(bx + 5, by + 7, boxW, boxH, 18);
      g.fillStyle(0xc98a3c, 1); g.fillRoundedRect(bx, by, boxW, boxH, 18);
      g.fillStyle(0xf3e4c8, 1); g.fillRoundedRect(bx + 10, by + 10, boxW - 20, boxH - 20, 12);
    } else {
      // 게임 통일 크림/남색 액자(DialogBox와 동일 팔레트)
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(bx + 5, by + 7, boxW, boxH, 20);
      g.fillStyle(0xf6efd8, 1); g.fillRoundedRect(bx, by, boxW, boxH, 20);
      g.fillStyle(0x21314f, 1); g.fillRoundedRect(bx + 6, by + 6, boxW - 12, boxH - 12, 15);
      g.lineStyle(2, 0x4a6aa5, 0.85); g.strokeRoundedRect(bx + 11, by + 11, boxW - 22, boxH - 22, 12);
    }
    // 정지 스프라이트: 내용 세로경계 기준으로 액자 안에 꽉 차게 중앙 배치
    const key = this.winSpr.texture.key;
    const m = this.frontMetrics(key);
    const inner = boxW - 64;
    const sc = inner / Math.max(1, m.bottom - m.top);
    this.winSpr.setScale(sc);
    const contentCx = m.frameW / 2, contentCy = (m.top + m.bottom) / 2;
    this.winSpr.setPosition(bx + boxW / 2 + (m.frameW / 2 - contentCx) * sc, by + boxH / 2 + (m.frameH / 2 - contentCy) * sc);
  }

  private async runIntro(): Promise<void> {
    this.busy = true;
    const name = this.playerName();
    await this.wait(450);
    await this.dlg.say(`오, ${name}! 잘 왔다.`, "오박사");
    await this.dlg.say("탁자 위 세 포켓볼이 네 첫 파트너 후보란다.", "오박사");
    await this.dlg.say(`${name}! 나까지 두근거리잖아! 네가 고른 파트너랑 배틀할 생각에 벌써 신난다고!`, "네모");
    await this.dlg.say("마음에 드는 포켓볼 앞에 서서 살펴보렴.", "오박사");
    this.dlg.hide();
    this.hint.setText("방향키: 이동  |  포켓볼 앞에서 Space: 살펴보기  |  아래 문: 나가기").setVisible(true);
    this.busy = false;
  }

  private tryExit(): void {
    if (!this.chosen) {
      this.busy = true;
      const you = this.playerName();
      this.dlg.say(`${you}, 파트너 없이 나가기엔 위험하단다. 어서 파트너를 골라보렴.`, "오박사").then(() => { this.dlg.hide(); this.busy = false; });
      return;
    }
    this.busy = true; this.player.stop();
    playSfx(this, SFX.doorOut, 0.5);
    this.cameras.main.fadeOut(340, 0, 0, 0);
    const [tx, ty] = this.map.exit.toTown;
    this.time.delayedCall(360, () => this.scene.start("WorldScene", { spawn: [tx, ty], face: "down" }));
  }

  private wait(ms: number): Promise<void> { return new Promise((r) => this.time.delayedCall(ms, r)); }
}
