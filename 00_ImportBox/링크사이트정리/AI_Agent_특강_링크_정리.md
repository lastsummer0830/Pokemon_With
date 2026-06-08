# AI Agent 특강 링크 정리

> 정리 기준: **각 링크가 무엇을 하는 곳인지**, **AI Agent 특강에서 왜 나왔는지**, **초보자가 어디에 쓰면 되는지**를 기준으로 정리했습니다.  
> 중복 링크는 같은 항목으로 합쳤습니다.  
> 날짜에 따라 바뀔 수 있는 버전 번호, 로그인 후에만 보이는 내부 페이지, 비공식 플러그인 관련 내용은 단정하지 않고 안전하게 표현했습니다.

---

## 전체 요약

이번 특강 링크들은 대체로 아래 흐름으로 연결됩니다.

```text
1. Node.js 설치
   ↓
2. OpenCode 설치
   ↓
3. AGENTS.md / CLAUDE.md / Skills로 AI Agent 행동 규칙 만들기
   ↓
4. Obsidian을 지식 저장소로 사용
   ↓
5. Web Clipper로 웹 자료 수집
   ↓
6. NotebookLM으로 자료 기반 학습/요약
   ↓
7. Hugging Face / Artificial Analysis로 AI 모델 탐색
   ↓
8. Exa로 Agent에 검색 기능 연결
   ↓
9. Penpot / Stitch로 UI 디자인 생성·협업
   ↓
10. Backend.AI GO로 로컬 AI/Agent 실행 환경 확장
```

핵심만 말하면, 이번 특강은 **“AI를 그냥 채팅으로 쓰는 법”이 아니라, OpenCode + Obsidian + AGENTS.md + Skills + MCP를 묶어서 AI가 내 파일/지식/프로젝트를 직접 이해하고 도와주게 만드는 흐름**에 가깝습니다.

---

# 1. 교수님 PKM Course

## 링크

- <http://dangtong76.github.io/pkm-course/docs>
- <https://dangtong76.github.io/pkm-course/docs/>

> 같은 사이트입니다. 하나는 끝에 `/`가 있고 하나는 없을 뿐입니다.

## 무엇을 하는 곳인가?

**교수님이 만든 AI 지식관리/Agent 실습용 강의 자료 사이트**로 보면 됩니다.

사이트의 흐름은 대략 다음과 같습니다.

- 환경 설치
- 새로운 지식관리 패러다임
- AI로 Vault 구조 만들기
- MCP로 Obsidian 연동
- 지식 캡처 자동화

즉, 이 링크는 단순한 블로그가 아니라 **이번 특강의 중심 교재**에 가깝습니다.

## 왜 중요한가?

여기서 말하는 PKM은 **Personal Knowledge Management**, 즉 개인 지식 관리입니다.

예전 방식은 사람이 직접 폴더 만들고, 노트 쓰고, 링크 정리하는 방식이었다면, 이번 특강의 방향은 다음에 가깝습니다.

```text
내가 공부한 자료, 프로젝트 기록, 링크, 코드, 문서를
AI Agent가 읽고 이해하고 다시 활용할 수 있게 구조화하기
```

## 너한테 어떻게 쓰이는가?

너처럼 수업 자료, 프로젝트 파일, 오류 해결 기록, SQL 정리, 발표 자료를 많이 다루는 경우에는 이 사이트가 특히 중요합니다.

예를 들어:

```text
수업 자료를 Obsidian에 정리
OpenCode로 프로젝트 코드 수정
AGENTS.md로 AI 작업 규칙 설정
Web Clipper로 참고 자료 저장
NotebookLM으로 PDF/PPT 요약
```

이런 흐름을 하나로 묶는 기준서처럼 쓰면 됩니다.

---

# 2. OpenCode 공식 문서

## 링크

- <https://opencode.ai/docs/ko#%EC%84%A4%EC%B9%98>

## 무엇을 하는 곳인가?

**OpenCode 공식 문서**입니다.

OpenCode는 공식적으로 **오픈 소스 AI coding agent**입니다. 터미널, 데스크톱 앱, IDE 확장 등으로 사용할 수 있고, 프로젝트 파일을 읽고 수정하는 데 도움을 주는 개발용 AI Agent입니다.

쉽게 말하면:

```text
터미널 / VSCode / IDE 안에서 AI에게 내 코드 파일을 읽고 고치게 하는 도구
```

입니다.

## 왜 중요한가?

일반 ChatGPT는 보통 대화창에서 설명을 해주는 방식입니다.  
하지만 OpenCode는 실제 프로젝트 폴더 안에서 실행되기 때문에, 파일을 읽고 수정하는 작업에 더 직접적으로 연결됩니다.

