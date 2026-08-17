import Phaser from "phaser";
import DialogBox from "../ui/DialogBox";
import { addItem, POCKET_NAME } from "../data/Bag";
import { getItem } from "../data/ar";
import { josa } from "../data/josa";
import { playMe, playSfx, SFX, BGM } from "../game/sfx";
import { playBgm } from "../game/bgm";
import { setSelfSwitch, setArSwitch, arSwitchOn, dirFrame } from "./mapEvents";
import type { EventLine, EventPage, MapEvent } from "./mapEvents";

// 원본 맵 이벤트 한 페이지를 **실제로 실행**하는 곳 — 대사·선택지·아이템·효과음.
//
// 왜 씬 밖으로 뺐나 (2026-08-04):
//   원래 이 로직은 WorldScene 안에만 있었다. 그런데 상록시티 민가 4채(AR Map160~163)를 이식하면서
//   **실내 씬(BuildingScene)에서도 똑같은 원본 이벤트를 돌려야** 했다.
//   그림을 어디에 어떤 크기로 놓느냐는 씬마다 다르지만(야외는 카메라 추적, 실내는 중앙정렬),
//   "무슨 말을 하고 무엇을 주는가"는 원본이 정한 것 하나뿐이라 여기 한 곳에 둔다.

/** AR 효과음 이름 → 우리 오디오 키. 여기 없는 이름은 조용히 넘어간다(원본에만 있는 소리). */
const AR_SE: Record<string, string> = {
  PIKACHU: "cry_PIKACHU",   // 상록시티 민가3의 피카츄 울음(AR Audio/SE/PIKACHU.ogg 원본 그대로)
};

/**
 * AR BGM 이름 → 우리 곡 키. **여기 없는 이름은 아무 일도 하지 않는다**(원본에만 있는 곡).
 *
 * ⚠️ 없는 곡을 playBgm에 그냥 넘기면 안 된다 — playBgm은 캐시를 보기 **전에** 지금 곡을 끈다
 *    (bgm.ts) → 원본에만 있는 곡 하나 때문에 필드가 통째로 무음이 된다.
 */
const AR_BGM: Record<string, string> = {
  KM_Pallet: BGM.town,   // 태초마을 곡(우리 bgm_town)
};

/** 원본 BGM 볼륨(0~100)을 우리 필드 BGM 기준(WorldScene이 쓰는 0.35)으로 옮긴다. */
const FIELD_BGM_VOL = 0.35;

/** 원본 이벤트가 시키는 BGM 교체. 우리에게 없는 곡이면 **지금 곡을 그대로 둔다**. */
export function playArBgm(scene: Phaser.Scene, name: string, volume = 100): void {
  const key = AR_BGM[name];
  if (!key || !scene.cache.audio.exists(key)) return;
  playBgm(scene, key, FIELD_BGM_VOL * (volume / 100));
}

/** 효과음 파일 목록 — 씬 preload에서 함께 받아둔다(없으면 그냥 안 울린다). */
export const AR_SE_FILES: Record<string, string> = {
  cry_PIKACHU: "assets/audio/cry_PIKACHU.ogg",
};

export function preloadEventAudio(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(AR_SE_FILES))
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, path);
}

