import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ request, url, redirect }, next) => {
  const host = (request.headers.get('host') || url.hostname).toLowerCase().split(':')[0];
  const pathname = url.pathname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app');

  // 1. Canonical host: apex / pages.dev → www
  if (!isLocal) {
    if (host === '9jabeacon.name.ng' || host.endsWith('.pages.dev')) {
      const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return redirect(`https://www.9jabeacon.name.ng${cleanPath}${url.search}`, 301);
    }
  }

  // 2. Trailing slash normalisation
  if (pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/_astro') && !pathname.startsWith('/api/')) {
    const cleanPath = pathname.slice(0, -1);
    return redirect(`${cleanPath}${url.search}`, 301);
  }

  // 3. Query pagination → clean path (/page/N, /category/x/page/N)
  const pageQ = url.searchParams.get('page');
  if (pageQ && /^\d+$/.test(pageQ)) {
    const p = Math.max(1, parseInt(pageQ, 10));
    if (pathname === '/' || pathname === '') {
      if (p <= 1) return redirect('/', 301);
      return redirect(`/page/${p}`, 301);
    }
    const cat = pathname.match(/^\/category\/([a-z0-9-]+)$/i);
    if (cat) {
      if (p <= 1) return redirect(`/category/${cat[1]}`, 301);
      return redirect(`/category/${cat[1]}/page/${p}`, 301);
    }
  }

  // 4. Category normalisation
  if (pathname === '/category/money-hustle' || pathname === '/category/money' || pathname === '/category/hustle') {
    return redirect(`/category/business${url.search}`, 301);
  }

  // 5. Feed normalisation
  if (pathname === '/feed' || pathname === '/rss') {
    return redirect(`/rss.xml`, 301);
  }

  // 6. GSC "Page with redirect" / removed sections → home (301)
  if (
    pathname === '/presenters' ||
    pathname === '/videos' ||
    pathname.startsWith('/videos/')
  ) {
    return redirect(`/`, 301);
  }

  // Autonomous background ingest removed — only Daily Desk workflow may write articles.

  return next();
});
