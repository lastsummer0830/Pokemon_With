import { defineConfig } from "vite";

// 이 프로젝트는 D: 드라이브(/mnt/d)에 있어서 WSL에서 파일 변경 감지(inotify)가 안 된다.
// usePolling으로 주기적으로 파일을 확인해야 수정 → 자동 새로고침(HMR)이 작동한다.
export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 200,
    },
  },
});
