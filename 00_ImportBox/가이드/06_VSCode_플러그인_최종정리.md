---
title: VSCode 플러그인 최종정리
created: 2026-06-05
tags:
  - migration
  - vscode
  - extensions
  - home-pc
status: final-guide
source: code --list-extensions --show-versions
extension_count: 36
---

# VSCode 플러그인 최종정리

> [!important] 용어
> VS Code에서는 보통 `플러그인`보다 **확장 프로그램(extension)** 이 정확한 표현이다. 여기서는 사용자가 알아보기 쉽게 `플러그인`이라고도 적는다.

## 1. Git 기준

```text
Git에 올릴 것:
- 이 문서

Git에 올리지 않을 것:
- VS Code 설치 폴더
- VS Code extension 실제 설치 파일
- .vscode/ 개인 설정
- *.code-workspace

집 PC에서 할 것:
- 아래 extension ID 목록으로 재설치
```

## 2. 확인 기준

실행 위치:

```text
WSL Ubuntu
/mnt/d/dev/MyStudy
```

확인 명령:

```bash
code --list-extensions --show-versions
```

확인 결과:

```text
총 36개
```

> [!warning] Windows VS Code와 WSL VS Code 구분
> Windows PowerShell에서 실행한 `code --list-extensions`와 WSL Ubuntu에서 실행한 `code --list-extensions` 결과가 다를 수 있다. MyStudy는 WSL 기준으로 쓰므로, 집 PC에서는 **WSL Ubuntu에서 먼저 설치/확인**한다.

## 3. 반드시 설치할 핵심 묶음

### 3.1 AI / Agent

```text
anthropic.claude-code
```

### 3.2 Markdown / 학습노트

```text
bierner.markdown-checkbox
bierner.markdown-emoji
davidanson.vscode-markdownlint
shd101wyy.markdown-preview-enhanced
streetsidesoftware.code-spell-checker
vstirbu.vscode-mermaid-preview
yzhang.markdown-all-in-one
zaaack.markdown-editor
```

### 3.3 HTML / CSS / Web 수업

```text
ecmel.vscode-html-css
formulahendry.auto-close-tag
formulahendry.auto-rename-tag
pranaygp.vscode-css-peek
ritwickdey.liveserver
vincaslt.highlight-matching-tag
esbenp.prettier-vscode
usernamehw.errorlens
```

### 3.4 Java / Spring 수업

```text
oracle.oracle-java
redhat.java
vscjava.vscode-gradle
vscjava.vscode-java-debug
vscjava.vscode-java-dependency
vscjava.vscode-java-pack
vscjava.vscode-java-test
vscjava.vscode-maven
```

### 3.5 DB / SQL

```text
oracle.sql-developer
dbdiagram.dbdiagram-vscode
```

### 3.6 Container / Dev Environment

```text
ms-azuretools.vscode-containers
ms-vscode-remote.remote-containers
```

### 3.7 Git / 보기 / 편의

```text
eamodio.gitlens
grapecity.gc-excelviewer
tomoki1207.pdf
catppuccin.catppuccin-vsc
catppuccin.catppuccin-vsc-icons
pkief.material-icon-theme
jakobhoeg.vscode-pokemon
```

## 4. 현재 설치된 전체 목록

```text
anthropic.claude-code@2.1.165
bierner.markdown-checkbox@0.4.0
bierner.markdown-emoji@0.3.1
catppuccin.catppuccin-vsc@3.19.0
catppuccin.catppuccin-vsc-icons@1.26.0
davidanson.vscode-markdownlint@0.61.2
dbdiagram.dbdiagram-vscode@0.2.1
eamodio.gitlens@18.0.0
ecmel.vscode-html-css@2.0.14
esbenp.prettier-vscode@12.4.0
formulahendry.auto-close-tag@0.5.15
formulahendry.auto-rename-tag@0.1.10
grapecity.gc-excelviewer@4.2.65
jakobhoeg.vscode-pokemon@4.3.5
ms-azuretools.vscode-containers@2.4.5
ms-vscode-remote.remote-containers@0.459.0
oracle.oracle-java@25.1.0
oracle.sql-developer@26.1.2
pkief.material-icon-theme@5.35.0
pranaygp.vscode-css-peek@4.4.3
redhat.java@1.54.0
ritwickdey.liveserver@5.7.10
shd101wyy.markdown-preview-enhanced@0.8.28
streetsidesoftware.code-spell-checker@4.5.6
tomoki1207.pdf@1.2.2
usernamehw.errorlens@3.28.0
vincaslt.highlight-matching-tag@0.11.0
vscjava.vscode-gradle@3.17.3
vscjava.vscode-java-debug@0.59.0
vscjava.vscode-java-dependency@0.27.5
vscjava.vscode-java-pack@0.31.0
vscjava.vscode-java-test@0.45.0
vscjava.vscode-maven@0.45.3
vstirbu.vscode-mermaid-preview@2.1.2
yzhang.markdown-all-in-one@3.6.3
zaaack.markdown-editor@0.1.13
```

