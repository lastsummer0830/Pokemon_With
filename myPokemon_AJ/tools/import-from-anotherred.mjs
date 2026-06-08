// Another Red 원본에서 "추가" 에셋을 골라 public/assets 로 복사한다.
// (처음 핵심 세트는 이미 들어와 있고, 나중에 더 필요할 때 이걸로 꺼내 쓴다.)
//
// 사용법:
//   node tools/import-from-anotherred.mjs "<AnotherRed 폴더 경로>" <카테고리>
//
// 카테고리:
//   back        → 내 포켓몬 뒷모습 (배틀에서 필요)  → public/assets/pokemon/back
//   followers   → 따라다니는 포켓몬 오버월드        → public/assets/characters/followers
//   trainers    → 트레이너 배틀 스프라이트          → public/assets/trainers
//   battlebacks → 배틀 배경                          → public/assets/battlebacks
//   ui          → UI 이미지                          → public/assets/ui
//
// 예: node tools/import-from-anotherred.mjs "D:/Pokemon Another Red_PWT_250829" back

import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const MAP = {
  back:        { src: "Graphics/Pokemon/Back",         dest: "public/assets/pokemon/back" },
  followers:   { src: "Graphics/Characters/Followers", dest: "public/assets/characters/followers" },
  trainers:    { src: "Graphics/Trainers",             dest: "public/assets/trainers" },
  battlebacks: { src: "Graphics/Battlebacks",          dest: "public/assets/battlebacks" },
  ui:          { src: "Graphics/UI",                   dest: "public/assets/ui" },
};

const [root, category] = process.argv.slice(2);
if (!root || !category || !MAP[category]) {
  console.error("사용법: node tools/import-from-anotherred.mjs \"<AnotherRed 경로>\" <" + Object.keys(MAP).join("|") + ">");
  process.exit(1);
}

const { src, dest } = MAP[category];
await mkdir(dest, { recursive: true });
console.log(`복사: ${join(root, src)}  →  ${dest}`);
await cp(join(root, src), dest, { recursive: true });
console.log("완료. (용량 주의 — git 커밋 전 du 로 크기 확인 권장)");
