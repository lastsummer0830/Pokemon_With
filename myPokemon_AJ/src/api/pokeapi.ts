// PokeAPI(https://pokeapi.co)에서 진짜 포켓몬 데이터·그림을 가져오는 모듈.
// 다운로드 없이 인터넷에서 실시간으로 받아온다. (무료/공개 자료)

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

// 작은 도트 그림 URL (맵·배틀에서 쓰기 좋음, 96x96)
export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

// 큰 공식 일러스트 URL (475x475, 타이틀·도감에서 쓰기 좋음)
export function artworkUrl(id: number): string {
  return `${SPRITE_BASE}/other/official-artwork/${id}.png`;
}

// HOME 3D 렌더 URL (512x512, 가장 고화질 + CORS 열림) — 메뉴/도감/타이틀 1순위 추천
export function homeUrl(id: number): string {
  return `${SPRITE_BASE}/other/home/${id}.png`;
}

// gen5 흑/백 애니메이션 도트 GIF (움직이는 도트). Phaser는 GIF 첫 프레임만 읽으므로
// 애니메이션이 필요하면 스프라이트시트로 변환해서 써야 한다. (tools/fetch-pokemon.mjs 참고)
export function animatedGifUrl(id: number): string {
  return `${SPRITE_BASE}/versions/generation-v/black-white/animated/${id}.gif`;
}

// 하트골드/소울실버 인게임 도트 (80x80, 작은 도트). HGSS 감성용.
export function hgssUrl(id: number): string {
  return `${SPRITE_BASE}/versions/generation-iv/heartgold-soulsilver/${id}.png`;
}

// 우리가 쓰기 좋게 추린 포켓몬 정보
export interface ApiPokemon {
  id: number;
  name: string;          // 영어 이름 (예: "chikorita")
  types: string[];       // 속성 (예: ["grass"])
  height: number;
  weight: number;
  stats: Record<string, number>; // hp, attack, defense ...
  spriteUrl: string;
  artworkUrl: string;
}

// 포켓몬 한 마리 정보를 가져온다. (id 숫자 또는 영어 이름)
export async function fetchPokemon(idOrName: number | string): Promise<ApiPokemon> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
  if (!res.ok) throw new Error(`PokeAPI 응답 오류: ${res.status}`);
  const data = await res.json();

  const stats: Record<string, number> = {};
  for (const s of data.stats) stats[s.stat.name] = s.base_stat;

  return {
    id: data.id,
    name: data.name,
    types: data.types.map((t: any) => t.type.name),
    height: data.height,
    weight: data.weight,
    stats,
    spriteUrl: spriteUrl(data.id),
    artworkUrl: artworkUrl(data.id),
  };
}

// 하트골드 스타팅 3마리 도감 번호 (치코리타 / 브케인 / 리아코)
export const JOHTO_STARTERS = [152, 155, 158];
