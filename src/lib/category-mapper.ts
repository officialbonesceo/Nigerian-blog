/**
 * Topic-First Category Classifier for 9jaBeacon
 * 
 * Complies strictly with the 9jaBeacon AI Developer Spec & Editorial Standards:
 * - SPORTS only if main topic is:
 *   match, fixture, player, coach, club, league, tournament,
 *   Super Eagles, NPFL, AFCON, Olympics sport event, transfer fee for athletes
 * - NOT sports:
 *   royal/olori/king/traditional ruler, politics, ICPC, ministers,
 *   blockchain, steel investment, education policy, relationship drama
 *   unless the lead is an athlete competition story
 * - NO money-keyword rules (price|naira|fund|fee|transaction|million must not force business)
 * - Politics / governance / security / court / crime -> naija-news (even if "funds" / "naira" is mentioned)
 * - Business: only when firm, market, NGX, inflation, FX, or macro is the actual SUBJECT
 * - World: foreign lead with no Nigeria-first angle
 */

export type PrimaryCategory = 'cat_money_hustle' | 'cat_sports' | 'cat_world' | 'cat_naija_news';

export interface CategoryDecision {
  primary: PrimaryCategory;
  secondary?: PrimaryCategory;
  reasons: string[];
}

// Strict sports keywords: genuine athletic competition, football, leagues, or sports federations
const SPORTS_KEYWORDS = [
  'football', 'soccer', 'super eagles', 'npfl', 'premier league', 'champions league',
  'la liga', 'serie a', 'bundesliga', 'afcon', 'caf', 'fifa', 'match', 'goal',
  'stadium', 'football player', 'striker', 'midfielder', 'defender', 'goalkeeper',
  'referee', 'fixture', 'points table', 'relegation', 'promotion', 'ballon d\'or',
  'nff', 'boxing', 'athletics', 'basketball', 'tennis', 'wrestling', 'mma', 'ufc',
  'olympic', 'olympics', 'medal', 'sports tournament', 'league match',
  'transfer fee', 'transfer window', 'osimhen', 'lookman', 'boniface', 'pochettino',
  'arsenal', 'chelsea', 'manchester united', 'manchester city', 'liverpool', 'real madrid', 'barcelona'
];

// Explicit non-sports patterns: stories that frequently trigger false positive sports classification
const NOT_SPORTS_PATTERNS = /olori|olu of|royal|royalty|monarch|palace|polygamy|icpc|minister|blockchain|lisk|steel investment|education minister|traditional ruler|alausa|gym instructor|feminist|activist|divorce|adultery|court trial|senate|presidency|tinubu/i;

const POLITICS_SECURITY_KEYWORDS = [
  'tinubu', 'presidency', 'inec', 'senate', 'house of reps', 'national assembly',
  'minister', 'police', 'bandit', 'bandits', 'court', 'efcc', 'icpc', 'election',
  'protest', 'protests', 'governor', 'shettima', 'ndlea', 'nysc', 'frsc', 'dss',
  'military', 'army', 'kidnap', 'murder', 'judiciary', 'omokri', 'fbi', 'apc', 'pdp', 'lp',
  'olori', 'olu of warri', 'traditional ruler', 'alausa'
];

