---
name: ar-map-rxdata-pipeline
description: AR 맵(rxdata)은 읽을 수 있음 — 파이프라인 + 진행중인 시작 집(방↔거실) 작업 체크포인트
metadata: 
  node_type: memory
  type: project
  originSessionId: a2ca6ebd-a8cd-4f7b-b46a-106c004cbd2b
---

**AR 맵 데이터는 읽힌다(AGENTS.md "못 가져옴"은 틀림).** `.rxdata` = Ruby Marshal → `pip install --break-system-packages rubymarshal`로 파싱. 맵 388개. 검증된 렌더 파이프라인 스크립트: `scratchpad/rxrender.py`, `extract.py`(2026-06-24 작성, 세션 끝나면 사라질 수 있으니 핵심 로직 메모):
- Map###.rxdata → attrs `@tileset_id,@data(Table),@events,@width/@height`. Table `_private_data`: `struct '<5i'`(dim,xs,ys,zs,total) + int16*xs*ys*zs, 인덱스 `x+xs*y+xs*ys*z`.
- Tilesets.rxdata[id] → `@tileset_name`(Graphics/Tilesets PNG), `@autotile_names`(7개, Graphics/Autotiles), `@passages`(Table 1D).
- 렌더: tid≥384 → 타일셋 PNG의 (tid-384) 타일(8열,32px). tid<384,n=tid//48 → 오토타일 n의 대표타일 = autotile PNG의 crop(0,32,32,64). tid=0 빈칸.
- 충돌: `(passages[tid]&0x0f)==0x0f` 면 막힘(벽/가구), 0이면 바닥. **검증됨**(바닥0/가구15).
- 이동(계단/문): event @code==201(Transfer) 의 (@x,@y)=계단위치, @parameters[1]=대상맵.

**주인공 집 = Map155 "레드의방"(2F 침실, 계단(10,3)) + Map154 "레드의집"(1F) + Map55 태초마을. Map156=그린(라이벌)집.**

**진행중 작업(미완):** 사용자가 시작 집 = 2F방 Map155 + 1F거실 **Map067**(154 아님!)로 정함. 둘을 계단 전환(페이드+`Door enter.ogg`=`assets/audio/door.ogg`)으로 왕복. 이미 추출 저장됨: `public/assets/house/red_room_2f.png(155)`, `red_living_1f.png(067)`, `rooms.json`(blocked격자+warps+start). **남은 일: `InteriorScene.ts`(데이터드리븐, 칸이동+충돌+워프전환) 작성 → main.ts 등록 → IntroScene/DebugMenu가 BedroomScene 대신 InteriorScene(room:bedroom) 호출 → exe 재빌드.** 정수배 스케일로 주인공 또렷하게(이전 BedroomScene은 소수배라 뭉갬). [[mypokemon-project]] [[launch-via-bat-only]] [[pick-folder-workflow]]
