// 조작키 — 흩어져 있던 `keydown-ENTER/Z/SPACE/X/ESC`를 **액션**(무엇을 하는 키인가)으로 모은 곳.
//
// ── 원본(Another Red) 실측 ────────────────────────────────────────────────
//  · 게임 폴더의 `조작키 및 안내사항.txt`
//        A버튼: C · B버튼: X · "가방 및 사용 버튼": Z · L버튼: A · R버튼: S · 스페셜(가방 등록 등): D · 배속: Q
//  · `mkxp.json`의 bindingNames = mkxp-z 기본 배치 → 물리키 C=USE · X=BACK · Z=ACTION · A=JumpUp · S=JumpDown · D=SPECIAL · Q=L(AUX1)
//  · `Scripts.rxdata`의 `Scene_Map.rb`(원문):
//        Input::USE    → interact_calling  (말 걸기/확인)
//        Input::ACTION → menu_calling      (**필드 메뉴 열기**)
//        Input::SPECIAL→ ready_menu_calling(등록 아이템)
//    ⚠️ 즉 원본의 **물리 Z는 '가방'이 아니라 '메뉴 열기'**다. 가방은 그 메뉴 안에 있다.
//       (문서의 "가방 및 사용 버튼"이 이 뜻이었다 — 전용 가방 단축키는 원본에 없다.)
//    우리는 원본에 없는 '가방 직행'을 원본 스페셜 자리인 **D**에 둔다(우리는 등록 아이템이 없다).
//  · 배속(Q)은 스크립트에 없다 = mkxp 엔진의 프레임 스킵. 우리는 배틀 시간배속으로 대신한다(BattleScene).
//
// ── 우리 규칙 ──────────────────────────────────────────────────────────────
//  · 기본값 = 원본 배치. 단 **Enter·Space는 계속 확인으로 받는다**(지금까지 손에 익은 것).
//  · 프리셋 2종: `original`(원본식) / `legacy`(기존식 — Z가 확인, Enter·X가 메뉴).
//  · 방향키는 재할당 대상이 아니다(원본 F1 화면은 방향키도 바꾸지만, 우리는 5개 액션만 다룬다).
//
// 사용법:
//    const off = bindActions(this, { USE: () => ..., BACK: () => ... });   // 끌 땐 off()
//    onAction(this, "MENU", () => this.openMenu());                        // 씬이 끝나면 자동 해제
//    if (isActionDown(this, "BACK")) ...                                   // 누르고 있는지(달리기)

import Phaser from "phaser";

export type Action = "USE" | "BACK" | "MENU" | "BAG" | "SPEED";

export const ACTIONS: Action[] = ["USE", "BACK", "MENU", "BAG", "SPEED"];

/** 화면에 보여줄 액션 이름/설명. */
export const ACTION_LABEL: Record<Action, string> = {
  USE: "확인 (A버튼)",
  BACK: "취소 (B버튼)",
  MENU: "메뉴 열기",
  BAG: "가방 열기",
  SPEED: "배속 (배틀 전용)",
};

export const ACTION_DESC: Record<Action, string> = {
  USE: "말 걸기·결정·대사 넘기기.",
  BACK: "취소·뒤로. 이동 중에 누르고 있으면 반대 속도가 된다.",
  MENU: "필드에서 메뉴(포켓몬·가방·저장)를 연다.",
  BAG: "필드에서 가방을 바로 연다.",
  SPEED: "배틀에서 눌러 진행을 빠르게 한다. 다시 누르면 원래 속도.",
};

export type PresetName = "original" | "legacy";

export type KeyMap = Record<Action, string[]>;

/**
 * 원본 배치(기본값). Enter·Space는 우리 편의로 확인에 함께 둔다.
 * ⚠️ 여기선 **한 키가 두 액션에 겹치지 않는다** — 겹치면 실내처럼 '말 걸기'와 '메뉴 열기'가 한 번에 터진다.
 */
export const PRESET_ORIGINAL: KeyMap = {
  USE: ["KeyC", "Enter", "Space"],
  BACK: ["KeyX", "Escape"],
  MENU: ["KeyZ"],
  BAG: ["KeyD"],
  SPEED: ["KeyQ"],
};

