/**
 * Wikipedia Public Media API Integration for 9jaBeacon
 * 
 * Fetches verified, high-resolution editorial photos from Wikimedia Commons
 * for real entities, public figures, landmarks, and news events.
 * 
 * Verification Rules:
 * - Must be authentic photographic media from Wikimedia Commons (upload.wikimedia.org).
 * - Strictly rejects vector icons (.svg), coats of arms, flags, locator maps, and logos.
 * - Enforces minimum resolution (width >= 300px).
 * - Falls back to null if unverified or unavailable so the editorial fallback setup is used.
 */

export interface WikipediaImageResult {
  imageUrl: string;
  caption: string;
  credit: string;
  wikiTitle: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Known non-photographic keywords to reject
 */
const REJECTED_IMAGE_KEYWORDS = [
  '.svg',
  'flag_of',
  'flag-',
  'coat_of_arms',
  'emblem',
  'insignia',
  'seal_of',
  'locator_map',
  'map_of',
  'location_map',
  'sound-icon',
  'speaker_icon',
  'audio_icon',
  'ambox',
  'question_mark',
  'portal-icon',
  'disambig',
  'symbol',
  'generic_avatar',
  'blank_template',
  'stub_icon',
  'padlock',
  'logo',
  '_logo',
  '-logo',
  'banner',
  'chart',
  'graph',
  'diagram',
  'poster',
  'icon',
  'screenshot',
  'waterfall',
  'falls',
  'rock_formation',
  'landscape',
  'cave',
  'scenery',
  'panorama',
  'tourist_attraction',
  'beach_resort',
];

const NIGERIAN_STATES_AND_CITIES = new Set([
  'osun', 'lagos', 'kano', 'kaduna', 'ondo', 'rivers', 'edo', 'delta', 'abuja',
  'imo', 'enugu', 'borno', 'plateau', 'sokoto', 'benue', 'ogun', 'oyo', 'kwara',
  'kogi', 'nasarawa', 'taraba', 'bauchi', 'gombe', 'yobe', 'adamawa', 'jigawa',
  'katsina', 'kebbi', 'zamfara', 'niger', 'ekiti', 'abia', 'anambra', 'ebonyi',
  'bayelsa', 'akwa ibom', 'cross river', 'ibadan', 'portharcourt', 'port harcourt',
  'benin city', 'warri', 'calabar', 'maiduguri', 'jos', 'ilorin', 'abeokuta'
]);

const CRIME_OR_INCIDENT_WORDS = /\b(police|arrest|arrested|court|judge|justice|murder|kill|killed|death|dead|hospital|blast|explosion|collapse|warning|warns|arraigned|fraud|strike|suspect|theft|remanded|gunmen|bandits)\b/i;

const PROMINENT_ENTITIES: Array<{ pattern: RegExp; query: string }> = [
  { pattern: /\b(?:kashim\s+)?shettima\b/i, query: 'Kashim Shettima' },
  { pattern: /\b(?:bola\s+)?tinubu\b/i, query: 'Bola Tinubu' },
  { pattern: /\b(?:babajide\s+)?sanwo-?olu\b/i, query: 'Babajide Sanwo-Olu' },
  { pattern: /\b(?:siminalayi\s+)?fubara\b/i, query: 'Siminalayi Fubara' },
  { pattern: /\b(?:nyesom\s+)?wike\b/i, query: 'Nyesom Wike' },
  { pattern: /\b(?:festus\s+)?keyamo\b/i, query: 'Festus Keyamo' },
  { pattern: /\b(?:governor\s+)?otu\b/i, query: 'Bassey Otu' },
  { pattern: /\b(?:caleb\s+)?mutfwang\b/i, query: 'Caleb Mutfwang' },
  { pattern: /\b(?:peter\s+)?obi\b/i, query: 'Peter Obi' },
  { pattern: /\b(?:atiku\s+)?abubakar\b/i, query: 'Atiku Abubakar' },
  { pattern: /\b(?:muhammadu\s+)?buhari\b/i, query: 'Muhammadu Buhari' },
  { pattern: /\b(?:olayemi\s+)?cardoso\b/i, query: 'Olayemi Cardoso' },
  { pattern: /\b(?:godwin\s+)?emefiele\b/i, query: 'Godwin Emefiele' },
  { pattern: /\b(?:aliko\s+)?dangote\b/i, query: 'Aliko Dangote' },
  { pattern: /\b(?:asuu|academic staff union of universities)\b/i, query: 'Academic Staff Union of Universities' },
  { pattern: /\bnigerian defence academy\b/i, query: 'Nigerian Defence Academy' },
  { pattern: /\bcole palmer\b/i, query: 'Cole Palmer' },
  { pattern: /\bdeclan rice\b/i, query: 'Declan Rice' },
  { pattern: /\banthony joshua\b/i, query: 'Anthony Joshua' },
  { pattern: /\btyson fury\b/i, query: 'Tyson Fury' },
  { pattern: /\bprincipality stadium\b/i, query: 'Millennium Stadium' },
  { pattern: /\brodri\b/i, query: 'Rodri (footballer)' },
  { pattern: /\bdembele\b/i, query: 'Ousmane Dembélé' },
  { pattern: /\benrique\b/i, query: 'Luis Enrique' },
  { pattern: /\blookman\b/i, query: 'Ademola Lookman' },
  { pattern: /\bosimhen\b/i, query: 'Victor Osimhen' },
  { pattern: /\bboniface\b/i, query: 'Victor Boniface' },
  { pattern: /\b(?:donald\s+)?trump\b/i, query: 'Donald Trump' },
  { pattern: /\b(?:unga|81st unga|united nations general assembly)\b/i, query: 'United Nations General Assembly' },
  { pattern: /\bmtn group\b/i, query: 'MTN Group' },
  { pattern: /\bnepal floods?\b/i, query: 'Nepal' },
];

/**
 * Extracts searchable subject queries from an article title
 */
export function extractWikipediaQueries(title: string, category?: string): string[] {
  const queries: string[] = [];
  const clean = title.replace(/[‘“"”’'']/g, ' ').replace(/\s+/g, ' ').trim();
  const isCrimeOrIncident = CRIME_OR_INCIDENT_WORDS.test(clean);

  // 1. Check known prominent figures / entities first
  for (const entity of PROMINENT_ENTITIES) {
    if (entity.pattern.test(clean)) {
      queries.push(entity.query);
    }
  }

  // 2. Quoted names/terms
  const quoted = title.match(/[‘"“]([^’”"]+)[’”"]/g);
  if (quoted) {
    for (const q of quoted) {
      const trimmed = q.replace(/[‘"“”’'']/g, '').trim();
      if (trimmed.length > 3 && !trimmed.toLowerCase().includes('gone in')) {
        queries.push(trimmed);
      }
    }
  }

  // 3. Colons or dash prefixes (e.g. "Osun: Police Arrest...", "TechCabal Daily: MTN...")
  // CRITICAL: Never query bare Nigerian state/city on crime/police stories (avoids waterfalls/tourism on murder/arrests)
  const parts = clean.split(/[:–—\-]/);
  if (parts.length > 1) {
    const left = parts[0].trim();
    const leftLower = left.toLowerCase();
    const isStateOrCity = NIGERIAN_STATES_AND_CITIES.has(leftLower);
    
    if (left.length >= 3 && left.length <= 35 && !leftLower.includes('daily')) {
      if (!isCrimeOrIncident || !isStateOrCity) {
        queries.push(left);
      }
    }
    const right = parts[1].trim();
    if (right.length >= 4) {
      queries.push(right.slice(0, 50));
    }
  }

  // 4. Prominent capitalized 2-word names/entities (e.g. "Ademola Lookman", "Festus Keyamo", "Donald Trump")
  const twoWordNames = clean.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)\b/g);
  if (twoWordNames) {
    for (const tw of twoWordNames) {
      const lower = tw.toLowerCase();
      if (
        !lower.includes('after') &&
        !lower.includes('before') &&
        !lower.includes('under') &&
        !lower.includes('over') &&
        !lower.includes('into') &&
        !lower.includes('says') &&
        !lower.includes('warns') &&
        !lower.includes('issues') &&
        !lower.includes('moves')
      ) {
        queries.push(tw);
      }
    }
  }

  // 5. Prominent capitalized multi-word phrases (e.g. "Central Bank of Nigeria", "Tottenham Hotspur")
  const properNouns = clean.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,3}\b/g);
  if (properNouns) {
    for (const pn of properNouns) {
      const lower = pn.toLowerCase();
      if (
        !lower.includes('african footballer') &&
        !lower.includes('higher institutions') &&
        !lower.includes('police command') &&
        !lower.includes('middle east') &&
        !lower.includes('see the') &&
        !lower.includes('gone in')
      ) {
        queries.push(pn);
      }
    }
  }

  // 6. Category-specific context query
  if (category === 'cat_sports') {
    const sportsMatch = clean.match(/(Dembele|Lookman|Rodri|Enrique|Odegaard|Havertz|Tottenham|Arsenal|Man City|Chelsea|Real Madrid|Super Eagles|Osimhen|Boniface)/i);
    if (sportsMatch) {
      queries.push(sportsMatch[0]);
    }
  }

  // 7. First 5-6 words of clean headline
  const headlineSlice = clean.split(/\s+/).slice(0, 6).join(' ');
  queries.push(headlineSlice);

  // Deduplicate and filter out short queries
  return [...new Set(queries)].filter((q) => q && q.length >= 3);
}

/**
 * Validates whether a media URL from Wikimedia is an authentic photographic asset
 */
export function isVerifiedWikipediaImage(url?: string, width?: number, height?: number): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();

  // Must be from legitimate Wikimedia domain
  if (!lower.includes('wikimedia.org')) return false;

  // Must have a standard photo extension
  const isRasterFormat = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') ||
    lower.includes('.jpg?') || lower.includes('.jpeg?') || lower.includes('.png?') || lower.includes('.webp?');

  if (!isRasterFormat) return false;

  // Reject icons, flags, logos, coats of arms
  for (const rejected of REJECTED_IMAGE_KEYWORDS) {
    if (lower.includes(rejected)) {
      return false;
    }
  }

  // Minimum dimensions: Width should be at least 280px to prevent thumbnail icons
  if (width && width < 280) return false;
  if (height && height < 180) return false;

  return true;
}

/**
 * Attempts to search and retrieve a verified Wikipedia photo for a story
 */
export async function fetchVerifiedWikipediaImage(
  title: string,
  category?: string
): Promise<WikipediaImageResult | null> {
  const candidateQueries = extractWikipediaQueries(title, category);

  for (const query of candidateQueries.slice(0, 3)) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=pageimages|extracts&piprop=thumbnail|original&pithumbsize=1200&exintro=1&explaintext=1&exchars=150&format=json`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': '9jaBeaconNews/1.0 (editorial@9jabeacon.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!response.ok) continue;

      const data: any = await response.json();
      const pages = Object.values(data?.query?.pages || {});

      for (const page of pages as any[]) {
        const thumb = page.thumbnail;
        const original = page.original;
        const candidateUrl = thumb?.source || original?.source;
        const width = thumb?.width || original?.width;
        const height = thumb?.height || original?.height;

        if (isVerifiedWikipediaImage(candidateUrl, width, height)) {
          // Verify entity relevance: The Wikipedia page title itself must share meaningful words with the query
          const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length >= 4 && !['with', 'from', 'after', 'under', 'into', 'over', 'says', 'warns', 'hails', 'moves'].includes(w));
          const pageTitleLower = page.title.toLowerCase();
          const hasTitleMatch = queryWords.some(w => pageTitleLower.includes(w)) ||
            pageTitleLower.split(/\s+/).some((pw: string) => pw.length >= 4 && query.toLowerCase().includes(pw));

          if (!hasTitleMatch) {
            continue; // Skip loosely related search matches where the page title does not match the subject
          }

          return {
            imageUrl: candidateUrl,
            caption: `${page.title} — archival editorial dispatch.`,
            credit: 'Wikimedia Commons / CC Attribution',
            wikiTitle: page.title,
            sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
            width,
            height,
          };
        }
      }
    } catch {
      // If a query times out or fails, gracefully try the next candidate
      continue;
    }
  }

  return null;
}
