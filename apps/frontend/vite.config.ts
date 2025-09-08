import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORT = 5173

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: PORT,
    strictPort: true,
    proxy: {
      '/sites': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
