import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'

const isObjectWithDefaultFunction = (
  module: unknown
): module is { default: typeof monacoEditorPluginModule } =>
  module != null &&
  typeof module === 'object' &&
  'default' in module &&
  typeof module.default === 'function'

const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule

const tauriBuildVariant =
  process.env.ROUTEX_TAURI_BUILD_VARIANT ||
  (process.env.ROUTEX_AUTO_BUILD === 'true' ? 'autobuild' : process.env.NODE_ENV === 'development' ? 'dev' : 'release')

const routexBuildDefines = {
  __ROUTEX_AUTO_BUILD__: JSON.stringify(process.env.ROUTEX_AUTO_BUILD === 'true'),
  __ROUTEX_BUILD_VARIANT__: JSON.stringify(tauriBuildVariant),
  __ROUTEX_HOST__: JSON.stringify('tauri'),
  __ROUTEX_PLATFORM__: JSON.stringify(process.platform)
}

export default defineConfig({
  root: resolve(__dirname, 'src/tauri-web'),
  define: routexBuildDefines,
  plugins: [
    react(),
    tailwindcss(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService'],
      // @ts-ignore - vite-plugin-monaco-editor type mismatch
      languages: ['yaml', 'json'],
      customDistPath: (_root, outDir) => `${outDir}/monacoeditorwork`,
      customWorkers: [
        {
          label: 'yaml',
          entry: 'monaco-yaml/yaml.worker'
        }
      ]
    })
  ],
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
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'next-themes'],
          'vendor-ui': ['@heroui/react'],
          'vendor-motion': ['framer-motion'],
          'vendor-chart': ['echarts', 'echarts-for-react'],
          'vendor-editor': ['monaco-editor', 'react-monaco-editor', 'monaco-yaml'],
          'vendor-flow': ['@xyflow/react', 'dagre'],
          'vendor-core': ['react-router-dom', 'zustand', 'swr']
        }
      }
    }
  }
})