## 5. 집 PC 재설치 명령

> [!important] 실행 위치
> MyStudy를 WSL에서 열어 쓸 것이므로 **WSL Ubuntu에서 먼저 실행**한다.

```bash
code --install-extension anthropic.claude-code
code --install-extension bierner.markdown-checkbox
code --install-extension bierner.markdown-emoji
code --install-extension catppuccin.catppuccin-vsc
code --install-extension catppuccin.catppuccin-vsc-icons
code --install-extension davidanson.vscode-markdownlint
code --install-extension dbdiagram.dbdiagram-vscode
code --install-extension eamodio.gitlens
code --install-extension ecmel.vscode-html-css
code --install-extension esbenp.prettier-vscode
code --install-extension formulahendry.auto-close-tag
code --install-extension formulahendry.auto-rename-tag
code --install-extension grapecity.gc-excelviewer
code --install-extension jakobhoeg.vscode-pokemon
code --install-extension ms-azuretools.vscode-containers
code --install-extension ms-vscode-remote.remote-containers
code --install-extension oracle.oracle-java
code --install-extension oracle.sql-developer
code --install-extension pkief.material-icon-theme
code --install-extension pranaygp.vscode-css-peek
code --install-extension redhat.java
code --install-extension ritwickdey.liveserver
code --install-extension shd101wyy.markdown-preview-enhanced
code --install-extension streetsidesoftware.code-spell-checker
code --install-extension tomoki1207.pdf
code --install-extension usernamehw.errorlens
code --install-extension vincaslt.highlight-matching-tag
code --install-extension vscjava.vscode-gradle
code --install-extension vscjava.vscode-java-debug
code --install-extension vscjava.vscode-java-dependency
code --install-extension vscjava.vscode-java-pack
code --install-extension vscjava.vscode-java-test
code --install-extension vscjava.vscode-maven
code --install-extension vstirbu.vscode-mermaid-preview
code --install-extension yzhang.markdown-all-in-one
code --install-extension zaaack.markdown-editor
```

## 6. 설치 후 검증

```bash
code --list-extensions --show-versions
```

확인 기준:

```text
1. 총 36개인지 확인
2. anthropic.claude-code가 있는지 확인
3. redhat.java와 vscjava.* Java 확장들이 있는지 확인
4. ritwickdey.liveserver가 있는지 확인
5. shd101wyy.markdown-preview-enhanced와 yzhang.markdown-all-in-one이 있는지 확인
```

빠른 확인 명령:

```bash
code --list-extensions | sort > /tmp/vscode-extensions.txt
grep -E 'anthropic.claude-code|redhat.java|vscjava.vscode-java-pack|ritwickdey.liveserver|shd101wyy.markdown-preview-enhanced|yzhang.markdown-all-in-one' /tmp/vscode-extensions.txt
```

## 7. 충돌 주의

| 묶음 | 주의 |
|---|---|
| Java | `oracle.oracle-java`, `redhat.java`, `vscjava.vscode-java-pack`가 함께 있음. Java project 인식이 이상하면 하나씩 disable해서 확인한다. |
| Markdown | Preview/editor 계열이 여러 개다. 단축키나 preview가 겹치면 실제 쓰는 것만 enable한다. |
| Theme/Icon | 여러 개 설치되어도 실제 적용 theme/icon은 하나만 선택된다. |
| Dev Containers | Docker Desktop/WSL integration이 없으면 extension만 있어도 container 실행은 안 된다. |

## 8. 집 PC에서 최종 체크

```text
[ ] WSL Ubuntu에서 code 명령 실행됨
[ ] code --list-extensions --show-versions 성공
[ ] 총 36개 설치 확인
[ ] Java 파일 열 때 자동완성/오류 표시 확인
[ ] HTML 파일 Live Server 실행 확인
[ ] Markdown preview 확인
```
