/**
 * 9jaBeacon Editorial Pipeline & Quality Gate (Fail-Closed Architecture)
 * 
 * Spec implementation:
 * - fail-closed ingest -> classify -> quality gate -> optional rewrite -> quality gate again -> DB publish
 * - Topic-first classification (Naija News, Business, Sports, World) with priority overrides
 * - Hard fail-closed quality checks (min 120 words, prohibited AI leaks, banned placeholder strings, deduplication, consecutive duplicate sentences)
 * - Proportional reading time: readingMinutes(wordCount) = Math.max(1, Math.ceil(wordCount / 200))
 * - Editorial Take policy: strictly no generic templates or boilerplate governance fillers on World/Sports
 * - Normalized canonical host and desk attributions
 */

export type ArticleCategory = 'naija-news' | 'business' | 'sports' | 'world';

export const ALLOWED_CATEGORIES = new Set<string>(['naija-news', 'business', 'sports', 'world']);

export interface QualityGateInput {
  title: string;
  bodyHtml?: string;
  bodyText: string;
  category: string;
  sourceOk: boolean;
  sourceUrl?: string;
  sourceOutlet?: string;
  sourceExcerpt?: string;
}

export interface QualityGateResult {
  pass: boolean;
  reasons: string[];
}

export interface DeskAttribution {
  authorName: string;
  authorRole: string;
  deskLabel: string;
}

/**
 * Standard reading time calculation: honest ceiling based on 200 wpm
 */
