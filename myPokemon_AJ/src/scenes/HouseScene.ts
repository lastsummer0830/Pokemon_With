import Phaser from "phaser";

// 집 꾸미기 화면 ★ 내 색
// "격자 위에 가구를 놓고, 그 배치를 저장한다" — 동물의 숲 방 꾸미기와 같은 구조.
export default class HouseScene extends Phaser.Scene {
  constructor() {
    super("HouseScene");
  }

  preload(): void {
    // TODO: 방 타일, 가구 스프라이트 로딩 (furniture.ts 카탈로그 참고)
  }

  create(): void {
    // TODO: 모눈종이(격자) 그리기, 가구를 칸에 놓기/치우기
    // 놓은 결과는 data/HouseLayout 형태로 모아서 systems/save.ts 로 저장한다.
  }

  update(): void {
    // TODO: 가구 드래그 / 배치 미리보기
  }
}
