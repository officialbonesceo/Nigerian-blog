import { defineMiddleware } from 'astro:middleware';
import { getD1 } from './lib/runtime-db';
import { runIngestionPipeline } from './lib/automated-ingest';

let lastAutomatedIngest = 0;
let isIngesting = false;
const INGEST_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes

export const onRequest = defineMiddleware(async ({ request, url, redirect, locals }, next) => {
  const host = (request.headers.get('host') || url.hostname).toLowerCase().split(':')[0];
  
  // 301 Permanent Redirect apex -> canonical www domain in production
  if (host === '9jabeacon.name.ng') {
    return redirect(`https://www.9jabeacon.name.ng${url.pathname}${url.search}`, 301);
  }

  // Autonomous background ingest trigger (non-blocking, fire-and-forget)
  // Only trigger on public content requests, skip static assets and internal admin APIs
  const pathname = url.pathname;
  const isStatic = pathname.startsWith('/_astro') || pathname.startsWith('/favicon') || pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2)$/);
  const isAdminApi = pathname.startsWith('/api/admin');

  if (!isStatic && !isAdminApi && !isIngesting) {
    const now = Date.now();
    if (now - lastAutomatedIngest > INGEST_INTERVAL_MS) {
      lastAutomatedIngest = now;
      isIngesting = true;

      const backgroundTask = async () => {
        try {
          const db = getD1(locals);
          await runIngestionPipeline(db, { limitPerSource: 1 });
        } catch (bgErr) {
          console.warn('[Automated Ingest Background Warning]', bgErr);
        } finally {
          isIngesting = false;
        }
      };

      // In Cloudflare Workers/Pages runtime, use ctx.waitUntil if available
      const ctx = (locals as any)?.runtime?.ctx;
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(backgroundTask());
      } else {
        // Node / Dev / fallback execution
        Promise.resolve().then(backgroundTask);
      }
    }
  }

  return next();
});