/**
 * 기존식(0802까지 우리 게임의 배치). Z가 확인, 필드 메뉴는 Enter·X.
 * 이 배치는 Enter·X가 확인/취소와 겹치는데, **그게 지금까지 굴러온 그대로**다
 * (필드에선 메뉴만, 메뉴 안에선 확인/취소만 걸려 있어 부딪히지 않는다).
 * 겹친 키를 '말 걸기'로 세지 않는 처리는 `isActionJustDown`의 except 옵션이 한다.
 */
export const PRESET_LEGACY: KeyMap = {
  USE: ["KeyZ", "Enter", "Space", "KeyC"],
  BACK: ["KeyX", "Escape"],
  MENU: ["Enter", "KeyX"],
  BAG: ["KeyB"],
  SPEED: ["KeyQ"],
};

export const PRESETS: Record<PresetName, KeyMap> = {
  original: PRESET_ORIGINAL,
  legacy: PRESET_LEGACY,
};

export const PRESET_LABEL: Record<PresetName, string> = {
  original: "원본식",
  legacy: "기존식",
};

const STORE_KEY = "myPokemon.keys";

// ── 저장/불러오기 ───────────────────────────────────────────────────────────
const clone = (m: KeyMap): KeyMap => ({ USE: [...m.USE], BACK: [...m.BACK], MENU: [...m.MENU], BAG: [...m.BAG], SPEED: [...m.SPEED] });

let current: KeyMap = clone(PRESET_ORIGINAL);
let loaded = false;
const changeListeners = new Set<(m: KeyMap) => void>();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Record<Action, unknown>>;
    // 액션마다 따로 합친다 — 나중에 액션이 늘어도 옛 저장본이 그 액션을 통째로 비우지 않게.
    for (const a of ACTIONS) {
      const v = saved[a];
      if (Array.isArray(v) && v.every((k) => typeof k === "string") && v.length > 0) current[a] = v as string[];
    }
  } catch { /* 깨졌으면 기본값 그대로 */ }
}

function save(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(current)); } catch { /* noop */ }
}

/** 지금 배치(읽기 전용으로 쓸 것). */
export function keyMap(): KeyMap {
  load();
  return current;
}

/** 배치가 바뀌면 알려준다(키 설정 화면·눌린키 추적이 구독). */
export function onKeysChange(fn: (m: KeyMap) => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function apply(next: KeyMap): void {
  current = clone(next);
  save();
  for (const fn of changeListeners) fn(current);
}

/** 프리셋 통째로 적용. */
export function usePreset(name: PresetName): void {
  load();
  apply(PRESETS[name]);
}

/** 지금 배치가 어느 프리셋과 같은가(어느 쪽도 아니면 null = 사용자 지정). */
export function matchedPreset(): PresetName | null {
  load();
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);
  for (const name of Object.keys(PRESETS) as PresetName[]) {
    if (ACTIONS.every((act) => same(current[act], PRESETS[name][act]))) return name;
  }
  return null;
}

/**
 * 한 액션의 키를 `code` 하나로 바꾼다(원본 F1 화면도 액션당 키 하나를 다시 잡는다).
 * 같은 키가 다른 액션에 이미 있으면 **거기서 뺀다** — 한 키가 두 가지를 하면 안 되기 때문.
 * 마지막 남은 키까지 뺏기는 액션은 그대로 두고 `false`를 준다(그 키는 못 쓴다고 알려준다).
 */
export function rebind(action: Action, code: string): boolean {
  load();
  const next = clone(current);
  for (const a of ACTIONS) {
    if (a === action) continue;
    if (!next[a].includes(code)) continue;
    if (next[a].length <= 1) return false;   // 그 액션의 유일한 키 → 빼앗으면 조작 불능
    next[a] = next[a].filter((k) => k !== code);
  }
  next[action] = [code];
  apply(next);
  return true;
}

/** 한 액션만 기본값(원본식)으로. */
export function resetAction(action: Action): void {
  load();
  const next = clone(current);
  next[action] = [...PRESET_ORIGINAL[action]];
  apply(next);
}

/** 전부 기본값(원본식)으로. */
export function resetKeys(): void {
  usePreset("original");
}

// ── 보여줄 이름 ─────────────────────────────────────────────────────────────
const KEY_LABEL: Record<string, string> = {
  Enter: "Enter", Space: "Space", Escape: "ESC", Tab: "Tab", Backspace: "←Back",
  ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};

