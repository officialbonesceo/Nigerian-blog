/**
 * Rank RSS candidates BEFORE any AI call.
 * Cheap local scoring only — no model usage.
 */

export interface RankableItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  imageUrl?: string;
  sourceId: string;
  sourceName: string;
  categoryDefaultId?: string;
  trustScore?: number;
}

export interface RankedCandidate extends RankableItem {
  score: number;
  reasons: string[];
}

/**
 * Static high-intent Nigerian / regional query themes.
 * Can later be replaced/extended by GSC top queries without AI.
 */
export const TREND_KEYWORD_GROUPS: string[][] = [
  ['nysc', 'corps member', 'orientation camp'],
  ['cbn', 'naira', 'forex', 'exchange rate', 'monetary policy'],
  ['tinubu', 'presidency', 'villa', 'federal government'],
  ['inec', 'election', 'voter'],
  ['super eagles', 'npfl', 'afcon', 'football'],
  ['asuu', 'university', 'strike', 'jamb'],
  ['petrol', 'fuel subsidy', 'nnpc', 'refinery'],
  ['kidnap', 'bandit', 'insecurity', 'gunmen'],
  ['lagos', 'abuja', 'rivers', 'imo', 'anambra', 'kano'],
  ['court', 'supreme court', 'efcc', 'icpc'],
  ['diphtheria', 'cholera', 'outbreak', 'ncdc'],
  ['power grid', 'electricity', 'disco'],
];

function hoursAgo(pubDate?: string): number {
  if (!pubDate) return 72;
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return 72;
  return Math.max(0, (Date.now() - t) / 36e5);
}

function trendHits(text: string): { hits: number; matched: string[] } {
  const lower = text.toLowerCase();
  let hits = 0;
  const matched: string[] = [];
  for (const group of TREND_KEYWORD_GROUPS) {
    for (const kw of group) {
      if (lower.includes(kw)) {
        hits += 1;
        matched.push(kw);
        break; // one hit per group
      }
    }
  }
  return { hits, matched };
}

/**
 * Score one candidate. Higher = more worth spending AI on.
 */
export function scoreCandidate(item: RankableItem): RankedCandidate {
  const reasons: string[] = [];
  let score = 0;
  const blob = `${item.title} ${item.description || ''} ${item.content || ''}`.slice(0, 1500);

  // Recency (0–40)
  const age = hoursAgo(item.pubDate);
  if (age <= 6) {
    score += 40;
    reasons.push('fresh<=6h');
  } else if (age <= 24) {
    score += 28;
    reasons.push('fresh<=24h');
  } else if (age <= 48) {
    score += 16;
    reasons.push('fresh<=48h');
  } else if (age <= 72) {
    score += 8;
    reasons.push('fresh<=72h');
  } else {
    score += 2;
    reasons.push('older');
  }

  // Title quality
  const titleLen = (item.title || '').trim().length;
  if (titleLen >= 40 && titleLen <= 110) {
    score += 10;
    reasons.push('title-len');
  } else if (titleLen >= 25) {
    score += 5;
  }

  // Excerpt richness (helps later rewrite legality/quality)
  const excerpt = `${item.content || item.description || ''}`.replace(/<[^>]+>/g, ' ').trim();
  if (excerpt.length >= 400) {
    score += 15;
    reasons.push('rich-excerpt');
  } else if (excerpt.length >= 150) {
    score += 8;
    reasons.push('ok-excerpt');
  } else if (excerpt.length >= 50) {
    score += 3;
  }

  // Trend / search-intent overlap
  const { hits, matched } = trendHits(blob);
  if (hits > 0) {
    score += Math.min(25, hits * 8);
    reasons.push(`trend:${matched.slice(0, 3).join(',')}`);
  }

  // Source trust
  const trust = typeof item.trustScore === 'number' ? item.trustScore : 90;
  if (trust >= 95) {
    score += 8;
    reasons.push('high-trust');
  } else if (trust >= 85) {
    score += 4;
  }

  // Prefer items with image (UX, not SEO primary)
  if (item.imageUrl) {
    score += 3;
    reasons.push('has-image');
  }

  // Soft penalty for pure opinion/lifestyle markers in title
  if (/\b(opinion|editorial|how to|top \d+|celebrity gossip)\b/i.test(item.title || '')) {
    score -= 12;
    reasons.push('soft-penalty-opinion');
  }

  return { ...item, score, reasons };
}

/**
 * Rank and return top N unique-by-link candidates.
 */
export function rankCandidates(items: RankableItem[], topN: number): RankedCandidate[] {
  const seen = new Set<string>();
  const scored: RankedCandidate[] = [];

  for (const item of items) {
    const key = (item.link || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    scored.push(scoreCandidate(item));
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topN));
}
