// Electron 메인 프로세스 — 웹게임을 독립 창(데스크톱 앱)으로 띄운다.
// 개발 중에는 Vite 개발 서버(localhost:5180)를, 빌드(.exe) 후에는 dist의 파일을 연다.
const { app, BrowserWindow } = require("electron");
const path = require("path");

// app.isPackaged: .exe로 패키징된 상태면 true → 빌드된 파일을, 아니면 개발 서버를 연다
const isDev = !app.isPackaged;

// WSLg(리눅스 GUI) 환경에서 WebGL이 막히는 걸 풀어준다. 실제 윈도우(GPU)에선 영향 없음.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "myPokemon",
    backgroundColor: "#1b1b1b",
    autoHideMenuBar: true,        // 상단 메뉴바 숨김 (게임답게)
    webPreferences: {
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5180");   // 개발 서버 (npm run dev 가 켜져 있어야 함)
    // win.webContents.openDevTools();      // 필요하면 개발자도구
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html")); // 빌드 결과물
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
