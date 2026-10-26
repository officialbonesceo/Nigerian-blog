import type { APIRoute } from 'astro';

export const prerender = false;

interface PublicImageResult {
  id: string;
  title: string;
  url: string;
  thumbUrl: string;
  source: string;
  license: string;
  author: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  sanitizedCdnUrl: string;
}

function buildSanitizedCdnUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.startsWith('http')) return rawUrl;
  if (rawUrl.includes('images.unsplash.com')) {
    const clean = rawUrl.split('?')[0];
    return `${clean}?auto=format&fit=crop&w=1200&h=675&q=82`;
  }
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

    const cleanSearch =
      rawQuery
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 6)
        .join(' ') || 'Nigeria news';

    const results: PublicImageResult[] = [];

    // 1) Wikimedia Commons
    try {
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanSearch)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': '9jaBeaconNewsBot/2.0 (editorial; contact@9jabeacon.name.ng)',
        },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const pages = data?.query?.pages || {};
        for (const pageId of Object.keys(pages)) {
          const p = pages[pageId];
          const info = p.imageinfo?.[0];
          if (!info?.url) continue;
          const mime = (info.mime || '').toLowerCase();
          if (!/jpeg|jpg|png|webp/.test(mime)) continue;
          const ext = info.extmetadata || {};
          const license = ext.LicenseShortName?.value || ext.License?.value || 'CC / Public Domain';
          const author =
            ext.Artist?.value?.replace(/<[^>]*>/g, '').trim() || 'Wikimedia Contributor';
          const title = (p.title || 'Public photo').replace(/^File:/i, '').replace(/\.[^/.]+$/, '');
          results.push({
            id: `wiki_${pageId}`,
            title: title.slice(0, 80),
            url: info.url,
            thumbUrl: info.thumburl || info.url,
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
    } catch (e) {
      console.warn('Wikimedia search failed', e);
    }

    // 2) Openverse (open licenses, free)
    try {
      const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(cleanSearch)}&page_size=10&license_type=commercial,modification`;
      const ovRes = await fetch(ovUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: 'application/json' },
      });
      if (ovRes.ok) {
        const ov = (await ovRes.json()) as any;
        for (const item of ov?.results || []) {
          if (!item?.url) continue;
          results.push({
            id: `ov_${item.id}`,
            title: String(item.title || cleanSearch).slice(0, 80),
            url: item.url,
            thumbUrl: item.thumbnail || item.url,
            source: 'Openverse',
            license: String(item.license || 'Open license').slice(0, 40),
            author: String(item.creator || 'Openverse').slice(0, 50),
            width: item.width || 1200,
            height: item.height || 675,
            aspectRatio: '16:9',
            sanitizedCdnUrl: buildSanitizedCdnUrl(item.url),
          });
        }
      }
    } catch (e) {
      console.warn('Openverse search failed', e);
    }

    // 3) Pexels (if key present on Pages env)
    const pexelsKey =
      (typeof process !== 'undefined' && process.env?.PEXELS_API_KEY) || '';
    if (pexelsKey) {
      try {
        const pxRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanSearch)}&per_page=8`,
          {
            signal: AbortSignal.timeout(6000),
            headers: { Authorization: pexelsKey },
          }
        );
        if (pxRes.ok) {
          const px = (await pxRes.json()) as any;
          for (const photo of px?.photos || []) {
            const src = photo.src?.large2x || photo.src?.large || photo.src?.original;
            if (!src) continue;
            results.push({
              id: `pexels_${photo.id}`,
              title: String(photo.alt || cleanSearch).slice(0, 80),
              url: src,
              thumbUrl: photo.src?.medium || src,
              source: 'Pexels',
              license: 'Pexels License',
              author: String(photo.photographer || 'Pexels').slice(0, 50),
              width: photo.width || 1200,
              height: photo.height || 675,
              aspectRatio: '16:9',
              sanitizedCdnUrl: buildSanitizedCdnUrl(src),
            });
          }
        }
      } catch (e) {
        console.warn('Pexels search failed', e);
      }
    }

    // 4) Unsplash API if key present
    const unsplashKey =
      (typeof process !== 'undefined' &&
        (process.env?.UNSPLASH_ACCESS_KEY || process.env?.UNSPLASH_API_KEY)) ||
      '';
    if (unsplashKey) {
      try {
        const uRes = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanSearch)}&per_page=8`,
          {
            signal: AbortSignal.timeout(6000),
            headers: { Authorization: `Client-ID ${unsplashKey}` },
          }
        );
        if (uRes.ok) {
          const u = (await uRes.json()) as any;
          for (const photo of u?.results || []) {
            const src = photo.urls?.regular || photo.urls?.full;
            if (!src) continue;
            results.push({
              id: `unsplash_${photo.id}`,
              title: String(photo.alt_description || cleanSearch).slice(0, 80),
              url: src,
              thumbUrl: photo.urls?.thumb || src,
              source: 'Unsplash',
              license: 'Unsplash License',
              author: String(photo.user?.name || 'Unsplash').slice(0, 50),
              width: photo.width || 1200,
              height: photo.height || 675,
              aspectRatio: '16:9',
              sanitizedCdnUrl: buildSanitizedCdnUrl(src),
            });
          }
        }
      } catch (e) {
        console.warn('Unsplash search failed', e);
      }
    }

    // 5) Category editorial fallbacks if thin results
    if (results.length < 4) {
      const fallbacks = [
        {
          title: 'Editorial press desk',
          url: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
        },
        {
          title: 'City skyline',
          url: 'https://images.unsplash.com/photo-1577975882846-431adc8c2009?auto=format&fit=crop&w=1200&q=80',
        },
        {
          title: 'Markets chart',
          url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
        },
      ];
      fallbacks.forEach((item, i) => {
        results.push({
          id: `fallback_${category}_${i}`,
          title: item.title,
          url: item.url,
          thumbUrl: item.url.replace('w=1200', 'w=400'),
          source: 'Unsplash Editorial',
          license: 'Free editorial use',
          author: 'Editorial',
          width: 1200,
          height: 675,
          aspectRatio: '16:9',
          sanitizedCdnUrl: buildSanitizedCdnUrl(item.url),
        });
      });
    }

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
