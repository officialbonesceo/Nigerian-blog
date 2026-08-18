import type { Category, Source, Article } from './types';

export const initialCategories: Category[] = [
  {
    id: 'cat_politics',
    slug: 'politics',
    name: 'Politics',
    description: 'National assembly, electoral reforms, executive policies and governance news across Nigeria.',
    icon: 'landmark',
    color: '#008751',
    follower_count: 14200,
    display_order: 1,
  },
  {
    id: 'cat_business',
    slug: 'business',
    name: 'Business',
    description: 'Markets, corporate earnings, banking, trade policy and foreign exchange updates.',
    icon: 'trending-up',
    color: '#0284c7',
    follower_count: 18600,
    display_order: 2,
  },
  {
    id: 'cat_economy',
    slug: 'economy',
    name: 'Economy',
    description: 'Macroeconomics, inflation, monetary policy, GDP indicators and fiscal trends.',
    icon: 'coins',
    color: '#d97706',
    follower_count: 11900,
    display_order: 3,
  },
  {
    id: 'cat_sports',
    slug: 'sports',
    name: 'Sports',
    description: 'Super Eagles, Premier League, UEFA competitions, NPFL and Nigerian athletes worldwide.',
    icon: 'trophy',
    color: '#16a34a',
    follower_count: 22400,
    display_order: 4,
  },
  {
    id: 'cat_tech',
    slug: 'tech',
    name: 'Tech & Startups',
    description: 'Fintech innovations, venture funding, Yaba startup ecosystem and African digital developments.',
    icon: 'cpu',
    color: '#7c3aed',
    follower_count: 9800,
    display_order: 5,
  },
  {
    id: 'cat_energy',
    slug: 'energy',
    name: 'Energy & Oil',
    description: 'Petroleum industry, Dangote refinery, NNPCL operations and renewable transition in Nigeria.',
    icon: 'flame',
    color: '#ea580c',
    follower_count: 8300,
    display_order: 6,
  },
];

export const initialSources: Source[] = [
  {
    id: 'src_punch_breaking',
    name: 'The Punch News (Official RSS)',
    feed_url: 'https://punchng.com/feed/',
    website_url: 'https://punchng.com',
    category_default_id: 'cat_politics',
    is_enabled: 1,
    is_official: 1,
    trust_score: 96.5,
    license_notes: 'Reputable daily publication. RSS feed permitted for headlines and metadata indexing with full canonical attribution.',
    last_fetched_at: '2026-08-18T14:30:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_von_news',
    name: 'Voice of Nigeria (VON Government RSS)',
    feed_url: 'https://von.gov.ng/feed/',
    website_url: 'https://von.gov.ng',
    category_default_id: 'cat_politics',
    is_enabled: 1,
    is_official: 1,
    trust_score: 98.0,
    license_notes: 'Federal Government official international broadcast station. Public interest news releases under open govt attribution guidelines.',
    last_fetched_at: '2026-08-18T14:15:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_cbn_press',
    name: 'Central Bank of Nigeria (CBN Press Feed)',
    feed_url: 'https://www.cbn.gov.ng/RSS/cbn_press_releases.xml',
    website_url: 'https://www.cbn.gov.ng',
    category_default_id: 'cat_economy',
    is_enabled: 1,
    is_official: 1,
    trust_score: 99.5,
    license_notes: 'Monetary policy and financial sector public regulatory releases with source citation.',
    last_fetched_at: '2026-08-18T13:45:00Z',
    fetch_interval_minutes: 60,
  },
  {
    id: 'src_premium_times',
    name: 'Premium Times Nigeria',
    feed_url: 'https://www.premiumtimesng.com/feed',
    website_url: 'https://www.premiumtimesng.com',
    category_default_id: 'cat_business',
    is_enabled: 1,
    is_official: 0,
    trust_score: 95.0,
    license_notes: 'Investigative reporting and national coverage. Editorial rewriting with source credit required.',
    last_fetched_at: '2026-08-18T14:00:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_vanguard_news',
    name: 'Vanguard News Nigeria',
    feed_url: 'https://www.vanguardngr.com/feed/',
    website_url: 'https://www.vanguardngr.com',
    category_default_id: 'cat_politics',
    is_enabled: 1,
    is_official: 0,
    trust_score: 94.0,
    license_notes: 'National breaking news feed. Requires editorial synthesis and reference links.',
    last_fetched_at: '2026-08-18T13:30:00Z',
    fetch_interval_minutes: 45,
  },
  {
    id: 'src_channels_tv',
    name: 'Channels Television News',
    feed_url: 'https://www.channelstv.com/feed/',
    website_url: 'https://www.channelstv.com',
    category_default_id: 'cat_politics',
    is_enabled: 1,
    is_official: 1,
    trust_score: 97.0,
    license_notes: 'Multi-award winning independent broadcast network. Summary indexing with video/text attribution.',
    last_fetched_at: '2026-08-18T14:45:00Z',
    fetch_interval_minutes: 30,
  },
];

