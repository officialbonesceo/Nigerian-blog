/**
 * 9jaBeacon Editorial image resolver
 * Person stories: Wikipedia Commons or branded SVG (never random stock faces).
 * Non-person: Unsplash API (TOS) then SVG.
 */
import { fetchVerifiedWikipediaImage } from './wikipedia-image';

export interface EditorialSvgOptions {
  title: string;
  category?: string;
  sourceName?: string;
  width?: number;
  height?: number;
}

export interface ResolvedImageResult {
  imageUrl: string;
  imageCaption: string;
  imageCredit: string;
  imageLicense: string;
}

export function isPublisherLogoOrBanner(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;
  if (
    trimmed.includes('1x1') ||
    trimmed.includes('tracking') ||
    trimmed.includes('doubleclick') ||
    trimmed.includes('feedburner')
  ) {
    return true;
  }
  const logoKeywords = [
    'logo',
    'avatar',
    'favicon',
    'placeholder',
    'watermark',
    'badge',
    'sponsor',
    'advert',
    'icon-192',
    'icon-512',
    'apple-touch-icon',
  ];
  return logoKeywords.some((kw) => trimmed.includes(kw)) || trimmed.endsWith('.ico');
}

function escapeXml(unsafe: string): string {
  const amp = String.fromCharCode(38) + 'amp;';
  const lt = String.fromCharCode(38) + 'lt;';
  const gt = String.fromCharCode(38) + 'gt;';
  const quot = String.fromCharCode(38) + 'quot;';
  const apos = String.fromCharCode(38) + 'apos;';
  return (unsafe || '')
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

function wrapSvgText(text: string, maxCharsPerLine = 38, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) lines.push(currentLine);
  if (
    words.length > 0 &&
    lines.length === maxLines &&
    words.join(' ').length > lines.join(' ').length
  ) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\.*$/, '') + '...';
  }
  return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)];
}

export function generateEditorialSvgString(options: EditorialSvgOptions): string {
  const width = options.width || 1200;
  const height = options.height || 675;
  const rawTitle = (options.title || 'Breaking Verified Nigerian News Wire').trim();
  const rawCat = (options.category || 'cat_naija_news').toLowerCase();
  const sourceName = escapeXml(options.sourceName || '9jaBeacon Editorial Wire');
  let themeName = 'NIGERIA & GOVERNANCE';
  let primaryColor = '#10b981';
  let bgStart = '#022c1e';
  let bgMid = '#031f16';
  let bgEnd = '#01120c';
  if (rawCat.includes('money') || rawCat.includes('business')) {
    themeName = 'MONEY, NAIRA & MARKETS';
    primaryColor = '#34d399';
  } else if (rawCat.includes('sports')) {
    themeName = 'SPORTS & ATHLETICS WIRE';
    primaryColor = '#84cc16';
  } else if (rawCat.includes('world')) {
    themeName = 'GLOBAL & WORLD AFFAIRS';
    primaryColor = '#38bdf8';
    bgStart = '#08253d';
    bgMid = '#051829';
    bgEnd = '#020b14';
  }
  const lines = wrapSvgText(rawTitle, 40, 3);
  const escapedTheme = escapeXml(themeName);
  const lineTexts = lines
    .map(
      (line, i) =>
        '<text x="80" y="' +
        String(280 + i * 60) +
        '" font-family="system-ui,sans-serif" font-size="42" font-weight="800" fill="#f8fafc">' +
        escapeXml(line) +
        '</text>'
    )
    .join('\n');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" width="' +
      width +
      '" height="' +
      height +
      '">',
    '<defs>',
    '<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="' + bgStart + '" />',
    '<stop offset="60%" stop-color="' + bgMid + '" />',
    '<stop offset="100%" stop-color="' + bgEnd + '" />',
    '</linearGradient>',
    '</defs>',
    '<rect width="' + width + '" height="' + height + '" fill="url(#bgGrad)" />',
    '<rect x="36" y="36" width="' +
      (width - 72) +
      '" height="' +
      (height - 72) +
      '" rx="24" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />',
    '<text x="80" y="110" font-family="system-ui,sans-serif" font-size="28" font-weight="900" fill="#ffffff">9ja<tspan fill="' +
      primaryColor +
      '">Beacon</tspan></text>',
    '<text x="80" y="200" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="' +
      primaryColor +
      '" letter-spacing="1.5">' +
      escapedTheme +
      '</text>',
    lineTexts,
    '<text x="80" y="560" font-family="system-ui,sans-serif" font-size="14" fill="#cbd5e1">9jaBeacon News Wire - ' +
      sourceName +
      '</text>',
    '</svg>',
  ].join('\n');
}

export function generateEditorialSvgDataUrl(options: EditorialSvgOptions): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(generateEditorialSvgString(options));
}

