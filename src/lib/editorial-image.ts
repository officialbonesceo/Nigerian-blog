/**
 * 9jaBeacon High-Definition Editorial SVG Generator & Publisher Image Sanitizer
 * Generates vector-crisp editorial cards and filters out publisher watermarks/logos.
 */

export interface EditorialSvgOptions {
  title: string;
  category?: string;
  sourceName?: string;
  width?: number;
  height?: number;
}

/**
 * Detects if an RSS image enclosure is merely the publisher's site logo,
 * avatar, header banner, tracking pixel, or default placeholder.
 */
export function isPublisherLogoOrBanner(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();

  // Reject invalid, relative, or tracking URLs
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;
  if (trimmed.includes('1x1') || trimmed.includes('tracking') || trimmed.includes('doubleclick') || trimmed.includes('feedburner')) return true;

  // Known logo & badge keywords in path or filename
  const logoKeywords = [
    'logo',
    'logos',
    'avatar',
    'favicon',
    'channel_logo',
    'header-logo',
    'header_logo',
    'site-logo',
    'brand-logo',
    'brand_logo',
    'brand-mark',
    'placeholder',
    'default-thumb',
    'default_thumbnail',
    'default-image',
    'fallback-thumb',
    'watermark',
    'badge',
    'sponsor',
    'advert',
    'icon-192',
    'icon-512',
    'apple-touch-icon',
    'bbc_news_logo',
    'punch_logo',
    'punch-logo',
    'vanguard_logo',
    'vanguard-logo',
    'channelstv_logo',
    'guardian_logo',
    'thecable_logo',
    'sunnews_logo',
    'tribune_logo',
    'leadership_logo',
  ];

  for (const kw of logoKeywords) {
    if (trimmed.includes(kw)) {
      return true;
    }
  }

  // Reject tiny .ico or tiny .gif files
  if (trimmed.endsWith('.ico') || (trimmed.endsWith('.gif') && (trimmed.includes('icon') || trimmed.includes('small') || trimmed.includes('button')))) {
    return true;
  }

  return false;
}

/**
 * Escapes characters for safe SVG XML inclusion
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wraps title text into multiple lines for SVG <tspan> rendering
 */
function wrapSvgText(text: string, maxCharsPerLine: number = 38, maxLines: number = 3): string[] {
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

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If text exceeded, add ellipsis on last line
  if (words.length > 0 && lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\.*$/, '') + '...';
  }

  return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)];
}

/**
 * Generates an ultra-crisp, category-themed Editorial SVG vector graphic
 */
