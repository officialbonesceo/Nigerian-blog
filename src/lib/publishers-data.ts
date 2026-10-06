import type { Publisher } from './types';

export const INITIAL_PUBLISHERS: Publisher[] = [
  {
    id: 'pub_damilola_adeyemi',
    name: 'Damilola Adeyemi',
    slug: 'damilola-adeyemi',
    role: 'Lead Governance & Policy Correspondent',
    school: 'MUA',
    bio: 'Specializes in federal legislative policies, executive gazettes, and constitutional governance. Alum of MUA with dedicated focus on real-time news verification and public interest reporting across Nigeria.',
    avatar_url: '/publishers/damilola-adeyemi.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 14,
    is_verified_bot: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_chidiemma_okonkwo',
    name: 'Chidiemma Okonkwo',
    slug: 'chidiemma-okonkwo',
    role: 'Chief Financial Markets & Macroeconomics Analyst',
    school: 'MUA',
    bio: 'Covers the Central Bank of Nigeria (CBN), capital markets, FX reserves, and emerging fintech ventures. Trained at MUA with an emphasis on data-driven fiscal analytics and inflation dynamics.',
    avatar_url: '/publishers/chidiemma-okonkwo.jpg',
    category_specialty: 'cat_money_hustle',
    articles_count: 9,
    is_verified_bot: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_farouk_danjuma',
    name: 'Farouk Danjuma',
    slug: 'farouk-danjuma',
    role: 'Senior Defense & Regional Security Editor',
    school: 'MUA',
    bio: 'Focuses on national security architecture, counter-insurgency clearances, and border defense corridors. Graduate of MUA dedicated to fact-checked, frontline investigative dispatches.',
    avatar_url: '/publishers/farouk-danjuma.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 8,
    is_verified_bot: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_ngozi_eze',
    name: 'Ngozi Eze',
    slug: 'ngozi-eze',
    role: 'Continental Sports & Athletics Correspondent',
    school: 'MUA',
    bio: 'Tracks the Super Eagles, Premier League developments, boxing mega-bouts, and African sporting achievements. Alum of MUA combining tactical pitch analytics with breaking sports coverage.',
    avatar_url: '/publishers/ngozi-eze.jpg',
    category_specialty: 'cat_sports',
    articles_count: 7,
    is_verified_bot: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_babatunde_lawal',
    name: 'Babatunde Lawal',
    slug: 'babatunde-lawal',
    role: 'Global Affairs & Diplomatic Correspondent',
    school: 'MUA',
    bio: 'Reports on multilateral diplomatic summits, United Nations treaties, African Union bilateral engagements, and geopolitical shifts. Educated at MUA with a focus on verified international wires.',
    avatar_url: '/publishers/babatunde-lawal.jpg',
    category_specialty: 'cat_world',
    articles_count: 6,
    is_verified_bot: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_kemi_adebayo',
    name: 'Kemi Adebayo',
    slug: 'kemi-adebayo',
    role: 'Tech Ecosystem & AI Innovation Desk',
    school: 'MUA',
    bio: 'Investigates Africa\'s burgeoning technology hubs, seed investments, AI systems, and digital infrastructure across Lagos and continental tech corridors. MUA alumna dedicated to high-impact tech journalism.',
    avatar_url: '/publishers/kemi-adebayo.jpg',
    category_specialty: 'cat_tech',
    articles_count: 5,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_ibrahim_mustapha',
    name: 'Ibrahim Mustapha',
    slug: 'ibrahim-mustapha',
    role: 'Judicial Affairs & Legal Corridors Reporter',
    school: 'MUA',
    bio: 'Provides authoritative dispatches on appellate jurisprudence, federal high court rulings, constitutional amendments, and rule-of-law developments. Trained at MUA in precision legal analysis.',
    avatar_url: '/publishers/ibrahim-mustapha.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 4,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_amina_bello',
    name: 'Amina Bello',
    slug: 'amina-bello',
    role: 'Energy Transition & Infrastructure Desk',
    school: 'MUA',
    bio: 'Examines petroleum regulatory frameworks, national grid stabilization, gas flaring reduction, and renewable off-grid investments. MUA graduate with acute focus on resource accountability.',
    avatar_url: '/publishers/amina-bello.jpg',
    category_specialty: 'cat_money_hustle',
    articles_count: 4,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_emeka_nnamani',
    name: 'Emeka Nnamani',
    slug: 'emeka-nnamani',
    role: 'Investigative & Civic Transparency Bureau',
    school: 'MUA',
    bio: 'Spearheads forensic cross-verification of procurement audits, public asset disclosures, and institutional integrity trackers. Alum of MUA dedicated to fearless civic watchdog reporting.',
    avatar_url: '/publishers/emeka-nnamani.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 5,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_folake_balogun',
    name: 'Folake Balogun',
    slug: 'folake-balogun',
    role: 'Culture, Arts & Entertainment Bureau',
    school: 'MUA',
    bio: 'Chronicles the global ascent of Afrobeats, Nollywood box office triumphs, fashion exhibitions, and the expanding African creative economy. MUA-trained cultural analyst and curator.',
    avatar_url: '/publishers/folake-balogun.jpg',
    category_specialty: 'cat_entertainment',
    articles_count: 4,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_tunde_olatunji',
    name: 'Tunde Olatunji',
    slug: 'tunde-olatunji',
    role: 'Public Health & Medical Science Correspondent',
    school: 'MUA',
    bio: 'Tracks epidemiological surveillance, primary healthcare funding, pharmaceutical supply chains, and emergency clinical response across West Africa. MUA alum in health systems research.',
    avatar_url: '/publishers/tunde-olatunji.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 4,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_chioma_ubani',
    name: 'Chioma Ubani',
    slug: 'chioma-ubani',
    role: 'Education Policy & Higher Institutions Desk',
    school: 'MUA',
    bio: 'Covers tertiary education reforms, ASUU negotiations, research grants, and vocational development policies. MUA graduate examining student welfare and academic development nationwide.',
    avatar_url: '/publishers/chioma-ubani.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 3,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_musa_abdullahi',
    name: 'Musa Abdullahi',
    slug: 'musa-abdullahi',
    role: 'Agro-Commodities & Food Security Analyst',
    school: 'MUA',
    bio: 'Monitors grain silos, agricultural logistics, fertilizer pricing, and dry-season irrigation schemes across the northern grain belt. MUA graduate in commodity forecasting and agrarian market dynamics.',
    avatar_url: '/publishers/musa-abdullahi.jpg',
    category_specialty: 'cat_money_hustle',
    articles_count: 3,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_tarila_briggs',
    name: 'Tarila Briggs',
    slug: 'tarila-briggs',
    role: 'Maritime, Blue Economy & Coastal Ports Desk',
    school: 'MUA',
    bio: 'Specializes in deep-sea port developments, cabotage regulations, maritime security along the Gulf of Guinea, and coastal conservation. Alum of MUA with coastal policy focus.',
    avatar_url: '/publishers/tarila-briggs.jpg',
    category_specialty: 'cat_naija_news',
    articles_count: 3,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pub_zainab_aliyu',
    name: 'Zainab Aliyu',
    slug: 'zainab-aliyu',
    role: 'Climate Resilience & Environmental Correspondent',
    school: 'MUA',
    bio: 'Reports on flood mitigation infrastructure, Great Green Wall afforestation, drought adaptation, and climate finance summit resolutions. MUA alumna in environmental data journalism.',
    avatar_url: '/publishers/zainab-aliyu.jpg',
    category_specialty: 'cat_world',
    articles_count: 3,
    is_verified_bot: 1,
    is_active: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Returns currently active publishers, falling back to top 5 if none enabled
 */
export function getActivePublishersList(publishers: Publisher[] = INITIAL_PUBLISHERS): Publisher[] {
  const active = publishers.filter((p) => p.is_active === 1 || (p.is_active as any) === true);
  if (active.length > 0) return active;
  return INITIAL_PUBLISHERS.slice(0, 5);
}

/**
 * Deterministically or rotationally selects an active publisher for an article
 */
export function selectPublisherForArticle(
  category: string,
  publishers: Publisher[] = INITIAL_PUBLISHERS,
  seedStr?: string
): Publisher {
  const active = getActivePublishersList(publishers);
  const normalizedCat = (category || '').toLowerCase();

  // Try matching active publishers with category specialty
  const matched = active.filter((p) => {
    const spec = (p.category_specialty || '').toLowerCase();
    if (normalizedCat.includes('sport') && spec.includes('sport')) return true;
    if ((normalizedCat.includes('money') || normalizedCat.includes('business')) && (spec.includes('money') || spec.includes('business'))) return true;
    if (normalizedCat.includes('world') && (spec.includes('world') || spec.includes('global'))) return true;
    if (normalizedCat.includes('tech') && spec.includes('tech')) return true;
    if (normalizedCat.includes('ent') && spec.includes('ent')) return true;
    if ((normalizedCat.includes('naija') || normalizedCat.includes('news')) && (spec.includes('naija') || spec.includes('news'))) return true;
    return false;
  });

  const pool = matched.length > 0 ? matched : active;
  if (!seedStr) return pool[0];

  // Hash seed string for deterministic selection across re-runs
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

/**
 * Finds publisher profile by author name
 */
export function findPublisherByName(name?: string, publishers: Publisher[] = INITIAL_PUBLISHERS): Publisher | null {
  if (!name) return null;
  const clean = name.toLowerCase().trim();
  return (
    publishers.find(
      (p) =>
        p.name.toLowerCase() === clean ||
        clean.includes(p.name.toLowerCase()) ||
        p.slug === clean.replace(/\s+/g, '-')
    ) || null
  );
}
