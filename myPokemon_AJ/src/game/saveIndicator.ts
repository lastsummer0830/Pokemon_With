import Phaser from "phaser";
import { autoSave, SaveLoc } from "../systems/save";

// SV(9세대)식 "저장 중…" 표시 + 스토리 이정표 자동저장.
//  자동저장은 원본 AR엔 없는 기능(Essentials v21.1은 수동 저장만) → 라이벌이 네모(SV)인 감성에 맞춰
//  SV 오토세이브 방식을 참고했다: 확인창 없이 조용히 저장하고, 화면 우상단에 잠깐 배너만 띄운다.
//  ⚠️ 카메라가 움직이는 씬(World/Lab/Gym)에서도 화면에 고정되도록 setScrollFactor(0)이 필수다.
const FONT = "Galmuri11";

// "저장 중…" 배너를 우상단에 잠깐 띄웠다 페이드아웃한다(사운드 없음 — SV 오토세이브는 조용하다).
export function showSavingToast(scene: Phaser.Scene, label = "저장 중…"): void {
  const t = scene.add.text(scene.scale.width - 16, 16, label, {
    fontFamily: FONT, fontSize: "20px", color: "#ffffff",
    backgroundColor: "#000000cc", padding: { x: 14, y: 8 },
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(2000);
  // localStorage 저장은 즉시 끝나므로 연출로 잠깐(1.2초) 보여준 뒤 사라지게 한다.
  scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 500, onComplete: () => t.destroy() });
}

// 이정표 자동저장 한 줄 호출용: 위치 기록 + 저장 + "저장 중…" 배너.
export function autoSaveWithToast(scene: Phaser.Scene, loc: SaveLoc): void {
  autoSave(scene.registry, loc);
  showSavingToast(scene);
}
