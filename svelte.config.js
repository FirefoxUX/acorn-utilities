import path from 'path';
import { fileURLToPath } from 'url';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const utilsSassAbsolute = path.join(__dirname, 'src/ui/styles/utils.sass');

export default {
  preprocess: vitePreprocess({
    style: {
      css: {
        preprocessorOptions: {
          sass: {
            additionalData: (d) => {
              const prepend = `@use "${utilsSassAbsolute}" as tint\n`
              const match = d.match(/^\s*/);
              const spaces = match ? match[0] : '';
              return `${spaces}${prepend}\n${d}`
            },
          },
        },
      },
    }
  }),
};