export function isPersonRelatedStory(title: string, content?: string): boolean {
  const combined = (title || '') + ' ' + (content || '').slice(0, 1000);
  const lower = combined.toLowerCase();
  if (
    /\b(president|governor|minister|senator|lawmaker|commissioner|coach|manager|athlete|captain)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /\b(tinubu|shettima|wike|peter\s+obi|atiku|buhari|dangote|soludo|lookman|osimhen|iwobi|fubara|sanwo-?olu)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

function resolveUnsplashAccessKey(): string {
  const env = typeof process !== 'undefined' ? process.env || {} : {};
  const candidates = [
    env.UNSPLASH_ACCESS_KEY,
    env.UNSPLASH_CLIENT_ID,
    env.UNSPLASH_API_KEY,
    env.UNSPLASH_KEY,
  ];
  for (const c of candidates) {
    const v = (c || '').trim().replace(/^Client-ID\s+/i, '');
    if (v && v.length >= 20 && !/^\d+$/.test(v)) return v;
  }
  return '';
}

function extractSearchQuery(title: string): string {
  const lower = title.toLowerCase();
  if (/\b(police|gunmen|bandits|kidnap|arrest|efcc)\b/i.test(lower)) {
    return 'nigeria police security law enforcement';
  }
  if (/\b(naira|cbn|economy|bank|inflation|market)\b/i.test(lower)) {
    return 'nigeria economy finance naira banking';
  }
  if (/\b(football|eagles|match|league|goal)\b/i.test(lower)) {
    return 'football stadium africa sport';
  }
  if (/\b(flood|rain|disaster)\b/i.test(lower)) {
    return 'flood emergency nigeria weather';
  }
  if (/\b(oil|refinery|petrol)\b/i.test(lower)) {
    return 'oil refinery energy industry';
  }
  return 'nigeria news africa city skyline';
}

async function searchUnsplash(query: string): Promise<ResolvedImageResult | null> {
  const key = resolveUnsplashAccessKey();
  if (!key) {
    console.warn('[Image] UNSPLASH_ACCESS_KEY missing — using fallback');
    return null;
  }
  const appName = (process.env.UNSPLASH_APP_NAME || '9jaBeacon').replace(/\s+/g, '');
  try {
    const endpoint =
      'https://api.unsplash.com/search/photos?query=' +
      encodeURIComponent(query) +
      '&per_page=1&orientation=landscape';
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Client-ID ' + key, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn('[Unsplash] HTTP ' + res.status);
      return null;
    }
    const data = (await res.json()) as any;
    const photo = data.results?.[0];
    if (!photo?.urls?.regular) return null;
    if (photo.links?.download_location) {
      fetch(photo.links.download_location, {
        headers: { Authorization: 'Client-ID ' + key },
        signal: AbortSignal.timeout(3000),
      }).catch(function () {});
    }
    const author = photo.user?.name || 'Unsplash Contributor';
    const authorUrl = photo.user?.links?.html
      ? photo.user.links.html + '?utm_source=' + appName + '&utm_medium=referral'
      : 'https://unsplash.com/?utm_source=' + appName + '&utm_medium=referral';
    const home = 'https://unsplash.com/?utm_source=' + appName + '&utm_medium=referral';
    const creditHtml =
      'Photo by <a href="' +
      authorUrl +
      '" target="_blank" rel="noopener noreferrer">' +
      author +
      '</a> on <a href="' +
      home +
      '" target="_blank" rel="noopener noreferrer">Unsplash</a>';
    return {
      imageUrl: photo.urls.regular + '&auto=format&fit=crop&w=1200&q=80',
      imageCaption: photo.alt_description || photo.description || query + ' — editorial photo.',
      imageCredit: creditHtml,
      imageLicense: 'Unsplash License (Free Editorial Use with Attribution)',
    };
  } catch (e: any) {
    console.warn('[Unsplash] error', e?.message || e);
    return null;
  }
}

export async function resolveEditorialImage(options: {
  title: string;
  content?: string;
  category?: string;
  sourceName?: string;
  sourceImageUrl?: string | null;
  aiKeyword?: string | null;
}): Promise<ResolvedImageResult> {
  const title = options.title;
  const content = options.content;
  const category = options.category;
  const sourceName = options.sourceName;
  const sourceImageUrl = options.sourceImageUrl;
  const aiKeyword = options.aiKeyword;

  if (sourceImageUrl && !isPublisherLogoOrBanner(sourceImageUrl)) {
    const u = sourceImageUrl.toLowerCase();
    if (
      u.includes('unsplash.com') ||
      u.includes('pexels.com') ||
      u.includes('wikimedia') ||
      u.includes('wikipedia')
    ) {
      return {
        imageUrl: sourceImageUrl,
        imageCaption: title + ' — Verified wire report.',
        imageCredit: sourceName || 'Open source wire',
        imageLicense: 'Open / Editorial',
      };
    }
  }

  const isPerson = isPersonRelatedStory(title, content);

  if (isPerson) {
    try {
      const wiki = await fetchVerifiedWikipediaImage(title, category);
      if (wiki?.imageUrl) {
        console.log('[Image] Wikipedia: ' + title.slice(0, 50));
        return {
          imageUrl: wiki.imageUrl,
          imageCaption: wiki.caption || (wiki.wikiTitle || '') + ' — archival.',
          imageCredit: wiki.credit || 'Wikimedia Commons',
          imageLicense: 'Creative Commons / Editorial',
        };
      }
    } catch {
      // continue to SVG
    }
    console.log('[Image] Person → SVG: ' + title.slice(0, 50));
    return {
      imageUrl: generateEditorialSvgDataUrl({
        title: title,
        category: category || 'cat_naija_news',
        sourceName: sourceName || '9jaBeacon',
      }),
      imageCaption: title + ' — 9jaBeacon editorial card.',
      imageCredit: '9jaBeacon Editorial Visual Desk',
      imageLicense: 'Editorial (own graphic)',
    };
  }

  const query =
    aiKeyword && aiKeyword.trim().length > 2 ? aiKeyword.trim() : extractSearchQuery(title);
  console.log('[Image] Unsplash search: ' + query);
  const stock = await searchUnsplash(query);
  if (stock) {
    console.log('[Image] Unsplash OK: ' + stock.imageUrl.slice(0, 70));
    return stock;
  }

  return {
    imageUrl: generateEditorialSvgDataUrl({
      title: title,
      category: category || 'cat_naija_news',
      sourceName: sourceName || '9jaBeacon',
    }),
    imageCaption: title + ' — 9jaBeacon editorial card.',
    imageCredit: '9jaBeacon Editorial Visual Desk',
    imageLicense: 'Editorial (own graphic)',
  };
}