예를 들어:

```text
filmDiary.jsp에서 Archive 영역만 수정해줘.
index 탭 이동 로직은 건드리지 마.
수정 전 어떤 파일을 바꿀지 먼저 계획해줘.
```

이런 식으로 요청하면, OpenCode가 프로젝트 파일을 기준으로 작업할 수 있습니다.

## 핵심 개념

| 개념 | 설명 |
|---|---|
| CLI | 명령어로 실행하는 방식 |
| TUI | 터미널 안에서 화면처럼 조작하는 인터페이스 |
| Provider | OpenAI, Claude, Gemini, Ollama 같은 AI 모델 제공자 |
| API Key | 모델 제공자에 접속하기 위한 인증키 |
| AGENTS.md | AI Agent에게 프로젝트 규칙을 알려주는 설명서 |
| Plan | 바로 수정하지 않고 먼저 계획을 세우는 방식 |
| Build / Edit | 실제 파일을 수정하는 작업 |
| Undo | 방금 한 변경을 되돌리는 기능 |

## 설치 관련 주의

OpenCode 설치 방식은 문서나 운영체제에 따라 달라질 수 있습니다. 공식 다운로드/문서에서는 예를 들어 다음 계열의 설치 방식을 안내합니다.

```bash
npm i -g opencode-ai
```

또는 공식 설치 스크립트, 패키지 매니저, 데스크톱 앱, IDE 확장 등을 제공할 수 있습니다.

따라서 설치할 때는 반드시 현재 공식 문서의 설치 부분을 기준으로 확인하는 게 좋습니다.

## 너한테 중요한 사용 습관

OpenCode에게 바로 “고쳐줘”라고 하는 것보다, 아래처럼 요청하는 게 안전합니다.

```text
먼저 수정 계획만 세워줘.
어떤 파일을 바꿀지, 어떤 부분을 건드릴지 알려줘.
승인 전에는 실제 파일을 수정하지 마.
```

그리고 실제 수정할 때는:

```text
요청한 범위 밖의 파일은 수정하지 마.
관련 없는 리팩토링, 포맷 변경, 이름 변경은 하지 마.
```

이렇게 범위를 좁히는 게 중요합니다.

---

# 3. Node.js 다운로드

## 링크

- <https://nodejs.org/ko/download>

## 무엇을 하는 곳인가?

**Node.js 공식 다운로드 페이지**입니다.

Node.js는 JavaScript를 브라우저 밖에서도 실행할 수 있게 해주는 실행 환경입니다.

쉽게 말하면:

```text
자바스크립트를 내 컴퓨터 터미널에서도 실행할 수 있게 해주는 프로그램
```

입니다.

## 왜 AI Agent 특강에서 필요한가?

OpenCode 같은 개발 도구가 Node.js의 패키지 관리자 `npm`을 통해 설치되는 경우가 많기 때문입니다.

예를 들어:

```bash
npm install -g opencode-ai
```

이런 명령어는 Node.js가 설치되어 있어야 사용할 수 있습니다.

## 핵심 개념

| 개념 | 설명 |
|---|---|
| Node.js | JavaScript 실행 환경 |
| npm | Node.js 패키지 설치 관리자 |
| `npm install` | 패키지 설치 |
| `-g` | 전역 설치, 즉 어느 폴더에서든 명령어를 사용할 수 있게 설치 |
| LTS | 장기 지원 버전 |
| Current | 최신 기능이 들어간 현재 버전 |

## 주의할 점

Node.js 공식 페이지의 버전 번호는 시간이 지나면 바뀝니다.  
그래서 특정 버전 숫자만 외우기보다, 보통은 **LTS 버전**을 설치한다고 이해하는 게 안전합니다.

초보자나 수업용 환경에서는 대부분 **LTS 버전**을 권장합니다.

---

# 4. ChatGPT Codex Cloud Analytics

## 링크

- <https://chatgpt.com/codex/cloud/settings/analytics>

## 무엇을 하는 곳인가?

이 링크는 일반 공개 문서 페이지가 아니라, **ChatGPT/Codex 내부 설정 페이지**로 보입니다.

로그인 상태, 요금제, 워크스페이스 권한, 조직 설정에 따라 보이는 화면이 달라질 수 있습니다.

따라서 이 링크는 다음에 가까운 용도로 이해하면 됩니다.

```text
Codex Cloud 관련 사용량, 분석, 설정을 확인하는 내부 설정 화면
```

## 왜 중요한가?

Codex는 OpenAI 쪽의 코드 작업용 AI 기능입니다.  
Codex Cloud는 로컬 컴퓨터가 아니라 OpenAI 쪽 클라우드 환경에서 코드 작업을 처리하는 흐름과 연결될 수 있습니다.

