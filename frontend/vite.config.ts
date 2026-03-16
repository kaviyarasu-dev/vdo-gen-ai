import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 6200,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-flow': ['@xyflow/react'],
          tanstack: ['@tanstack/react-query'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
          zustand: ['zustand', 'immer'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
