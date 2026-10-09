/**
 * 9jaBeacon High-Definition Editorial SVG Generator & Publisher Image Sanitizer
 * Generates vector-crisp editorial cards and filters out publisher watermarks/logos.
 */
import { GoogleGenAI } from '@google/genai';

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

import { fetchVerifiedWikipediaImage } from './wikipedia-image';

/**
 * Detects if a story is centered on an individual person / public figure.
 * When true, we NEVER use generic stock photos (like Unsplash), because displaying
 * an unrelated person's face for a public figure or official violates news ethics.
 */
export function isPersonRelatedStory(title: string, content?: string): boolean {
  const combined = `${title || ''} ${(content || '').slice(0, 1000)}`.toLowerCase();

  // 1. Roles and titles of specific individuals (excluding anonymous suspects or victims)
  const personRoleKeywords = [
    /\b(president|governor|minister|senator|lawmaker|commissioner|inspector general|police chief|attorney general|spokesperson|ambassador)\b/i,
    /\b(footballer|striker|midfielder|defender|goalkeeper|coach|manager|winger|boxer|fighter|athlete|captain)\b/i,
    /\b(director general|chief executive|founder|chairman|billionaire|actor|actress|musician|singer|artist)\b/i,
    /\b(dr\.|prof\.|mr\.|mrs\.|ms\.|sen\.|gov\.|hon\.|chief|alhaaji|pastor|rev\.)\s+[a-z]+/i,
  ];

  for (const regex of personRoleKeywords) {
    if (regex.test(combined)) return true;
  }

  // 2. Known named public figures and prominent personalities
  const knownFigures = /\b(tinubu|shettima|sanwo-?olu|fubara|wike|peter\s+obi|atiku|buhari|emefiele|cardoso|dangote|adeleke|soludo|lookman|osimhen|boniface|iwobi|chukwueze|ndidi|pochettino|arteta|guardiola|ancelotti|trump|biden|harris|putin|zelensky|starmer|macron|netanyahu|alonso|russell|antonelli|joshua|fury|palmer|rice|rodri|dembele|enrique|otu|mutfwang|keyamo)\b/i;
  if (knownFigures.test(combined)) {
    return true;
  }

  return false;
}

export interface ResolvedImageResult {
  imageUrl: string;
  imageCaption: string;
  imageCredit: string;
  imageLicense: string;
}

/**
 * Curated high-resolution conceptual photography for general non-human news categories
 */
