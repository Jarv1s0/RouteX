import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve(__dirname, 'src/tauri-web'),
  define: {
    __ROUTEX_HOST__: JSON.stringify('tauri'),
    __ROUTEX_PLATFORM__: JSON.stringify(process.platform)
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, 'src')]
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, 'dist-tauri'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/tauri-web/index.html'),
        floating: resolve(__dirname, 'src/tauri-web/floating.html'),
        traymenu: resolve(__dirname, 'src/tauri-web/traymenu.html')
      }
    }
  }
})