Analytics라는 이름상, 일반 코딩 화면이라기보다는 다음 정보를 확인하는 설정 화면일 가능성이 큽니다.

| 항목 | 설명 |
|---|---|
| 사용량 | Codex를 얼마나 사용했는지 |
| 작업 기록 | 어떤 작업이 실행되었는지 |
| 워크스페이스 분석 | 팀/조직 단위 사용 현황 |
| 설정 | Codex Cloud 관련 환경 설정 |

## 주의할 점

이 링크는 계정 권한이 없으면 정상 화면이 안 보이거나 ChatGPT 메인으로 이동할 수 있습니다.

그래서 이 링크는:

```text
모든 사용자가 반드시 볼 수 있는 공개 자료
```

라기보다는,

```text
Codex 기능이 활성화된 계정 또는 워크스페이스에서 접근 가능한 설정 페이지
```

로 보는 게 안전합니다.

---

# 5. OpenCode Anthropic Auth 플러그인

## 링크

- <https://github.com/ex-machina-co/opencode-anthropic-auth>

## 무엇을 하는 곳인가?

**OpenCode에서 Anthropic/Claude 인증을 붙이기 위한 비공식 플러그인 저장소**입니다.

쉽게 말하면:

```text
OpenCode에서 Claude 계정 인증을 사용하려는 플러그인
```

에 가깝습니다.

## 왜 나왔을 가능성이 높은가?

OpenCode를 사용할 때 모델 제공자를 연결해야 합니다.

보통은 다음 방식이 있습니다.

```text
OpenAI API Key 연결
Anthropic API Key 연결
Google Gemini API Key 연결
Ollama 같은 로컬 모델 연결
```

그런데 이 플러그인은 API Key 방식이 아니라 Claude 계정 인증/OAuth 쪽을 OpenCode에 연결하려는 목적의 도구입니다.

## 매우 중요한 주의점

이 저장소 README에는 약관 위반 가능성, 계정 제한 가능성 등에 대한 경고가 포함되어 있습니다.

즉, 이 링크는:

```text
공식 Anthropic 도구가 아님
OpenCode 공식 기본 기능이라고 보기 어려움
사용 시 계정 제재나 약관 문제가 생길 수 있음
```

으로 이해해야 합니다.

## 너한테 추천하는 해석

수업에서 이 링크가 나왔다고 해서 무조건 설치하라는 뜻으로 받아들이면 위험합니다.

이 링크는 다음처럼 이해하는 게 안전합니다.

```text
OpenCode에서 Claude 계정 연동을 시도하는 비공식 사례
```

실제 사용 여부는 교수님 안내, 계정 정책, 플러그인 신뢰성, 보안 위험을 확인하고 판단해야 합니다.

---

# 6. Hugging Face

## 링크

- <https://huggingface.co/>

## 무엇을 하는 곳인가?

**AI 모델, 데이터셋, 데모 앱을 공유하는 대표적인 AI/머신러닝 플랫폼**입니다.

쉽게 말하면:

```text
AI 모델들의 GitHub 같은 곳
```

입니다.

## 여기서 할 수 있는 것

| 기능 | 설명 |
|---|---|
| Models | LLM, 이미지 생성 모델, 음성 모델 등 AI 모델 검색 |
| Datasets | 학습용 데이터셋 검색 |
| Spaces | AI 데모 앱 실행/배포 |
| Docs | 모델과 라이브러리 사용법 확인 |
| Community | 연구자/개발자들이 모델과 자료 공유 |

## 왜 AI Agent 특강에서 중요한가?

AI Agent가 사용하는 두뇌는 결국 AI 모델입니다.  
Hugging Face는 그런 모델을 찾고, 비교하고, 테스트하거나 내려받을 수 있는 대표 플랫폼입니다.

예를 들어:

```text
한국어 임베딩 모델 찾기
로컬에서 돌릴 수 있는 작은 LLM 찾기
이미지 생성 모델 찾아보기
문서 분류 모델 찾기
오픈소스 모델 다운로드하기
```

이런 데 사용할 수 있습니다.

## 너한테 어떻게 쓰이는가?

당장 프로젝트 개발에서는 필수는 아닐 수 있지만, 나중에 다음을 해보고 싶다면 중요합니다.

```text
내 컴퓨터에서 AI 모델 돌리기
한국어 문서 검색 시스템 만들기
나만의 챗봇 만들기
이미지 생성/분류 모델 실험하기
```

---

# 7. Backend.AI GO

## 링크

- <https://go.backend.ai/ko/>

## 무엇을 하는 곳인가?