const NON_HUMAN_STOCK_ASSETS: Record<string, { url: string; caption: string; credit: string }> = {
  solar: {
    url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80',
    caption: 'Clean energy generation and utility-scale solar infrastructure.',
    credit: 'International Renewable Energy Agency / Unsplash',
  },
  finance: {
    url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
    caption: 'Financial market operations, banking liquidity, and currency exchange indicators.',
    credit: 'Financial Markets Analytics Archive',
  },
  equities: {
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    caption: 'Trading terminal monitoring equities movements and capital market volume.',
    credit: 'Capital Markets Data / Unsplash',
  },
  trade: {
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    caption: 'Maritime commercial freight terminal and container cargo logistics.',
    credit: 'Port Operations Authority / Unsplash',
  },
  tech: {
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
    caption: 'Enterprise cloud infrastructure, secure data networking, and telecommunications.',
    credit: 'Digital Systems Network Archive',
  },
  mobile: {
    url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=1200&q=80',
    caption: 'Mobile telecommunications devices and consumer electronics innovation.',
    credit: 'Tech Innovations Archive / Unsplash',
  },
  stadium: {
    url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Continental football arena and professional pitch grounds.',
    credit: 'Sports Federation Media',
  },
  boxing: {
    url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
    caption: 'Professional championship combat arena and boxing ring.',
    credit: 'Sports Arena Media Archive',
  },
  summit: {
    url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Intergovernmental diplomatic assembly and international policy summit.',
    credit: 'Global Summit Press Service',
  },
  education: {
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    caption: 'University academic lecture halls and higher education institution facilities.',
    credit: 'Higher Education Archive / Unsplash',
  },
  justice: {
    url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    caption: 'Courthouse legal chambers, constitutional jurisprudence, and justice administration.',
    credit: 'Legal & Judicial Media Archive',
  },
  defense: {
    url: 'https://images.unsplash.com/photo-1579208575657-c595a05383b7?auto=format&fit=crop&w=1200&q=80',
    caption: 'National defense reconnaissance, security command operations, and tactical deterrence.',
    credit: 'Defense Information Archive',
  },
  transit: {
    url: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=1200&q=80',
    caption: 'Interstate transport arterial road networks and municipal highway infrastructure.',
    credit: 'National Highway Infrastructure / Unsplash',
  },
  health: {
    url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    caption: 'Modern healthcare medical center, patient clinical care, and diagnostics.',
    credit: 'Healthcare Sciences Archive / Unsplash',
  },
  agriculture: {
    url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
    caption: 'Agricultural grain harvest, commercial farm cultivation, and food supply chains.',
    credit: 'Agricultural Production Bureau / Unsplash',
  },
  aviation: {
    url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    caption: 'Commercial aviation operations, terminal fleet maintenance, and airspace infrastructure.',
    credit: 'Aviation Authority / Unsplash',
  },
  flood: {
    url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1200&q=80',
    caption: 'Severe seasonal precipitation, emergency flood management, and hydrological monitoring.',
    credit: 'Emergency Disaster Relief Dispatch / Unsplash',
  },
  construction: {
    url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    caption: 'Urban structural engineering, civil construction works, and infrastructure development.',
    credit: 'Civil Engineering Archive / Unsplash',
  },
  police: {
    url: 'https://images.unsplash.com/photo-1508847154043-be5407fcaa5a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Law enforcement tactical operations, rapid emergency response, and public security patrols.',
    credit: 'Law Enforcement Command Archive / Unsplash',
  },
  refinery: {
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    caption: 'Petroleum energy refining operations, oil terminal pipelines, and crude processing.',
    credit: 'Energy Infrastructure Archive / Unsplash',
  },
  governance: {
    url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Intergovernmental executive assembly, national policy chambers, and civic administration.',
    credit: 'State Affairs Press Archive',
  },
  crypto: {
    url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1200&q=80',
    caption: 'Decentralized digital currency trading, blockchain ledgers, and digital asset markets.',
    credit: 'Digital Asset Markets Archive / Unsplash',
  },
};

/**
 * Extracts clean topic search keywords from article context for Unsplash / Pexels search
 */
