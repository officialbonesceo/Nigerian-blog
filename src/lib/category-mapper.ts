/**
 * Topic-First Category Classifier for 9jaBeacon
 * 
 * Complies strictly with the 9jaBeacon AI Developer Spec:
 * - NO money-keyword rules (price|naira|fund|fee|transaction|million must not force business)
 * - Politics / governance / security / court / crime -> naija-news (even if "funds" / "naira" is mentioned)
 * - Business: only when firm, market, NGX, inflation, FX, or macro is the actual SUBJECT
 * - Sports: matches, clubs, players, tournaments
 * - World: foreign lead with no Nigeria-first angle
 */

export type PrimaryCategory = 'cat_money_hustle' | 'cat_sports' | 'cat_world' | 'cat_naija_news';

export interface CategoryDecision {
  primary: PrimaryCategory;
  secondary?: PrimaryCategory;
  reasons: string[];
}

const SPORTS_KEYWORDS = [
  'football', 'soccer', 'super eagles', 'npfl', 'premier league', 'champions league',
  'la liga', 'serie a', 'bundesliga', 'afcon', 'caf', 'fifa', 'match', 'goal',
  'stadium', 'player', 'coach', 'manager', 'transfer', 'signing', 'kit',
  'boxing', 'athletics', 'basketball', 'tennis', 'wrestling', 'mma', 'ufc',
  'olympic', 'medal', 'tournament', 'league', 'cup', 'final', 'semi-final',
  'striker', 'midfielder', 'defender', 'goalkeeper', 'referee', 'fixture',
  'victory', 'defeat', 'draw', 'points table', 'relegation', 'promotion',
  'osimhen', 'lookman', 'boniface', 'dembele', 'odegaard', 'pochettino'
];

const POLITICS_SECURITY_KEYWORDS = [
  'tinubu', 'presidency', 'inec', 'senate', 'house of reps', 'national assembly',
  'minister', 'police', 'bandit', 'bandits', 'court', 'efcc', 'icpc', 'election',
  'protest', 'protests', 'governor', 'shettima', 'ndlea', 'nysc', 'frsc', 'dss',
  'military', 'army', 'kidnap', 'murder', 'judiciary', 'omokri', 'fbi', 'apc', 'pdp', 'lp'
];

const GENUINE_BUSINESS_SUBJECTS = [
  'ngx', 'nigerian exchange', 'cbn', 'central bank', 'inflation', 'inventory',
  'manufacturer', 'manufacturers association', 'bank plc', 'tier-1 bank',
  'earnings', 'gdp', 'fx', 'dollar', 'exchange rate', 'monetary policy',
  'interest rate', 'fmdq', 'refinery', 'fintech', 'papss', 'afreximbank',
  'trade surplus', 'non-oil exports', 'telecom subscriber', 'working capital'
];

const WORLD_KEYWORDS = [
  'united nations', 'white house', 'pentagon', 'kremlin', 'putin', 'zelensky',
  'biden', 'trump', 'middle east', 'israel', 'gaza', 'palestine', 'iran',
  'lebanon', 'beirut', 'syria', 'idlib', 'damascus', 'north korea', 'kim jong',
  'south korea', 'philippines', 'manila', 'nepal', 'kathmandu', 'taiwan',
  'beijing', 'tokyo', 'london', 'paris', 'berlin', 'ottawa', 'canberra',
  'south africa', 'johannesburg', 'nato', 'g7', 'g20'
];

const NIGERIA_MARKERS = [
  'nigeria', 'nigerian', 'lagos', 'abuja', 'kano', 'port harcourt',
  'rivers state', 'oyo', 'ogun', 'anambra', 'enugu', 'delta', 'ondo', 'osun',
  'sokoto', 'plateau', 'cross river', 'borno', 'kaduna', 'katsina', 'tinubu',
  'fg ', 'federal government'
];

function countMatches(text: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) count++;
  }
  return count;
}

/**
 * Decide primary + optional secondary category using topic-first main classifier.
 */
export function decideCategories(
  title: string,
  content: string,
  aiSuggested?: string,
  sourceName?: string
): CategoryDecision {
  const text = `${title} ${content} ${sourceName || ''}`.toLowerCase();

  const sportsScore = countMatches(text, SPORTS_KEYWORDS);
  const politicsScore = countMatches(text, POLITICS_SECURITY_KEYWORDS);
  const businessScore = countMatches(text, GENUINE_BUSINESS_SUBJECTS);
  const worldScore = countMatches(text, WORLD_KEYWORDS);
  const nigeriaScore = countMatches(text, NIGERIA_MARKERS);

  // 1. Clear sports signals win
  if (sportsScore >= 2 || (sportsScore >= 1 && politicsScore === 0 && businessScore === 0)) {
    return {
      primary: 'cat_sports',
      secondary: businessScore >= 1 ? 'cat_money_hustle' : undefined,
      reasons: [`Sports signals matched (${sportsScore})`],
    };
  }

  // 2. High-priority Politics / Security override: NEVER business just because "funds" or money appears
  if (politicsScore >= 1) {
    return {
      primary: 'cat_naija_news',
      secondary: undefined,
      reasons: [`Politics / governance / security subject matched (${politicsScore}) - prioritized over any financial terms`],
    };
  }

  // 3. World Affairs: Zero Nigeria markers in title + strong foreign markers
  if (nigeriaScore === 0 && (worldScore >= 2 || (worldScore >= 1 && /reuters|bbc|al jazeera|cnn|ap news|bloomberg|afp/i.test(sourceName || '')))) {
    return {
      primary: 'cat_world',
      secondary: businessScore >= 1 ? 'cat_money_hustle' : undefined,
      reasons: [`Foreign wire with no domestic Nigeria focus (${worldScore} world markers)`],
    };
  }

  // 4. Business subject check: only when company, market, macro, or banking is the story subject
  if (businessScore >= 2 || (businessScore >= 1 && politicsScore === 0)) {
    return {
      primary: 'cat_money_hustle',
      reasons: [`Genuine business, financial market, or macroeconomic subject matched (${businessScore})`],
    };
  }

  // 5. Model suggestion evaluation
  const ai = (aiSuggested || '').toLowerCase();
  if (ai.includes('sport')) {
    return { primary: 'cat_sports', reasons: ['Model suggested sports'] };
  }
  if (ai.includes('world') || (ai.includes('foreign') && nigeriaScore === 0)) {
    return { primary: 'cat_world', reasons: ['Model suggested world affairs'] };
  }
  if ((ai.includes('business') || ai.includes('money') || ai.includes('hustle')) && businessScore >= 1 && politicsScore === 0) {
    return { primary: 'cat_money_hustle', reasons: ['Model suggested business and confirmed by business subject markers'] };
  }

  return {
    primary: 'cat_naija_news',
    reasons: ['Defaulted to Naija News (governance, public institutions, or domestic events)'],
  };
}