**내 컴퓨터에서 AI 모델과 Agent를 실행하고 관리할 수 있게 돕는 데스크톱 AI 플랫폼**입니다.

공식 설명 기준으로 Backend.AI GO는 로컬 우선, 프라이버시, 에이전트 실행, MCP, 여러 장치 연결 같은 방향을 강조합니다.

쉽게 말하면:

```text
내 컴퓨터 안에서 AI 모델과 Agent를 실행하고 관리하는 프로그램
```

입니다.

## 핵심 기능

| 기능 | 설명 |
|---|---|
| 로컬 모델 실행 | 내 PC에서 LLM 실행 |
| 프라이버시 | 프롬프트, 파일, 실행 결과를 내 장비 안에 둘 수 있음 |
| Agent 허브 | 여러 Agent 작업을 관리하는 방향 |
| MCP 지원 | 외부 도구와 연결하는 표준 방식 지원 |
| GO Mesh | 여러 장치의 GO를 연결하는 기능 |

## 왜 중요한가?

ChatGPT, Claude 같은 서비스는 보통 외부 서버를 사용합니다.  
반면 Backend.AI GO는 **로컬에서 AI를 돌리는 방향**과 연결됩니다.

이건 다음 상황에서 중요합니다.

```text
민감한 파일을 외부로 보내기 싫을 때
로컬 LLM을 실험하고 싶을 때
내 PC에서 Agent를 실행해보고 싶을 때
MCP 기반 자동화를 실험하고 싶을 때
```

## 너한테는 지금 필수인가?

지금 당장 JSP/Servlet 프로젝트를 하거나 OpenCode 기초를 배우는 단계라면 필수는 아닙니다.

하지만 나중에:

```text
로컬 AI
MCP
내 파일 기반 Agent
개인 지식관리 자동화
```

이쪽을 깊게 해보고 싶다면 중요해지는 도구입니다.

---

# 8. Obsidian Web Clipper

## 링크

- <https://obsidian.md/clipper>

## 무엇을 하는 곳인가?

**웹페이지를 Obsidian 노트로 저장하는 브라우저 확장 기능**입니다.

쉽게 말하면:

```text
웹에서 본 좋은 글, 문서, 자료를 Obsidian Vault에 바로 저장하는 도구
```

입니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 웹페이지 저장 | 블로그, 문서, 기사 저장 |
| 하이라이트 | 중요한 문장 표시 |
| 템플릿 | 저장 형식을 정해둘 수 있음 |
| Markdown 저장 | Obsidian에서 읽기 좋은 `.md` 형태로 저장 |
| 로컬 관리 | 저장한 자료를 내 Vault에서 관리 |

## 왜 AI Agent 특강에서 중요한가?

AI Agent가 잘 도와주려면, Agent가 읽을 수 있는 자료가 필요합니다.

Obsidian Web Clipper는 인터넷에서 본 자료를 내 지식 저장소에 쌓는 입구 역할을 합니다.

예를 들어:

```text
SQLD 정리글 저장
JSP/Servlet 참고 문서 저장
OpenCode 설정법 저장
Figma 디자인 참고 저장
AI Agent 관련 블로그 저장
프로젝트 발표 자료 참고 링크 저장
```

이렇게 모아두면 나중에 AI가 내 Obsidian Vault를 기준으로 정리, 요약, 연결을 도와줄 수 있습니다.

---

# 9. AGENTS.md 가이드

## 링크

- <https://www.aihero.dev/a-complete-guide-to-agents-md>

> 같은 링크가 두 번 들어있습니다.

## 무엇을 하는 곳인가?

**AGENTS.md를 어떻게 잘 작성할지 설명하는 글**입니다.

AGENTS.md는 쉽게 말하면:

```text
AI 코딩 에이전트를 위한 README
```

입니다.

사람이 프로젝트를 볼 때 `README.md`를 읽듯이, AI Agent는 `AGENTS.md`를 읽고 프로젝트 작업 규칙을 이해할 수 있습니다.

## 왜 중요한가?

OpenCode, Codex CLI 같은 AI coding agent에게 프로젝트를 맡길 때, 그냥 “고쳐줘”라고 하면 너무 넓게 해석할 수 있습니다.

AGENTS.md에 미리 규칙을 써두면 AI가 다음을 알 수 있습니다.

```text
프로젝트 구조
실행 방법
수정 금지 영역
코딩 스타일
테스트 방법
작업 전 확인해야 할 것
```

## 좋은 AGENTS.md의 방향

