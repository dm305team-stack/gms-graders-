import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gms/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@gms/llm': path.resolve(__dirname, '../../packages/llm/src'),
      '@gms/db': path.resolve(__dirname, '../../packages/db/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Forward /api to the aeo-api Express backend (see server/).
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.AEO_API_PORT || 3334}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Two entries: the public landing (index.html) and the internal
      // operator console (console.html). The console never ships in the
      // public bundle; in dev Vite serves it directly at /console.html.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        console: path.resolve(__dirname, 'console.html'),
      },
    },
  },
});
