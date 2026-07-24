import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { inlineHtmlPlugin } from './src/plugins/inline-html'
import { sharedConfig } from './vite.config.shared'

export default defineConfig({
  ...sharedConfig,
  plugins: [svelte(), inlineHtmlPlugin()],
  css: {
    preprocessorOptions: {
      sass: {
        additionalData: (d: string) => {
          const prepend = `@use "@src/ui/styles/utils.sass" as tint\n`
          const match = d.match(/^\s*/)
          const spaces = match ? match[0] : ''
          return `${spaces}${prepend}\n${d}`
        },
      },
    },
  },
  build: {
    ...sharedConfig.build,
    rollupOptions: {
      ...sharedConfig.rollupOptions,
      input: 'index.html',
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        inlineDynamicImports: true
      }
    }
  }
})