| 나쁜 방향 | 좋은 방향 |
|---|---|
| 모든 내용을 한 파일에 다 넣음 | 핵심 규칙만 짧고 명확하게 |
| 파일 경로를 지나치게 세세하게 고정 | 구조와 원칙 중심으로 설명 |
| 오래된 규칙이 계속 남음 | 자주 갱신 가능한 형태 |
| “항상”, “절대”가 너무 많음 | 꼭 필요한 금지/주의만 작성 |
| AI가 매번 너무 긴 문서를 읽음 | 필요할 때만 세부 문서 참고 |

## 너한테 중요한 점

너는 OpenCode에게 파일 수정을 많이 맡기기 때문에, AGENTS.md에는 특히 이런 규칙이 필요합니다.

```text
요청한 파일과 영역만 수정한다.
관련 없는 리팩토링을 하지 않는다.
기존 UI 구조와 라우팅을 깨지 않는다.
수정 전 변경 파일 목록을 먼저 제시한다.
JSP/Servlet/Oracle DB 흐름을 임의로 바꾸지 않는다.
```

---

# 10. Andrej Karpathy 스타일 CLAUDE.md 예시

## 링크

- <https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md>

## 무엇을 하는 곳인가?

**Claude Code나 AI 코딩 도구에게 줄 행동 지침 예시 파일**입니다.

저장소 설명상, LLM 코딩 실수를 줄이기 위한 행동 가이드라인입니다.

## 핵심 방향

| 규칙 | 의미 |
|---|---|
| Think Before Coding | 코딩 전에 먼저 생각하고 계획하기 |
| Simplicity First | 필요 이상으로 복잡하게 만들지 않기 |
| Surgical Changes | 요청한 부분만 정확히 수정하기 |
| Goal-Driven Execution | 목표와 성공 기준을 확인하며 작업하기 |
| Caution Over Speed | 빠른 작업보다 실수 방지를 우선하기 |

## 너한테 특히 중요한 규칙

가장 중요한 건 **Surgical Changes**입니다.

즉:

```text
요청한 부분만 수술하듯이 정확히 고치고,
관련 없는 코드나 파일은 건드리지 말라
```

는 뜻입니다.

너가 자주 겪는 문제는 이런 것입니다.

```text
나는 filmDiary.jsp의 Archive UI만 고치라고 했는데,
AI가 다른 탭, 다른 CSS, 라우팅, DB 코드까지 건드림
```

이런 사고를 줄이기 위해 CLAUDE.md나 AGENTS.md에 이런 규칙을 넣을 수 있습니다.

```text
Make surgical changes only.
Do not refactor unrelated code.
Do not rename files, routes, IDs, classes, or database fields unless explicitly requested.
```

## 주의할 점

이 링크는 “정답 파일”이라기보다는 **좋은 행동 규칙 예시**입니다.  
그대로 복사하기보다, 네 프로젝트와 수업 환경에 맞게 줄여서 쓰는 게 좋습니다.

---

# 11. Obsidian Skills

## 링크

- <https://github.com/kepano/obsidian-skills>

## 무엇을 하는 곳인가?

**Obsidian을 AI Agent가 더 잘 다루게 하기 위한 Skills 모음**입니다.

쉽게 말하면:

```text
AI Agent에게 Obsidian 사용법을 더 자세히 가르치는 추가 설명서 묶음
```

입니다.

## Skills란?

Skill은 AI Agent에게 특정 작업을 더 잘하게 하는 작은 지침 패키지입니다.

예를 들어:

```text
Obsidian Markdown을 잘 쓰는 법
Obsidian Canvas 파일을 만드는 법
Obsidian CLI로 Vault를 다루는 법
웹페이지를 Markdown으로 정리하는 법
```

같은 내용을 AI에게 알려주는 역할입니다.

## 주요 예시

| Skill | 역할 |
|---|---|
| obsidian-markdown | Obsidian식 Markdown 작성/수정 |
| obsidian-bases | Obsidian Bases 문법 지원 |
| json-canvas | Obsidian Canvas 파일 작성 |
| obsidian-cli | Obsidian CLI와 연동 |
| defuddle | 웹페이지에서 깔끔한 Markdown 추출 |

## 왜 중요한가?

Obsidian은 일반 Markdown보다 기능이 많습니다.

예를 들어:

```text
[[위키링크]]
![[임베드]]
태그
속성
Canvas
Bases
템플릿
```

이런 기능을 AI가 정확히 이해하려면 별도 지침이 있으면 좋습니다.

## 너한테 어떻게 쓰이는가?

너가 Obsidian을 수업 정리, 프로젝트 기록, 오류 해결 기록, AGENTS.md 관리용으로 쓴다면, Obsidian Skills는 다음에 도움이 됩니다.

```text
노트 구조 정리
수업 내용 요약
프로젝트별 문서 자동 생성
링크 관계 정리
Canvas 형태로 개념도 만들기
```

