// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://dockerfilegenerator.soumosarkar.online',
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Map the ~/* import alias to the src/ directory. We compute
        // the absolute path at config-load time so editors (and the
        // Vite dev server) resolve it without any Node-only imports.
        '~': new URL('./src/', import.meta.url).pathname,
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
});