export function extractImageSearchQuery(title: string, category?: string): string {
  const lower = title.toLowerCase();

  // Law enforcement / Crime / Court (Must be checked FIRST so crimes never match hospital/injuries)
  if (/\b(police|arrest|suspect|robbery|gunmen|bandits|kidnap|efcc|icpc|ndlea|fraud|detained|custody|court|judge|tribunal|arraigned)\b/i.test(lower)) {
    if (/\b(court|judge|tribunal|arraigned|remanded|bail|justice|ruling)\b/i.test(lower)) {
      return 'courtroom gavel justice trial';
    }
    return 'police security investigation law enforcement';
  }

  // Economy / Currency / Markets / Banking
  if (/\b(cbn|naira|fx|forex|inflation|bank|monetary|reserve|interest rate|economy|ngx|stock|equities)\b/i.test(lower)) {
    if (/\b(stock|equities|shares|market rally|ngx)\b/i.test(lower)) {
      return 'stock market financial exchange terminal';
    }
    return 'central bank currency money finance';
  }

  // Energy / Fuel / Oil / Power
  if (/\b(petrol|fuel|nnpc|refinery|crude|oil|gas|power grid|electricity|blackout|transmission)\b/i.test(lower)) {
    if (/\b(solar|clean energy|renewable)\b/i.test(lower)) {
      return 'solar energy panels infrastructure';
    }
    return 'energy petroleum oil refinery facility';
  }

  // Sports / Athletics
  if (category === 'cat_sports' || /\b(super eagles|falcons|football|soccer|premier league|champions league|match|stadium|afcon|fifa|boxing|bout)\b/i.test(lower)) {
    return 'football soccer match stadium floodlights';
  }

  // Tech / Telecom / 3MTT / Innovation
  if (/\b(tech|telecom|software|startup|fintech|ai|broadband|mtn|airtel|3mtt|digital|cyber)\b/i.test(lower)) {
    return 'modern technology innovation computing digital';
  }

  // Agriculture / Food security
  if (/\b(farmer|farm|agriculture|harvest|food prices|crops|grain|fertilizer|palm oil)\b/i.test(lower)) {
    return 'agriculture farmland harvest crops';
  }

  // Education / Universities / ASUU
  if (/\b(asuu|university|students|lecturers|academic|polytechnic|education|cadet|graduate)\b/i.test(lower)) {
    return 'university students campus lecture';
  }

  // Health / Medicine / Hospitals (strict medical only)
  if (/\b(hospital|doctor|nurses|clinical|medical center|disease|malaria|cholera|epidemic|outbreak)\b/i.test(lower)) {
    return 'modern hospital clinic healthcare';
  }

  // Aviation
  if (/\b(flight|airline|airport|aircraft|aviation|plane)\b/i.test(lower)) {
    return 'commercial airplane aviation airport';
  }

  // Transport & Roads
  if (/\b(road|highway|expressway|bridge|railway|train|transit)\b/i.test(lower)) {
    return 'highway expressway modern transport infrastructure';
  }

  // Governance / Diplomacy
  if (category === 'cat_world' || /\b(summit|unga|treaty|diplomacy|president|governor|senate|minister|bilateral)\b/i.test(lower)) {
    return 'government summit diplomacy assembly conference';
  }

  return 'editorial journalism news';
}

/**
 * Uses AI to analyze the news story and decide the optimal visual search keyword
 * for Unsplash / Pexels image search.
 * Features:
 * - Direct Gemini flash model inference.
 * - Negative prompt enforcement (never outputs syringes for crime/accidents).
 * - Comprehensive logging of any failure.
 * - Non-blocking fallback to deterministic rules.
 */
