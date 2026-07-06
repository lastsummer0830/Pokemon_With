import Phaser from "phaser";

// 공용 BGM 매니저 — 씬이 바뀌어도 끊기지 않게 전역 사운드 매니저(scene.sound = game.sound)로 한 곡만 유지한다.
//  - playBgm: 같은 곡이면 그대로 두고, 다른 곡이면 이전 곡 끄고 새로 재생.
//  - 브라우저 자동재생 정책: 첫 사용자 입력 전엔 소리가 잠겨 있음 → 잠겨 있으면 UNLOCKED 때 재생.
//  - 파일이 아직 없으면(로드 실패) 조용히 넘어간다(게임은 안 멈춤).
let current: Phaser.Sound.BaseSound | null = null;
let currentKey = "";

export function playBgm(scene: Phaser.Scene, key: string, volume = 0.4): void {
  if (currentKey === key && current && current.isPlaying) return; // 이미 그 곡 재생 중
  stopBgm();
  if (!scene.cache.audio.exists(key)) return; // 아직 파일 없음 → 패스

  const snd = scene.sound.add(key, { loop: true, volume });
  current = snd;
  currentKey = key;

  if (scene.sound.locked) {
    // 자동재생 잠김 → 첫 입력으로 풀리는 순간 재생
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      if (current === snd) snd.play();
    });
  } else {
    snd.play();
  }
}

export function stopBgm(): void {
  if (current) {
    current.stop();
    current.destroy();
  }
  current = null;
  currentKey = "";
}

// 현재 재생 중인 곡 키(디버그/검증용)
export function currentBgmKey(): string {
  return current && current.isPlaying ? currentKey : "";
}
