import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    server: {
      proxy: {
        // усі запити на /xtiles/* підуть на https://xtiles.app/*
        '/xtiles': {
        target: 'https://stage.xtiles.app',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/xtiles/, ''),
        },
      },
    },
  };
});
