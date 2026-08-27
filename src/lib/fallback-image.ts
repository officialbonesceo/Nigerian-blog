/**
 * 9jaBeacon Branded Editorial Fallback Image Generator
 * Generates an ultra-crisp SVG card using 9jaBeacon's name, beacon logo, and editorial styling.
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

export function generateBrandedSvg(options: FallbackImageOptions = {}): string {
  const width = options.width || 1200;
  const height = options.height || 675;
  const rawTitle = options.title?.trim() || 'Your Trusted Light on Nigerian News';
  const category = (options.category?.trim() || '9jaBeacon Verified').toUpperCase();

  // Truncate title if too long for clean 2-line rendering
  const title = rawTitle.length > 70 ? rawTitle.slice(0, 67) + '...' : rawTitle;
  const escapedTitle = escapeXml(title);
  const escapedCategory = escapeXml(category);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#022c22" />
      <stop offset="50%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#021a12" />
    </linearGradient>

    <!-- Accent Emerald Gradient -->
    <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- Beacon Sunburst Gradient -->
    <radialGradient id="beaconBeam" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#059669" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#022c22" stop-opacity="0" />
    </radialGradient>

    <!-- Card Background Grid Pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(52, 211, 153, 0.05)" stroke-width="1" />
    </pattern>

    <!-- Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  
  <!-- Subtle Geometric Grid -->
  <rect width="${width}" height="${height}" fill="url(#grid)" />

  <!-- Ambient Glow Circles -->
  <circle cx="200" cy="150" r="300" fill="url(#beaconBeam)" />
  <circle cx="1050" cy="500" r="250" fill="url(#beaconBeam)" />

  <!-- Outer Border -->
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="24" fill="none" stroke="rgba(52, 211, 153, 0.2)" stroke-width="2" />

  <!-- Top Left: 9jaBeacon Logo Badge -->
  <g transform="translate(70, 70)">
    <!-- Logo Icon Background -->
    <rect width="64" height="64" rx="16" fill="url(#emeraldGlow)" filter="url(#glow)" />
    <!-- Beacon Lighthouse Rays -->
    <path d="M32 14 L24 48 L40 48 Z" fill="#ffffff" opacity="0.95" />
    <path d="M32 20 L16 38 L48 38 Z" fill="#ffffff" opacity="0.8" />
    <circle cx="32" cy="20" r="5" fill="#fef08a" />
    <path d="M32 20 L10 10 M32 20 L54 10 M32 20 L8 28 M32 20 L56 28" stroke="#fef08a" stroke-width="2.5" stroke-linecap="round" opacity="0.9" />
    
    <!-- Brand Wordmark -->
    <text x="80" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="-0.5">9ja<tspan fill="#34d399">Beacon</tspan></text>
    <text x="80" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#6ee7b7" letter-spacing="2">YOUR TRUSTED LIGHT ON NIGERIAN NEWS</text>
  </g>

  <!-- Category Tag -->
  <g transform="translate(70, 220)">
    <rect width="180" height="36" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(52, 211, 153, 0.4)" stroke-width="1.5" />
    <circle cx="20" cy="18" r="4" fill="#34d399" />
    <text x="34" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#a7f3d0" letter-spacing="1.5">${escapedCategory}</text>
  </g>

  <!-- Dynamic / Fallback Headline -->
  <g transform="translate(70, 310)">
    <text x="0" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
      ${escapedTitle}
    </text>
  </g>

  <!-- Bottom Brand Footer Strip -->
  <g transform="translate(70, 570)">
    <!-- Nigerian Flag Color Strip -->
    <rect x="0" y="0" width="12" height="24" rx="2" fill="#008751" />
    <rect x="14" y="0" width="12" height="24" rx="2" fill="#ffffff" />
    <rect x="28" y="0" width="12" height="24" rx="2" fill="#008751" />

    <text x="52" y="17" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#94a3b8">
      9jabeacon.pages.dev  •  Autonomous Nigerian Journalism &amp; Live Wire
    </text>
  </g>
</svg>`;
}

export const DEFAULT_FALLBACK_IMAGE_URL = '/fallback-image.svg';
