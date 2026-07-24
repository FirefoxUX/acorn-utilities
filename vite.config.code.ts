import { defineConfig } from 'vite'
import { sharedConfig } from './vite.config.shared'

export default defineConfig({
  ...sharedConfig,
  build: {
    ...sharedConfig.build,
    lib: {
      entry: 'src/code/index.ts',
      name: 'FigmaPlugin',
      formats: ['iife']
    },
    rollupOptions: {
      ...sharedConfig.rollupOptions,
      output: {
        entryFileNames: 'code.js'
      }
    }
  }
})
