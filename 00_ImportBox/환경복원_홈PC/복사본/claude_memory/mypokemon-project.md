---
name: mypokemon-project
description: myPokemon_AJ — Phaser/TS 포켓몬 팬게임 프로젝트의 목표·에셋소스·치명적 함정
metadata: 
  node_type: memory
  type: project
  originSessionId: f2d03e8b-8596-4185-ab15-c22ec2fedca7
---

`myPokemon_AJ/` = 2D 탑다운 포켓몬 팬게임 (Phaser3 + TypeScript + Vite). 목표 퀄리티 = 팬게임 "어나더 레드" 수준 — 에셋은 항상 고화질, 손으로 그리지 말 것. 차별점: "집 꾸미기"가 포켓몬 컨디션을 올리고 배틀로 이어짐.

상세 규칙은 `myPokemon_AJ/CLAUDE.md`에 있음 (폴더 구조/에셋 소스/컨벤션). 작업 전 그 파일을 따른다.

**에셋 소스:** PokeAPI/sprites(github raw, CORS 열림 → Phaser 직접 로드 OK, home 512px가 최고화질) / pokemondb.net(CORS 없음 → 다운로드해서 public/에 넣고 사용). 다운로더: `npm run fetch <도감번호>`.

**치명적 함정:** 프로젝트가 `/mnt/d`(윈도우 드라이브)라 WSL inotify가 안 됨 → `vite.config.ts`의 `server.watch.usePolling:true` 없으면 코드 수정이 브라우저에 반영 안 됨(서버 curl로는 보여서 디버깅 미궁). 화면 안 바뀌면 Ctrl+Shift+R. dev 서버는 localhost:5180. [[mnt-d-vite-polling]]
