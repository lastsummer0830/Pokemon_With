import Phaser from "phaser";
import { Gender } from "../data/Player";
import { createFromSpecies, Pokemon } from "../data/Pokemon";
import { loadArDb } from "../data/ar";
import DialogBox from "../ui/DialogBox";
import { playBgm } from "../game/bgm";
import { playSfx, preloadCommonAudio, SFX, BGM } from "../game/sfx";

// 포켓몬 연구소(오박사 랩) — 어나더레드 실제 내부맵(Map157) 추출본.
//  실제 FRLG/AR 스타팅 방식: 탁자 위에 "포켓볼 3개"가 놓여 있고, 플레이어가 포켓볼 하나 앞에 서서
//  A(Space)를 누르면 → 액자 프레임에 그 포켓몬 정지스프라이트가 뜨고 하단 대화창 "○○은 불꽃포켓몬
//  파이리로 하는 거니? 예/아니오". (커서로 훑는 게 아니라 포켓볼별 개별 선택 — 원작 그대로)
type Dir = "down" | "left" | "right" | "up";
interface LabMap { img: string; cols: number; rows: number; blocked: number[][]; spawn: [number, number]; exit: { x: number; y: number; toTown: [number, number] }; }
interface PreviewData { preview?: boolean; pick?: number; }

interface StarterDef { key: string; name: string; type: string; id: number; category: string; height: string; weight: string; dex: string; }
// 타입 표준색 — 설명카드 타입칩 배경(관용 팔레트).
const TYPE_COLOR: Record<string, number> = { "풀": 0x78c850, "불꽃": 0xf08030, "물": 0x6890f0 };
// 분류·도감·키·무게 = PokeAPI/공식 SV 데이터 원문(추측 아님).
const STARTERS: StarterDef[] = [
  { key: "SPRIGATITO", name: "나오하",  type: "풀",   id: 906, category: "풀고양이포켓몬", height: "0.4m", weight: "4.1kg",
    dex: "몸에서 나오는 달콤한 향기로 주위를 매료시킨다. 햇빛에 닿으면 향기가 더욱 강해진다." },
  { key: "CHARMANDER", name: "파이리",  type: "불꽃", id: 4,   category: "도롱뇽포켓몬",   height: "0.6m", weight: "8.5kg",
    dex: "태어날 때부터 꼬리의 불꽃이 타오르고 있다. 불꽃이 꺼지면 그 생명이 다하고 만다." },
  { key: "FROAKIE",    name: "개구마르", type: "물",   id: 656, category: "거품개구리포켓몬", height: "0.3m", weight: "7.0kg",
    dex: "가슴과 등에서 거품을 내뿜는다. 탄력 있는 거품으로 공격을 막아내고 데미지를 줄인다." },
];

const OAK_TILE: [number, number] = [8, 3];      // 스타팅 탁자 바로 뒤(중앙)
const NEMONA_TILE: [number, number] = [11, 3];