export function readingMinutes(wordCount: number): number {
  if (!wordCount || isNaN(wordCount) || wordCount <= 0) return 1;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Spec-mandated Category Normalizer with keyword fallbacks and hard overrides:
 * - Never defaults unknown to sports.
 * - Forces royalty / Olori / polygamy -> naija-news
 * - Forces blockchain / lisk -> business
 * - Forces foreign football / Liga MX -> sports
 */
export function normalizeCategory(raw: string, title = '', body = ''): ArticleCategory {
  let c = String(raw || '').toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace('naija_news', 'naija-news')
    .replace('cat_naija_news', 'naija-news')
    .replace('money_hustle', 'business')
    .replace('cat_money_hustle', 'business')
    .replace('money-hustle', 'business')
    .replace('cat_business', 'business')
    .replace('cat_sports', 'sports')
    .replace('cat_world', 'world');

  if (!ALLOWED_CATEGORIES.has(c)) {
    // keyword fallback ONLY if model failed — still better than default sports
    const t = `${title} ${body}`.toLowerCase();
    if (/\b(match|league|player|coach|tournament|afcon|npfl|fifa|liga|goal|transfer|cruz azul|toluca)\b/.test(t)
        && !/\b(olori|olu of|royal|polygamy|icpc|minister|blockchain|investment pledge)\b/.test(t)) {
      c = 'sports';
    } else if (/\b(cbn|naira|investment|company|fintech|trade surplus|coca-cola|stock|ipo)\b/.test(t)) {
      c = 'business';
    } else if (/\b(ukraine|gaza|washington|london|global|united nations)\b/.test(t)
        && !/\bnigeria|lagos|abuja|rivers state\b/.test(t)) {
      c = 'world';
    } else {
      c = 'naija-news';
    }
  }

  // Hard overrides — enforce spec rules (File 1 Section 3 & File 2 Section 5)
  const t = `${title} ${body}`.toLowerCase();
  
  // 1. Olori / traditional rulers / polygamy / culture / local incident / confinement -> strictly naija-news (never sports)
  if (/\b(olori|olu of warri|polygamy|traditional ruler)\b/.test(t)) c = 'naija-news';
  if (/\b(confinement|toilet confinement|rescued from toilet|police command|kidnap|icpc|efcc|arraign)\b/.test(t) && !/\b(match|player|stadium)\b/.test(t)) {
    c = 'naija-news';
  }

  // 2. Blockchain / Lisk / Coca-Cola / investment pledge -> strictly business
  if (/\b(blockchain|lisk|web3 network)\b/.test(t) && !/\b(match|player)\b/.test(t)) c = 'business';
  if (/\b(coca-cola|investment pledge|cbn rates|monetary policy committee)\b/.test(t)) c = 'business';

  // 3. Celebrity / entertainment / Nollywood -> strictly naija-news (never sports)
  if (/\b(celebrity|entertainment|nollywood|reconcile|reconciliation)\b/.test(t) && !/\b(match|player|league)\b/.test(t)) {
    c = 'naija-news';
  }

  // 4. Liga MX / Cruz Azul / Toluca / foreign football matches -> sports (not naija-news)
  if (/\b(cruz azul|toluca|liga mx|premier league|champions league|la liga|serie a|bundesliga)\b/.test(t)
      && /\b(draw|snatches draw|match|score|fixture|vs|table|goal)\b/.test(t)) {
    c = 'sports';
  }

  // 5. Global stories with no Nigeria angle -> world
  if (/\b(global clean energy|surpasses \$2 trillion|united nations|gaza|ukraine)\b/.test(t)
      && !/\bnigeria|lagos|abuja|rivers state|port harcourt\b/.test(t)) {
    c = 'world';
  }

  // 6. Demote sports if there is no sports signal
  if (c === 'sports') {
    const hasSportsSignal = /\b(match|league|player|coach|tournament|afcon|npfl|fifa|liga|goal|transfer|boxing|bout|striker|midfielder|winger|goalkeeper|defender|stadium|championship)\b/.test(t);
    if (!hasSportsSignal) {
      c = 'naija-news';
    }
  }

  return (ALLOWED_CATEGORIES.has(c) ? c : 'naija-news') as ArticleCategory;
}

/**
 * Maps category slug or DB category ID to canonical allowed category slug
 */
export function normalizeCategorySlug(rawCat?: string): ArticleCategory {
  return normalizeCategory(rawCat || '');
}

/**
 * Returns the corresponding DB category ID
 */
export function categorySlugToId(cat: ArticleCategory): string {
  switch (cat) {
    case 'business':
      return 'cat_money_hustle';
    case 'sports':
      return 'cat_sports';
    case 'world':
      return 'cat_world';
    case 'naija-news':
    default:
      return 'cat_naija_news';
  }
}

/**
 * Returns official Desk Attribution based exclusively on canonical category
 */
export function getDeskAttribution(category: ArticleCategory): DeskAttribution {
  switch (category) {
    case 'business':
      return {
        authorName: '9jaBeacon Business & Markets Desk',
        authorRole: 'Money, Banking & Macroeconomics Reporter',
        deskLabel: 'Money & Markets Editorial Desk',
      };
    case 'sports':
      return {
        authorName: '9jaBeacon Sports Desk',
        authorRole: 'Sports & Athletics Correspondent',
        deskLabel: 'Sports Desk',
      };
    case 'world':
      return {
        authorName: '9jaBeacon World Affairs Desk',
        authorRole: 'Global Geopolitics & Foreign Wire Analyst',
        deskLabel: 'World Affairs Editorial Desk',
      };
    case 'naija-news':
    default:
      return {
        authorName: '9jaBeacon National News Desk',
        authorRole: 'Governance, Judiciary & Public Affairs Reporter',
        deskLabel: 'National News Editorial Desk',
      };
  }
}

/**
 * Topic-first main classifier with deterministic post-overrides
 * (Never classifies by presence of generic money/price/fee words alone)
 */
export function classifyTopic(title: string, bodyText: string, aiSuggestedCategory?: string): ArticleCategory {
  const combined = `${title || ''}\n${(bodyText || '').slice(0, 1000)}`.toLowerCase();

  // 1. Clear Sports signals win first
  const sportsRegex = /\b(goal|goals|match|matches|premier league|npfl|super eagles|fifa|uefa|champions league|afcon|caf|coach|fixture|fixtures|striker|midfielder|winger|goalkeeper|defender|transfer window|ballon d'or|la liga|serie a|bundesliga|stadium|penalty|athletic|athletics|boxing|wrestle|wrestling|arsenal|chelsea|manchester united|liverpool|real madrid|barcelona|psg|osimhen|lookman|boniface)\b/i;
  if (sportsRegex.test(combined)) {
    return 'sports';
  }

  // 2. High-priority Politics / Governance / Crime / Courts / Elections overrides
  // Politics/Security MUST NEVER become business just because "funds", "naira", "fee", "price", or "dollars" appears.
  const politicsSecurityRegex = /\b(tinubu|shettima|presidency|aso rock|inec|national assembly|senate|house of reps|minister|ministry|police|fbi|efcc|icpc|dss|bandit|bandits|military|army|court|judiciary|election|elections|protest|protests|governor|otu|sanwo-olu|mutfwang|ndlea|nysc|frsc|apc|pdp|lp|nnpp|boko haram|kidnap|kidnappers|murder|arraign|prosecut|omokri|reno omokri|investigation|allegation|law enforcement|bribe)\b/i;
  const isPoliticsSecurity = politicsSecurityRegex.test(combined);

  // 3. Foreign / International affairs check (Zero Nigeria markers, distinct global signals)
  const nigeriaMarkerRegex = /\b(nigeria|nigerian|lagos|abuja|kano|kaduna|ibadan|port harcourt|rivers|enugu|anambra|delta|ogun|oyo|plateau|ondo|osun|sokoto|cross river|katsina|borno|naira|fg|federal government|national assembly)\b/i;
  const worldMarkersRegex = /\b(white house|pentagon|kremlin|putin|zelensky|biden|trump|united nations|un security council|gaza|israel|palestine|beirut|lebanon|syria|damascus|idlib|north korea|kim jong|philippines|manila|nepal|kathmandu|south africa|johannesburg|capetown|g7|nato|taipei|taiwan|beijing|tokyo|seoul)\b/i;

  if (worldMarkersRegex.test(combined) && !nigeriaMarkerRegex.test(title.toLowerCase())) {
    // If foreign story with no domestic Nigeria focus in headline
    return 'world';
  }

  // 4. Genuine Business subject check: only when firm, financial market, or macroeconomics is the actual subject
  const businessSubjectRegex = /\b(ngx|nigerian exchange|cbn|central bank of nigeria|monetary policy committee|interest rate|inflation rate|naira exchange rate|forex window|fmdq|inventory|manufacturer|manufacturers association of nigeria|bank plc|tier-1 bank|earnings report|quarterly revenue|gdp growth|capital importation|export surplus|crude oil production|refinery output|dangote refinery|fintech funding|papss)\b/i;

  if (businessSubjectRegex.test(combined) && !isPoliticsSecurity) {
    return 'business';
  }

  // If politics/security was flagged, strictly naija-news
  if (isPoliticsSecurity) {
    return 'naija-news';
  }

  // 5. Check AI suggestion if available, mapped safely
  if (aiSuggestedCategory) {
    const norm = normalizeCategorySlug(aiSuggestedCategory);
    if (norm === 'business') {
      // Apply guard: verify businessSubject actually exists, else naija-news
      if (businessSubjectRegex.test(combined)) {
        return 'business';
      }
      return 'naija-news';
    }
    return norm;
  }

  // Default fallback for domestic stories
  return 'naija-news';
}

/**
 * Spec-mandated post-rewrite validators:
 */
export function plainLen(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

export function hasAttribution(html: string, outlet: string): boolean {
  const t = html.toLowerCase();
  const o = (outlet || '').toLowerCase();
  return /according to|reported by|police said|in a statement|official|spokesperson|told newsmen|disclosed|confirmed that/.test(t)
    || (Boolean(o && o.length > 2 && t.includes(o)));
}

export function looksLikeStub(html: string): boolean {
  return /compiling|field dispatch|coming soon|lorem ipsum|as an ai|okay,\s*i need to/i.test(html);
}

export function bannedUnsourcedStats(html: string, excerpt: string): boolean {
  // Flag common unsolicited AI padding if not in excerpt
  const checks = [
    /15 million.*children/i,
    /global slavery index/i,
    /international labour organization/i,
    /world bank/i,
  ];
  const ex = (excerpt || '').toLowerCase();
  for (const re of checks) {
    if (re.test(html) && !re.test(ex)) return true;
  }
  return false;
}

/**
 * Fail-closed Quality Gate: Returns pass=false if article does not meet strict journalistic thresholds
 */
export function qualityGate(input: QualityGateInput): QualityGateResult {
  const reasons: string[] = [];
  const html = input.bodyHtml || '';
  const text = (input.bodyText || '').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const lengthChars = plainLen(html || text);

  // 1. Source availability check
  if (!input.sourceOk) {
    reasons.push('source_fetch_failed');
  }

  // Fail-closed source inputs
  if (input.sourceUrl !== undefined && !input.sourceUrl.trim()) {
    reasons.push('missing_source_url');
  }
  if (input.sourceExcerpt !== undefined && input.sourceExcerpt.trim().length < 50) {
    reasons.push('missing_source_excerpt');
  }

  // 2. Headline length check
  const title = (input.title || '').trim();
  if (!title || title.length < 20) {
    reasons.push('title_too_short');
  }

  // 3. Word count check (minimum 120 words required for publish)
  if (words < 120) {
    reasons.push(`body_too_short (${words} words < 120 words minimum)`);
  }

  // 4. Character count check (under 400 characters is rejected as a stub)
  if (lengthChars < 400) {
    reasons.push(`body_text_insufficient_length (${lengthChars} chars < 400 chars minimum)`);
  }

  // 5. Banned stub / placeholder / AI leak patterns
  if (looksLikeStub(text) || looksLikeStub(html)) {
    reasons.push('looks_like_stub_or_ai_leak');
  }

  const bannedPatterns = [
    /compiling further operational updates/i,
    /field dispatches and corroborating sources/i,
    /while pacing ai development might sound like a quick fix/i,
    /as an ai\b/i,
    /as an ai language model/i,
    /i cannot fulfill this request/i,
    /here is a rewritten version/i,
    /sure,\s*here is/i,
    /certainly,\s*here is/i,
    /based on the provided text/i,
    /placeholder/i,
    /observers anticipate/i,
    /the situation remains fluid/i,
    /search interest surges/i,
    /200 concurrent queries/i,
  ];

  for (const re of bannedPatterns) {
    if (re.test(text) || re.test(html)) {
      reasons.push(`placeholder_or_leak (${re.toString()})`);
      break;
    }
  }

  // 6. Unsourced global statistics check
  if (input.sourceExcerpt && bannedUnsourcedStats(html || text, input.sourceExcerpt)) {
    reasons.push('banned_unsourced_global_statistics_in_body');
  }

  // 7. Attribution check (require according to / outlet mention)
  if (input.sourceOutlet && !hasAttribution(html || text, input.sourceOutlet)) {
    reasons.push(`missing_source_attribution (${input.sourceOutlet})`);
  }

  // 8. Generic boilerplate filter (No generic Nigeria regulatory oversight boilerplate on World/Sports)
  const normCat = normalizeCategorySlug(input.category);
  if (normCat === 'world' || normCat === 'sports') {
    if (
      /across nigeria/i.test(text) &&
      /regulatory oversight/i.test(text) &&
      /civic monitors/i.test(text)
    ) {
      reasons.push('boilerplate_nigeria_injection_in_foreign_or_sports_story');
    }
  }

  // 9. Duplicate consecutive long sentences (detects broken/repetitive LLM loops)
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 40);

  for (let i = 1; i < sentences.length; i++) {
    if (sentences[i] === sentences[i - 1]) {
      reasons.push(`duplicate_consecutive_sentence ("${sentences[i].slice(0, 50)}...")`);
      break;
    }
  }

  // 10. Category validity check
  if (!ALLOWED_CATEGORIES.has(normCat)) {
    reasons.push(`invalid_category (${input.category})`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}

/**
 * Editorial Take Policy:
 * Default: OFF. No generic templates or boilerplate governance fillers on World wires.
 */
export function shouldWriteEditorialTake(_category?: string, _bodyWordCount?: number): boolean {
  // Default off per v2 spec
  return false;
}

/**
 * Common typo correction pass for news wires (e.g. "spoek" -> "spoke")
 */
export function cleanNewsTypos(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bspoek\b/gi, 'spoke')
    .replace(/\bteh\b/gi, 'the')
    .replace(/\bgoverment\b/gi, 'government')
    .replace(/\bpresidnet\b/gi, 'president')
    .replace(/\boccured\b/gi, 'occurred')
    .replace(/\brecieve\b/gi, 'receive');
}

// Re-export automated ingestion engine (RSS + Gemini)
export {
  fetchRss,
  rewriteWithEditorialQuality,
  runIngestionPipeline,
  type FetchRssResult,
  type EditorialRewriteResult,
  type IngestionPipelineResult,
} from './automated-ingest';

