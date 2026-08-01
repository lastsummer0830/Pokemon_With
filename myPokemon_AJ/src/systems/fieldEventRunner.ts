import Phaser from "phaser";
import DialogBox from "../ui/DialogBox";
import { addItem, POCKET_NAME } from "../data/Bag";
import { getItem } from "../data/ar";
import { josa } from "../data/josa";
import { playMe, playSfx, SFX } from "../game/sfx";
import { setSelfSwitch, setArSwitch } from "./mapEvents";
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
 */
const sheetJobs = new Map<string, Promise<void>>();

export async function loadEventSheet(scene: Phaser.Scene, gfx: string): Promise<string | null> {
  const sheetKey = `ev_${gfx}`;
  let job = sheetJobs.get(sheetKey);
  if (!job) {
    job = (async () => {
      const imgKey = `evimg_${gfx}`;
      if (!scene.textures.exists(imgKey)) {
        await new Promise<void>((resolve) => {
          scene.load.image(imgKey, `assets/characters/${gfx}.png`);
          scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
          scene.load.start();
        });
      }
      if (!scene.textures.exists(sheetKey) && scene.textures.exists(imgKey)) {
        const src = scene.textures.get(imgKey).getSourceImage() as HTMLImageElement;
        scene.textures.addSpriteSheet(sheetKey, src, { frameWidth: src.width / 4, frameHeight: src.height / 4 });
      }
    })();
    sheetJobs.set(sheetKey, job);
  }
  await job;
  if (!scene.textures.exists(sheetKey)) return null;
  scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return sheetKey;
}

/**
 * 이벤트 한 페이지를 위에서부터 실행한다.
 * @returns 이벤트의 **모습이 바뀌었을 수 있으면** true (셀프스위치가 켜져 다음 페이지로 넘어간 경우).
 *          부르는 쪽이 그때 스프라이트를 다시 그리거나 지운다.
 */
export async function runEventPage(
  scene: Phaser.Scene, dlg: DialogBox, map: string, ev: MapEvent, page: EventPage,
): Promise<boolean> {
  const reg = scene.registry;
  const you = (reg.get("playerName") as string) ?? "나";
  const fill = (t: string) => t.replace(/\{PLAYER\}/g, you);
  let changed = false;
  let took = false;   // 이번에 실제로 물건을 집었나(열매를 "안 딴다"고 하면 false)

  const runLines = async (lines: EventLine[]): Promise<void> => {
    for (const l of lines) {
      if (l.text) {
        await dlg.say(fill(l.text), l.speaker ? fill(l.speaker) : null);
      } else if (l.choice?.length) {
        const pick = await dlg.askChoice(l.choice.map(fill));
        await runLines(l.branches?.[pick] ?? []);
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
      }
    }
  };
  await runLines(page.lines);

  // 바닥 아이템·열매는 원본도 셀프스위치 A를 켜서 빈 페이지로 넘긴다.
  //  (추출기가 그 123 명령을 같이 뽑지만, 조건분기 안에 들어 있어 빠지는 경우가 있어 여기서 한 번 더 확실히 한다.)
  if (took && (ev.kind === "item" || ev.kind === "berry")) {
    setSelfSwitch(reg, map, ev.id, "A");
    changed = true;
  }
  return changed;
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
