import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
