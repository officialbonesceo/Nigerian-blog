/**
 * Ultra-strong Category Mapper for 9jaBeacon
 * 
 * Rules:
 * - Money/Finance: ANYTHING related to money (loan, grant, crypto, bank, naira, oil, budget, fintech, investment, etc.)
 * - Sports: ANYTHING related to any sport
 * - World: Anything that is NOT Nigerian-based (foreign news)
 * - Naija News: Default Nigerian politics, security, governance, local affairs
 * 
 * Supports primary + secondary categories (e.g. player transfer = Sports + Money)
 */

export type PrimaryCategory = 'cat_money_hustle' | 'cat_sports' | 'cat_world' | 'cat_naija_news';

export interface CategoryDecision {
  primary: PrimaryCategory;
  secondary?: PrimaryCategory;
  reasons: string[];
}

const MONEY_KEYWORDS = [
  'naira', 'cbn', 'central bank', 'bank', 'banking', 'loan', 'grant', 'crypto', 'bitcoin',
  'ethereum', 'fintech', 'inflation', 'economy', 'economic', 'budget', 'oil', 'crude',
  'refinery', 'investment', 'investor', 'stock', 'shares', 'exchange rate', 'dollar',
  'usd', 'forex', 'sme', 'hustle', 'business', 'profit', 'revenue', 'tax', 'vat',
  'subsidy', 'fuel price', 'petrol', 'diesel', 'salary', 'wage', 'pension', 'capital',
  'funding', 'fund', 'debt', 'credit', 'interest rate', 'monetary', 'fiscal',
  'market', 'trade', 'export', 'import', 'commerce', 'startup', 'venture',
  'transfer fee', 'signing bonus', 'wage bill', 'contract worth', 'million naira',
  'billion naira', 'dollar deal', 'sponsorship', 'endorsement deal'
];

const SPORTS_KEYWORDS = [
  'football', 'soccer', 'super eagles', 'npfl', 'premier league', 'champions league',
  'la liga', 'serie a', 'bundesliga', 'afcon', 'caf', 'fifa', 'match', 'goal',
  'stadium', 'player', 'coach', 'manager', 'transfer', 'signing', 'kit',
  'boxing', 'athletics', 'basketball', 'tennis', 'wrestling', 'mma', 'ufc',
  'olympic', 'medal', 'tournament', 'league', 'cup', 'final', 'semi-final',
  'striker', 'midfielder', 'defender', 'goalkeeper', 'referee', 'fixture',
  'victory', 'defeat', 'draw', 'points table', 'relegation', 'promotion'
];

const WORLD_KEYWORDS = [
  'united nations', 'un ', 'us ', 'usa', 'america', 'american', 'china', 'chinese', 'beijing',
  'russia', 'russian', 'ukraine', 'europe', 'european', 'uk ', 'britain', 'british', 'france',
  'germany', 'middle east', 'israel', 'gaza', 'palestine', 'iran',
  'global', 'international', 'foreign', 'diplomacy', 'summit',
  'nato', 'g7', 'g20', 'world bank', 'imf', 'who ', 'unesco',
  'diaspora', 'abroad', 'overseas', 'washington', 'london', 'paris',
  'moscow', 'kyiv', 'brussels', 'geneva', 'trump', 'biden', 'white house',
  'pentagon', 'capitol hill', 'kremlin', 'putin', 'zelensky', 'tokyo', 'seoul',
  'pyongyang', 'north korea', 'south korea', 'taiwan', 'syria', 'idlib', 'damascus',
  'lebanon', 'beirut', 'nepal', 'kathmandu', 'philippines', 'manila', 'basilan',
  'india', 'indian', 'modi', 'delhi', 'canada', 'australia'
];

const NIGERIA_MARKERS = [
  'nigeria', 'nigerian', 'lagos', 'abuja', 'kano', 'port harcourt',
  'rivers state', 'oyo', 'ogun', 'anambra', 'enugu', 'delta',
  'tinubu', 'buhari', 'national assembly', 'senate', 'house of reps',
  'efcc', 'icpc', 'inec', 'npc', 'frsc', 'nysc', 'nnpc', 'ndlea',
  'south-west', 'south-east', 'south-south', 'north-west', 'north-east', 'north-central',
  'yoruba', 'igbo', 'hausa', 'fulani'
];