---

# 12. Google Stitch

## 링크

- <https://stitch.withgoogle.com/>

## 무엇을 하는 곳인가?

**Google의 AI UI 디자인 도구**입니다.

공식 설명 기준으로 Stitch는 모바일/웹 애플리케이션 UI를 생성해서 디자인 아이디어를 빠르게 만들 수 있게 도와주는 도구입니다.

쉽게 말하면:

```text
말로 설명하거나 이미지를 참고로 주면 UI 디자인 시안을 만들어주는 Google AI 디자인 도구
```

입니다.

## 무엇을 할 수 있나?

예를 들어 이런 요청을 할 수 있습니다.

```text
갈색/크림톤의 영화 다이어리 웹앱 UI를 만들어줘.
모바일 로그인 화면을 만들어줘.
대시보드 화면을 카드형 UI로 만들어줘.
책처럼 펼쳐진 기록 앱 화면을 만들어줘.
```

## 왜 중요한가?

AI Agent 특강에서 Stitch가 나온 이유는, 개발 전에 UI 아이디어를 빠르게 뽑아보기 좋기 때문입니다.

전통적인 흐름:

```text
기획 → 와이어프레임 → 디자인 → 코드
```

AI 도구를 쓰는 흐름:

```text
자연어 설명 → AI UI 시안 → 수정 → 코드/디자인 도구로 연결
```

## 너한테 어떻게 쓰이는가?

너는 UI에 신경을 많이 쓰고, Figma/Canva로 디자인을 많이 만지기 때문에 Stitch가 잘 맞을 수 있습니다.

예를 들어 영화 다이어리 프로젝트에서:

```text
Write 페이지 시안
Archive 페이지 시안
Stats/Badges 페이지 시안
책 펼친 레이아웃
티켓 카드 디자인
마스킹테이프 느낌의 UI
```

이런 것을 빠르게 시각화하는 데 사용할 수 있습니다.

---

# 13. Penpot

## 링크

- <https://penpot.app/>

## 무엇을 하는 곳인가?

**오픈소스 디자인 플랫폼**입니다.

쉽게 말하면:

```text
Figma와 비슷한 UI/UX 디자인 도구인데, 오픈소스 성격이 강한 도구
```

입니다.

## 주요 특징

| 특징 | 설명 |
|---|---|
| 오픈소스 | 소스가 공개된 디자인 플랫폼 |
| UI/UX 디자인 | 화면 설계 가능 |
| 프로토타입 | 화면 전환 흐름 제작 가능 |
| 협업 | 팀원과 함께 작업 가능 |
| 디자인 시스템 | 색상, 컴포넌트, 토큰 관리 |
| 코드/AI 워크플로우 | 디자인과 개발 연결을 강조 |

## Figma와의 관계

Penpot은 Figma의 대체재처럼 이야기되는 경우가 많습니다.  
둘 다 UI 디자인과 프로토타입을 만들 수 있지만, Penpot은 **오픈소스, 자기 호스팅 가능성, 개발자/AI 워크플로우 연결**을 더 강조합니다.

## 왜 AI Agent 특강에서 중요한가?

AI Agent가 디자인 파일을 읽거나, 디자인 시스템을 이해하거나, UI를 코드로 옮기는 흐름에서 디자인 도구가 중요해집니다.

Penpot은 특히 다음 방향과 연결됩니다.

```text
디자인 시스템
개발자 친화적 디자인
AI가 이해하기 쉬운 디자인 구조
MCP 기반 디자인/코드 연결
```

## 너한테 어떻게 쓰이는가?

너는 프로젝트 UI를 예쁘게 만들고 싶어 하고, Figma/Canva도 자주 쓰기 때문에 Penpot은 다음 용도로 볼 수 있습니다.

```text
영화 다이어리 UI 시안 만들기
페이지 구조 잡기
색상/컴포넌트 정리
디자인을 개발 코드로 옮기기 위한 기준 만들기
```

---

# 14. Exa

## 링크

- <https://exa.ai/>

## 무엇을 하는 곳인가?

**AI Agent용 웹 검색 API / AI 검색 엔진**입니다.

쉽게 말하면:

```text
AI Agent가 인터넷 검색을 잘하도록 붙여주는 검색 도구
```

입니다.

## 일반 검색과의 차이

네이버나 구글은 사람이 직접 검색해서 결과를 고르는 방식입니다.  
Exa는 개발자가 AI Agent나 앱에 검색 기능을 붙이기 위한 API 성격이 강합니다.

즉:

```text
사람이 쓰는 검색창
```

이라기보다,

```text
AI가 쓰는 검색 엔진
```

에 가깝습니다.

## 무엇을 할 수 있나?

