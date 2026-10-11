import type { APIRoute } from 'astro';

export const prerender = false;

interface PublicImageResult {
  id: string;
  title: string;
  url: string;
  thumbUrl: string;
  source: 'Wikimedia Commons' | 'Unsplash Editorial' | 'Open Public Domain';
  license: string;
  author: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  sanitizedCdnUrl: string;
}

// Fallback high quality editorial photos for common news categories
const EDITORIAL_NEWS_COLLECTION: Record<string, Array<{ title: string; url: string; author: string }>> = {
  politics: [
    { title: 'National Assembly & Governance', url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Editorial' },
    { title: 'Official Press Conference & Spokesperson', url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Editorial' },
    { title: 'Democratic Balloting & Voting Box', url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Editorial' },
  ],
  economy: [
    { title: 'Central Bank & Financial District', url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Finance' },
    { title: 'Currency & Economic Growth Chart', url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Markets' },
    { title: 'Commercial Container Port & Maritime Trade', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Logistics' },
  ],
  tech: [
    { title: 'Digital Innovation & Fiber Infrastructure', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Tech' },
    { title: 'Artificial Intelligence & Data Center', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Tech' },
    { title: 'Fintech Mobile Application Development', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Digital' },
  ],
  sports: [
    { title: 'Super Eagles International Stadium Floodlights', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Sports' },
    { title: 'Athletic Football Field Match Action', url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Sports' },
    { title: 'Track and Field Championship Runner', url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80', author: 'Unsplash Sports' },
  ],
  general: [
    { title: 'Press Desk Breaking Broadcast', url: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80', author: 'Editorial Media' },
    { title: 'African Metropolitan Skyline', url: 'https://images.unsplash.com/photo-1577975882846-431adc8c2009?auto=format&fit=crop&w=1200&q=80', author: 'Urban Media' },
    { title: 'Public Security & Emergency Response', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=1200&q=80', author: 'Civic Media' },
  ],
};

function buildSanitizedCdnUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.startsWith('http')) return rawUrl;
  // If already an optimized Unsplash URL
  if (rawUrl.includes('images.unsplash.com')) {
    const clean = rawUrl.split('?')[0];
    return `${clean}?auto=format&fit=crop&w=1200&h=675&q=82`;
  }
  // Use Cloudflare-backed weserv CDN for zero-cost caching and legal privacy sanitization
  try {
    const encoded = encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''));
    return `https://images.weserv.nl/?url=${encoded}&w=1200&h=675&fit=cover&output=webp&q=85`;
  } catch {
    return rawUrl;
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const rawQuery = (url.searchParams.get('query') || '').trim();
    const category = (url.searchParams.get('category') || 'general').toLowerCase();

    // Clean query words for Wikimedia search
    const cleanSearch = rawQuery
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 5)
      .join(' ') || 'Nigeria news';

    const results: PublicImageResult[] = [];

    // 1. Fetch Wikimedia Commons Public Domain & Creative Commons Media
    try {
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanSearch)}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': '9jaBeaconNewsBot/2.0 (editorial newsroom image search; contact@9jabeacon.name.ng)'
        }
      });

      if (res.ok) {
        const data = await res.json() as any;
        const pages = data?.query?.pages || {};
        for (const pageId of Object.keys(pages)) {
          const p = pages[pageId];
          const info = p.imageinfo?.[0];
          if (!info || !info.url) continue;

          // Only keep standard raster photos (skip SVG icons, audio, PDF)
          const mime = (info.mime || '').toLowerCase();
          if (!mime.includes('jpeg') && !mime.includes('png') && !mime.includes('webp') && !mime.includes('jpg')) {
            continue;
          }

          const ext = info.extmetadata || {};
          const license = ext.LicenseShortName?.value || ext.License?.value || 'Creative Commons / Public Domain';
          const author = ext.Artist?.value?.replace(/<[^>]*>/g, '').trim() || 'Wikimedia Contributor';
          const title = (p.title || 'Public Editorial Photo').replace(/^File:/i, '').replace(/\.[^/.]+$/, '');
          const thumbUrl = info.thumburl || info.url;

          results.push({
            id: `wiki_${pageId}`,
            title: title.slice(0, 80),
            url: info.url,
            thumbUrl: thumbUrl,
            source: 'Wikimedia Commons',
            license: String(license).slice(0, 40),
            author: author.slice(0, 50),
            width: info.width || 1200,
            height: info.height || 675,
            aspectRatio: '16:9',
            sanitizedCdnUrl: buildSanitizedCdnUrl(info.url),
          });
        }
      }
    } catch (wikiErr) {
      console.warn('Wikimedia API query timeout/error:', wikiErr);
    }

    // 2. Add category-matched high quality editorial photos
    const catKey = category.includes('tech') ? 'tech' :
                   category.includes('econ') || category.includes('fin') || category.includes('biz') ? 'economy' :
                   category.includes('sport') ? 'sports' :
                   category.includes('gov') || category.includes('pol') ? 'politics' : 'general';

    const fallbackList = EDITORIAL_NEWS_COLLECTION[catKey] || EDITORIAL_NEWS_COLLECTION.general;
    fallbackList.forEach((item, index) => {
      results.push({
        id: `editorial_${catKey}_${index}`,
        title: item.title,
        url: item.url,
        thumbUrl: item.url.replace('&w=1200', '&w=400'),
        source: 'Unsplash Editorial',
        license: 'Free Commercial & Editorial Use',
        author: item.author,
        width: 1200,
        height: 675,
        aspectRatio: '16:9',
        sanitizedCdnUrl: buildSanitizedCdnUrl(item.url),
      });
    });

    return new Response(
      JSON.stringify({
        success: true,
        query: cleanSearch,
        total: results.length,
        images: results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Image search failed', images: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
