import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  vite: {
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: false,
    },
  },
});
