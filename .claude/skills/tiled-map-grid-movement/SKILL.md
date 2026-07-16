---
name: tiled-map-grid-movement
description: 마을 맵·타일맵과 격자(칸) 이동·충돌을 만드는 스킬. Another Red 타일셋, Tiled JSON, tilemap, collision layer, grid movement, warp/door/event 타일, 방향전환. 트리거 예: "진짜 마을 맵 만들어줘", "칸 이동 붙여줘", "충돌 처리해줘", "문으로 워프되게".
---

# 타일맵 & 격자 이동 (HGSS식)

> 작업 전 `myPokemon_AJ/AGENTS.md` §3·§6(다음 우선순위)을 먼저 읽는다. 이건 그 다음 단계 작업이다.

## 목표
AGENTS.md 로드맵의 다음 우선순위 = **Another Red Tilesets로 Tiled 타일맵 + 칸 단위 이동 + 충돌**, 주인공을 Another Red 오버월드로 교체.

## 배치 규칙
- 타일셋 이미지: `public/assets/tilesets/` (Another Red 타일셋 — 이름에 공백/유니코드 있을 수 있음, 로드 시 경로 정확히).
- Tiled JSON: **build에 포함되도록** `public/assets/` 아래(예: `public/assets/maps/`)에 둔다. (string 경로 로드 → public 필수.)
- 맵 로직(충돌 판정·이벤트·워프 데이터)은 `WorldScene`에 다 때려넣지 말고 `src/systems/`·`src/data/`로 분리. Scene은 렌더·입력·연출 중심.

## 절차
1. Tiled에서 레이어 분리: **ground / overlay / collision / event(warp,door)**. 충돌·이벤트는 별도 레이어/속성으로.
2. Phaser `this.make.tilemap` + `addTilesetImage` + `createLayer`로 로드. 충돌은 collision 레이어 속성 기반.
3. **칸(격자) 단위 이동**: 입력 → 한 칸 목표 좌표로 tween 이동, 이동 중 입력 잠금, 도착 후 다음 입력. 정지 시 방향 전환만(HGSS 감성).
4. 워프/도어/이벤트 타일 위 도착 시 트리거 → scene transition.
5. 주인공 스프라이트: Another Red 오버월드(`public/assets/characters/`의 boy_/girl_). 도트는 `setFilter(NEAREST)`.

## 금지/주의
- ✅ **Another Red `Data/*.rxdata`는 rubymarshal로 다 읽힌다** — 맵 배열·충돌·풀숲·연결·BGM·인카운터 전부.
  (예전 "못 가져옴 → Tiled로 재구성"은 **틀린 서술**. `myPokemon_AJ/AGENTS.md` §4-C가 정본.)
  뽑는 도구는 이미 있다 — **새로 만들지 말 것**:
  - `tools/ar-map/extract-map.py --map <번호> --out <이름>` → 월드맵 PNG + `{cols,rows,blocked,grass?}`
  - `tools/ar-map/extract.py` → **집(방·거실) 전용**. 돌리면 `rooms.json`을 덮어쓴다 — 조심.
  - `tools/ar-data/extract-encounters.py --maps <번호>` → 야생 인카운터 표
  - terrain_tag **2 = 풀숲**, `map_connections.dat` = 맵 이어붙이기 오프셋, `map_metadata.dat` = 배틀배경·한글이름
- 야외 맵 배치·좌표변환의 정본 = **`src/data/region.ts`** (맵 3장을 이어붙인 52×100 리전).
  ⚠️ WorldScene 좌표는 **리전 글로벌**. 다른 씬이 맵 기준 로컬로 말할 땐 `map` 이름을 같이 넘긴다(안 하면 엉뚱한 맵에 스폰).
- 좌표 하드코딩 대신 타일 크기·격자 기준 계산.
- ⚠️ 새 public 에셋(png·ogg·json)을 추가하면 **dev서버 재시작** — 안 하면 `text/html`로 응답해 "디코딩 실패/안 바뀜"으로 몇 시간 날린다.

## 검증
- `npm run dev` → http://localhost:5180 에서 충돌/워프/이동을 직접 플레이. 화면 안 바뀌면 `build-run-debug` 참고.
