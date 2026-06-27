# 🏠 집 PC 환경복원 키트 — 먼저 읽기

> **작성일: 2026-06-24 / 작성 장소: 학원 PC (WSL2 Ubuntu)**
> 이 폴더 하나로 학원 PC에서 하던 작업을 집 PC에서 **똑같은 환경**으로 이어서 할 수 있게 만든다.
> 집 PC의 Claude(또는 사람)에게 이 폴더를 통째로 주고 *"이대로 환경 복원해줘"* 라고 하면 된다.

---

## 🤖 0. AI에게 — 이대로 실행 (사용자가 이 폴더를 주며 "환경 복원해줘"라고 하면)

> 아래는 **네(AI)가 직접 수행**한다. 사용자에게 일일이 시키지 말고, 네 도구로 파일을 올바른 경로에 만들어라.
> 단, 표시된 **"사용자 필요"** 항목은 네가 물리적으로 못 하니 사용자에게 명확히 요청한다.

**네가 직접 하는 일:**
1. **세션 루트 확인** — 반드시 프로젝트 **루트**(`AGENTS.md`가 있는 `myPokemon_AJ/`의 상위, 즉 `vcPortfolio_AJ`)에서 작업 중인지 확인. 아니면 사용자에게 "루트에서 다시 열어달라"고 요청(스킬·메모리가 이 폴더 기준으로 로드됨).
2. **스킬 배치** — `복사본/claude_skills/`의 내용을 `<루트>/.claude/skills/`로 복사. 각 `SKILL.md`의 frontmatter(`name`/`description`) 존재 확인.
3. **메모리 배치** — `복사본/claude_memory/*.md`(`MEMORY.md` 포함)를 **너의 실제 메모리 폴더**(`~/.claude/projects/<이 프로젝트 슬러그>/memory/`)에 복사. 슬러그는 네 컨텍스트에 이미 주어져 있으니 그 경로를 그대로 써라. 경로 추측하지 말 것.
4. **settings 배치(선택)** — `복사본/claude_settings/settings.local.json`을 `<루트>/.claude/settings.local.json`로 복사(없으면 권한만 매번 물음).
5. **AR맵 스크립트 경로 수정** — `myPokemon_AJ/tools/ar-map/extract.py`·`rxrender.py` 안의 `AR=`/`PUB=` 절대경로를 **이 PC 경로**로 고쳐라.
6. **의존성 설치 & 검증** — `cd myPokemon_AJ && npm install` (Electron 504 시 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`) → `npm run dev`로 http://localhost:5180 확인.
7. 끝나면 각 단계 결과를 보고하고, 못 한 "사용자 필요" 항목을 짚어준다.

**사용자가 해줘야 하는 일(네가 못 함 — 명확히 요청):**
- 🧑 **프로젝트 본체**가 이 PC에 있어야 함(git clone 또는 폴더 동기화). URL/위치 모르면 사용자에게 물어라.
- 🧑 **어나더레드 원본** `Pokemon Another Red_PWT_250829`를 D드라이브에 배치(수백MB, USB/클라우드로 옮김).
- 🧑 **모델 = Opus** 선택 확인(`/model`).

**검증(이거 되면 복원 성공):** 새 세션에서 "주인공 남녀가 누구고 실행 본체가 뭐냐"고 물었을 때 *"남=1세대 RED, 여=4세대 DAWN, 본체=Pokemon With.exe"*가 바로 나오면 메모리가 제대로 로드된 것.

---

## 0-1. 이게 뭔가 (한 줄 요약)

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
