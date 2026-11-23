/**
 * 9jaBeacon high-contrast hook-style fallback cards
 * Big headline, urgency bar, dark overlay — built for click-through, not plain text tiles.
 */

export interface FallbackImageOptions {
  title?: string;
  category?: string;
  width?: number;
  height?: number;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxLen = 28, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= maxLen) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\.*$/, '') + '…';
  }
  return lines.length ? lines : [text.slice(0, maxLen)];
}

export function generateBrandedSvg(options: FallbackImageOptions = {}): string {
  const width = options.width || 1200;
  const height = options.height || 675;
  const rawTitle = options.title?.trim() || 'Breaking: Nigeria news that matters';
  const category = (options.category?.trim() || 'NIGERIA NEWS').toUpperCase().slice(0, 28);
  const lines = wrapLines(rawTitle, 30, 3);
  const escapedCat = escapeXml(category);

  const lineEls = lines
    .map((line, i) => {
      const y = 300 + i * 72;
      const fill = i === 0 ? '#facc15' : '#ffffff'; // first line yellow hook
      return `<text x="64" y="${y}" font-family="system-ui,Arial,sans-serif" font-size="56" font-weight="900" fill="${fill}" letter-spacing="-1">${escapeXml(line)}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#facc15"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <!-- top urgency strip -->
  <rect x="0" y="0" width="${width}" height="8" fill="url(#bar)"/>
  <!-- brand -->
  <text x="64" y="72" font-family="system-ui,Arial,sans-serif" font-size="28" font-weight="900" fill="#ffffff">9ja<tspan fill="#34d399">Beacon</tspan></text>
  <rect x="64" y="96" width="${Math.min(320, 24 + category.length * 11)}" height="32" rx="6" fill="#10b981"/>
  <text x="76" y="118" font-family="system-ui,Arial,sans-serif" font-size="14" font-weight="800" fill="#022c22" letter-spacing="1.5">${escapedCat}</text>
  ${lineEls}
  <!-- bottom hook bar -->
  <rect x="0" y="${height - 72}" width="${width}" height="72" fill="#000000" opacity="0.55"/>
  <text x="64" y="${height - 28}" font-family="system-ui,Arial,sans-serif" font-size="18" font-weight="700" fill="#e2e8f0">www.9jabeacon.name.ng  ·  Nigerian news wire</text>
</svg>`;
}

export const DEFAULT_FALLBACK_IMAGE_URL = '/fallback-image.svg';
