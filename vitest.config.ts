import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __ROUTEX_AUTO_BUILD__: JSON.stringify(false),
    __ROUTEX_BUILD_VARIANT__: JSON.stringify('test'),
    __ROUTEX_HOST__: JSON.stringify('web'),
    __ROUTEX_PLATFORM__: JSON.stringify(process.platform)
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
