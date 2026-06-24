# 🏠 집 PC 환경복원 키트 — 먼저 읽기

> **작성일: 2026-06-24 / 작성 장소: 학원 PC (WSL2 Ubuntu)**
> 이 폴더 하나로 학원 PC에서 하던 작업을 집 PC에서 **똑같은 환경**으로 이어서 할 수 있게 만든다.
> 집 PC의 Claude(또는 사람)에게 이 폴더를 통째로 주고 *"이대로 환경 복원해줘"* 라고 하면 된다.

---

## 0. 이게 뭔가 (한 줄 요약)

`myPokemon_AJ` = Phaser 3 + TypeScript + Vite + Electron으로 만드는 **2D 탑다운 포켓몬 팬게임**(목표 퀄리티 = 팬게임 "어나더 레드" 수준). 차별점 = **집 꾸미기 → 포켓몬 컨디션 → 배틀 보너스**.

---

## 1. ⚠️ 경로 주의 (제일 중요)

이 문서들의 모든 경로는 **학원 PC 기준**이다. 집 PC는 다를 수 있으니 아래를 너 환경에 맞게 치환해라.

| 의미 | 학원 PC (이 문서 기준) | 집 PC에서 확인할 것 |
|---|---|---|
| 프로젝트 루트 (WSL) | `/mnt/d/dev/AJ_Proj/vcPortfolio_AJ` | 집 드라이브/경로에 맞게 |
| 프로젝트 루트 (Windows) | `D:\dev\AJ_Proj\vcPortfolio_AJ` | 〃 |
| 게임 폴더 | `<루트>/myPokemon_AJ` | 동일 구조 |
| **어나더레드 원본** | `/mnt/d/Pokemon Another Red_PWT_250829` (= `D:\Pokemon Another Red_PWT_250829`) | **집 PC에도 이 폴더가 따로 있어야 함** (git에 없음, §파일목록 참고) |
| Claude 메모리 폴더 | `/home/<유저>/.claude/projects/<프로젝트경로-슬러그>/memory/` | **슬러그는 프로젝트 경로에서 자동 생성됨** → 경로 다르면 슬러그도 달라짐 (아래 주의) |

> 🔴 **메모리 폴더 슬러그 주의:** Claude는 프로젝트 절대경로를 `-mnt-d-dev-AJ-Proj-vcPortfolio-AJ` 식으로 바꿔 메모리 폴더 이름을 만든다. 집 PC 경로가 다르면 이 슬러그가 달라져서, 복사한 메모리 md를 **엉뚱한 폴더에 넣으면 Claude가 못 읽는다.** 집 PC에서 이 프로젝트로 Claude를 한 번 띄워 실제 메모리 폴더 경로를 확인한 뒤 그 안에 복사해라. (자세히는 `02_게임_핵심설정_메모리.md`)

---

## 2. 복원 순서 (집 PC에서 이대로)

1. **프로젝트 받기** — git clone(또는 동기화). git으로 따라오는 것/아닌 것은 `04_가져갈파일_체크리스트.md` 참고.
2. **OS·런타임·도구 깔기** → `01_작업환경_OS_도구.md` (Ubuntu WSL2, node@nvm, python 패키지, ffmpeg, 폰트…).
3. **의존성 설치** — `cd myPokemon_AJ && npm install` (Electron 504 뜨면 미러: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`).
4. **Claude skills 복원** — `복사본/claude_skills/` → 프로젝트 루트의 `.claude/skills/`로 복사. (자세히는 기존 `00_ImportBox/skills/myPokemon_환경복원_skills.md` — 각 SKILL.md 전문이 거기 박혀 있음.)
5. **Claude 메모리 복원** — `복사본/claude_memory/*.md` → 집 PC의 실제 메모리 폴더로 복사(§1 슬러그 주의). 내용 설명은 `02_게임_핵심설정_메모리.md`.
6. **settings 복원(선택)** — `복사본/claude_settings/settings.local.json` → `.claude/settings.local.json` (권한 허용목록일 뿐, 없어도 동작은 함).
7. **어나더레드 원본 배치** — D드라이브에 `Pokemon Another Red_PWT_250829` 폴더 두기(git에 없음).
8. **빌드/실행 확인** — `npm run dev` → http://localhost:5180. 데스크톱 exe는 `npm run build && npx electron-builder --win --x64`.
9. **오늘 한 작업 이어가기** — `03_AR맵_rxdata_파이프라인.md`의 "진행중(미완)" 체크포인트부터.

---

## 3. 이 폴더 구성

```
환경복원_홈PC/
├─ 00_README_먼저읽기.md            ← 지금 이 파일
├─ 01_작업환경_OS_도구.md           OS/런타임/도구/폰트 등 환경 전체
├─ 02_게임_핵심설정_메모리.md       게임 확정설정 + Claude 메모리 내용 해설
├─ 03_AR맵_rxdata_파이프라인.md     오늘 새로 한 작업(맵 추출) + 미완 체크포인트
├─ 04_가져갈파일_체크리스트.md      git로 오는 것 / 수동으로 챙길 것
└─ 복사본/                          git에 안 올라가는 실제 파일들 (그대로 복사해 쓰기)
   ├─ claude_skills/                → .claude/skills/ 로
   ├─ claude_memory/                → 실제 메모리 폴더로 (슬러그 주의)
   └─ claude_settings/              → .claude/settings.local.json
```

> 참고: 기존에 만들어둔 `00_ImportBox/skills/myPokemon_환경복원_skills.md`에 **8개 skill 전문이 코드펜스로 박혀 있다.** skills 복원은 그 파일만으로도 가능(복사본은 편의용).