function countMatches(text: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) count++;
  }
  return count;
}

/**
 * Decide primary + optional secondary category.
 * AI decision is respected but overridden by strong keyword evidence.
 */
export function decideCategories(
  title: string,
  content: string,
  aiSuggested?: string,
  sourceName?: string
): CategoryDecision {
  const text = `${title} ${content} ${sourceName || ''}`.toLowerCase();
  const reasons: string[] = [];

  const moneyScore = countMatches(text, MONEY_KEYWORDS);
  const sportsScore = countMatches(text, SPORTS_KEYWORDS);
  const worldScore = countMatches(text, WORLD_KEYWORDS);
  const nigeriaScore = countMatches(text, NIGERIA_MARKERS);

  // Detect multi-category cases (e.g. player transfer = Sports + Money)
  const isPlayerMoneyDeal =
    sportsScore > 0 &&
    (text.includes('transfer') || text.includes('signing') || text.includes('contract') ||
     text.includes('fee') || text.includes('wage') || text.includes('deal') ||
     text.includes('million') || text.includes('billion'));

  let primary: PrimaryCategory = 'cat_naija_news';
  let secondary: PrimaryCategory | undefined;

  // Priority order:
  // 1. Sports+Money hybrid
  // 2. Pure sports
  // 3. Foreign/World stories (if zero Nigeria markers and strong world keywords/foreign source, primary is cat_world)
  // 4. Money/Hustle (for Nigerian business, finance, and domestic economic affairs)
  // 5. Naija News (governance, judiciary, community)
  if (isPlayerMoneyDeal) {
    primary = 'cat_sports';
    secondary = 'cat_money_hustle';
    reasons.push('Detected sports transfer/financial deal → Sports + Money');
  } else if (sportsScore >= 2 || (sportsScore >= 1 && moneyScore === 0 && worldScore === 0)) {
    primary = 'cat_sports';
    reasons.push(`Sports keywords matched (${sportsScore})`);
  } else if (nigeriaScore === 0 && (worldScore >= 2 || (worldScore >= 1 && /reuters|bbc|al jazeera|cnn|ap news|bloomberg|afp/i.test(sourceName || '')))) {
    primary = 'cat_world';
    if (moneyScore >= 1) {
      secondary = 'cat_money_hustle';
      reasons.push(`Foreign/World story with economic angle (${worldScore} world, ${moneyScore} money)`);
    } else {
      reasons.push(`Foreign/World story with no Nigeria markers (${worldScore} world)`);
    }
  } else if (moneyScore >= 2 || (moneyScore >= 1 && sportsScore === 0)) {
    primary = 'cat_money_hustle';
    reasons.push(`Money/Finance keywords matched (${moneyScore})`);
  } else if (worldScore >= 2 && nigeriaScore === 0) {
    primary = 'cat_world';
    reasons.push(`Foreign/World keywords matched (${worldScore}) with no strong Nigeria markers`);
  } else {
    // Respect AI if it made a clear choice, otherwise default to Naija
    const ai = (aiSuggested || '').toLowerCase();
    if (ai.includes('money') || ai.includes('hustle') || ai.includes('business') || ai.includes('economy')) {
      primary = 'cat_money_hustle';
      reasons.push('AI suggested Money/Hustle');
    } else if (ai.includes('sport')) {
      primary = 'cat_sports';
      reasons.push('AI suggested Sports');
    } else if (ai.includes('world') || ai.includes('global') || ai.includes('foreign')) {
      primary = 'cat_world';
      reasons.push('AI suggested World');
    } else {
      primary = 'cat_naija_news';
      reasons.push('Defaulted to Naija News');
    }
  }

  // Extra safety: pure foreign story should never stay in Naija News
  if (primary === 'cat_naija_news' && nigeriaScore === 0 && worldScore >= 1) {
    primary = 'cat_world';
    reasons.push('Overrode to World (no Nigeria markers)');
  }

  // Extra safety: pure foreign story should never be primary Money & Hustle unless Nigeria-linked
  if (primary === 'cat_money_hustle' && nigeriaScore === 0 && worldScore >= 2) {
    primary = 'cat_world';
    secondary = 'cat_money_hustle';
    reasons.push('Overrode to World (international economic event without Nigerian domestic ties)');
  }

  return { primary, secondary, reasons };
}
