# 0710 PokemonWith 작업일지

> 주제: **검증 파이프라인 실동작 확인 → 오디오(시작 BGM/SFX) 정리 → 전 화면 QA 스윕.** 이 PC = **집 PC(ONE, `/mnt/c/Users/ONE/...`)**.

## 0. 한 줄 요약
`/verify` 파이프라인을 실제로 돌려(Playwright 렌더러 스냅샷) 동작을 확증하고, 그 과정에서 **shot 스크립트 경로 하드코딩**과 **인트로 타이틀곡 정지 시점**을 바로잡았다. 배경음악·효과음 구현 상태를 런타임으로 전수 확인하고, 전 씬을 촬영해 품질 이슈를 정리했다(대부분 "지금 안 고침"으로 결론).

## 1. 오늘 커밋 (git 동기화 O)
- **`f1f69dc`** `tools: shot 스크립트 OUT 경로 하드코딩 제거(import.meta 상대경로)`
  - `shot-collision/dimtest/menuA/shelf/sprite-ab.mjs` + `verify-fixes.mjs` 6개의 `OUT="/mnt/d/dev/..."` → `fileURLToPath(new URL("../../.claude/.verify", import.meta.url))`. **PC 무관(집/학원)하게 리포 루트 `.claude/.verify`로 저장.** 검증: `shot-menuA` 실행 → 실제 렌더 PNG 생성 확인.
- **`bb70a1d`** `오디오: 인트로 나레이션부터 타이틀곡 정지 + exe 자동재생`
  - `IntroScene.create()` 시작에 `stopBgm()` → **나레이션("…") 구간부터 무음**(뒤쪽 중복 stopBgm 정리). 타이틀곡은 **타이틀~새게임 메뉴까지만**.
  - `electron/main.cjs` `webPreferences.autoplayPolicy="no-user-gesture-required"` → **exe에선 창 뜨자마자 BGM 재생**(브라우저 탭은 정책상 첫 입력 전 무음 — 코드로 못 뚫음).

## 2. 런타임으로 확인한 것 (오디오 현황 — 코드 정상)
- **BGM 흐름**: 타이틀=`bgm_title`, 새게임 메뉴=타이틀곡 유지, 인트로 나레이션=무음(오늘 변경), 이후 집/마을=`bgm_town`, 연구소=`bgm_lab`, 배틀=`bgm_battle`. `game.sound` 후킹으로 실제 재생 키 확인 완료.
- **메뉴 커서 SFX**: 새게임/이어하기 등 ↑↓ 이동 시 `sfx_cursor`, 확정 시 `sfx_decision` — **이미 구현·실제로 남**(`MainMenuScene.move/choose`, `DialogBox`).
- **대사 넘김(Enter) SFX**: 구현됨(`IntroScene.say():294`, `DialogBox:108` = `sfx_decision`).
- **대사 타이핑 SFX(글자마다)**: ❌ **없음.** 글자는 38ms마다 나오지만 소리는 없음. → **정정: 본가 포켓몬은 원래 글자별 타이핑음 없음**(넘김 소리만). AR SE에도 텍스트음 없음. **사용자 결정 = 보류**(넣으려면 사인파 말고 제대로 된 소스 필요).

## 3. QA 전 화면 스윕 (1280×720 렌더러 스냅샷) — 결론: 지금 고칠 것 없음
- **실내 레터박싱**(연구소·집 거실/침실): 방을 통짜 이미지로 화면맞춤 축소(`zoom=Math.min(가로,세로)`) → 4:3 방 vs 16:9 창이라 **좌우 검은 여백**. `LabScene`은 배경 `#000000`. → **사용자 결정: 안 건드림**(충돌격자·계단이 방 스케일에 묶여 손대면 밟기/계단 깨질 위험).
- **배틀 배경**: 하늘·땅 **단색 사각형 2개 플레이스홀더**(`BattleScene.ts:135-136`). → 로케이션/인카운터 시스템 생길 때 AR `Graphics/Battlebacks/`에서 골라 적용(보류).
- **배틀 공격 애니메이션**: ❌ **기술별 이펙트 없음.** 어떤 기술이든 대상 스프라이트 **flash(깜빡)** + 상성별 히트음(`sfx_hit_super/normal/weak`)만. 기술 데이터에 애니 필드 없음. AR `Graphics/Battle animations/`에 소스는 있음(향후 매핑 작업).
- **메뉴 "어둡다"는 오탐**: 내 캡처가 페이드인 중간 프레임을 잡은 것. 원본 `menu_dither.png`는 밝은 파스텔 노을, 재촬영 시 정상.
- 문제 없던 곳: 마을·배틀=화면 꽉 참·또렷, 인트로 나레이션=의도된 어두운 연출.

## 4. 주의사항 / PC-로컬 함정
- **Playwright(렌더러 스냅샷) 실행에 시스템 라이브러리 `libnspr4`·`libnss3` 필요.** 이 PC엔 오늘 `sudo apt`로 설치 완료(이제 `LD_LIBRARY_PATH` 우회 없이 기본 실행됨). **다른 PC(학원)에선 없을 수 있음** → chromium이 `libnspr4.so` 못 찾으면 `sudo apt-get install libnspr4 libnss3 libasound2t64` 또는 `npx playwright install-deps`.
- **AR 경로(이 PC)**: `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829/` (Audio·Graphics/Battlebacks·Battle animations 등 소스 다수).
- shot 스크립트 `snap()`은 `.claude/.verify` 폴더가 있어야 함(리포에 `.gitkeep`으로 커밋돼 있음).

## 5. 다음 이어서 할 스텝 (다음 세션 배틀 작업 — 사용자 지시)
### ★ 배틀 공격기 애니메이션 붙이기 (현재 전혀 없음)
- **현 상태**: 어떤 기술이든 대상 스프라이트 `flash()`(깜빡, `BattleScene.ts:331`) + 상성별 히트음(`sfx_hit_super/normal/weak`, `:233`)만. **기술 고유 이펙트(불꽃·물대포 등) 전무.** 기술 데이터(`src/systems/battle.ts` 등)에 애니 필드 없음.
- **소스**: AR `/mnt/c/Users/ONE/Desktop/Pokemon Another Red_PWT_250829/Graphics/Battle animations/` (실제 기술 애니 에셋 있음). *다른 PC면 AR 경로 `find`.*
- **할 일**: 기술→애니 매핑 테이블 설계 → 에셋 가져와 `public/assets/`에 넣고 → `runMove`(`BattleScene.ts:~220`) 히트 연출 자리에서 기술별 애니 재생(현 `flash` 대체/보강). 타입/기술명 기준 매핑. (별도 큰 작업 — 스킬 `turn-battle-system` 라우팅.)
### 로케이션별 배틀 배경 (현재 단색 플레이스홀더)
- **현 상태**: `BattleScene.ts:135-136` 하늘·땅 단색 사각형 2개.
- **할 일**: 인카운터/장소 시스템 생기면 만나는 NPC·포켓몬 등장 로케이션에 맞춰 AR `Graphics/Battlebacks/`(초원·물가·동굴 등 `*_bg.png` + 발판 base)에서 골라 사각형 대신 배경+발판 스프라이트로 교체.
### 보류
- 타이핑 SFX — 제대로 된 텍스트 SE 소스 확보 후(사인파 금지).

## 6. 지침/skills/memory 변경
- 리포 규칙(AGENTS/rules/hooks) 변경 없음. memory 변경 없음(이 일지로 대체). → **이관 폴더 불필요, 이 md만.**