| 기능 | 설명 |
|---|---|
| Search API | 웹 검색 결과 가져오기 |
| Contents | 검색한 페이지 내용 가져오기 |
| Answer | 검색 기반 답변 생성 |
| Websets | 조건에 맞는 웹 데이터 수집 |
| Crawler | 웹사이트 크롤링 |

## 왜 중요한가?

AI Agent가 최신 정보를 다루려면 검색 기능이 필요합니다.

예를 들어 Agent에게 다음 작업을 시킬 수 있습니다.

```text
최신 공식 문서 찾아오기
특정 라이브러리 사용법 검색하기
경쟁 서비스 조사하기
논문/블로그/코드 자료 찾기
검색 결과를 요약해서 보고서 만들기
```

이런 기능을 직접 구현할 때 Exa 같은 검색 API가 쓰일 수 있습니다.

## 너한테 지금 필요한가?

지금 당장 OpenCode/Obsidian을 배우는 단계에서는 필수는 아닙니다.

하지만 나중에:

```text
검색하는 AI Agent 만들기
최신 자료 자동 수집하기
내 주제에 맞는 자료를 자동으로 찾아오는 시스템 만들기
```

이런 걸 하고 싶다면 중요한 서비스입니다.

---

# 15. Google NotebookLM

## 링크

- <https://notebooklm.google.com/?icid=home_maincta&_gl=1*10n54c3*_ga*OTg4NTE5NjA1LjE3Nzg5MTcyNjA.*_ga_W0LDH41ZCB*czE3Nzg5MTcyNTkkbzEkZzEkdDE3Nzg5MTc4OTEkajYwJGwwJGgw>

## 무엇을 하는 곳인가?

**Google의 자료 기반 AI 학습/연구 도구**입니다.

쉽게 말하면:

```text
내가 넣은 자료만 기준으로 요약하고 질문에 답해주는 AI 노트
```

입니다.

## 넣을 수 있는 자료 예시

NotebookLM은 다음과 같은 자료를 소스로 넣을 수 있습니다.

```text
PDF
웹사이트
YouTube 영상
오디오 파일
Google Docs
Google Slides
텍스트 자료
```

## ChatGPT와의 차이

| ChatGPT | NotebookLM |
|---|---|
| 범용 대화/작업에 강함 | 내가 넣은 자료 기반 학습에 강함 |
| 코드, 글쓰기, 분석, 상담 등 범위가 넓음 | 소스 기반 요약/질문/학습자료 생성에 특화 |
| 대화 맥락과 일반 지식 활용 | 노트북에 넣은 자료 중심 |
| 프로젝트 작업에 유용 | 수업자료, PDF, 논문, 발표자료 정리에 유용 |

## 주요 기능

| 기능 | 설명 |
|---|---|
| 자료 요약 | 업로드한 자료 핵심 정리 |
| 질의응답 | 자료 내용 기반 질문 답변 |
| Audio Overview | 자료를 바탕으로 오디오 설명 생성 |
| Video Overview | 자료를 바탕으로 영상형 설명 생성 |
| Flashcards | 암기 카드 생성 |
| Quizzes | 퀴즈 생성 |
| Infographic | 인포그래픽 생성 |
| Slide Deck | 슬라이드 자료 생성 |

## 너한테 어떻게 쓰이는가?

너는 수업자료, PDF, PPT, 프로젝트 설계서, 발표 자료를 자주 다루기 때문에 NotebookLM이 잘 맞습니다.

예를 들어:

```text
교수님 PDF 넣고 시험 대비 요약
PPT 넣고 발표 대본 만들기
프로젝트 설계서 넣고 기능 흐름 정리
SQL 자료 넣고 예상문제 만들기
긴 강의 자료를 챕터별로 정리
```

이런 데 사용할 수 있습니다.

---

# 16. Lucide

## 링크

- <https://lucide.dev/>

## 무엇을 하는 곳인가?

**오픈소스 아이콘 라이브러리**입니다.

쉽게 말하면:

```text
웹사이트나 앱 UI에 넣는 깔끔한 선형 아이콘 모음
```

입니다.

## 특징

| 특징 | 설명 |
|---|---|
| SVG 기반 | 확대해도 깨지지 않는 벡터 아이콘 |
| 가벼움 | 웹 UI에 쓰기 좋음 |
| 일관된 스타일 | 선 두께와 모양이 통일되어 있음 |
| 커스터마이징 가능 | 색상, 크기, stroke width 조절 가능 |
| 패키지 지원 | React, Vue, Svelte 등에서 사용 가능 |

## 어떤 아이콘이 있나?

예를 들어 다음 같은 아이콘을 찾을 수 있습니다.