export function generateEditorialSvgString(options: EditorialSvgOptions): string {
  const width = options.width || 1200;
  const height = options.height || 675;
  const rawTitle = (options.title || 'Breaking Verified Nigerian News Wire').trim();
  const rawCat = (options.category || 'cat_naija_news').toLowerCase();
  const sourceName = escapeXml(options.sourceName || '9jaBeacon Editorial Wire');

  // Category palette determination
  let themeName = 'NIGERIA & GOVERNANCE';
  let primaryColor = '#10b981'; // Emerald
  let bgStart = '#022c1e';
  let bgMid = '#031f16';
  let bgEnd = '#01120c';
  let accentPattern = 'grid';

  if (rawCat.includes('money') || rawCat.includes('business')) {
    themeName = 'MONEY, NAIRA & MARKETS';
    primaryColor = '#34d399';
    bgStart = '#04281b';
    bgMid = '#031d14';
    bgEnd = '#020e0a';
    accentPattern = 'mesh';
  } else if (rawCat.includes('sports')) {
    themeName = 'SPORTS & ATHLETICS WIRE';
    primaryColor = '#84cc16'; // Lime
    bgStart = '#0f291e';
    bgMid = '#081c13';
    bgEnd = '#030e0a';
    accentPattern = 'arcs';
  } else if (rawCat.includes('world')) {
    themeName = 'GLOBAL & WORLD AFFAIRS';
    primaryColor = '#38bdf8'; // Sky Blue
    bgStart = '#08253d';
    bgMid = '#051829';
    bgEnd = '#020b14';
    accentPattern = 'globe';
  }

  const lines = wrapSvgText(rawTitle, 40, 3);
  const escapedTheme = escapeXml(themeName);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-pattern="${accentPattern}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}" />
      <stop offset="60%" stop-color="${bgMid}" />
      <stop offset="100%" stop-color="${bgEnd}" />
    </linearGradient>

    <!-- Accent Glow -->
    <radialGradient id="beaconGlow" cx="20%" cy="20%" r="60%">
      <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.25" />
      <stop offset="50%" stop-color="${primaryColor}" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Technical Grid Pattern -->
    <pattern id="cardGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
      <circle cx="60" cy="60" r="1.5" fill="rgba(255, 255, 255, 0.06)" />
    </pattern>
  </defs>

  <!-- Base Dark Canvas -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <rect width="${width}" height="${height}" fill="url(#cardGrid)" />
  <rect width="${width}" height="${height}" fill="url(#beaconGlow)" />

  <!-- Subtle Vector Geometries -->
  <g opacity="0.15" stroke="${primaryColor}" stroke-width="1.5" fill="none">
    <circle cx="1050" cy="180" r="280" />
    <circle cx="1050" cy="180" r="180" stroke-dasharray="6,6" />
    <circle cx="1050" cy="180" r="80" />
    <path d="M 800 675 L 1200 275" />
    <path d="M 880 675 L 1200 355" stroke-dasharray="4,4" />
  </g>

  <!-- Framing Border -->
  <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="24" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" />

  <!-- Brand Masthead Header -->
  <g transform="translate(80, 85)">
    <!-- 9jaBeacon Sunburst Icon -->
    <rect width="46" height="46" rx="12" fill="${primaryColor}" />
    <circle cx="23" cy="23" r="5" fill="#ffffff" />
    <path d="M23 10 L23 14 M23 32 L23 36 M10 23 L14 23 M32 23 L36 23 M14 14 L17 17 M29 29 L32 32 M14 32 L17 29 M29 14 L32 17" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
    
    <!-- Brand Typography -->
    <text x="62" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="-0.5">9ja<tspan fill="${primaryColor}">Beacon</tspan></text>
    <text x="62" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="rgba(255, 255, 255, 0.6)" letter-spacing="2.5">EDITORIAL INVESTIGATIVE DESK</text>
  </g>

  <!-- Category Badge Pill -->
  <g transform="translate(80, 185)">
    <rect width="260" height="38" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="${primaryColor}" stroke-width="1.5" />
    <circle cx="22" cy="19" r="4.5" fill="${primaryColor}" />
    <text x="36" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#ffffff" letter-spacing="1.5">${escapedTheme}</text>
  </g>

  <!-- Dynamic Headline Typography -->
  <g transform="translate(80, 275)">
    ${lines.map((line, i) => `
      <text x="0" y="${i * 68}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#f8fafc" letter-spacing="-1">
        ${escapeXml(line)}
      </text>
    `).join('')}
  </g>

  <!-- Editorial Attribution Footer -->
  <g transform="translate(80, 560)">
    <!-- Nigerian Tricolor Marker -->
    <rect x="0" y="0" width="10" height="24" rx="2" fill="#008751" />
    <rect x="12" y="0" width="10" height="24" rx="2" fill="#ffffff" />
    <rect x="24" y="0" width="10" height="24" rx="2" fill="#008751" />

    <text x="48" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="600" fill="#cbd5e1">
      9jaBeacon News Wire  •  <tspan fill="${primaryColor}">${sourceName}</tspan>  •  Verified Public Interest Journalism
    </text>
  </g>
</svg>`.trim();
}

/**
 * Returns a base64 or utf8 data URI suitable for <img src="..." />
 */
export function generateEditorialSvgDataUrl(options: EditorialSvgOptions): string {
  const svg = generateEditorialSvgString(options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
