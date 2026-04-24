import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Isoler tunge biblioteker i egne chunks for bedre caching + raskere initial load
            recharts: ['recharts'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            vendor: ['react', 'react-dom', 'lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
