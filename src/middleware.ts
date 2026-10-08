import { defineMiddleware } from 'astro:middleware';
import { getD1 } from './lib/runtime-db';
import { runIngestionPipeline } from './lib/automated-ingest';

let lastAutomatedIngest = 0;
let isIngesting = false;
const INGEST_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes

export const onRequest = defineMiddleware(async ({ request, url, redirect, locals }, next) => {
  const host = (request.headers.get('host') || url.hostname).toLowerCase().split(':')[0];
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const pathname = url.pathname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app');

  // 1. Google Search Console: 301 Permanent Redirect apex, http, & pages.dev to canonical https://www.9jabeacon.name.ng
  if (!isLocal) {
    if (host === '9jabeacon.name.ng' || host === '9jabeacon.pages.dev' || (proto === 'http' && host.includes('9jabeacon'))) {
      const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return redirect(`https://www.9jabeacon.name.ng${cleanPath}${url.search}`, 301);
    }
  }

  // 2. Google Search Console: Trailing slash normalisation (never leave duplicate trailing slash URLs)
  if (pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/_astro')) {
    const cleanPath = pathname.slice(0, -1);
    return redirect(`${cleanPath}${url.search}`, 301);
  }

  // 3. Category normalisation: /category/money-hustle -> /category/business (prevents 404/redirect errors in index)
  if (pathname === '/category/money-hustle') {
    return redirect(`/category/business${url.search}`, 301);
  }

  // 4. Feed normalisation: /feed and /rss -> /rss.xml
  if (pathname === '/feed' || pathname === '/rss') {
    return redirect(`/rss.xml`, 301);
  }

  // Autonomous background ingest trigger (non-blocking, fire-and-forget)
  // Only trigger on public content requests, skip static assets and internal admin APIs
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