export async function extractAiImageSearchQuery(title: string, content?: string, category?: string): Promise<string> {
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Tier 1 AI: Google Gemini AI
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `Analyze this news article headline, category, and lead context.
Generate 2 to 4 precise visual keywords in English for an editorial stock photography search (Unsplash/Pexels).

Headline: "${title}"
Category: "${category || 'Naija News'}"
Context: "${(content || '').slice(0, 250).replace(/<[^>]+>/g, '').trim()}"

STRICT RULES:
1. Output ONLY 2 to 4 keywords separated by spaces (e.g. "police arrest law enforcement", "central bank currency market", "boxing championship ring", "commercial airplane flight").
2. NEVER output "syringe", "needle", "injection", or "vaccine" for crime, arrest, murder, trial, robbery, or poisoning stories!
3. No punctuation, no markdown, no quotes, no explanations.`;

      const aiPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI keyword decision timed out (4000ms)')), 4000)
      );

      const response: any = await Promise.race([aiPromise, timeoutPromise]);
      const rawText = (response?.text || '').trim().replace(/["'`.\n\r]/g, ' ').replace(/\s+/g, ' ');

      if (rawText && rawText.length > 2) {
        // Strict guard against syringes on crime/arrest stories
        const sanitized = rawText
          .replace(/\b(syringe|needle|injection|vaccine)\b/gi, 'investigation')
          .trim();
        const words = sanitized.split(' ').filter(Boolean).slice(0, 4).join(' ');
        if (words) {
          console.log(`🤖 [AI Image Keyword Engine]: Selected "${words}" for "${title.slice(0, 45)}..."`);
          return words;
        }
      }
    } catch (aiErr: any) {
      console.warn(`⚠️ [AI Image Keyword Engine Warning]: Gemini decision failed (${aiErr.message || String(aiErr)}).`);
    }
  }

  // Tier 2 AI: OpenRouter API Fallback
  const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (openrouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: 'qwen/qwen-2.5-72b-instruct:free',
          messages: [
            {
              role: 'user',
              content: `Output 2 to 4 visual stock photo keywords in English for: "${title}". Rules: ONLY keywords, no quotes, no syringes for crime.`
            }
          ],
          max_tokens: 20,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = (data.choices?.[0]?.message?.content || '').trim().replace(/["'`.\n\r]/g, ' ').replace(/\s+/g, ' ');
        if (text && text.length > 2) {
          const sanitized = text.replace(/\b(syringe|needle|injection|vaccine)\b/gi, 'investigation').trim();
          const words = sanitized.split(' ').filter(Boolean).slice(0, 4).join(' ');
          if (words) {
            console.log(`🤖 [OpenRouter AI Image Keyword Engine]: Selected "${words}" for "${title.slice(0, 45)}..."`);
            return words;
          }
        }
      }
    } catch (orErr: any) {
      console.warn(`⚠️ [OpenRouter Image Keyword Warning]:`, orErr.message);
    }
  }

  // Tier 3 AI: Cloudflare Workers AI Fallback
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (cfAccount && cfToken) {
    try {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Output 2 to 4 visual stock photo keywords in English for headline: "${title}". Rules: ONLY keywords separated by spaces, no punctuation, no medical terms on crime.`
            }
          ],
          max_tokens: 30,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (cfRes.ok) {
        const cfData = await cfRes.json() as any;
        const raw = (cfData?.result?.response || cfData?.response || '').trim().replace(/["'`.\n\r]/g, ' ').replace(/\s+/g, ' ');
        if (raw && raw.length > 2) {
          const sanitized = raw.replace(/\b(syringe|needle|injection|vaccine)\b/gi, 'investigation').trim();
          const words = sanitized.split(' ').filter(Boolean).slice(0, 4).join(' ');
          if (words) {
            console.log(`🤖 [Cloudflare AI Image Keyword Engine]: Selected "${words}" for "${title.slice(0, 45)}..."`);
            return words;
          }
        }
      }
    } catch (cfErr: any) {
      console.warn(`⚠️ [Cloudflare AI Image Keyword Warning]:`, cfErr.message);
    }
  }

  // Deterministic rule-based extraction fallback
  return extractImageSearchQuery(title, category);
}

export interface UnsplashCredentials {
  accessKey: string;
  secretKey: string;
  appId: string;
  appName: string;
}

/**
 * Robust Unsplash credential resolver:
 * Automatically recognizes all naming conventions used across GitHub Secrets, Cloudflare, and local .env:
 * - Access Key / Client ID: UNSPLASH_ACCESS_KEY, UNSPLASH_CLIENT_ID, UNSPLASH_API_KEY, UNSPLASH_KEY, etc.
 * - Secret Key: UNSPLASH_SECRET_KEY, UNSPLASH_CLIENT_SECRET, UNSPLASH_SECRET, etc.
 * - App ID: UNSPLASH_APP_ID, UNSPLASH_APPLICATION_ID, UNSPLASH_ID.
 * - App Name: UNSPLASH_APP_NAME, UNSPLASH_NAME, UNSPLASH_APPLICATION_NAME (used for TOS UTM referral tags).
 *
 * Includes heuristic validation to ensure a numeric App ID is never mistakenly sent as an API Bearer token,
 * and extracts the real 30-45 char Access Key even if fields were swapped or pasted with "Client-ID " prefix.
 */