export const initialArticles: Article[] = [
  {
    id: 'art_cbn_mpr_2025',
    slug: 'cbn-retains-mpr-at-26-75-signals-cautious-optimism-on-inflation',
    title: 'CBN Retains MPR at 26.75%, Signals Cautious Optimism on Inflation Trajectory',
    summary: 'The Central Bank of Nigeria has decided to hold the Monetary Policy Rate (MPR) at 26.75% following its latest Monetary Policy Committee meeting in Abuja.',
    content: `
<p>The Monetary Policy Committee (MPC) of the Central Bank of Nigeria (CBN) has decided to hold the Monetary Policy Rate (MPR) at 26.75%, maintaining a stance of cautious optimism as headline inflation metrics begin showing signs of month-on-month deceleration across core food baskets.</p>

<p>Announcing the unanimous decision following the two-day committee meeting in Abuja, CBN Governor Olayemi Cardoso stated that while structural pressures remain in transportation and power logistics, previous rate hikes have successfully stabilized the foreign exchange market and curbed speculative arbitrage on the Naira.</p>

<blockquote>"Our priority remains firmly anchored on restoring purchasing power and maintaining exchange rate stability. The committee observed encouraging moderation in the rate of price increases, particularly in metropolitan centers," Cardoso told journalists during the post-MPC press briefing.</blockquote>

<h3>Key Resolutions by the Committee:</h3>
<ul>
  <li><strong>Monetary Policy Rate (MPR):</strong> Retained at 26.75%</li>
  <li><strong>Asymmetric Corridor:</strong> Kept at +500/-100 basis points around the MPR</li>
  <li><strong>Cash Reserve Ratio (CRR):</strong> Maintained at 45.0% for commercial deposit banks</li>
  <li><strong>Liquidity Ratio:</strong> Left unchanged at 30.0%</li>
</ul>

<p>Financial analysts in Lagos noted that retaining the benchmark rate will allow businesses to plan capital expenditures with greater predictability while preventing unnecessary disruption to ongoing credit expansion in the manufacturing and agro-processing sectors.</p>

<p>The foreign exchange market reacted positively to the announcement, with turnover at the Nigerian Autonomous Foreign Exchange Market (NAFEM) crossing $320 million on Tuesday as diaspora remittances and institutional foreign portfolio inflows continued their upward trend.</p>
    `,
    category_id: 'cat_business',
    image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Central Bank of Nigeria Headquarters in Abuja, Federal Capital Territory.',
    image_credit: 'CBN Media Archives / Editorial License',
    image_license: 'Public Interest Information Use',
    author_name: 'Tunde Akinsola',
    author_role: 'Chief Economics Correspondent',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    is_top_story: 1,
    is_trending: 1,
    is_breaking: 0,
    views_count: 14820,
    reading_time_minutes: 5,
    source_id: 'src_cbn_press',
    source_name: 'Central Bank of Nigeria',
    source_original_url: 'https://www.cbn.gov.ng',
    published_at: '2026-08-18T13:45:00Z',
    updated_at: '2026-08-18T14:10:00Z',
    status: 'published',
  },
  {
    id: 'art_trade_surplus_q1',
    slug: 'nigerias-trade-surplus-hits-n6-3tn-in-q1',
    title: "Nigeria's Trade Surplus Hits ₦6.3tn in Q1 Amid Surging Non-Oil Exports",
    summary: 'The National Bureau of Statistics reports a substantial merchandise trade surplus driven by fertilizer, agricultural products and refined hydrocarbons.',
    content: `
<p>Nigeria recorded a total foreign merchandise trade surplus of ₦6.32 trillion in the first quarter of the fiscal year, according to the latest Foreign Trade Statistics released by the National Bureau of Statistics (NBS).</p>

<p>The positive trade balance was primarily bolstered by strong performances in manufactured fertilizers, sesame seeds, cashew nuts, and domestic petroleum derivatives that have progressively replaced costly refined imports.</p>

<p>European and Asian markets remained Nigeria's top trade destinations, with the Netherlands, India, and Spain accounting for a combined 34% of total export receipts recorded during the review period.</p>
    `,
    category_id: 'cat_business',
    image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Container cargo loading terminal at the Lekki Deep Sea Port, Lagos.',
    image_credit: 'Nigerian Ports Authority / Lekki Port PR',
    image_license: 'Editorial Reference',
    author_name: 'Ngozi Okonjo-Eze',
    author_role: 'Trade & Financial Markets Reporter',
    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 9450,
    reading_time_minutes: 4,
    source_id: 'src_punch_breaking',
    source_name: 'National Bureau of Statistics / Punch',
    source_original_url: 'https://punchng.com',
    published_at: '2026-08-18T11:20:00Z',
    updated_at: '2026-08-18T11:20:00Z',
    status: 'published',
  },
  {
    id: 'art_lookman_super_eagles',
    slug: 'lookman-nominated-for-african-footballer-of-the-year-super-eagles',
    title: 'Lookman Nominated for African Footballer of the Year After Stellar Europa League Run',
    summary: 'Super Eagles forward Ademola Lookman leads the nominations following his historic European hat-trick and exceptional national team contributions.',
    content: `
<p>Super Eagles forward Ademola Lookman has been shortlisted as a prime contender for the prestigious CAF African Footballer of the Year award, recognizing a breathtaking season that culminated in European glory and standout national team outings.</p>

<p>The 26-year-old winger made international football history with an electrifying hat-trick in Dublin, driving Atalanta to their first European title in over six decades while cementing his status as one of Africa's most dangerous attacking threats.</p>

<p>Nigerian football fans across Lagos, Abuja, and Kano have celebrated the recognition, expressing confidence that Lookman will follow in the footsteps of Victor Osimhen to bring the continental crown home for a consecutive year.</p>
    `,
    category_id: 'cat_sports',
    image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Nigerian football fans cheering during an international fixture in Uyo.',
    image_credit: 'NFF Media / Open Editorial License',
    image_license: 'Fair Use Sports Journalism',
    author_name: 'Segun Odegbami Jr.',
    author_role: 'Senior Sports Editor',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 18920,
    reading_time_minutes: 3,
    source_id: 'src_channels_tv',
    source_name: 'Channels TV Sports',
    source_original_url: 'https://www.channelstv.com',
    published_at: '2026-08-18T09:15:00Z',
    updated_at: '2026-08-18T09:15:00Z',
    status: 'published',
  },
  {
    id: 'art_electoral_reform_review',
    slug: 'fg-inaugurates-committee-to-review-1999-constitution-and-electoral-laws',
    title: 'FG Inaugurates High-Powered Committee to Review 1999 Constitution and Electoral Laws',
    summary: 'The Federal Government has launched a comprehensive stakeholder committee to review constitutional provisions on state policing, local government autonomy and electronic voting.',
    content: `
<p>The Federal Government of Nigeria on Tuesday officially inaugurated a 24-member inter-agency committee tasked with harmonizing public memorandums on constitutional restructuring, state police framework, and electoral transparency.</p>

<p>Presiding over the ceremony at the State House Banquet Hall in Abuja, senior administration officials emphasized that modernizing the legal framework will deepen democratic institutions and bolster public trust ahead of upcoming civic engagements.</p>

<p>The committee is expected to submit its interim legislative draft to the National Assembly joint committees within 90 days for national debate and public hearings.</p>
    `,
    category_id: 'cat_politics',
    image_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'National Assembly Complex in the Three Arms Zone, Abuja.',
    image_credit: 'Federal Ministry of Information / VON Archive',
    image_license: 'Official Government Information',
    author_name: 'Abubakar Danladi',
    author_role: 'State House Bureau Chief',
    author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    is_top_story: 0,
    is_trending: 0,
    is_breaking: 1,
    views_count: 7340,
    reading_time_minutes: 4,
    source_id: 'src_von_news',
    source_name: 'Voice of Nigeria',
    source_original_url: 'https://von.gov.ng',
    published_at: '2026-08-18T12:00:00Z',
    updated_at: '2026-08-18T12:30:00Z',
    status: 'published',
  },
  {
    id: 'art_dangote_fuel_distribution',
    slug: 'dangote-refinery-expands-pms-distribution-easing-fuel-supply',
    title: 'Dangote Refinery Expands PMS Distribution Nationwide, Easing Fuel Supply Constraints',
    summary: 'Direct gantry and coastal vessel loading at the 650,000 bpd Lekki refinery surpasses 25 million litres daily to independent marketers.',
    content: `
<p>The 650,000 barrels-per-day Dangote Petroleum Refinery has expanded its nationwide delivery operations for Premium Motor Spirit (PMS), dispatching over 25 million litres per day via both coastal marine vessels and modern road gantry loading arms.</p>

<p>Major Energies Marketers Association of Nigeria (MEMAN) and Independent Petroleum Marketers Association of Nigeria (IPMAN) confirmed seamless product evacuation, which has led to stable pump prices across retail outlets in Lagos, Ogun, Oyo, and Abuja.</p>

<p>The facility is expected to initiate cross-border exports to West African neighbours under the African Continental Free Trade Area (AfCFTA) framework by the third quarter of the year.</p>
    `,
    category_id: 'cat_energy',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Industrial refining infrastructure at the Lekki Free Trade Zone.',
    image_credit: 'Dangote Industries Media / Creative Commons',
    image_license: 'Commercial Editorial License',
    author_name: 'Chinedu Eze',
    author_role: 'Energy & Infrastructure Analyst',
    author_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 12400,
    reading_time_minutes: 4,
    source_id: 'src_punch_breaking',
    source_name: 'The Punch / Vanguard',
    source_original_url: 'https://punchng.com',
    published_at: '2026-08-18T10:00:00Z',
    updated_at: '2026-08-18T10:45:00Z',
    status: 'published',
  },
  {
    id: 'art_yaba_tech_funding_2025',
    slug: 'nigerian-tech-startups-secure-record-green-energy-funding',
    title: 'Nigerian Tech Startups Secure Record $180m in Q2 Clean Energy and Fintech Rounds',
    summary: 'Lagos and Abuja-based technology hubs demonstrate renewed venture capital momentum across decentralized solar fintech and logistics AI.',
    content: `
<p>Nigerian technology enterprises secured over $180 million in combined seed and Series A/B venture equity and debt financing in the second quarter, marking a healthy rebound in institutional African startup funding.</p>

<p>Renewable energy financing platforms and B2B digital commerce enablers captured the largest share of foreign direct investment, with global funds citing Nigeria's high mobile penetration and strong technical talent pool.</p>

<p>Ecosystem leaders in Yaba, Lagos, noted that policy clarity on digital asset licensing and local currency payment switches has contributed significantly to investor confidence.</p>
    `,
    category_id: 'cat_tech',
    image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Software developers and technology founders collaborating at a tech hub in Yaba, Lagos.',
    image_credit: 'Techpoint Africa / Creative Commons',
    image_license: 'Editorial Attribution',
    author_name: 'Simi Adeleke',
    author_role: 'Technology & Venture Capital Lead',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    is_top_story: 0,
    is_trending: 0,
    is_breaking: 0,
    views_count: 5120,
    reading_time_minutes: 3,
    source_id: 'src_premium_times',
    source_name: 'Premium Times Tech',
    source_original_url: 'https://www.premiumtimesng.com',
    published_at: '2026-08-18T08:30:00Z',
    updated_at: '2026-08-18T08:30:00Z',
    status: 'published',
  },
];
