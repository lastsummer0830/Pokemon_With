import Phaser from "phaser";

// 공용 효과음(SFX) — Another Red 정품 효과음(public/assets/audio/sfx_*.ogg).
//  BGM(루프)은 bgm.ts가, 일회성 효과음은 여기가 담당.
//  각 씬 preload에서 preloadCommonAudio(this)를 부르면(이미 로드된 건 건너뜀) 어디서든 playSfx로 재생.

// 효과음 키(코드에서 이 상수를 쓴다 — 오타 방지)
export const SFX = {
  cursor: "sfx_cursor",       // 메뉴 커서 이동
  decision: "sfx_decision",   // 결정/확인/대사 넘김
  cancel: "sfx_cancel",       // 취소/뒤로
  doorIn: "sfx_door_in",      // 문/워프 진입
  doorOut: "sfx_door_out",    // 문 나가기
  bump: "sfx_bump",           // 벽에 부딪힘
  exclaim: "sfx_exclaim",     // "!" 발견/조우
  hitNormal: "sfx_hit_normal",// 배틀 데미지(보통)
  hitSuper: "sfx_hit_super",  // 배틀 데미지(효과 굉장)
  hitWeak: "sfx_hit_weak",    // 배틀 데미지(효과 별로)
  flee: "sfx_flee",           // 도망
  pkmnGet: "me_pkmn_get",     // 포켓몬 획득 팡파레(짧은 ME)
} as const;

// 키 → 파일 경로
const FILES: Record<string, string> = {
  [SFX.cursor]: "assets/audio/sfx_cursor.ogg",
  [SFX.decision]: "assets/audio/sfx_decision.ogg",
  [SFX.cancel]: "assets/audio/sfx_cancel.ogg",
  [SFX.doorIn]: "assets/audio/sfx_door_in.ogg",
  [SFX.doorOut]: "assets/audio/sfx_door_out.ogg",
  [SFX.bump]: "assets/audio/sfx_bump.ogg",
  [SFX.exclaim]: "assets/audio/sfx_exclaim.ogg",
  [SFX.hitNormal]: "assets/audio/sfx_hit_normal.ogg",
  [SFX.hitSuper]: "assets/audio/sfx_hit_super.ogg",
  [SFX.hitWeak]: "assets/audio/sfx_hit_weak.ogg",
  [SFX.flee]: "assets/audio/sfx_flee.ogg",
  [SFX.pkmnGet]: "assets/audio/me_pkmn_get.ogg",
  // 마을/집/연구소 공용 BGM도 여기서 함께 로드(그래야 playBgm이 캐시에서 찾아 재생).
  bgm_town: "assets/audio/bgm_town.ogg",
  bgm_route1: "assets/audio/bgm_route1.ogg",       // 1번도로 (AR KM_Route1)
  bgm_viridian: "assets/audio/bgm_viridian.ogg",   // 상록시티 (AR KM_Pewter)
};

// 씬 preload에서 호출 — 아직 안 받은 효과음만 큐에 넣는다(중복 로드 방지).
export function preloadCommonAudio(scene: Phaser.Scene): void {
  for (const key of Object.keys(FILES)) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, FILES[key]);
  }
}

// 효과음 한 번 재생(파일 없으면 조용히 패스 — 게임 안 멈춤).
export function playSfx(scene: Phaser.Scene, key: string, volume = 0.5): void {
  if (scene.cache.audio.exists(key)) scene.sound.play(key, { volume });
}

// BGM 키(bgm.ts와 함께 씀)
// 씬별 BGM — AR 실제 맵 데이터(@bgm) 기준으로 매핑:
//   태초마을(Map55)=KM_Pallet, 1번도로(Map10)=KM_Route1, 상록시티(Map56)=KM_Pewter,
//   오박사연구소(Map157)=Lab, 야생배틀(metadata)=Battle wild.
//   집 내부는 AR에서 BGM 미설정(마을곡 상속) → town 사용.
export const BGM = {
  title: "bgm_title",       // 타이틀~인트로 (DP 호수 테마 — 사용자 지정)
  town: "bgm_town",         // 마을/집 (KM_Pallet)
  route1: "bgm_route1",     // 1번도로 (KM_Route1)
  viridian: "bgm_viridian", // 상록시티 (KM_Pewter)
  lab: "bgm_lab",           // 오박사 연구소 (Lab.mid → AR soundfont로 렌더)
  battle: "bgm_battle",     // 야생 배틀 (Battle wild)
} as const;
