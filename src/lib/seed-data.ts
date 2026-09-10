import type { Category, Source, Article } from './types';

export const initialCategories: Category[] = [
  {
    id: 'cat_naija_news',
    slug: 'naija-news',
    name: 'Naija News',
    description: 'Breaking national reports, state assemblies, executive governance, infrastructure, and citizen stories across Nigeria.',
    icon: 'flag',
    color: '#008751',
    follower_count: 28400,
    display_order: 1,
  },
  {
    id: 'cat_money_hustle',
    slug: 'business',
    name: 'Business',
    description: 'Markets, corporate earnings, banking, Naira FX rates, fintech investments, SME growth, and business developments across Nigeria.',
    icon: 'trending-up',
    color: '#0284c7',
    follower_count: 34100,
    display_order: 2,
  },
  {
    id: 'cat_sports',
    slug: 'sports',
    name: 'Sports',
    description: 'Super Eagles, Premier League, NPFL, UEFA Champions League, boxing, combat sports, and Nigerian athletics worldwide.',
    icon: 'trophy',
    color: '#16a34a',
    follower_count: 41200,
    display_order: 3,
  },
  {
    id: 'cat_world',
    slug: 'world',
    name: 'World',
    description: 'International breaking events, geopolitics, global technology shifts, diplomacy, and diaspora developments.',
    icon: 'globe',
    color: '#6366f1',
    follower_count: 19800,
    display_order: 4,
  },
];

