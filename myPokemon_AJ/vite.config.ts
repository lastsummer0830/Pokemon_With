import { defineConfig } from "vite";

// 이 프로젝트는 D: 드라이브(/mnt/d)에 있어서 WSL에서 파일 변경 감지(inotify)가 안 된다.
// usePolling으로 주기적으로 파일을 확인해야 수정 → 자동 새로고침(HMR)이 작동한다.
export default defineConfig({
  // Electron에서 빌드 결과물을 file://로 열 때 경로가 깨지지 않게 상대경로 사용
  base: "./",
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300,
      // 폴링 부하를 줄여야 한다. /mnt/d(9P)에서 수천 개 파일을 200ms마다 폴링하면
      // IO가 마비돼 큰 정적 파일(폰트 5MB 등) 서빙이 30초씩 걸리고 화면이 검게 멈춘다.
      // → 빌드출력 + 정적 에셋(public/assets 3700여개) + 01_Resources는 감시 제외.
      //   (이들은 HMR이 필요 없고, 바뀌면 Ctrl+Shift+R 한 번으로 충분. 서빙은 계속 됨.)
      ignored: [
        "**/node_modules/**", "**/.git/**",
        "**/build_win/**", "**/release/**", "**/dist/**", "**/build/**",
        "**/public/assets/**", "**/01_Resources/**",
      ],
    },
  },
});