/**
 * 이벤트 그림 한 장을 스프라이트시트로 만들어 두고 그 키를 돌려준다(없으면 null).
 *
 * ⚠️ AR 캐릭터 시트는 **가로 4칸 × 세로 4칸**이 규칙인데 칸 크기는 파일마다 다르다
 *    (NPC 29는 48x48, 볼은 32x32, 열매나무는 32x64) → 그림을 받아 크기를 재서 잘라야 한다.
 * ⚠️ 같은 그림을 쓰는 이벤트가 여럿이면(볼 4개·열매나무 2그루) 동시에 만들다
 *    "Texture key already in use"가 난다 → 그림마다 **만드는 작업 하나**를 기억해 같이 기다린다.
 *    텍스처는 게임 전역이라 이 표도 모듈 전역이다.
 * ⚠️ 그림을 받는 도중에 씬이 꺼지면(워프·문·디버그 바로가기) 로더가 그 파일을 **취소한다** →
 *    COMPLETE가 영영 안 오고, 그 약속을 표에 남겨두면 **다음 씬이 죽은 약속을 물려받아** 계속 기다린다.
 *    (실제로 그랬다: 1번도로에 잠깐 들렀다 상록시티로 바로 가면 아일라 그림이 안 서고,
 *     그 그림을 기다리던 자동실행이 busy를 켠 채 멈춰 플레이어가 얼어붙었다.)
 *    → 씬이 꺼질 때 약속을 **풀어주고**, 아직 시트가 안 만들어졌으면 표에서 **그 자리에서 지운다**.
 */
const sheetJobs = new Map<string, Promise<void>>();

export async function loadEventSheet(scene: Phaser.Scene, gfx: string): Promise<string | null> {
  const sheetKey = `ev_${gfx}`;
  let job = sheetJobs.get(sheetKey);
  if (!job) {
    const owner = scene;
    const made = (): boolean => owner.textures.exists(sheetKey);
    // 표에서 지우는 일은 **동기로** 해야 한다 — scene.start는 같은 씬 인스턴스를 다시 쓰므로
    //  다음 create()가 이 자리를 지나기 전에 지워져 있어야 새로 받는다.
    const drop = (): void => { if (sheetJobs.get(sheetKey) === job && !made()) sheetJobs.delete(sheetKey); };
    job = (async () => {
      const imgKey = `evimg_${gfx}`;
      if (!owner.textures.exists(imgKey)) {
        await new Promise<void>((resolve) => {
          const done = (): void => {
            owner.load.off(Phaser.Loader.Events.COMPLETE, done);
            owner.events.off(Phaser.Scenes.Events.SHUTDOWN, done);
            owner.events.off(Phaser.Scenes.Events.DESTROY, done);
            resolve();
          };
          owner.load.image(imgKey, `assets/characters/${gfx}.png`);
          owner.load.once(Phaser.Loader.Events.COMPLETE, done);
          // 씬이 꺼지면 파일은 취소된다 — 그때도 반드시 풀어준다(안 풀면 기다리던 쪽이 영영 멈춘다).
          owner.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
          owner.events.once(Phaser.Scenes.Events.DESTROY, done);
          owner.load.start();
        });
      }
      if (!owner.textures.exists(sheetKey) && owner.textures.exists(imgKey)) {
        const src = owner.textures.get(imgKey).getSourceImage() as HTMLImageElement;
        owner.textures.addSpriteSheet(sheetKey, src, { frameWidth: src.width / 4, frameHeight: src.height / 4 });
      }
    })();
    sheetJobs.set(sheetKey, job);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, drop);
    scene.events.once(Phaser.Scenes.Events.DESTROY, drop);
    void job.then(drop, drop);
  }
  await job;
  if (!scene.textures.exists(sheetKey)) return null;
  scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return sheetKey;
}

/**
 * 이벤트 스프라이트에 **지금 보여야 할 모습**을 입힌다 — 정지 프레임이거나, 제자리 발동작(원본 step_anime).
 *
 * 시트는 가로 4칸(모습 변형) × 세로 4줄(방향). 제자리 발동작은 그 줄의 4칸을 도는 것이다.
 * 속도도 원본 값: `Game_Character#pattern_update_speed = move_time * 2`, 한 칸당 그 값의 1/4.
 * 걷기 속도(move_speed 3)면 move_time 0.25초 → 한 칸 0.125초 = **8fps**.
 *
 * ⚠️ 열매나무는 세로 4줄이 방향이 아니라 **성장 단계**다(시트 실측: 새싹→봉오리→꽃→열매).
 *    그래서 원본이 direction_fix로 방향을 잠가 뒀다 — 우리도 그 값(page.fixed)을 그대로 따른다.
 */