export const initialSources: Source[] = [
  // Naija News & Governance
  {
    id: 'src_punch_news',
    name: 'The Punch Newspapers',
    feed_url: 'https://punchng.com/feed/',
    website_url: 'https://punchng.com',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 1,
    trust_score: 96.5,
    license_notes: 'Nigeria leading daily publication. RSS feed permitted for headlines and metadata indexing with full canonical attribution.',
    last_fetched_at: '2026-08-25T14:30:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_vanguard_news',
    name: 'Vanguard News Nigeria',
    feed_url: 'https://www.vanguardngr.com/feed/',
    website_url: 'https://www.vanguardngr.com',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 94.5,
    license_notes: 'National breaking news and investigative wire. Editorial synthesis with source credit.',
    last_fetched_at: '2026-08-25T14:00:00Z',
    fetch_interval_minutes: 30,
  },
  // Phoenix Browser Feed Wire Sources (Metro, Crime, Assault, Celebrity, Local Gossip)
  {
    id: 'src_vanguard_metro',
    name: 'Vanguard Metro & Crime Guard',
    feed_url: 'https://www.vanguardngr.com/category/metro/feed/',
    website_url: 'https://www.vanguardngr.com/category/metro/',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 95.0,
    license_notes: 'Primary source for local police arraignments, assault investigations, and community incidents across Lagos and Nigerian states.',
    last_fetched_at: '2026-08-25T14:10:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_dailypost_metro',
    name: 'Daily Post Metro & Court News',
    feed_url: 'https://dailypost.ng/metro/feed/',
    website_url: 'https://dailypost.ng/metro/',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 93.0,
    license_notes: 'Rapid local reporting on state arrests, court trials, assault proceedings, and emergency rescue alerts.',
    last_fetched_at: '2026-08-25T14:20:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_legit_all',
    name: 'Legit.ng Wire & Human Interest',
    feed_url: 'https://www.legit.ng/rss/all.rss',
    website_url: 'https://www.legit.ng',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 92.5,
    license_notes: 'Premier consumer feed utilized by mobile aggregators for trending human interest, celebrity spotlights, and local controversies.',
    last_fetched_at: '2026-08-25T14:05:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_pulse_ng',
    name: 'Pulse Nigeria Entertainment & Metro',
    feed_url: 'https://www.pulse.ng/rss',
    website_url: 'https://www.pulse.ng',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 92.0,
    license_notes: 'Pop culture, celebrity news, relationship features, and trending societal stories.',
    last_fetched_at: '2026-08-25T14:15:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_linda_ikeji',
    name: 'Linda Ikeji News Wire',
    feed_url: 'https://www.lindaikejisblog.com/feed',
    website_url: 'https://www.lindaikejisblog.com',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 0,
    trust_score: 91.0,
    license_notes: 'Leading Nigerian blog for exclusive celebrity scoops, viral domestic reports, and gender-based crime news.',
    last_fetched_at: '2026-08-25T14:25:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_channels_tv',
    name: 'Channels Television',
    feed_url: 'https://www.channelstv.com/feed/',
    website_url: 'https://www.channelstv.com',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 1,
    trust_score: 97.5,
    license_notes: 'Broadcast journalism desk with breaking national coverage.',
    last_fetched_at: '2026-08-25T14:45:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_von_news',
    name: 'Voice of Nigeria (VON Official)',
    feed_url: 'https://von.gov.ng/feed/',
    website_url: 'https://von.gov.ng',
    category_default_id: 'cat_naija_news',
    is_enabled: 1,
    is_official: 1,
    trust_score: 98.0,
    license_notes: 'Federal Government official international broadcast station.',
    last_fetched_at: '2026-08-25T14:15:00Z',
    fetch_interval_minutes: 30,
  },

  // Business & Finance
  {
    id: 'src_techcabal',
    name: 'TechCabal African Innovation',
    feed_url: 'https://techcabal.com/feed/',
    website_url: 'https://techcabal.com',
    category_default_id: 'cat_money_hustle',
    is_enabled: 1,
    is_official: 1,
    trust_score: 96.0,
    license_notes: 'Fintech, venture rounds, startup business models, and African tech wealth.',
    last_fetched_at: '2026-08-25T13:30:00Z',
    fetch_interval_minutes: 45,
  },
  {
    id: 'src_businessday',
    name: 'BusinessDay Nigeria',
    feed_url: 'https://businessday.ng/feed/',
    website_url: 'https://businessday.ng',
    category_default_id: 'cat_money_hustle',
    is_enabled: 1,
    is_official: 1,
    trust_score: 97.0,
    license_notes: 'Markets, corporate earnings, Naira exchange rates, and real estate investments.',
    last_fetched_at: '2026-08-25T13:45:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_cbn_press',
    name: 'Central Bank of Nigeria (CBN Feed)',
    feed_url: 'https://www.cbn.gov.ng/RSS/cbn_press_releases.xml',
    website_url: 'https://www.cbn.gov.ng',
    category_default_id: 'cat_money_hustle',
    is_enabled: 1,
    is_official: 1,
    trust_score: 99.5,
    license_notes: 'Official monetary policy, banking guidelines, and interest rate resolutions.',
    last_fetched_at: '2026-08-25T12:00:00Z',
    fetch_interval_minutes: 60,
  },
  {
    id: 'src_cnbc_markets',
    name: 'CNBC Global Markets & Wealth',
    feed_url: 'https://search.cnbc.com/rs/search/combinedlist/view.xml?partnerId=wrss01&id=100003114',
    website_url: 'https://www.cnbc.com',
    category_default_id: 'cat_money_hustle',
    is_enabled: 1,
    is_official: 0,
    trust_score: 95.0,
    license_notes: 'Global indices, commodities, gold, crude oil, and crypto asset movements.',
    last_fetched_at: '2026-08-25T11:00:00Z',
    fetch_interval_minutes: 45,
  },

  // Sports
  {
    id: 'src_bbc_sport',
    name: 'BBC Sport Global',
    feed_url: 'https://feeds.bbci.co.uk/sport/rss.xml',
    website_url: 'https://www.bbc.com/sport',
    category_default_id: 'cat_sports',
    is_enabled: 1,
    is_official: 1,
    trust_score: 98.0,
    license_notes: 'Comprehensive football, African players abroad, Formula 1, and boxing coverage.',
    last_fetched_at: '2026-08-25T14:20:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_skysports_football',
    name: 'Sky Sports Premier League',
    feed_url: 'https://www.skysports.com/rss/12040',
    website_url: 'https://www.skysports.com',
    category_default_id: 'cat_sports',
    is_enabled: 1,
    is_official: 0,
    trust_score: 96.0,
    license_notes: 'Transfer breaking reports, match analysis, and league tables.',
    last_fetched_at: '2026-08-25T13:10:00Z',
    fetch_interval_minutes: 30,
  },

  // World
  {
    id: 'src_reuters_world',
    name: 'Reuters World News Wire',
    feed_url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    website_url: 'https://www.reuters.com',
    category_default_id: 'cat_world',
    is_enabled: 1,
    is_official: 1,
    trust_score: 98.5,
    license_notes: 'Global diplomatic summits, bilateral accords, geopolitical changes, and macro trends.',
    last_fetched_at: '2026-08-25T14:00:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_bbc_world',
    name: 'BBC World News',
    feed_url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    website_url: 'https://www.bbc.com/news/world',
    category_default_id: 'cat_world',
    is_enabled: 1,
    is_official: 1,
    trust_score: 98.0,
    license_notes: 'Global breaking events and in-depth investigative reports.',
    last_fetched_at: '2026-08-25T14:10:00Z',
    fetch_interval_minutes: 30,
  },
  {
    id: 'src_aljazeera_world',
    name: 'Al Jazeera International',
    feed_url: 'https://www.aljazeera.com/xml/rss/all.xml',
    website_url: 'https://www.aljazeera.com',
    category_default_id: 'cat_world',
    is_enabled: 1,
    is_official: 1,
    trust_score: 95.5,
    license_notes: 'Middle East, Global South, and UN diplomatic affairs.',
    last_fetched_at: '2026-08-25T13:50:00Z',
    fetch_interval_minutes: 30,
  },
];

