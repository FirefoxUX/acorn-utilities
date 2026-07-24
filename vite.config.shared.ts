import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url)

export const sharedConfig = {
  resolve: {
    alias: {
      '~tint': path.dirname(require.resolve('tint')),
      '@src': '/src',
      '@code': '/src/code',
      '@ui': '/src/ui',
      '@tools': '/src/tools',
    },
  },
  build: {
    outDir: 'dist',
    // es2020 (not lower) so esbuild preserves bigint literals as literals.
    // The Figma sandbox omits the global BigInt constructor but supports the
    // bigint primitive; downleveling `123n` to `BigInt("123")` would crash on
    // load (clipper2-ts's top-level constants) and defeat bigint-polyfill.ts.
    target: 'es2020' as const,
    minify: false,
    emptyOutDir: false,
  },
  rollupOptions: {
    external: () => false,
  }
}