// 라이벌(네모)은 내 스타터가 상성상 유리한 스타터를 고른다(SV 네모 방식 — 첫 배틀은 플레이어 우세).
//  풀(나오하) > 물(개구마르) > 불꽃(파이리) > 풀 …  즉 내가 고른 타입에 '약한' 스타터를 네모가 가진다.
function rivalCounter(myKey: string): string {
  const map: Record<string, string> = {
    SPRIGATITO: "FROAKIE",    // 내가 풀 → 네모는 물(내가 유리)
    CHARMANDER: "SPRIGATITO", // 내가 불꽃 → 네모는 풀
    FROAKIE: "CHARMANDER",    // 내가 물 → 네모는 불꽃
  };
  return map[myKey.toUpperCase()] ?? "CHARMANDER";
}
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

  // 선택 설명카드(크림 프레임 + 스프라이트 + 정보 텍스트)
  private winG!: Phaser.GameObjects.Graphics;
  private winSpr!: Phaser.GameObjects.Sprite;
  private winTexts: Phaser.GameObjects.Text[] = [];   // 카드 위 정보 텍스트(그릴 때마다 새로)
  private winOpen = false;
  private winSpecies = "";   // 현재 카드에 띄운 포켓몬(STARTERS의 key)

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
    this.load.spritesheet("oak_ow", "assets/characters/trainer_PROFESSOR.png", { frameWidth: 32, frameHeight: 48 }); // 키를 oak_ow로 — IntroScene의 큰 인물 이미지("oak")와 캐시 충돌 방지(안 그러면 연구소 오박사가 거인)
    this.load.spritesheet("nemona_ow", "assets/characters/trainer_NEMONA.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("obj_ball", "assets/characters/Object ball.png", { frameWidth: 32, frameHeight: 32 });
    const hero = this.gender === "girl" ? "assets/characters/trainer_DAWN.png" : "assets/characters/trainer_RED.png";
    this.load.spritesheet(this.texKey, hero, { frameWidth: 32, frameHeight: 48 });
    preloadCommonAudio(this);
    this.load.audio(BGM.lab, "assets/audio/bgm_lab.ogg"); // 연구소 전용 BGM(AR Lab 테마)
    // 카드용 스프라이트 = PokeRogue 정지컷(담백한 도트, 가만히 있는 포즈). AR 애니시트보다 카드에 적합.
    for (const s of STARTERS) this.load.image("card_" + s.key, "assets/pokemon/card/" + s.key + ".png" + v);
  }

  create(): void {
    this.map = this.cache.json.get("lab_col") as LabMap;
    this.tx = this.map.spawn[0]; this.ty = this.map.spawn[1]; this.facing = "up";

    for (const k of ["lab_map", "oak_ow", "nemona_ow", "obj_ball", this.texKey, ...STARTERS.map(s => "card_" + s.key)])
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor("#000000");

    playBgm(this, BGM.lab, 0.4); // 연구소 BGM — AR Map157의 실제 곡 'Lab'
    this.mapImg = this.add.image(0, 0, "lab_map").setOrigin(0, 0).setDepth(0);
    const mk = (key: string, frames: number[]) =>
      this.anims.create({ key: `lab-${key}`, frames: this.anims.generateFrameNumbers(this.texKey, { frames }), frameRate: 8, repeat: -1 });
    mk("down", [0, 1, 2, 3]); mk("left", [4, 5, 6, 7]); mk("right", [8, 9, 10, 11]); mk("up", [12, 13, 14, 15]);

    this.oak = this.add.sprite(0, 0, "oak_ow", 0).setOrigin(0.5, 1).setDepth(4);
    this.nemona = this.add.sprite(0, 0, "nemona_ow", 0).setOrigin(0.5, 1).setDepth(4);
    // 탁자 위 포켓볼 3개(닫힌 볼 = obj_ball 프레임 0)
    this.balls = BALL_TILES.map(() => this.add.sprite(0, 0, "obj_ball", 0).setOrigin(0.5, 1).setDepth(3));
    this.player = this.add.sprite(0, 0, this.texKey, this.idleFrame.up).setOrigin(0.5, 1).setDepth(7);

    // 선택 액자
    this.winG = this.add.graphics().setScrollFactor(0).setDepth(1010).setVisible(false);
    this.winSpr = this.add.sprite(0, 0, "card_SPRIGATITO", 0).setScrollFactor(0).setDepth(1011).setVisible(false);

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

  // 카드 스프라이트(PokeRogue 정지컷)를 dispPx 정사각 캔버스 중앙에 콘텐츠 꽉 차게 nearest로 구워 텍스처 키 반환.
  //  imageKey = preload에서 로드한 "card_<종족>". 이미 타이트 크롭된 소형 PNG라 안전(WebGL 폭 문제 없음).
  private bakeCardSprite(imageKey: string, dispPx: number): string {
    const key = `${imageKey}__bake${dispPx}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(imageKey).getSourceImage() as HTMLImageElement;
    const cw = src.width, ch = src.height, scale = dispPx / Math.max(cw, ch);
    const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
    const cvs = document.createElement("canvas"); cvs.width = dispPx; cvs.height = dispPx;
    const ctx = cvs.getContext("2d")!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, cw, ch, Math.round((dispPx - dw) / 2), Math.round((dispPx - dh) / 2), dw, dh);
    this.textures.addCanvas(key, cvs);
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  // 설명카드 위 텍스트 한 줄 추가(Galmuri11, 카드보다 위 depth). winTexts에 모아 닫을 때 정리.
  private cardText(x: number, y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, str, { fontFamily: "Galmuri11, sans-serif", ...style })
      .setScrollFactor(0).setDepth(1012);
    this.winTexts.push(t);
    return t;
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
    this.winSpecies = pick.key;   // 정지컷 텍스처는 drawWindow에서 '표시 크기'로 구워 얹는다
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

    // AR 종족 데이터로 실제 스탯·기술·속성을 갖춘 스타터를 만든다(예전 createPokemon 폴백=HP30·몸통박치기뿐이라 배틀 불가).
    await loadArDb();
    const mon: Pokemon = createFromSpecies(pick.key, 5); mon.id = pick.id;
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
    // 오박사 — 이 게임의 색(포켓몬을 소중히 대하면 컨디션·유대가 배틀로 이어진다)의 떡밥.
    await this.dlg.say(`한 가지만 기억하렴. ${disp}${this.josa(disp, "을를")} 진심으로 아껴주어야 한다.`, "오박사");
    await this.dlg.say("요즘 포켓몬은... 예전 같지 않아. 트레이너의 마음을 느끼고, 그만큼 배틀에서 응답해준단다.", "오박사");
    await this.dlg.say(`다행히 ${disp}${this.josa(disp, "은는")} 왠지 널 마음에 들어 하는 것 같구나. 좋은 인연이야.`, "오박사");
    // 네모 — 즉시 라이벌 배틀 도발(사용자 지시). "밖에서 기다린다" → 마을로 나가면 WorldScene에서 배틀 발동.
    await this.dlg.say(`좋았어, 결정했구나! ${you}, 이제 우린 라이벌이야.`, "네모");
    await this.dlg.say("그 파트너가 얼마나 굉장한지 당장 보고 싶어! 지금 바로 한 판 어때?", "네모");
    await this.dlg.say("밖에서 기다릴게 — 준비되면 마을로 나와!", "네모");
    this.dlg.hide();
    // 라이벌 배틀 예약: 상대는 내 스타터가 상성상 유리한 카운터 스타터(SV 네모 방식).
    this.registry.set("rivalBattlePending", true);
    this.registry.set("rivalEnemySpecies", rivalCounter(pick.key));
    this.hint.setText("아래 문으로 나가면 네모가 기다린다!").setVisible(true);
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
    this.winTexts.forEach(t => t.destroy()); this.winTexts = [];
  }

  // 설명카드(가로형 도감 엔트리): 크림 프레임 + 스프라이트(좌) + No/이름/타입/키·무게(우) + 분류·도감설명(하단 전폭)
  private drawWindow(): void {
    const { width: W, height: H } = this.scale;
    const g = this.winG; g.clear();
    this.winTexts.forEach(t => t.destroy()); this.winTexts = [];
    const d = STARTERS.find(s => s.key === this.winSpecies);
    if (!d) return;
    // 카드 팔레트(인트로 성별카드와 동일: 황금브라운 테두리 + 크림)
    const BORDER = 0xc98a3c, CREAM = 0xf3e4c8, DARK = "#3a2a14", SUB = "#7a5a2c", ACCENT = "#b5651d";
    const pad = 28, botH = 140;                                    // 넉넉한 여백 + 하단 설명영역
    // 하단 대화창(+이름표)과 겹치지 않게: 그 위 공간에 배치(DialogBox.layout()·applySpeaker와 동일 계산).
    const dh = Math.max(H * 0.22, 130);
    const dialogTop = H - dh - Math.max(H * 0.04, 18);
    const dlgFont = Math.max(18, Math.round(dh * 0.17));
    const plateH = Math.round(dlgFont * 1.7);                      // 이름표는 대화창 위로 이만큼 튀어나옴
    const bottomLimit = dialogTop - (plateH - 8) - 12;            // 이름표 위 12px 여유
    const topLimit = Math.max(H * 0.03, 20);
    const availH = bottomLimit - topLimit;                        // 카드가 쓸 수 있는 세로
    const cw = Math.min(W * 0.64, 660);
    const ch = Math.min(H * 0.80, 510, availH);                    // 공간 모자라면 자동 축소
    const cx = Math.round(W / 2 - cw / 2);
    const cy = Math.round(Math.max(topLimit, bottomLimit - ch));
    // 프레임(그림자 → 테두리 → 크림 속)
    g.fillStyle(0x000000, 0.30); g.fillRoundedRect(cx + 5, cy + 7, cw, ch, 20);
    g.fillStyle(BORDER, 1); g.fillRoundedRect(cx, cy, cw, ch, 20);
    g.fillStyle(CREAM, 1); g.fillRoundedRect(cx + 11, cy + 11, cw - 22, ch - 22, 13);
    // 스프라이트 박스(좌, 정사각) — 박스보다 스프라이트를 살짝 작게 얹어 여백 확보
    const sq = ch - pad - botH - 14;
    g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(cx + pad, cy + pad, sq, sq, 12);
    g.lineStyle(2, BORDER, 0.5); g.strokeRoundedRect(cx + pad, cy + pad, sq, sq, 12);
    this.winSpr.anims.stop();
    this.winSpr.setTexture(this.bakeCardSprite("card_" + d.key, Math.round(sq * 0.84))).setScale(1).setOrigin(0.5)
      .setPosition(Math.round(cx + pad + sq / 2), Math.round(cy + pad + sq / 2));
    // 우측 정보 열: No / 이름 / 타입칩 / 키·무게(넉넉한 간격)
    const rx = cx + pad + sq + 34;
    this.cardText(rx, cy + pad + 6, "No." + String(d.id).padStart(4, "0"), { fontSize: "20px", color: SUB });
    this.cardText(rx, cy + pad + 34, d.name, { fontStyle: "bold", fontSize: "38px", color: ACCENT });
    const pcx = rx + 46, pcy = cy + pad + 112, pw = 92, phh = 34, pr = phh / 2;
    const tcol = TYPE_COLOR[d.type] ?? 0x888888;
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(pcx - pw / 2 + 2, pcy - phh / 2 + 2, pw, phh, pr);
    g.fillStyle(tcol, 1); g.fillRoundedRect(pcx - pw / 2, pcy - phh / 2, pw, phh, pr);
    g.lineStyle(2, 0xffffff, 0.65); g.strokeRoundedRect(pcx - pw / 2, pcy - phh / 2, pw, phh, pr);
    this.cardText(pcx, pcy - 1, d.type, { fontStyle: "bold", fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    // 키/무게 미니 패널
    const my = cy + pad + 158, mw = cx + cw - pad - rx, mh = sq + cy + pad - my;
    g.fillStyle(0xffffff, 0.4); g.fillRoundedRect(rx, my, mw, mh, 10);
    g.lineStyle(2, BORDER, 0.4); g.strokeRoundedRect(rx, my, mw, mh, 10);
    this.cardText(rx + 16, my + mh / 2 - 30, "키", { fontSize: "18px", color: SUB });
    this.cardText(rx + mw - 16, my + mh / 2 - 32, d.height, { fontStyle: "bold", fontSize: "22px", color: DARK }).setOrigin(1, 0);
    this.cardText(rx + 16, my + mh / 2 + 6, "무게", { fontSize: "18px", color: SUB });
    this.cardText(rx + mw - 16, my + mh / 2 + 4, d.weight, { fontStyle: "bold", fontSize: "22px", color: DARK }).setOrigin(1, 0);
    // 하단 전폭: 분류 + 도감 설명(줄간격 넉넉)
    const by = cy + pad + sq + 16;
    g.lineStyle(2, BORDER, 0.55); g.beginPath(); g.moveTo(cx + pad, by); g.lineTo(cx + cw - pad, by); g.strokePath();
    this.cardText(cx + pad, by + 14, d.category, { fontStyle: "bold", fontSize: "21px", color: DARK });
    this.cardText(cx + pad, by + 46, d.dex, { fontSize: "20px", color: DARK, lineSpacing: 8, wordWrap: { width: cw - pad * 2 } });
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
