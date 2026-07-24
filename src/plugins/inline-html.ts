import type { Plugin } from 'vite'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'

interface InlineHtmlOptions {
  deleteInlinedFiles?: boolean
}

export function inlineHtmlPlugin(options: InlineHtmlOptions = {}): Plugin {
  const { deleteInlinedFiles = true } = options

  return {
    name: 'inline-html',
    apply: 'build',
    writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir || 'dist'

      const htmlFiles = Object.keys(bundle).filter((fileName) =>
        fileName.endsWith('.html'),
      )

      for (const htmlFile of htmlFiles) {
        const htmlPath = resolve(outDir, htmlFile)
        let htmlContent = readFileSync(htmlPath, 'utf-8')

        const cssMatches = htmlContent.match(
          /<link[^>]*href="([^"]*\.css)"[^>]*>/g,
        )
        if (cssMatches) {
          for (const match of cssMatches) {
            const hrefMatch = match.match(/href="([^"]*)"/)
            if (hrefMatch) {
              const cssFile = hrefMatch[1].startsWith('/')
                ? hrefMatch[1].substring(1)
                : hrefMatch[1]
              const cssPath = resolve(outDir, cssFile)

              try {
                const cssContent = readFileSync(cssPath, 'utf-8')
                const inlineStyle = `<style>${cssContent}</style>`
                htmlContent = htmlContent.replace(match, inlineStyle)

                if (deleteInlinedFiles && existsSync(cssPath)) {
                  unlinkSync(cssPath)
                }
              } catch (error) {
                console.warn(`Could not inline CSS file: ${cssFile}`, error)
              }
            }
          }
        }

        const jsMatches = htmlContent.match(
          /<script[^>]*src="([^"]*\.js)"[^>]*><\/script>/g,
        )
        if (jsMatches) {
          for (const match of jsMatches) {
            const srcMatch = match.match(/src="([^"]*)"/)
            if (srcMatch) {
              const jsFile = srcMatch[1].startsWith('/')
                ? srcMatch[1].substring(1)
                : srcMatch[1]

              if (jsFile === 'code.js') {
                continue
              }

              const jsPath = resolve(outDir, jsFile)

              try {
                const jsContent = readFileSync(jsPath, 'utf-8')
                const isModule = match.includes('type="module"')
                const inlineScript = `<script${isModule ? ' type="module"' : ''}>${jsContent}</script>`
                htmlContent = htmlContent.replace(match, inlineScript)

                if (deleteInlinedFiles && existsSync(jsPath)) {
                  unlinkSync(jsPath)
                }
              } catch (error) {
                console.warn(`Could not inline JS file: ${jsFile}`, error)
              }
            }
          }
        }

        writeFileSync(htmlPath, htmlContent)
      }

      const codeJsPath = resolve(outDir, 'code.js')
      if (existsSync(codeJsPath)) {
        let codeContent = readFileSync(codeJsPath, 'utf-8')

        const exportRegex = /export\s*\{[^}]*\};?\s*$/g
        if (exportRegex.test(codeContent)) {
          codeContent = codeContent.replace(exportRegex, '')
          writeFileSync(codeJsPath, codeContent)
        }
      }
    },
  }
}