export const initialArticles: Article[] = [
  {
    id: 'art_cbn_mpr_2025',
    slug: 'cbn-keeps-interest-rate-at-26-75-money-hustle',
    title: 'CBN Holds Interest Rate at 26.75% as Naira Stabilizes Across Autonomous Windows',
    summary: 'The Monetary Policy Committee has retained the benchmark Monetary Policy Rate (MPR) at 26.75%, supporting lending stability for manufacturers and small enterprise operators.',
    content: `
<h3>The Scoop</h3>
<p>The Monetary Policy Committee (MPC) of the Central Bank of Nigeria (CBN) has unanimously resolved to retain the benchmark Monetary Policy Rate (MPR) at 26.75%. The policy outcome was delivered by CBN Governor Olayemi Cardoso at the apex bank headquarters in Abuja following thorough deliberation on inflation indicators and currency dynamics.</p>
<p>The committee maintained the asymmetric corridor at +500/-100 basis points around the MPR, the Cash Reserve Ratio (CRR) for commercial deposit banks at 45.0%, and the liquidity ratio at 30.0%.</p>

<h3>The Stakes</h3>
<p>For entrepreneurs, hustle builders, and everyday businesses across Nigeria, the rate pause provides a steady borrowing cost environment, averting sudden jumps in commercial loan repayments while reinforcing foreign portfolio inflows into local capital markets.</p>

<h3>The Stats</h3>
<p>Key resolutions and verified numbers from the MPC briefing:</p>
<ul>
  <li><strong>Monetary Policy Rate (MPR):</strong> Retained at 26.75%</li>
  <li><strong>Cash Reserve Ratio (CRR):</strong> 45.0% for commercial deposit money banks</li>
  <li><strong>Daily FX Window Volume:</strong> Autonomous FX trading averaged $340M with rising remittances</li>
  <li><strong>Headline Inflation Outlook:</strong> Food and energy price pressure projected to moderate through the quarter</li>
</ul>
<blockquote>"Our foremost mandate is anchoring exchange rate stability and safeguarding the domestic purchasing power of working families," affirmed CBN Governor Olayemi Cardoso.</blockquote>
    `,
    category_id: 'cat_money_hustle',
    category_name: 'Business',
    category_slug: 'business',
    image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Central Bank of Nigeria Headquarters in the Central Business District, Abuja.',
    image_credit: 'CBN Corporate Communications / Editorial License',
    image_license: 'Public Interest Information Use',
    author_name: '9jaBeacon Finance Team',
    author_role: 'Senior Markets & Economy Desk',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    is_top_story: 1,
    is_trending: 1,
    is_breaking: 0,
    views_count: 142,
    reading_time_minutes: 5,
    source_id: 'src_cbn_press',
    source_name: 'Central Bank of Nigeria',
    source_original_url: 'https://www.cbn.gov.ng',
    published_at: '2026-08-25T13:45:00Z',
    updated_at: '2026-08-25T14:10:00Z',
    status: 'published',
  },
  {
    id: 'art_electoral_reform_review',
    slug: 'fg-inaugurates-committee-to-review-1999-constitution-and-electoral-laws',
    title: 'FG Inaugurates High-Powered Committee to Review 1999 Constitution and Electoral Laws',
    summary: 'The Federal Government has launched a multi-stakeholder panel to harmonize public recommendations on state policing, local government financial autonomy, and electronic polling unit transmission.',
    content: `
<h3>The Scoop</h3>
<p>The Federal Government of Nigeria on Tuesday officially inaugurated a 24-member inter-agency committee tasked with harmonizing public memorandums on constitutional restructuring, state police framework, and electoral transparency.</p>
<p>Presiding over the ceremony at the State House Banquet Hall in Abuja, senior administration officials emphasized that modernizing the legal framework will deepen democratic institutions and bolster civic trust.</p>

<h3>The Stakes</h3>
<p>Constitutional reviews address long-standing demands for decentralized community policing, fiscal federalism, and foolproof electronic transmission of election polling unit results.</p>

<h3>The Stats</h3>
<p>Key parameters of the reform committee mandate:</p>
<ul>
  <li><strong>Timeline:</strong> Interim draft due to the National Assembly within 90 days</li>
  <li><strong>Key Focus Areas:</strong> State policing guidelines, local council financial autonomy, and diaspora voting framework</li>
  <li><strong>Public Hearings:</strong> Townhall consultations scheduled across all six geopolitical zones</li>
</ul>
    `,
    category_id: 'cat_naija_news',
    category_name: 'Naija News',
    category_slug: 'naija-news',
    image_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'National Assembly Complex in the Three Arms Zone, Abuja.',
    image_credit: 'Federal Ministry of Information / VON Archive',
    image_license: 'Official Government Information',
    author_name: '9jaBeacon Editorial Team',
    author_role: 'National Affairs & Governance Desk',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 0,
    is_breaking: 1,
    views_count: 88,
    reading_time_minutes: 5,
    source_id: 'src_von_news',
    source_name: 'Voice of Nigeria',
    source_original_url: 'https://von.gov.ng',
    published_at: '2026-08-25T12:00:00Z',
    updated_at: '2026-08-25T12:30:00Z',
    status: 'published',
  },
  {
    id: 'art_lookman_super_eagles',
    slug: 'lookman-nominated-for-african-footballer-of-the-year-super-eagles',
    title: 'Lookman Nominated for African Footballer of the Year After Stellar Europa League Run',
    summary: 'Super Eagles forward Ademola Lookman leads the nominations following his historic European hat-trick and exceptional national team contributions.',
    content: `
<h3>The Crux & What Happened</h3>
<p>Super Eagles attacking sensation Ademola Lookman has been officially nominated by the Confederation of African Football (CAF) as a frontrunner for the African Footballer of the Year award. The nomination rewards a historic continental campaign in which Lookman delivered world-class performances at the Africa Cup of Nations (AFCON) and propelled Atalanta to a historic UEFA Europa League title with an unforgettable hat-trick in the final against Bayer Leverkusen.</p>
<p>CAF's technical committee highlighted Lookman's decisive goal-scoring prowess in high-pressure tournaments, elevating Nigerian football on the global stage.</p>

<h3>Deep-Dive Background & Precedent</h3>
<p>Lookman's career trajectory marks one of the most remarkable resurgences in modern European football. After alternating stints across the English Premier League and German Bundesliga, his move to Italian Serie A under Gian Piero Gasperini unlocked his full tactical maturity. His treble against an undefeated Leverkusen side marked the first hat-trick in a single-leg European final since 1969, entering the history books.</p>
<p>Should Lookman secure the award, it will mark back-to-back African Player of the Year triumphs for Nigeria following Victor Osimhen's historic victory the previous year, solidifying the nation's contemporary attacking renaissance.</p>

<h3>The Stakes: Impact on Nigerian & African Football</h3>
<p>The nomination elevates Nigerian grassroots football enthusiasm, drawing international scout interest and commercial investment into youth academies across Lagos, Benin City, and Uyo. For the national team, Lookman's top-tier form provides crucial leadership as the Super Eagles navigate qualifying stages for the FIFA World Cup and upcoming AFCON tournaments.</p>

<h3>Key Reactions & Official Statements</h3>
<p>Speaking after the announcement, Nigeria Football Federation (NFF) officials applauded the recognition: <em>"Ademola has consistently demonstrated the grit, humility, and excellence that define Nigerian spirit on the pitch. This nomination is thoroughly deserved and celebrated by over 200 million compatriots."</em></p>

<h3>Looking Ahead: Timeline & Next Steps</h3>
<p>The CAF Awards Gala will convene in Marrakech, Morocco, where national team head coaches, technical directors, and veteran sports journalists across the 54 CAF member associations will cast their final ballots ahead of the grand ceremony.</p>
    `,
    category_id: 'cat_sports',
    category_name: 'Sports',
    category_slug: 'sports',
    image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Nigerian football supporters cheering during an international match in Uyo.',
    image_credit: 'NFF Media / Open Sports Editorial',
    image_license: 'Fair Use Sports Journalism',
    author_name: '9jaBeacon Sports Desk',
    author_role: 'National & International Sports Desk',
    author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 215,
    reading_time_minutes: 5,
    source_id: 'src_bbc_sport',
    source_name: 'BBC Sport / Channels TV',
    source_original_url: 'https://www.bbc.com/sport',
    published_at: '2026-08-25T11:15:00Z',
    updated_at: '2026-08-25T11:15:00Z',
    status: 'published',
  },
  {
    id: 'art_world_un_climate_accord',
    slug: 'global-green-energy-investment-surpasses-two-trillion-world-summit',
    title: 'Global Clean Energy Investment Surpasses $2 Trillion at Historic UN Climate Summit',
    summary: 'International leaders and development finance institutions pledge unprecedented funding for emerging economy grids and decentralized solar infrastructure.',
    content: `
<h3>The Crux & What Happened</h3>
<p>Global capital allocation toward renewable power generation, battery energy storage systems, and decentralized mini-grids has officially crossed the $2 trillion threshold annually, according to verified reports published at the United Nations Climate and Energy Assembly. Major development finance corporations, sovereign wealth syndicates, and bilateral partners approved new multi-billion dollar concessional debt facilities earmarked directly for clean technology deployment in emerging markets across Africa and Southeast Asia.</p>
<p>The landmark assembly brought together 140 energy ministers and multilateral bank governors to establish coordinated sovereign risk guarantees designed to unlock commercial private equity for developing grid networks.</p>

<h3>Deep-Dive Background & Precedent</h3>
<p>Historically, emerging economies have faced prohibitive borrowing costs for capital-intensive infrastructure projects, frequently paying two to three times higher interest rates than developed nations for solar and transmission financing. The new international framework introduces blended finance risk-cushion mechanisms backed by the World Bank and AfDB, dramatically lowering interest premiums on clean utility loans.</p>

<h3>The Stakes: Real-Life Impact on Everyday Citizens</h3>
<p>For Nigeria and neighboring regional economies, decentralized clean energy provides immediate relief against high retail fuel costs. Off-grid rural healthcare clinics, agricultural cold-storage hubs, and processing factories in rural clusters can operate without reliance on expensive petrol and diesel generators, directly lowering food wastage and operational overhead for small businesses.</p>

<h3>Key Reactions & Official Statements</h3>
<p>Addressing the plenary summit, representatives of the African Energy Commission emphasized: <em>"Energy security is the foundation of economic independence. Unlocking affordable capital for distributed solar and storage empowers millions of artisans, market stalls, and health centers without burdening our children with unsustainable sovereign debt."</em></p>

<h3>Looking Ahead: Timeline & Implementation</h3>
<p>Bilateral financing tranches are scheduled for initial disbursement in Q4, targeting five priority pilot projects including commercial mini-grid expansions in northern agricultural basins and industrial rooftop clusters in southern manufacturing hubs.</p>
    `,
    category_id: 'cat_world',
    category_name: 'World',
    category_slug: 'world',
    image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Earth satellite visualization representing interconnected global infrastructure.',
    image_credit: 'NASA Earth Observatory / Public Domain',
    image_license: 'Public Domain Creative Commons',
    author_name: '9jaBeacon World News Desk',
    author_role: 'Global Foreign Affairs Desk',
    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 134,
    reading_time_minutes: 5,
    source_id: 'src_reuters_world',
    source_name: 'Reuters / BBC World',
    source_original_url: 'https://www.reuters.com',
    published_at: '2026-08-25T10:30:00Z',
    updated_at: '2026-08-25T10:30:00Z',
    status: 'published',
  },
  {
    id: 'art_techcabal_fintech_hustle',
    slug: 'nigerian-fintechs-cross-border-payment-volumes-hit-new-milestone',
    title: 'Nigerian Fintechs Tap Cross-Border Trade as Instant FX Settlement Surges 65%',
    summary: 'Lagos-based payment innovators and digital remittance hubs expand merchant corridors across Ghana, Kenya, and the UK with instant local currency payouts.',
    content: `
<h3>The Crux & What Happened</h3>
<p>African cross-border payments processed by Nigerian digital fintech infrastructure hit an all-time high of $4.8 billion this quarter, according to verified transaction data compiled by commercial settlement switches. Direct API integrations with Pan-African settlement corridors have eliminated intermediary correspondent banking friction for remote digital hustlers, freelance creators, and import-export merchants trading across regional borders.</p>
<p>Payment providers reported a 65% quarterly surge in automated settlements, powered by real-time treasury management engines and local virtual banking rails.</p>

<h3>Deep-Dive Background & Precedent</h3>
<p>For decades, intra-African commerce was severely hobbled by outdated correspondent routing, where a transfer from Lagos to Accra often had to route through banks in London or New York, incurring multiple exchange fees and delays lasting up to 5 business days. Nigerian fintech innovators have systematically dismantled these barriers by establishing bilateral clearing agreements and localized virtual bank accounts.</p>

<h3>The Stakes: Impact on Freelancers, Creators & Traders</h3>
<p>This seamless infrastructure directly benefits over 420,000 Nigerian digital freelancers, software engineers, video editors, and cross-border traders who earn in foreign currencies. Rather than losing large percentages to informal black-market brokers or delayed wire transfers, funds settle into Nigerian accounts within 30 seconds at transparent interbank exchange rates.</p>

<h3>Key Reactions & Official Statements</h3>
<p>A fintech industry analyst in Lagos observed: <em>"The democratization of cross-border FX routing is quietly powering Nigeria's next generation of digital exporters. Young creators and manufacturers can sell directly to customers in Nairobi, London, or Johannesburg without waiting days for international wires."</em></p>

<h3>Looking Ahead: Timeline & Next Steps</h3>
<p>The Central Bank of Nigeria and regional monetary authorities are expected to release updated harmonized regulatory guidelines next month to further streamline digital merchant settlements under the African Continental Free Trade Area (AfCFTA) framework.</p>
    `,
    category_id: 'cat_money_hustle',
    category_name: 'Business',
    category_slug: 'business',
    image_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Digital payment technology and modern financial analytics interface.',
    image_credit: 'TechCabal Media / Creative Commons',
    image_license: 'Editorial Attribution',
    author_name: '9jaBeacon Finance Team',
    author_role: 'Fintech & Digital Economy Desk',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 96,
    reading_time_minutes: 5,
    source_id: 'src_techcabal',
    source_name: 'TechCabal',
    source_original_url: 'https://techcabal.com',
    published_at: '2026-08-25T09:20:00Z',
    updated_at: '2026-08-25T09:20:00Z',
    status: 'published',
  },
  {
    id: 'art_trade_surplus_q1',
    slug: 'nigerias-trade-surplus-hits-n6-3tn-in-q1',
    title: "Nigeria's Trade Surplus Hits ₦6.3tn in Q1 Amid Surging Non-Oil Agricultural & Fertilizer Exports",
    summary: 'The National Bureau of Statistics reports a substantial merchandise trade surplus driven by urea fertilizer, processed cashew, sesame seeds and refined products.',
    content: `
<h3>The Crux & What Happened</h3>
<p>Nigeria recorded a total foreign merchandise trade surplus of ₦6.32 trillion in the first quarter of the fiscal year, according to the latest Foreign Trade Statistics report published by the National Bureau of Statistics (NBS). Total export receipts surged by over 42% year-on-year, propelled by rapid expansions in non-oil agricultural produce, chemical fertilizers, and locally refined petroleum products.</p>
<p>The statistical bureau noted that total imports moderated slightly as domestic refining and agricultural substitution reduced demand for foreign fuel and finished consumer staples.</p>

<h3>Deep-Dive Background & Precedent</h3>
<p>Historically, Nigeria's trade balance swung wildly based solely on global benchmark crude oil price swings. Over the past four quarters, intentional investments in domestic fertilizer manufacturing and specialized agro-allied processing corridors have steadily shifted the balance. Nigeria has transformed from a net fertilizer importer into one of the Atlantic basin's premier exporters of manufactured urea.</p>

<h3>The Stakes: Real-Life Impact on the Economy & Naira</h3>
<p>A sustained commercial trade surplus provides direct balance-of-payments support for the Central Bank of Nigeria's external foreign reserves. This strengthening trade cushion reinforces stability for the Naira in autonomous foreign exchange windows, helping curtail imported inflation on raw manufacturing materials and essential machinery.</p>

<h3>Key Reactions & Official Statements</h3>
<p>Economists and manufacturers praised the numbers while urging sustained port logistics reforms: <em>"The trade surplus proves that when domestic refining and non-oil export processing receive policy backing, Nigeria can compete globally. We now need sustained clearance efficiency at our deep sea ports to lower transit times."</em></p>

<h3>Looking Ahead: Timeline & Next Steps</h3>
<p>The Ministry of Industry, Trade and Investment is slated to launch an expanded Export Expansion Facility Programme next quarter, aimed at assisting an additional 1,200 smallholder agro-processors in meeting European and North American phytosanitary import certifications.</p>
    `,
    category_id: 'cat_money_hustle',
    category_name: 'Business',
    category_slug: 'business',
    image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Container cargo loading terminal at the Lekki Deep Sea Port, Lagos.',
    image_credit: 'Nigerian Ports Authority / Lekki Port PR',
    image_license: 'Editorial Reference',
    author_name: '9jaBeacon Finance Team',
    author_role: 'Trade & Markets Desk',
    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 118,
    reading_time_minutes: 5,
    source_id: 'src_punch_news',
    source_name: 'The Punch / BusinessDay',
    source_original_url: 'https://punchng.com',
    published_at: '2026-08-25T08:15:00Z',
    updated_at: '2026-08-25T08:15:00Z',
    status: 'published',
  },
];
