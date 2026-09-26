export interface TopicDefinition {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  searchTerms: string[];
  categorySlug: string;
  color: string;
}

export const NIGERIAN_TOPIC_SPHERES: TopicDefinition[] = [
  {
    slug: 'dangote-refinery',
    name: 'Dangote Petroleum Refinery & Petrochemicals',
    shortName: 'Dangote Refinery',
    tagline: 'Fuel supply, crude oil sales in Naira, local pump prices, and downstream oil distribution updates.',
    description: 'Latest verified news, crude supply agreements in Naira, petrol pricing, and production updates from the Dangote Petroleum Refinery in Lagos.',
    searchTerms: ['dangote', 'dangote refinery', 'crude in naira', 'petrol pump price', 'fuel loading'],
    categorySlug: 'business',
    color: '#0284c7', // sky-600
  },
  {
    slug: 'cbn-monetary-policy',
    name: 'Central Bank of Nigeria (CBN) & Monetary Policy',
    shortName: 'CBN Policy',
    tagline: 'Interest rate decisions (MPR), banking recapitalization, and financial sector directives.',
    description: 'Official Central Bank of Nigeria (CBN) directives, Monetary Policy Committee (MPC) decisions, FX market rules, and bank recapitalization news.',
    searchTerms: ['cbn', 'cardoso', 'monetary policy', 'mpr', 'bank recapitalization', 'fx market'],
    categorySlug: 'business',
    color: '#16a34a', // green-600
  },
  {
    slug: 'naira-exchange-rate',
    name: 'Naira Exchange Rate & Foreign Exchange Market',
    shortName: 'Naira FX',
    tagline: 'Official NAFEM closing rates, parallel market FX developments, and foreign reserve movements.',
    description: 'Track Nigerian Naira (NGN) against US Dollar, British Pound, and Euro across official NAFEM windows and open market forex movements.',
    searchTerms: ['naira', 'exchange rate', 'nafem', 'fx reserves', 'dollar rate', 'foreign exchange'],
    categorySlug: 'business',
    color: '#059669', // emerald-600
  },
  {
    slug: 'fuel-price-and-energy',
    name: 'Nigeria Fuel Price, Petrol & Energy Sector',
    shortName: 'Fuel & Energy',
    tagline: 'PMS pump prices, NNPCL supply logistics, CNG transition, and power grid status.',
    description: 'Verified updates on petrol (PMS) retail pump prices across Nigerian states, NNPCL supply updates, and national energy policy changes.',
    searchTerms: ['fuel price', 'pms', 'nnpcl', 'petrol price', 'subsidy', 'power grid', 'cng'],
    categorySlug: 'business',
    color: '#d97706', // amber-600
  },
  {
    slug: 'tinubu-presidency',
    name: 'President Bola Ahmed Tinubu & Federal Executive',
    shortName: 'Tinubu Administration',
    tagline: 'Federal Executive Council (FEC) approvals, economic reforms, diplomatic engagements, and state visits.',
    description: 'Official announcements, policy pronouncements, executive orders, and governance updates from the President Bola Ahmed Tinubu administration.',
    searchTerms: ['tinubu', 'presidency', 'aso rock', 'fec', 'renewed hope', 'federal government'],
    categorySlug: 'naija-news',
    color: '#008751', // 9ja emerald
  },
  {
    slug: 'efcc-and-anti-corruption',
    name: 'EFCC Investigations & Anti-Corruption Inquiries',
    shortName: 'EFCC Watch',
    tagline: 'Financial crime prosecutions, asset forfeitures, public fund audits, and court proceedings.',
    description: 'Verified reporting on Economic and Financial Crimes Commission (EFCC) operations, court arraignments, asset recovery, and financial accountability.',
    searchTerms: ['efcc', 'anti-corruption', 'arraignment', 'money laundering', 'olukoyede', 'forfeiture'],
    categorySlug: 'naija-news',
    color: '#dc2626', // red-600
  },
  {
    slug: 'super-eagles-and-sports',
    name: 'Nigeria Super Eagles & International Football',
    shortName: 'Super Eagles',
    tagline: 'AFCON qualifiers, international friendlies, player transfers, and NPFL league match days.',
    description: 'Comprehensive sports coverage of Nigeria Super Eagles, European club form of Nigerian players, and domestic NPFL fixtures.',
    searchTerms: ['super eagles', 'osimhen', 'lookman', 'afcon', 'nff', 'npfl', 'nigerian football'],
    categorySlug: 'sports',
    color: '#10b981', // emerald-500
  },
  {
    slug: 'food-prices-and-inflation',
    name: 'Nigeria Food Prices, Agriculture & Inflation Tracker',
    shortName: 'Food & Cost of Living',
    tagline: 'Market survey prices of staple foods (rice, garri, beans), NBS headline inflation, and farmer security.',
    description: 'Market surveys and National Bureau of Statistics (NBS) inflation metrics tracking the real cost of staple foods across Nigerian markets.',
    searchTerms: ['food inflation', 'food prices', 'rice price', 'nbs', 'cost of living', 'staple foods'],
    categorySlug: 'business',
    color: '#f59e0b', // amber-500
  },
  {
    slug: 'national-assembly-legislation',
    name: 'Senate, House of Reps & Federal Legislation',
    shortName: 'National Assembly',
    tagline: 'Plenary debates, constitution amendments, public hearings, and federal budget scrutiny.',
    description: 'Daily legislative coverage from the Senate and House of Representatives: bills passed, committee investigations, and statutory budget approvals.',
    searchTerms: ['senate', 'house of reps', 'national assembly', 'lawmakers', 'plenary', 'akpabio'],
    categorySlug: 'naija-news',
    color: '#4f46e5', // indigo-600
  },
  {
    slug: 'security-and-defence',
    name: 'National Security, Police & Military Operations',
    shortName: 'Security Watch',
    tagline: 'Military clearance operations, police commands, border patrols, and community safety alerts.',
    description: 'Verified security reports from Defence Headquarters (DHQ), Nigeria Police Force, and civil security agencies nationwide.',
    searchTerms: ['police', 'military', 'troops', 'dhq', 'security forces', 'bandits', 'clearance operation'],
    categorySlug: 'naija-news',
    color: '#64748b', // slate-500
  },
  {
    slug: 'fintech-and-digital-economy',
    name: 'Nigerian Fintech, Tech Startups & Digital Economy',
    shortName: 'Fintech & Tech',
    tagline: 'Mobile payments, startup funding rounds, telecom tariffs, and digital financial innovation.',
    description: 'Reporting on Nigerian fintech ecosystems (OPay, Moniepoint, Flutterwave, Paystack), regulatory compliance, and technology investment.',
    searchTerms: ['fintech', 'startups', 'techcabal', 'opay', 'moniepoint', 'flutterwave', 'ncc', 'telecoms'],
    categorySlug: 'business',
    color: '#8b5cf6', // purple-500
  },
  {
    slug: 'entertainment-and-afrobeats',
    name: 'Afrobeats, Nollywood & Pop Culture',
    shortName: 'Entertainment',
    tagline: 'Global music charts, box office figures, major film releases, and cultural milestones.',
    description: 'Verified reporting on Afrobeats global achievements, Nollywood cinematic premieres, Headies, and prominent cultural developments.',
    searchTerms: ['afrobeats', 'nollywood', 'wizkid', 'davido', 'burna boy', 'box office', 'entertainment'],
    categorySlug: 'naija-news',
    color: '#ec4899', // pink-500
  },
];

export function getTopicBySlug(slug: string): TopicDefinition | undefined {
  const clean = (slug || '').toLowerCase().trim();
  return NIGERIAN_TOPIC_SPHERES.find((t) => t.slug === clean);
}

export function detectTopicsForArticle(title: string, content: string, summary: string): TopicDefinition[] {
  const combined = `${title} ${summary} ${content}`.toLowerCase();
  const matched: TopicDefinition[] = [];

  for (const topic of NIGERIAN_TOPIC_SPHERES) {
    const hits = topic.searchTerms.some((term) => combined.includes(term.toLowerCase()));
    if (hits) {
      matched.push(topic);
    }
  }

  return matched.slice(0, 3);
}
