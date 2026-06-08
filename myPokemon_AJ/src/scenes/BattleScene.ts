import Phaser from "phaser";

// 배틀 화면 — 제일 덩치 큰 부품. 맨 마지막에 얹어야 안 지친다.
// 서로 때리고 HP 깎는 단순 버전부터 시작한다.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  preload(): void {
    // TODO: 배틀 배경, 포켓몬 스프라이트 로딩
  }

  create(): void {
    // TODO: 내 포켓몬 / 상대 포켓몬 배치, HP 바, 기술 버튼
    // 데미지·턴 계산은 systems/battle.ts 에서 가져와 사용한다.
  }

  update(): void {
    // TODO: 턴 진행 상태 확인
  }
}