const GENUINE_BUSINESS_SUBJECTS = [
  'ngx', 'nigerian exchange', 'cbn', 'central bank', 'inflation', 'inventory',
  'manufacturer', 'manufacturers association', 'bank plc', 'tier-1 bank',
  'earnings', 'gdp', 'fx', 'dollar', 'exchange rate', 'monetary policy',
  'interest rate', 'fmdq', 'refinery', 'fintech', 'papss', 'afreximbank',
  'trade surplus', 'non-oil exports', 'telecom subscriber', 'working capital',
  'blockchain', 'crypto', 'steel investment', 'bilateral trade'
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
 * Post-overrides: Executed after model suggestions or initial classifier.
 * Ensures stories about royalty, ministers, blockchain, steel, education, or relationship drama
 * are never mislabeled as Sports.
 */
export function applyCategoryPostOverrides(
  category: PrimaryCategory,
  title: string,
  content: string
): PrimaryCategory {
  const combined = `${title} ${content}`.toLowerCase();

  // Post-override for Sports mis-tagging
  if (category === 'cat_sports') {
    if (NOT_SPORTS_PATTERNS.test(combined)) {
      // Map to Business if business/crypto/investment markers are present
      if (/blockchain|lisk|steel investment|crypto|invest|trade|export|firm|bank|equity|economy|fund|capital|dollar|naira|commercial/i.test(combined)) {
        return 'cat_money_hustle';
      }
      // Otherwise map to Naija News (royalty, culture, ministers, education, relationship drama, security)
      return 'cat_naija_news';
    }
  }

  return category;
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

  const isNotSports = NOT_SPORTS_PATTERNS.test(text);
  const sportsScore = isNotSports ? 0 : countMatches(text, SPORTS_KEYWORDS);
  const politicsScore = countMatches(text, POLITICS_SECURITY_KEYWORDS);
  const businessScore = countMatches(text, GENUINE_BUSINESS_SUBJECTS);
  const worldScore = countMatches(text, WORLD_KEYWORDS);
  const nigeriaScore = countMatches(text, NIGERIA_MARKERS);

  let initialDecision: CategoryDecision;

  // 1. High-priority Politics / Security / Culture override
  if (politicsScore >= 1) {
    initialDecision = {
      primary: 'cat_naija_news',
      secondary: undefined,
      reasons: [`Politics / governance / national / culture subject matched (${politicsScore}) - prioritized`],
    };
  }
  // 2. Clear sports signals win ONLY if NOT sports patterns are absent
  else if (!isNotSports && (sportsScore >= 2 || (sportsScore >= 1 && politicsScore === 0 && businessScore === 0))) {
    initialDecision = {
      primary: 'cat_sports',
      secondary: businessScore >= 1 ? 'cat_money_hustle' : undefined,
      reasons: [`Sports signals matched (${sportsScore})`],
    };
  }
  // 3. World Affairs: Zero Nigeria markers in title + strong foreign markers
  else if (nigeriaScore === 0 && (worldScore >= 2 || (worldScore >= 1 && /reuters|bbc|al jazeera|cnn|ap news|bloomberg|afp/i.test(sourceName || '')))) {
    initialDecision = {
      primary: 'cat_world',
      secondary: businessScore >= 1 ? 'cat_money_hustle' : undefined,
      reasons: [`Foreign wire with no domestic Nigeria focus (${worldScore} world markers)`],
    };
  }
  // 4. Business subject check: only when company, market, macro, or banking is the story subject
  else if (businessScore >= 2 || (businessScore >= 1 && politicsScore === 0)) {
    initialDecision = {
      primary: 'cat_money_hustle',
      reasons: [`Genuine business, financial market, or macroeconomic subject matched (${businessScore})`],
    };
  }
  // 5. Model suggestion evaluation
  else {
    const ai = (aiSuggested || '').toLowerCase();
    if (ai.includes('sport') && !isNotSports && sportsScore >= 1) {
      initialDecision = { primary: 'cat_sports', reasons: ['Model suggested sports and verified by sports markers'] };
    } else if (ai.includes('world') || (ai.includes('foreign') && nigeriaScore === 0)) {
      initialDecision = { primary: 'cat_world', reasons: ['Model suggested world affairs'] };
    } else if ((ai.includes('business') || ai.includes('money') || ai.includes('hustle')) && businessScore >= 1 && politicsScore === 0) {
      initialDecision = { primary: 'cat_money_hustle', reasons: ['Model suggested business and confirmed by business subject markers'] };
    } else {
      initialDecision = {
        primary: 'cat_naija_news',
        reasons: ['Defaulted to Naija News (governance, public institutions, or domestic events)'],
      };
    }
  }

  // 6. Execute mandatory post-overrides
  const finalizedPrimary = applyCategoryPostOverrides(initialDecision.primary, title, content);
  if (finalizedPrimary !== initialDecision.primary) {
    initialDecision.reasons.push(`Post-override reclassified ${initialDecision.primary} -> ${finalizedPrimary}`);
    initialDecision.primary = finalizedPrimary;
  }

  return initialDecision;
}
