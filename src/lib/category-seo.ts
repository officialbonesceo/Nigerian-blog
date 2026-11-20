/** Category-specific SEO helpers */

export type CategorySlug = 'naija-news' | 'business' | 'sports' | 'world' | string;

const CATEGORY_DEFAULTS: Record<
  string,
  { section: string; keywords: string[]; description: string }
> = {
  'naija-news': {
    section: 'Nigeria News',
    keywords: ['Nigeria news', 'Naija news', 'Lagos', 'Abuja'],
    description:
      'Latest Nigerian news: politics, security, states and everyday stories across the country. Clear updates from 9jaBeacon.',
  },
  business: {
    section: 'Business',
    keywords: ['Nigeria business', 'economy', 'Naira', 'CBN', 'markets'],
    description:
      'Nigeria business and economy news: naira, markets, companies, policy and hustle stories explained simply on 9jaBeacon.',
  },
  sports: {
    section: 'Sports',
    keywords: ['Nigeria sports', 'football', 'NPFL', 'Super Eagles'],
    description:
      'Nigerian and African sports news: Super Eagles, NPFL, athletics and major fixtures. Scores and context on 9jaBeacon.',
  },
  world: {
    section: 'World',
    keywords: ['world news', 'international', 'Africa'],
    description:
      'World news that matters to Nigerian readers: Africa, global politics, tech and culture. Straight reporting on 9jaBeacon.',
  },
  'money-hustle': {
    section: 'Business',
    keywords: ['Nigeria business', 'economy', 'Naira', 'CBN', 'markets'],
    description:
      'Nigeria business and economy news: naira, markets, companies, policy and hustle stories explained simply on 9jaBeacon.',
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

export function extractEmbeddedKeywords(content?: string | null): string[] {
  if (!content) return [];
  const m = content.match(/<!--\s*seo-keywords:\s*([^-][\s\S]*?)\s*-->/i);
  if (!m) return [];
  return m[1]
    .split(',')
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
  // Strip bylines like "By Name, CITY" that Ahrefs flagged as weak meta
  base = base.replace(/^By\s+[^.]{2,60}\.?\s*/i, '').trim();
  if (base.length < 120) {
    const pad = ` ${categoryLabel} coverage on 9jaBeacon — Nigerian news for everyday readers.`;
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
