import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
// https://github.com/vdesjs/vite-plugin-monaco-editor/issues/21#issuecomment-1827562674
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
import tailwindcss from '@tailwindcss/vite'

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

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          floating: resolve('src/renderer/floating.html'),
          traymenu: resolve('src/renderer/traymenu.html')
        },
        output: {
          manualChunks: {
            // UI 组件库（最大的单一依赖）
            'vendor-ui': ['@heroui/react', 'framer-motion'],
            // 图表库
            'vendor-chart': ['recharts'],
            // 编辑器（仅 override 页面使用）
            'vendor-editor': ['react-monaco-editor', 'monaco-yaml'],
            // 拓扑图（仅 map 页面使用）
            'vendor-flow': ['@xyflow/react', 'dagre'],
            // 路由和状态管理
            'vendor-core': ['react-router-dom', 'zustand', 'swr'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService'],
        // @ts-ignore
        languages: ['yaml', 'json'], // 只保留 yaml 和 json
        customDistPath: (_, out) => `${out}/monacoeditorwork`,
        customWorkers: [
          {
            label: 'yaml',
            entry: 'monaco-yaml/yaml.worker'
          }
        ]
      })
    ]
  }
})
