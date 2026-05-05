import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/entries': { target: 'http://localhost:3001', changeOrigin: true },
      '/workspaces': { target: 'http://localhost:3001', changeOrigin: true },
      '/s/': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
