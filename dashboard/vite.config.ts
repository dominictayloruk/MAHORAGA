import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.MAHORAGA_API_URL || process.env.MAHORAGA_API_URL || `http://localhost:${env.WRANGLER_PORT || process.env.WRANGLER_PORT || '8787'}`

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, '/agent'),
        },
      },
    },
  }
})