export function applyEventSprite(
  scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, sheetKey: string, page: EventPage, dir?: number,
): void {
  const base = dirFrame(dir ?? page.dir);
  if (!page.step) { sprite.stop(); sprite.setFrame(base); return; }
  const key = `evstep_${sheetKey}_${base}`;
  if (!scene.anims.exists(key)) {
    scene.anims.create({
      key, frameRate: 8, repeat: -1,
      frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [base, base + 1, base + 2, base + 3] }),
    });
  }
  sprite.play(key);
}

/**
 * 씬만 할 수 있는 컷신 동작(원본 자동실행 이벤트용). 씬이 넘겨주면 그 명령이 살아나고,
 * 안 넘기면 그 줄은 조용히 건너뛴다 — **실행기는 한 벌로 두고** 씬별 복사본을 만들지 않으려는 것이다.
 */
export interface EventHost {
  wait(frames: number): Promise<void>;          // 원본 'Wait'(프레임)
  /** 원본 '애니메이션 표시'(207). anim 3 = "!", 4 = "?". on = 띄울 대상(없으면 이 이벤트). */
  emote(ev: MapEvent, anim: number, on?: "player" | number): void;
  bgm(name: string, volume: number): void;      // 원본 BGM 교체
  move(ev: MapEvent, steps: string[]): Promise<void>;   // 원본 이동 루트(완료까지 기다림)
}

/** 한 페이지를 돌린 결과. */
export interface EventRunResult {
  /** 이벤트의 **모습이 바뀌었을 수 있다**(셀프스위치·전역 스위치가 켜져 다음 페이지로 넘어감) → 부르는 쪽이 다시 그린다. */
  changed: boolean;
  /**
   * 배틀 명령에서 **멈췄다**. 부르는 쪽이 그 배틀을 걸고, **이기고 돌아와** resumeAt부터 다시 부르면 이어진다.
   * (지면 원본대로 화이트아웃이라 여기로 돌아오지 않는다 → 셀프스위치가 안 켜져 재도전이 된다.)
   *
   * resumeAt은 **줄 번호의 경로**다 — `[3]`이면 본문 4번째 줄부터.
   * 조건분기 안에서 멈추면 `[분기줄, 갈래(0=then·1=else), 그 갈래의 줄]`이 된다(경호 = `[1, 0, 3]`).
   *
   * ⚠️ 갈래 번호를 **기록해 두는 것이 핵심**이다. 조건을 다시 보고 고르면, 배틀 사이에 스위치가
   *    달라졌을 때 엉뚱한 갈래의 그 번째 줄부터 돌거나(짧은 갈래면) 아무것도 안 돌고 조용히 끝난다
   *    — 이기고 왔는데 뒷대사도 안 나오고 스위치도 안 켜지는 상태가 된다.
   */
  battle?: { trainerId: string; resumeAt: number[] };
}

/** 배틀에서 멈춘 자리 — 안쪽에서 바깥으로 나오며 줄 번호를 앞에 붙여 경로를 만든다. */
interface BattleStop { trainerId: string; path: number[] }

/**
 * 이벤트 한 페이지를 위에서부터 실행한다.
 * @param opts.host    컷신 명령(대기·"!"·BGM·이동)을 실제로 해 줄 씬. 없으면 그 줄은 건너뛴다.
 * @param opts.startAt 이 줄부터 실행한다(배틀에서 이기고 돌아와 이어서 실행할 때).
 */
