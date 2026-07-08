---
paths:
  - "**/rooms.json"
  - "**/scenes/InteriorScene.ts"
  - "**/scenes/WorldScene.ts"
  - "**/scenes/LabScene.ts"
  - "**/assets/world/*.json"
  - "**/assets/house/*"
---

# ⛔ 맵 충돌격자 — 눈대중 금지 (STOP 체크리스트)

> 정본: `myPokemon_AJ/AGENTS.md` §2 "⭐집 내부 맵 충돌격자 규칙".
> 몇 주째 반복된 분노의 근본원인 = 게임 화면 눈대중. 이 파일을 건드리면 아래를 그대로 따른다.

1. **게임 실행화면 눈대중으로 blocked/warp 좌표를 타이핑하지 않는다.** 스케일·중앙정렬·스프라이트겹침이 셀 경계를 착각시킨다.
2. **원본 PNG(640×480 = 20×15칸 ×32px)에 PIL로 32px 격자+좌표라벨을 얹어** 셀↔가구를 1:1로 확인. blocked는 가구 사각형 좌표로 **스크립트 생성**(손타이핑 금지). 작은 소품 픽셀까지 훑는다.
3. **계단:** 파란 난간=밟기 금지(막음), 노란 발판만 층이동. 카펫→계단 진입이 정답 루트. warp `climb`로 그림 방향대로 오르게.
4. **전경 오버레이(가구 뒤로 지나가기) 금지** — 머리 잘림(사용자 격노). `overImg` setVisible(false) 유지.
5. **"고쳤는데 똑같다" 함정:** ① `this.load` URL에 `?v=`+Date.now() + `cache.json.remove` ② 새 public 에셋 만들면 **dev서버 재시작 필수**(`curl -w '%{content_type}'`가 image/png 아니면 재시작).
6. 수정 후 **playwright 주행 또는 `walkable(x,y)` 조회로 실제 검증.** 추측으로 "됐다" 금지.
