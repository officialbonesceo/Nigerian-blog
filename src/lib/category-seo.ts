/** Category-specific SEO helpers for article pages */

export type CategorySlug = 'naija-news' | 'business' | 'sports' | 'world' | string;

const CATEGORY_DEFAULTS: Record<
  string,
  { section: string; keywords: string[] }
> = {
  'naija-news': {
    section: 'Nigeria News',
    keywords: ['Nigeria news', 'Naija news', 'Lagos', 'Abuja'],
  },
  business: {
    section: 'Business',
    keywords: ['Nigeria business', 'economy', 'Naira', 'CBN', 'markets'],
  },
  sports: {
    section: 'Sports',
    keywords: ['Nigeria sports', 'football', 'NPFL', 'Super Eagles'],
  },
  world: {
    section: 'World',
    keywords: ['world news', 'international', 'Africa'],
  },
  'money-hustle': {
    section: 'Business',
    keywords: ['Nigeria business', 'economy', 'Naira', 'CBN', 'markets'],
  },
};

export function normalizeCategorySlug(slug?: string | null): string {
  const s = String(slug || 'naija-news').toLowerCase();
  if (s === 'money-hustle' || s === 'money' || s === 'hustle') return 'business';
  return s;
}

export function getCategorySeo(slug?: string | null) {
  const key = normalizeCategorySlug(slug);
  return CATEGORY_DEFAULTS[key] || CATEGORY_DEFAULTS['naija-news'];
}

/** Pull keywords written by daily-desk into HTML comments */
export function extractEmbeddedKeywords(content?: string | null): string[] {
  if (!content) return [];
  const m = content.match(/<!--\s*seo-keywords:\s*([^-][\s\S]*?)\s*-->/i);
  if (!m) return [];
  return m[1]
    .split(/,/)\
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function buildMetaDescription(
  summary: string | undefined,
  title: string,
  categoryLabel: string
): string {
  let base = (summary || title || '').replace(/\s+/g, ' ').trim();
  if (base.length < 120) {
    const pad = ` ${categoryLabel} coverage on 9jaBeacon.`;
    base = (base + pad).replace(/\s+/g, ' ').trim();
  }
  if (base.length > 160) return base.slice(0, 157).trimEnd() + '...';
  return base;
}

export function mergeKeywords(categorySlug: string | null | undefined, content?: string | null): string[] {
  const base = getCategorySeo(categorySlug).keywords;
  const embedded = extractEmbeddedKeywords(content);
  const all = [...base, ...embedded];
  return all.filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
}