export async function runEventPage(
  scene: Phaser.Scene, dlg: DialogBox, map: string, ev: MapEvent, page: EventPage,
  opts?: { host?: EventHost; startAt?: number[] },
): Promise<EventRunResult> {
  const host = opts?.host;
  const reg = scene.registry;
  const you = (reg.get("playerName") as string) ?? "나";
  const fill = (t: string) => t.replace(/\{PLAYER\}/g, you);
  let changed = false;
  let took = false;   // 이번에 실제로 물건을 집었나(열매를 "안 딴다"고 하면 false)

  /**
   * 줄 묶음 하나를 위에서부터 실행한다. 배틀에서 멈추면 그 자리를 돌려준다(경로 앞에 이 층의 줄 번호를 붙인다).
   * @param resume 이어실행 경로. `[i]`면 i번째 줄부터, `[i, …]`면 i번째 줄 **안으로** 나머지를 들고 내려간다.
   */
  const runLines = async (lines: EventLine[], resume: number[] = []): Promise<BattleStop | null> => {
    const start = resume.length ? resume[0] : 0;
    // 이어실행 자리가 지금 데이터 밖이면 **조용히 아무것도 안 하고 끝나는** 대신 남긴다
    //  (이벤트 JSON을 고친 뒤 옛 예약이 남았을 때 "이겼는데 뒷대사가 없다"로 나타난다).
    if (resume.length && start >= lines.length)
      console.error(`[fieldEventRunner] 이어실행 자리가 데이터 밖이다: ${map} #${ev.id} @${resume.join(".")} (줄 ${lines.length}개)`);
    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      // 이어실행은 **그 줄 안쪽**으로만 내려간다 — 그 뒤 줄들은 처음부터 돈다.
      const sub = i === start ? resume.slice(1) : [];
      // 배틀은 여기서 멈춘다. 이어실행 자리는 **그 다음 줄**이라 다시 걸리지 않는다.
      if (l.battle && !sub.length) return { trainerId: l.battle, path: [i + 1] };
      const stop = await runLine(l, sub);
      if (stop) return { trainerId: stop.trainerId, path: [i, ...stop.path] };
    }
    return null;
  };

  const runLine = async (l: EventLine, resume: number[] = []): Promise<BattleStop | null> => {
    if (l.ifSwitches) {
      // 원본 조건분기 — 전역 스위치가 모두 켜져야 then. 안 옮긴 스토리 스위치는 꺼져 있어 else가 돈다.
      //  이어실행이면 **그때 골랐던 갈래**(resume[0])를 그대로 쓴다 — 조건을 다시 보지 않는다.
      const branch = resume.length ? resume[0] : (l.ifSwitches.every((s) => arSwitchOn(reg, s)) ? 0 : 1);
      const stop = await runLines((branch === 0 ? l.then : l.else) ?? [], resume.slice(1));
      // 갈래 번호를 경로에 남긴다(바깥 runLines가 자기 줄 번호를 앞에 붙인다).
      return stop ? { trainerId: stop.trainerId, path: [branch, ...stop.path] } : null;
    }
    if (l.text) {
      await dlg.say(fill(l.text), l.speaker ? fill(l.speaker) : null);
    } else if (l.choice?.length) {
      const pick = await dlg.askChoice(l.choice.map(fill));
      const stop = await runLines(l.branches?.[pick] ?? []);
      // 선택지 안의 배틀은 이어실행할 수 없다 — 돌아왔을 때 어느 갈래였는지 다시 물을 수밖에 없다.
      //  조용히 틀리게 도는 것보다 여기서 터지는 게 낫다(지금 그런 이벤트는 없다).
      if (stop) throw new Error(`선택지 갈래 안의 배틀은 아직 못 이어실행한다 — ${map} #${ev.id}`);
    } else if (l.item) {
      await pickUp(scene, dlg, l.item, 1);
      took = true;
    } else if (l.berry) {
      // ⚠️ "안 딸래"를 고르면 열매는 그대로 남아야 한다 — 여기서 딴 경우만 표시한다.
      if (await pickBerry(scene, dlg, l.berry, l.count ?? 1)) took = true;
    } else if (l.receive) {
      await receiveItem(scene, dlg, l.receive, 1);
    } else if (l.shop) {
      // 상점(pbPokemonMart)은 아직 안 만들었다 — 마트 점원과 같은 안내로 통일한다.
      await dlg.say("(상점은 아직 준비 중이다.)");
    } else if (l.se) {
      playSfx(scene, AR_SE[l.se] ?? "", 0.5);
    } else if (l.setSelf) {
      setSelfSwitch(reg, map, ev.id, l.setSelf);
      changed = true;
    } else if (l.setSwitch) {
      setArSwitch(reg, l.setSwitch[0], l.setSwitch[1]);
      // 전역 스위치도 페이지를 바꾼다(경호는 95번이 켜지면 빈 페이지로 넘어가 사라진다) → 다시 그려야 한다.
      changed = true;
    // ── 아래는 씬(EventHost)이 있어야 하는 컷신 명령 ─────────────────
    } else if (l.move) {
      await host?.move(ev, l.move);
    } else if (l.wait !== undefined) {
      await host?.wait(l.wait);
    } else if (l.emote !== undefined) {
      host?.emote(ev, l.emote, l.emoteOn);
    } else if (l.bgm) {
      host?.bgm(l.bgm, l.bgmVolume ?? 100);
    }
    return null;
  };

  const stop = await runLines(page.lines, opts?.startAt ?? []);
  if (stop) return { changed, battle: { trainerId: stop.trainerId, resumeAt: stop.path } };

  // 바닥 아이템·열매는 원본도 셀프스위치 A를 켜서 빈 페이지로 넘긴다.
  //  (추출기가 그 123 명령을 같이 뽑지만, 조건분기 안에 들어 있어 빠지는 경우가 있어 여기서 한 번 더 확실히 한다.)
  if (took && (ev.kind === "item" || ev.kind === "berry")) {
    setSelfSwitch(reg, map, ev.id, "A");
    changed = true;
  }
  return { changed };
}

