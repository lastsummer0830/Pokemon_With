# 프로젝트 재구성 & 설정 작업 지시서 (최종)

작업 루트: `D:\dev\AJ_Proj`  (이하 AJ_Proj)
혼자 다듬는 개인 작업이다. 협업/원격 push 계획 없음.

**중요 1: DB 접속정보(config.properties)는 절대 git에 커밋하지 말 것. 이미 .gitignore에 등록돼 있음.**
**중요 2: 자바 둘(webProj_Popflex)은 servlet 네임스페이스가 javax다. jakarta로 올리지 말 것 (63개 파일 import 다 깨짐).**

---

## 0. 현재 폴더 구조 (이미 사람이 배치 완료)

```
AJ_Proj/
├── pokemonJava/            ← Swing 게임 (IntelliJ로 실행)
├── webProj_Popflex/        ← Tomcat 영화예매 웹앱 (IntelliJ로 실행)
└── vcPortfolio_AJ/         ← 정적 웹 묶음 (VS Code로 실행)
    ├── .vscode/
    ├── frontend_proj/      ← 4인 팀 협업이었던 정적 웹 (지금은 개인 사본)
    └── nintendo_Portfolio/ ← 닌텐도 정적 포트폴리오
```

폴더 배치는 끝났다. 이 위에 git 설정 + 자바 Maven 전환 + 정리만 하면 된다.

---

## 1. 사실관계 (이미 조사 완료 — 가정/추측 금지)

### webProj_Popflex (JSP/Servlet 영화예매 웹앱, 구 WebPojws2 / Eclipse명 MoviePrj)
- servlet 네임스페이스: **javax.servlet** (63개 파일). → **Tomcat 9 유지, jakarta 금지**
- JDK **17**
- 의존 jar (현재 `src/main/webapp/WEB-INF/lib/`에 직접 박힘): `ojdbc8.jar`, `jstl-1.2.jar`, `gson-2.11.0.jar`, `json-20230618.jar`
- DB 설정: **이미 외부화 완료**. `common.config.AppConfig`가 클래스패스의 `config.properties`를 읽고, `common.DBUtil`이 그걸 통해 커넥션 생성. 하드코딩 없음.
- `src/main/resources/`에 `config.properties`(실값) + `config.example.properties`(템플릿) 존재
- `.gitignore` 이미 config.properties / bin/ / target/ 제외 처리됨
- src 레이아웃이 이미 Maven 표준(`src/main/java`, `src/main/resources`, `src/main/webapp`)과 동일

### pokemonJava (순수 자바 Swing 게임, 구 javaprj)
- 의존성 없음. JDK 17.
- `src/swing_version/` 안 23개 파일이 본체. 진입점 = `swing_version.GameMain`
- 같은 폴더 안의 `Pokemon`, `pokemonAj`, `map` 등은 **연습용 → _archive로 분리, 빌드 대상 제외**

### vcPortfolio_AJ/frontend_proj (정적 웹)
- 원래 4인 팀 협업 레포였으나, 개인 사본으로 가져오며 **원본 `.git`은 이미 제거된 상태**(협업 이력 폐기 완료).
- 구조: 루트 `index.html` + `main_screen/` + `sub_screen/`

### vcPortfolio_AJ/nintendo_Portfolio (정적 웹)
- 단독 정적 HTML/CSS/JS. git 없음. 빌드 불필요.

---

## 2. git 전략 (B 방식: 이력 버리고 새 출발, 레포 3개)

1. **vcPortfolio_AJ 에서 `git init`** → 정적 웹 둘(frontend_proj + nintendo_Portfolio)을 한 레포로 관리.
   - 시작 전 확인: vcPortfolio_AJ 안에 중첩된 `.git`이 없어야 함(있으면 `git init`이 제대로 안 묶임). 없으면 그대로 진행.
   - `.gitignore`에 OS 부산물(`.DS_Store`, `Thumbs.db`) 정도. `.vscode/settings.json`은 커밋해도 무방.
   - `git init` 후 `git status`로 frontend_proj/nintendo 파일들이 Untracked로 다 뜨는지 확인 → 첫 커밋.
2. **pokemonJava 에서 `git init`** → 첫 커밋.
3. **webProj_Popflex 에서 `git init`** → 단, config.properties가 `git status`에 안 뜨는지 먼저 확인 후 첫 커밋.
4. **AJ_Proj 루트 자체는 git 안 함.** (레포 3개: vcPortfolio_AJ, pokemonJava, webProj_Popflex)

---

## 3. webProj_Popflex — Eclipse → Maven 전환 (핵심 작업)