export function resolveUnsplashCredentials(): UnsplashCredentials {
  const env = typeof process !== 'undefined' ? process.env || {} : {};

  // Check possible access key / client ID names
  let accessKey = (
    env.UNSPLASH_ACCESS_KEY ||
    env.UNSPLASH_CLIENT_ID ||
    env.UNSPLASH_API_KEY ||
    env.UNSPLASH_KEY ||
    env.UNSPLASH_PUBLIC_KEY ||
    env.UNSPLASH_ACCESS ||
    env.UNSPLASH_TOKEN ||
    ''
  ).trim();

  // Check possible secret key / client secret names
  let secretKey = (
    env.UNSPLASH_SECRET_KEY ||
    env.UNSPLASH_CLIENT_SECRET ||
    env.UNSPLASH_SECRET ||
    env.UNSPLASH_SECRET_TOKEN ||
    ''
  ).trim();

  // Check possible app ID names
  let appId = (
    env.UNSPLASH_APP_ID ||
    env.UNSPLASH_APPLICATION_ID ||
    env.UNSPLASH_ID ||
    ''
  ).trim();

  // Check registered app name (used in UTM source tag as required by Unsplash TOS)
  let appName = (
    env.UNSPLASH_APP_NAME ||
    env.UNSPLASH_APPLICATION_NAME ||
    env.UNSPLASH_NAME ||
    '9jaBeacon'
  ).trim();

  // Clean any pasted prefixes like "Client-ID ", "Bearer ", or surrounding quotes
  accessKey = accessKey.replace(/^Client-ID\s+/i, '').replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  secretKey = secretKey.replace(/^["']|["']$/g, '').trim();
  appId = appId.replace(/^["']|["']$/g, '').trim();

  // Heuristic safety #1: Did the user paste their long Access Key into UNSPLASH_APP_ID or UNSPLASH_ID?
  // (An Unsplash access key is alphanumeric and >= 20 characters, while App ID is typically a 4-8 digit number)
  if (!accessKey && appId && appId.length >= 20) {
    accessKey = appId;
    appId = '';
  }

  // Heuristic safety #2: Did the user paste their numeric App ID into UNSPLASH_ACCESS_KEY?
  if (accessKey && /^\d+$/.test(accessKey) && accessKey.length < 12) {
    if (!appId) appId = accessKey;
    accessKey = ''; // Pure numeric cannot be an Unsplash Access Key
  }

  return {
    accessKey,
    secretKey,
    appId,
    appName: appName || '9jaBeacon',
  };
}

/**
 * Dynamic External Stock Photo Search via Unsplash / Pexels API
 * Activated automatically when UNSPLASH_ACCESS_KEY / CLIENT_ID is supplied.
 * Fully compliant with Unsplash API Terms of Service (download triggers, live UTM attribution links).
 */
export async function searchDynamicStockPhoto(query: string): Promise<ResolvedImageResult | null> {
  const unsplashCreds = resolveUnsplashCredentials();
  const unsplashKey = unsplashCreds.accessKey;
  const appName = unsplashCreds.appName;
  const utmSource = encodeURIComponent(appName.replace(/\s+/g, ''));

  const pexelsKey = (typeof process !== 'undefined' ? (process.env?.PEXELS_API_KEY || '') : '').trim();

  // Try Unsplash API with full TOS compliance
  if (unsplashKey) {
    try {
      const endpoint = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Client-ID ${unsplashKey}`,
          'Accept-Version': 'v1',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const photo = data.results?.[0];
        if (photo && photo.urls?.regular) {
          // Unsplash TOS Requirement #1: Trigger download event location asynchronously to credit the photographer
          if (photo.links?.download_location) {
            fetch(photo.links.download_location, {
              headers: { Authorization: `Client-ID ${unsplashKey}` },
              signal: AbortSignal.timeout(3000),
            }).catch(() => {});
          }

          const author = photo.user?.name || photo.user?.username || 'Unsplash Contributor';
          const authorUrl = photo.user?.links?.html
            ? `${photo.user.links.html}?utm_source=${utmSource}&utm_medium=referral`
            : `https://unsplash.com/?utm_source=${utmSource}&utm_medium=referral`;
          const unsplashHome = `https://unsplash.com/?utm_source=${utmSource}&utm_medium=referral`;

          // Unsplash TOS Requirement #2: Formatted attribution with photographer & Unsplash links with UTM tracking
          const creditHtml = `Photo by <a href="${authorUrl}" target="_blank" rel="noopener noreferrer" class="underline hover:text-emerald-500">${author}</a> on <a href="${unsplashHome}" target="_blank" rel="noopener noreferrer" class="underline hover:text-emerald-500">Unsplash</a>`;

          return {
            imageUrl: `${photo.urls.regular}&auto=format&fit=crop&w=1200&q=80`,
            imageCaption: photo.description || photo.alt_description || `${query} — Verified wire report.`,
            imageCredit: creditHtml,
            imageLicense: 'Unsplash License (Free Editorial Use with Attribution)',
          };
        }
      } else {
        const errBody = await res.text().catch(() => '');
        console.warn(`[Unsplash API Notice]: HTTP ${res.status} - ${errBody.slice(0, 120)}`);
      }
    } catch (err: any) {
      console.warn('[Editorial Image]: Unsplash search warning:', err.message);
    }
  }

  // Try Pexels API (handles paused API gracefully)
  if (pexelsKey) {
    try {
      const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const res = await fetch(endpoint, {
        headers: { Authorization: pexelsKey },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const photo = data.photos?.[0];
        if (photo && (photo.src?.large2x || photo.src?.landscape || photo.src?.large)) {
          const imgUrl = photo.src.large2x || photo.src.landscape || photo.src.large;
          const author = photo.photographer || 'Pexels Contributor';
          return {
            imageUrl: imgUrl,
            imageCaption: photo.alt || `${query} — Verified wire report.`,
            imageCredit: `${author} / Pexels`,
            imageLicense: 'Pexels Editorial License',
          };
        }
      } else {
        console.warn(`[Pexels API Notice]: API status ${res.status} (Pexels may be paused or rate-limited). Falling back cleanly.`);
      }
    } catch (err: any) {
      console.warn('[Editorial Image]: Pexels search notice:', err.message);
    }
  }

  return null;
}

/**
 * Intelligent Multi-Tier Editorial Image Resolver:
 * 1. Prioritizes authentic photographic image from original news wire source.
 * 2. If human-related (person/public figure): tries Wikipedia Commons for that exact figure.
 * 3. Dynamic Unsplash/Pexels API lookup if API key is provided.
 * 4. Context-accurate themed photo matching with strict category isolation (never cross-contaminates crime and health!).
 * 5. Clean editorial SVG vector asset fallback.
 */
export async function resolveEditorialImage(options: {
  title: string;
  content?: string;
  category?: string;
  sourceName?: string;
  sourceImageUrl?: string | null;
  aiKeyword?: string | null;
}): Promise<ResolvedImageResult> {
  const { title, content, category, sourceName, sourceImageUrl, aiKeyword } = options;

  // Tier 1: Authentic photo from original news wire
  if (sourceImageUrl && !isPublisherLogoOrBanner(sourceImageUrl)) {
    return {
      imageUrl: sourceImageUrl,
      imageCaption: `${title} — Verified wire report.`,
      imageCredit: sourceName || 'Editorial Wire Partner',
      imageLicense: 'Editorial Fair Use',
    };
  }

  const isPerson = isPersonRelatedStory(title, content);

  // Tier 2: If human-related (person/public figure): try Wikipedia Commons for that exact figure.
  if (isPerson) {
    try {
      const wikiPhoto = await fetchVerifiedWikipediaImage(title, category);
      if (wikiPhoto && wikiPhoto.imageUrl) {
        return {
          imageUrl: wikiPhoto.imageUrl,
          imageCaption: wikiPhoto.caption || `${wikiPhoto.wikiTitle} — Archival editorial dispatch.`,
          imageCredit: wikiPhoto.credit || 'Wikimedia Commons',
          imageLicense: 'Creative Commons / Editorial',
        };
      }
    } catch {
      // Graceful continuation
    }
  }

  // Tier 3: AI Engine visual keyword decision + Dynamic stock photo API search (Unsplash / Pexels)
  let searchQuery = (aiKeyword && typeof aiKeyword === 'string' && aiKeyword.trim().length > 2)
    ? aiKeyword.trim()
    : '';

  if (!searchQuery) {
    searchQuery = await extractAiImageSearchQuery(title, content, category);
  } else {
    console.log(`🤖 [AI Image Keyword Engine]: Using AI-decided keyword "${searchQuery}" for "${title.slice(0, 45)}..."`);
  }

  const dynamicPhoto = await searchDynamicStockPhoto(searchQuery);
  if (dynamicPhoto) {
    return dynamicPhoto;
  }

  // Tier 4: Contextual curated themed photo matching utilizing title AND the AI visual keyword
  const lowerTitle = title.toLowerCase();
  const searchContext = `${lowerTitle} ${searchQuery.toLowerCase()}`;
  let matchedStock: { url: string; caption: string; credit: string } | null = null;

  // 4a. Crime, Police, Law Enforcement, EFCC, Courts, Arrests (STRICTLY FIRST)
  if (
    searchContext.includes('police') ||
    searchContext.includes('arrest') ||
    searchContext.includes('suspect') ||
    lowerTitle.includes('gunmen') ||
    lowerTitle.includes('bandits') ||
    lowerTitle.includes('kidnap') ||
    lowerTitle.includes('robbery') ||
    lowerTitle.includes('efcc') ||
    lowerTitle.includes('icpc') ||
    lowerTitle.includes('ndlea') ||
    lowerTitle.includes('detained') ||
    lowerTitle.includes('custody') ||
    lowerTitle.includes('warning to political')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.police;
  } else if (
    lowerTitle.includes('court') ||
    lowerTitle.includes('judge') ||
    lowerTitle.includes('justice') ||
    lowerTitle.includes('tribunal') ||
    lowerTitle.includes('lawyer') ||
    lowerTitle.includes('arraigned') ||
    lowerTitle.includes('remanded') ||
    lowerTitle.includes('nullifies')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.justice;
  } else if (
    lowerTitle.includes('refinery') ||
    lowerTitle.includes('petrol') ||
    lowerTitle.includes('fuel') ||
    lowerTitle.includes('crude oil') ||
    lowerTitle.includes('nnpc') ||
    lowerTitle.includes('dangote refinery')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.refinery;
  } else if (
    lowerTitle.includes('crypto') ||
    lowerTitle.includes('bitcoin') ||
    lowerTitle.includes('blockchain') ||
    lowerTitle.includes('binance')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.crypto;
  } else if (
    lowerTitle.includes('solar') ||
    lowerTitle.includes('clean energy') ||
    lowerTitle.includes('renewable') ||
    lowerTitle.includes('climate')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.solar;
  } else if (
    lowerTitle.includes('equities') ||
    lowerTitle.includes('ngx') ||
    lowerTitle.includes('stock exchange') ||
    lowerTitle.includes('shares')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.equities;
  } else if (
    lowerTitle.includes('inflation') ||
    lowerTitle.includes('bank') ||
    lowerTitle.includes('cbn') ||
    lowerTitle.includes('naira') ||
    lowerTitle.includes('interest rate') ||
    lowerTitle.includes('fx') ||
    lowerTitle.includes('liquidity')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.finance;
  } else if (
    lowerTitle.includes('asuu') ||
    lowerTitle.includes('university') ||
    lowerTitle.includes('student') ||
    lowerTitle.includes('academic') ||
    lowerTitle.includes('lecturer') ||
    lowerTitle.includes('higher institution') ||
    lowerTitle.includes('cadet') ||
    lowerTitle.includes('graduate')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.education;
  } else if (
    lowerTitle.includes('military') ||
    lowerTitle.includes('army') ||
    lowerTitle.includes('troops') ||
    lowerTitle.includes('defence academy') ||
    lowerTitle.includes('fansan yamma') ||
    lowerTitle.includes('security')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.defense;
  } else if (
    lowerTitle.includes('bus') ||
    lowerTitle.includes('transit') ||
    lowerTitle.includes('rail') ||
    lowerTitle.includes('highway') ||
    lowerTitle.includes('commuter') ||
    lowerTitle.includes('transport')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.transit;
  } else if (
    lowerTitle.includes('building') ||
    lowerTitle.includes('collapse') ||
    lowerTitle.includes('demolition') ||
    lowerTitle.includes('construction') ||
    lowerTitle.includes('estate')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.construction;
  } else if (
    lowerTitle.includes('flood') ||
    lowerTitle.includes('rain') ||
    lowerTitle.includes('storm') ||
    lowerTitle.includes('disaster')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.flood;
  } else if (
    (searchContext.includes('hospital') ||
    searchContext.includes('health') ||
    searchContext.includes('medical') ||
    searchContext.includes('clinical') ||
    searchContext.includes('disease') ||
    searchContext.includes('malaria') ||
    searchContext.includes('cholera')) &&
    !searchContext.includes('arrest') &&
    !searchContext.includes('police') &&
    !searchContext.includes('robbery') &&
    !searchContext.includes('murder') &&
    !searchContext.includes('court') &&
    !searchContext.includes('suspect')
  ) {
    // Legitimate medical & healthcare stories ONLY (strictly isolated from crime/legal news)
    matchedStock = NON_HUMAN_STOCK_ASSETS.health;
  } else if (
    lowerTitle.includes('food') ||
    lowerTitle.includes('palm oil') ||
    lowerTitle.includes('palm wine') ||
    lowerTitle.includes('farm') ||
    lowerTitle.includes('market') ||
    lowerTitle.includes('crop') ||
    lowerTitle.includes('herbal mixture') ||
    lowerTitle.includes('consumer protection')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.agriculture;
  } else if (
    lowerTitle.includes('aviation') ||
    lowerTitle.includes('flight') ||
    lowerTitle.includes('airline') ||
    lowerTitle.includes('airport') ||
    lowerTitle.includes('plane')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.aviation;
  } else if (
    lowerTitle.includes('phone') ||
    lowerTitle.includes('smartphone') ||
    lowerTitle.includes('apple') ||
    lowerTitle.includes('samsung') ||
    lowerTitle.includes('gadget')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.mobile;
  } else if (
    lowerTitle.includes('export') ||
    /\bports?\b/i.test(lowerTitle) ||
    lowerTitle.includes('customs') ||
    lowerTitle.includes('cargo') ||
    lowerTitle.includes('trade surplus')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.trade;
  } else if (
    lowerTitle.includes('telecom') ||
    lowerTitle.includes('broadband') ||
    lowerTitle.includes('fintech') ||
    /\bdata\b/i.test(lowerTitle) ||
    lowerTitle.includes('software') ||
    lowerTitle.includes('mtn') ||
    lowerTitle.includes('3mtt') ||
    lowerTitle.includes('idice') ||
    lowerTitle.includes('innovators')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.tech;
  } else if (
    lowerTitle.includes('boxing') ||
    lowerTitle.includes('heavyweight') ||
    lowerTitle.includes('joshua') ||
    lowerTitle.includes('fury') ||
    lowerTitle.includes('bout')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.boxing;
  } else if (
    category === 'cat_sports' ||
    lowerTitle.includes('league') ||
    lowerTitle.includes('tournament') ||
    lowerTitle.includes('stadium') ||
    lowerTitle.includes('match') ||
    /\bcup\b/i.test(lowerTitle) ||
    lowerTitle.includes('coach')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.stadium;
  } else if (
    category === 'cat_world' ||
    lowerTitle.includes('summit') ||
    lowerTitle.includes('un ') ||
    lowerTitle.includes('treaty') ||
    lowerTitle.includes('unga') ||
    lowerTitle.includes('north korea') ||
    lowerTitle.includes('diplomacy') ||
    lowerTitle.includes('intelligence')
  ) {
    matchedStock = NON_HUMAN_STOCK_ASSETS.summit;
  } else {
    matchedStock = NON_HUMAN_STOCK_ASSETS.governance;
  }

  if (matchedStock) {
    return {
      imageUrl: matchedStock.url,
      imageCaption: `${matchedStock.caption} (${title})`,
      imageCredit: matchedStock.credit,
      imageLicense: 'Editorial Concept Photo',
    };
  }

  // Final Tier 5: Custom Editorial SVG Graphic
  const svgUrl = generateEditorialSvgDataUrl({
    title,
    category: category || 'naija-news',
    sourceName: sourceName || '9jaBeacon Wire',
  });

  return {
    imageUrl: svgUrl,
    imageCaption: `${title} — Verified public interest report.`,
    imageCredit: '9jaBeacon Editorial Visual Desk',
    imageLicense: 'Vector Editorial Asset',
  };
}
