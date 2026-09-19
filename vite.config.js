import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发模式：前端 5173，/api 代理到后端 3000
// 生产模式：vite build 产出 dist，由 Express 直接托管（单端口 3000）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