```text
home
search
user
calendar
heart
star
book
film
ticket
settings
trash
edit
```

## 너의 영화 다이어리 프로젝트에 적용하면?

| 기능 | 어울리는 Lucide 아이콘 예시 |
|---|---|
| Write | `PenLine`, `NotebookPen` |
| Archive | `Archive`, `Film`, `Ticket` |
| Stats | `ChartBar`, `ChartPie` |
| Badges | `Award`, `BadgeCheck`, `Trophy` |
| Calendar | `CalendarDays` |
| Emotion Tag | `Smile`, `Heart` |
| Edit | `Pencil`, `Edit3` |
| Delete | `Trash2` |

## 왜 중요한가?

아이콘은 UI 완성도에 영향을 많이 줍니다.

Lucide는 스타일이 깔끔하고 통일되어 있어서, 프로젝트 UI에 넣으면 전체적인 디자인이 덜 촌스럽고 정돈되어 보입니다.

---

# 17. Artificial Analysis LLM Leaderboard

## 링크

- <https://artificialanalysis.ai/leaderboards/models>

## 무엇을 하는 곳인가?

**AI 모델 성능 비교 사이트**입니다.

쉽게 말하면:

```text
GPT, Claude, Gemini, DeepSeek, Qwen 같은 AI 모델들을 비교하는 순위표
```

입니다.

## 비교할 수 있는 항목

| 항목 | 뜻 |
|---|---|
| Intelligence | 모델의 문제 해결/추론 성능 |
| Price | API 사용 가격 |
| Output Speed | 출력 속도 |
| Latency | 첫 응답까지 걸리는 시간 |
| Context Window | 한 번에 넣을 수 있는 문서/코드 길이 |
| Provider | 모델을 제공하는 API 업체 |
| Open weights 여부 | 모델 가중치 공개 여부 |

## 왜 AI Agent 특강에서 중요한가?

AI Agent를 만들 때 어떤 모델을 쓰느냐에 따라 결과가 크게 달라집니다.

예를 들어:

```text
코딩 Agent → 지능 높은 모델이 중요
긴 문서 분석 → context window가 큰 모델이 중요
실시간 챗봇 → latency와 속도가 중요
반복 자동화 → 가격이 중요
로컬 실행 → open weights 여부가 중요
```

Artificial Analysis는 이런 모델 선택을 도와주는 참고 사이트입니다.

## 주의할 점

리더보드는 절대적인 정답이 아닙니다.  
벤치마크 방식, 업데이트 시점, 가격 정책, 모델 제공자 상태에 따라 결과가 바뀔 수 있습니다.

그래서 이 사이트는:

```text
모델 선택을 위한 참고 자료
```

로 보는 것이 좋습니다.

---

# 우선순위 정리

지금 너한테 중요한 순서로 정리하면 다음과 같습니다.

| 우선순위 | 링크/도구 | 지금 중요한 이유 |
|---|---|---|
| 1 | 교수님 PKM Course | 수업 전체 흐름의 기준 |
| 2 | OpenCode Docs | OpenCode 설치/사용법 |
| 3 | Node.js | OpenCode 설치 기반 |
| 4 | AGENTS.md Guide | global AGENTS.md 제대로 만들기 |
| 5 | CLAUDE.md 예시 | AI가 쓸데없이 파일 안 건드리게 만들기 |
| 6 | Obsidian Web Clipper | 수업자료/웹자료 저장 자동화 |
| 7 | Obsidian Skills | Obsidian을 AI가 잘 다루게 하기 |
| 8 | NotebookLM | PDF/PPT/수업자료 요약·시험대비 |
| 9 | Lucide | 프로젝트 UI 아이콘 |
| 10 | Penpot / Stitch | UI 시안 생성/디자인 |
| 11 | Hugging Face / Artificial Analysis | AI 모델 공부 |
| 12 | Exa | Agent 검색 기능 개발 |
| 13 | Backend.AI GO | 로컬 AI Agent 실행 |
| 주의 | opencode-anthropic-auth | 비공식 플러그인이라 사용 주의 |
| 조건부 | Codex Analytics | 계정/워크스페이스 권한에 따라 보이는 내부 설정 가능성 |

---

# 최종 한 줄 요약

이번 링크들은 각각 따로 떨어진 사이트가 아니라, 전체적으로 보면 다음 흐름을 만들기 위한 자료입니다.

```text
AI Agent 개발 환경을 설치하고,
AI에게 프로젝트 규칙을 알려주고,
Obsidian에 내 지식을 쌓고,
웹 자료를 자동 수집하고,
모델과 검색 API를 연결하고,
UI 디자인과 코드 작업까지 AI와 함께 진행하는 흐름
```
