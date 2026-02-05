import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.MAHORAGA_API_URL || process.env.MAHORAGA_API_URL || `http://localhost:${env.WRANGLER_PORT || process.env.WRANGLER_PORT || '8787'}`
  
  const cfAccessClientId = env.CF_ACCESS_CLIENT_ID || process.env.CF_ACCESS_CLIENT_ID
  const cfAccessClientSecret = env.CF_ACCESS_CLIENT_SECRET || process.env.CF_ACCESS_CLIENT_SECRET
  
  console.log('[vite] API Target:', apiTarget)
  console.log('[vite] CF Access configured:', !!cfAccessClientId && !!cfAccessClientSecret)

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
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (cfAccessClientId && cfAccessClientSecret) {
                proxyReq.setHeader('CF-Access-Client-Id', cfAccessClientId)
                proxyReq.setHeader('CF-Access-Client-Secret', cfAccessClientSecret)
              }
            })
          },
        },
      },
    },
  }
})