/** `KeyboardEvent.code` → 화면에 쓸 짧은 이름(KeyC → C, Digit1 → 1). */
export function keyLabel(code: string): string {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`;
  return code;
}

/** 한 액션에 걸린 키들을 "C · Enter · Space"로. */
export function keysLabel(action: Action): string {
  return keyMap()[action].map(keyLabel).join(" · ");
}

/** 키 설정 화면에서 못 잡게 막는 키(이걸 뺏기면 화면을 빠져나올 수 없거나 브라우저가 가로챈다). */
export function isBindable(code: string): boolean {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) return false;  // 방향키는 이동 고정
  if (code.startsWith("F") && /^F\d+$/.test(code)) return false;                          // F1~F12(F1은 키 설정 열기)
  if (["MetaLeft", "MetaRight", "AltLeft", "AltRight", "ContextMenu", "CapsLock"].includes(code)) return false;
  return true;
}

// ── 씬에 붙이기 ─────────────────────────────────────────────────────────────
type Handler = () => void;

/** 씬마다 살아 있는 등록. 씬이 끝나면(SHUTDOWN) 통째로 걷어낸다. */
interface SceneHooks {
  entries: { action: Action; fn: Handler }[];
  dispatcher: (event: KeyboardEvent) => void;
}
const perScene = new WeakMap<Phaser.Scene, SceneHooks>();

function hooksFor(scene: Phaser.Scene): SceneHooks {
  const found = perScene.get(scene);
  if (found) return found;
  const hooks: SceneHooks = {
    entries: [],
    dispatcher: (event: KeyboardEvent) => {
      // 키를 누른 채로 두면 브라우저가 같은 keydown을 반복해 보낸다 → 결정/취소가 두 번 먹지 않게 무시.
      if (event.repeat) return;
      const map = keyMap();
      // 배열 사본으로 돈다 — 콜백 안에서 off()를 불러 목록이 줄어들 수 있다.
      for (const e of [...hooks.entries]) {
        if (!map[e.action].includes(event.code)) continue;
        if (!hooks.entries.includes(e)) continue;   // 이 이벤트 처리 도중에 이미 해제됐다
        e.fn();
      }
    },
  };
  perScene.set(scene, hooks);
  scene.input.keyboard!.on("keydown", hooks.dispatcher);
  // ⚠️ Phaser는 씬 인스턴스를 재사용한다 → 씬이 끝날 때 반드시 떼어낸다(옛 훅이 살아남아 다음 판을 망친다).
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off("keydown", hooks.dispatcher);
    hooks.entries.length = 0;
    perScene.delete(scene);
  });
  return hooks;
}

/** 액션 하나에 콜백을 건다. 돌려주는 함수를 부르면 해제. */
export function onAction(scene: Phaser.Scene, action: Action, fn: Handler): () => void {
  const hooks = hooksFor(scene);
  const entry = { action, fn };
  hooks.entries.push(entry);
  return () => {
    const i = hooks.entries.indexOf(entry);
    if (i >= 0) hooks.entries.splice(i, 1);
  };
}

/** 여러 액션을 한 번에. 돌려주는 함수 하나로 전부 해제(대사창처럼 잠깐 걸었다 떼는 곳). */
export function bindActions(scene: Phaser.Scene, map: Partial<Record<Action, Handler>>): () => void {
  const offs = (Object.keys(map) as Action[]).map((a) => onAction(scene, a, map[a]!));
  return () => offs.forEach((off) => off());
}

// ── 누르고 있는지(달리기용) ─────────────────────────────────────────────────
// Phaser의 Key 객체를 액션별로 만들어 두고, 배치가 바뀌면 다시 만든다.
interface BoundKey { code: string; key: Phaser.Input.Keyboard.Key }
const heldCache = new WeakMap<Phaser.Scene, { map: KeyMap; keys: Partial<Record<Action, BoundKey[]>> }>();

function heldKeys(scene: Phaser.Scene, action: Action): BoundKey[] {
  const map = keyMap();
  let box = heldCache.get(scene);
  // 배치가 바뀌면(키 설정에서 다시 잡으면) 만들어 둔 Key 객체를 버리고 새로 만든다.
  if (!box || box.map !== map) { box = { map, keys: {} }; heldCache.set(scene, box); }
  if (!box.keys[action]) {
    box.keys[action] = map[action]
      .map((code) => ({ code, kc: codeToPhaserKey(code) }))
      .filter((e): e is { code: string; kc: number } => e.kc !== null)
      // enableCapture=false: 브라우저 기본동작을 막지 않는다(다른 키 처리를 방해하지 않게).
      .map((e) => ({ code: e.code, key: scene.input.keyboard!.addKey(e.kc, false) }));
  }
  return box.keys[action]!;
}

/** 그 액션의 키 중 하나라도 지금 눌려 있는가(원본의 `Input.press?`). */
export function isActionDown(scene: Phaser.Scene, action: Action): boolean {
  return heldKeys(scene, action).some((b) => b.key.isDown);
}

/**
 * 이번 프레임에 '막 눌렸나'(원본의 `Input.trigger?`). 매 프레임 update에서 폴링하는 곳(실내 상호작용)용.
 *  · 누른 순간은 **읽는 즉시 소비된다** — 그래야 대사창이 닫힌 직후의 키가 새어 들어와 또 발동하지 않는다.
 *  · `except`에 적은 액션에도 걸린 키는 세지 않는다. 기존식 배치의 Enter처럼 **한 키가 확인이자 메뉴**인 경우,
 *    그 키는 메뉴 열기에만 쓰이게 해서 "말 걸기 + 메뉴 열기"가 한 번에 터지는 걸 막는다.
 */
export function isActionJustDown(scene: Phaser.Scene, action: Action, opts?: { except?: Action[] }): boolean {
  const map = keyMap();
  const skip = new Set((opts?.except ?? []).flatMap((a) => map[a]));
  let hit = false;
  heldKeys(scene, action).forEach((b) => {
    // ⚠️ 눌린 순간은 키마다 전부 소비해야 한다(중간에 멈추면 다음 프레임에 또 잡힌다) → some/every 대신 forEach.
    const just = Phaser.Input.Keyboard.JustDown(b.key);
    if (just && !skip.has(b.code)) hit = true;
  });
  return hit;
}

// ── F1 = 키 설정 열기(원본과 같은 자리) ────────────────────────────────────
// 원본은 mkxp 엔진이 F1로 키 설정 창을 띄운다("F1 키를 눌러 조작키를 커스텀할 수 있습니다").
// 우리는 게임 전역에서 F1을 받아 지금 보고 있는 씬 위에 KeyConfigScene을 얹는다.
export function installKeyConfigHotkey(game: Phaser.Game): void {
  window.addEventListener("keydown", (event) => {
    if (event.code !== "F1") return;
    event.preventDefault();   // 브라우저 도움말이 뜨지 않게
    const scenes = game.scene.getScenes(true);          // 지금 돌아가는 씬들(뒤쪽이 위에 그려진다)
    if (scenes.some((s) => s.scene.key === "KeyConfigScene")) return;   // 이미 열려 있다
    const top = scenes[scenes.length - 1];
    if (!top) return;
    // 인트로의 이름 입력(HTML input)처럼 키보드를 꺼 둔 화면에선 끼어들지 않는다.
    if (!top.input.keyboard?.enabled) return;
    top.scene.pause();
    top.scene.launch("KeyConfigScene", { from: top.scene.key });
  });
}

/** `KeyboardEvent.code` → Phaser KeyCodes(숫자). 모르는 키는 null. */
function codeToPhaserKey(code: string): number | null {
  const KC = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  if (code.startsWith("Key")) return KC[code.slice(3)] ?? null;   // KeyC → KeyCodes.C
  if (code.startsWith("Digit")) {
    // Phaser는 숫자키를 영어 이름으로 부른다(1 → ONE).
    const names = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    return KC[names[Number(code.slice(5))] ?? ""] ?? null;
  }
  const table: Record<string, number> = {
    Enter: KC.ENTER, Space: KC.SPACE, Escape: KC.ESC, Tab: KC.TAB, Backspace: KC.BACKSPACE,
    ShiftLeft: KC.SHIFT, ShiftRight: KC.SHIFT, ControlLeft: KC.CTRL, ControlRight: KC.CTRL,
    ArrowUp: KC.UP, ArrowDown: KC.DOWN, ArrowLeft: KC.LEFT, ArrowRight: KC.RIGHT,
  };
  return table[code] ?? null;
}
