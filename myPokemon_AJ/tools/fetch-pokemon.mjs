// 포켓몬 고화질 에셋을 프로젝트(public/assets/pokemon)에 다운로드하는 스크립트.
//
// 사용법:
//   node tools/fetch-pokemon.mjs 152 155 158 384
//   node tools/fetch-pokemon.mjs            (인자 없으면 아래 DEFAULT 목록)
//
// 받는 것 (모두 고화질):
//   - artwork.png : 공식 일러스트 475x475 (PokeAPI)
//   - home.png    : HOME 3D 렌더 512x512 (PokeAPI, 가장 고화질)
//   - anim.gif    : gen5 흑백 애니메이션 도트 (PokeAPI)
//
// 왜 다운로드? PokeAPI는 CORS가 열려 런타임 로드도 되지만, 자주 쓰는 건 받아두면
// 빠르고 오프라인에서도 되고 외부 의존이 없다. pokemondb는 CORS가 없어 반드시 다운로드해야 함.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const OUT = "public/assets/pokemon";

// 인자 없으면 받을 기본 목록 (하트골드 스타팅 3마리 + 레쿠자)
const DEFAULT = [152, 155, 158, 384];

const ids = process.argv.slice(2).map(Number).filter(Boolean);
const targets = ids.length ? ids : DEFAULT;

async function save(url, path) {
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ✗ ${res.status}  ${url}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  console.log(`  ✓ ${(buf.length / 1024).toFixed(0).padStart(4)}KB  ${path}`);
  return true;
}

for (const id of targets) {
  const dir = join(OUT, String(id));
  await mkdir(dir, { recursive: true });
  console.log(`#${id}`);
  await save(`${BASE}/other/official-artwork/${id}.png`, join(dir, "artwork.png"));
  await save(`${BASE}/other/home/${id}.png`, join(dir, "home.png"));
  await save(`${BASE}/versions/generation-v/black-white/animated/${id}.gif`, join(dir, "anim.gif"));
}

console.log(`\n완료 → ${OUT}/<도감번호>/ 에 저장됨`);
