import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'cloudflare' }),
  devToolbar: { enabled: false },
  integrations: [tailwind({ applyBaseStyles: true })],
  server: { host: '0.0.0.0', port: 3000 },
  vite: { server: { host: '0.0.0.0', port: 3000, hmr: false } },
});