/** 바닥 아이템 줍기 — 문구는 원본 `pbItemBall`(Overworld.rb) 그대로 두 줄이다. */
async function pickUp(scene: Phaser.Scene, dlg: DialogBox, itemId: string, n: number): Promise<void> {
  const def = getItem(itemId);
  const name = def?.name ?? itemId;
  playMe(scene, SFX.pkmnGet, 0.5);   // 원본 ME "Item get" 자리
  await dlg.say(`${name}${josa(name, "을를")} 주웠다!`);
  addItem(scene.registry, itemId, n);
  const pocket = POCKET_NAME[def?.pocket ?? 1] ?? "일반";
  await dlg.say(`${name}${josa(name, "을를")} 가방의\n${pocket} 포켓에 넣었다.`);
}

/** 사람이 건네주는 물건 — 원본 `pbReceiveItem`은 "주웠다"가 아니라 **"받았다"**로 시작한다. */
async function receiveItem(scene: Phaser.Scene, dlg: DialogBox, itemId: string, n: number): Promise<void> {
  const def = getItem(itemId);
  const name = def?.name ?? itemId;
  playMe(scene, SFX.pkmnGet, 0.5);
  await dlg.say(`${name}${josa(name, "을를")} 받았다!`);
  addItem(scene.registry, itemId, n);
  const pocket = POCKET_NAME[def?.pocket ?? 1] ?? "일반";
  await dlg.say(`${name}${josa(name, "을를")} 가방의\n${pocket} 포켓에 넣었다.`);
}

/** 열매 따기 — 원본 `pbPickBerry`: 몇 개 열렸는지 묻고, 예를 고르면 딴다. 딴 경우에만 true. */
async function pickBerry(scene: Phaser.Scene, dlg: DialogBox, itemId: string, n: number): Promise<boolean> {
  const def = getItem(itemId);
  const name = def?.name ?? itemId;
  await dlg.say(`${name}${josa(name, "이가")} ${n}개 열려있다!\n열매를 딸까?`);
  if (!(await dlg.askYesNo())) return false;
  playMe(scene, SFX.pkmnGet, 0.5);   // 원본 ME "Berry get" 자리
  addItem(scene.registry, itemId, n);
  await dlg.say(`${name}${josa(name, "을를")} ${n}개 땄다!`);
  return true;
}
