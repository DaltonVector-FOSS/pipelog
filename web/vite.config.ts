import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/auth': { target: proxyTarget, changeOrigin: true },
        '/entries': { target: proxyTarget, changeOrigin: true },
        '/workspaces': { target: proxyTarget, changeOrigin: true },
        '/s/': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
      },
    },
  };
});
