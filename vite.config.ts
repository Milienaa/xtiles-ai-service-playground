import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      // прокидаємо ключ Gemini (як було)
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        // Dev: усі запити на /xtiles/* підуть на https://stage.xtiles.app/*
        '/xtiles': {
          target: 'https://stage.xtiles.app',
          changeOrigin: true,
          secure: true, // HTTPS
          rewrite: (p) => p.replace(/^\/xtiles/, ''),
        },
      },
    },
  };
});