1. src 레이아웃은 이미 Maven 표준 → 그대로 유지.
2. Eclipse 잔재 삭제: `.project`, `.classpath`, `.settings/`, `bin/`.
3. 루트에 `pom.xml` 생성:
   - `packaging`: `war`
   - `maven.compiler.source/target`: `17`
   - `project.build.sourceEncoding=UTF-8`
   - dependencies:
     - `javax.servlet:javax.servlet-api:4.0.1` (scope **provided**)
     - `javax.servlet:jstl:1.2`
     - `com.google.code.gson:gson:2.11.0`
     - `org.json:json:20230618`
     - **ojdbc8**: 둘 중 택1
       - (권장) Oracle 좌표 `com.oracle.database.jdbc:ojdbc8:21.x`  ※ DB 버전 미정이면 21 계열 최신으로
       - 또는 기존 `WEB-INF/lib/ojdbc8.jar`를 `mvn install:install-file`로 로컬 설치 후 의존성 등록
   - `maven-war-plugin` 명시.
4. `WEB-INF/lib/`의 jar들은 pom 의존성으로 대체되면 삭제 (ojdbc8 로컬설치 방식이면 그 jar는 보관).
5. `mvn clean package`로 war 생성 확인 → Tomcat 9 배포 기동 확인.
6. config: `config.example.properties` 복사 → `config.properties` 만들고 본인 DB 값 입력. **커밋 안 되는지 확인**.
7. README.md: 실행법(Tomcat 9 + JDK17 + config.properties 세팅), 의존성, 진입 URL.

> javax → jakarta 변환 금지. Servlet API는 javax 4.0.1 + Tomcat 9 고정.

---

## 4. pokemonJava — 정리 + (선택) Maven 표준화

1. `src/swing_version/`의 23개 파일이 본체. 진입점 `swing_version.GameMain`.
2. 연습용(`Pokemon`, `pokemonAj`, `map` 등)은 `AJ_Proj` 밖이나 `AJ_Proj/_archive/`로 이동, 빌드 경로 제외.
3. Eclipse 잔재(`.project`, `.classpath`, `bin/`) 삭제.
4. (선택, 통일성 위해) Maven `jar` 전환:
   - 소스를 `src/main/java/swing_version/`로, 리소스(png 등)는 `src/main/resources/`로 이동
   - `pom.xml`: packaging `jar`, compiler 17, `maven-jar-plugin`에 `mainClass = swing_version.GameMain`
   - 리소스 로딩이 상대경로면 `getResourceAsStream` 기반으로 점검/수정
5. README: 실행법(`mvn package` 후 `java -jar` 또는 IDE에서 GameMain).

---

## 5. vcPortfolio_AJ — 정적 웹 (빌드 불필요)

1. frontend_proj, nintendo_Portfolio 각각 링크/이미지 경로 깨짐 점검 (대소문자, 한글 폴더명 주의).
2. VS Code Live Server로 각 `index.html` 기동 확인.
3. README: 두 정적 웹 열람법.

---

## 6. IDE 설정 (작업 후 사람이 할 것)

- **IntelliJ IDEA Community**: pokemonJava / webProj_Popflex 각각 `File > Open`으로 폴더 열기 → Maven 자동 인식.
  - webProj_Popflex: Tomcat 9 Local run config (war exploded). Community에 Tomcat 통합 없으면 Smart Tomcat 플러그인 또는 외부 Tomcat에 war 배포.
  - pokemonJava: GameMain Application run config.
- **VS Code**: `vcPortfolio_AJ` 폴더 열기 → frontend_proj + nintendo가 한 트리에. Live Server 사용.
- 같은 자바 폴더를 VS Code로도 열어볼 수 있음(.idea와 .vscode는 충돌 안 함). 단 실행은 IntelliJ 권장.

---

## 7. 완료 기준 체크리스트

- [ ] vcPortfolio_AJ에서 git init, frontend_proj+nintendo가 한 레포로 묶임(`git status` 확인), 첫 커밋
- [ ] pokemonJava git init + 첫 커밋
- [ ] webProj_Popflex git init + 첫 커밋, config.properties는 추적 안 됨(`git status` 확인), config.example.properties는 추적됨
- [ ] webProj_Popflex: `mvn clean package` 성공, war 생성, 대체된 jar 제거, Tomcat 9 + JDK17 기동, javax 유지
- [ ] pokemonJava: GameMain 실행 정상, 연습용 _archive로 분리
- [ ] vcPortfolio_AJ: 두 정적 웹 정상 렌더, 경로 안 깨짐
- [ ] 각 프로젝트 README.md (실행법/의존성/JDK·Tomcat 버전)
- [ ] Eclipse 잔재(.project/.classpath/.settings/bin) 전부 제거
```
