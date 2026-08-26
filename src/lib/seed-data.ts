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
    slug: 'money-hustle',
    name: 'Money Hustle',
    description: 'Wealth creation, side hustles, SME strategies, Naira FX rates, fintech investments, banking and market opportunities.',
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
  // Naija News
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

  // Money Hustle
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
    category_name: 'Money Hustle',
    category_slug: 'money-hustle',
    image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Central Bank of Nigeria Headquarters in the Central Business District, Abuja.',
    image_credit: 'CBN Corporate Communications / Editorial License',
    image_license: 'Public Interest Information Use',
    author_name: 'Dr. Kelechi Nwosu',
    author_role: 'Chief Financial Analyst & Money Hustle Editor',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    is_top_story: 1,
    is_trending: 1,
    is_breaking: 0,
    views_count: 16420,
    reading_time_minutes: 4,
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
    author_name: 'Oluwaseun Adeyemi',
    author_role: 'Senior Bureau Chief & National Affairs Correspondent',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 0,
    is_breaking: 1,
    views_count: 9840,
    reading_time_minutes: 4,
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
<h3>The Scoop</h3>
<p>Super Eagles attacking sensation Ademola Lookman has been officially nominated by the Confederation of African Football (CAF) as a frontrunner for the African Footballer of the Year award.</p>
<p>The nomination rewards a historic season in which Lookman became the first player to score a hat-trick in a one-legged European final, securing Atalanta's Europa League triumph.</p>

<h3>The Stakes</h3>
<p>Lookman's global recognition underscores the rising prominence of Nigerian talent in world football and keeps Nigeria at the pinnacle of African football awards following Victor Osimhen's previous triumph.</p>

<h3>The Stats</h3>
<p>Key records and match statistics from Ademola Lookman's milestone year:</p>
<ul>
  <li><strong>Europa League Final:</strong> 3 goals vs Bayer Leverkusen in Dublin</li>
  <li><strong>National Team:</strong> 3 goals and key assists during the AFCON campaign</li>
  <li><strong>Club Form:</strong> 17 goals and 10 assists across all competitions in Serie A</li>
</ul>
    `,
    category_id: 'cat_sports',
    category_name: 'Sports',
    category_slug: 'sports',
    image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Nigerian football supporters cheering during an international match in Uyo.',
    image_credit: 'NFF Media / Open Sports Editorial',
    image_license: 'Fair Use Sports Journalism',
    author_name: 'Chidi Okafor',
    author_role: 'Sports Lead & African Football Bureau',
    author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 22100,
    reading_time_minutes: 3,
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
<h3>The Scoop</h3>
<p>Global capital allocation toward renewable power generation, battery energy storage systems, and decentralized mini-grids has crossed the $2 trillion threshold annually, according to official reports released at the United Nations Climate and Energy Assembly.</p>
<p>Major development finance corporations, sovereign wealth funds, and bilateral syndicates affirmed new multi-billion dollar debt relief facilities tied directly to clean technology deployment in Africa and Asia.</p>

<h3>The Stakes</h3>
<p>For developing markets, accelerated energy funding unlocks cheap distributed power for agricultural cold chains, rural hospitals, and micro-factories without bloating public debt.</p>

<h3>The Stats</h3>
<p>Key metrics from the UN Climate and Energy report:</p>
<ul>
  <li><strong>Total Global Clean Tech Allocation:</strong> $2.15 Trillion in 2026</li>
  <li><strong>Solar Capacity Growth:</strong> +36% year-on-year installation rate across the Global South</li>
  <li><strong>Concessional Finance Window:</strong> $45 Billion committed for African clean energy projects</li>
</ul>
<blockquote>"Transitioning to abundant renewable energy is no longer just an environmental ideal; it is the single most potent economic growth engine of our generation," stated the UN Environment Directorate.</blockquote>
    `,
    category_id: 'cat_world',
    category_name: 'World',
    category_slug: 'world',
    image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Earth satellite visualization representing interconnected global infrastructure.',
    image_credit: 'NASA Earth Observatory / Public Domain',
    image_license: 'Public Domain Creative Commons',
    author_name: 'Amina Bello-Garba',
    author_role: 'Foreign Correspondent & World Affairs Desk',
    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 14580,
    reading_time_minutes: 4,
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
<h3>The Scoop</h3>
<p>African cross-border payments processed by Nigerian digital fintech infrastructure hit an all-time high of $4.8 billion this quarter, according to data from TechCabal Insights and commercial settlement networks.</p>
<p>Direct API integrations with Pan-African settlement switches have reduced payment friction for remote digital hustlers, freelance creators, and import-export merchants trading across regional borders.</p>

<h3>The Stakes</h3>
<p>Seamless cross-border payouts allow Nigerian tech creators, e-commerce vendors, and freelancers to earn globally in foreign currency while receiving instant fair-rate conversion into their local accounts.</p>

<h3>The Stats</h3>
<p>Key highlights from the cross-border payment report:</p>
<ul>
  <li><strong>Quarterly Volume:</strong> $4.8 Billion settled across West and East African corridors</li>
  <li><strong>Average Transaction Time:</strong> Reduced from 48 hours to under 35 seconds</li>
  <li><strong>Active Hustle Merchants:</strong> Over 420,000 Nigerian digital sellers accepting direct international client payments</li>
</ul>
    `,
    category_id: 'cat_money_hustle',
    category_name: 'Money Hustle',
    category_slug: 'money-hustle',
    image_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Digital payment technology and modern financial analytics interface.',
    image_credit: 'TechCabal Media / Creative Commons',
    image_license: 'Editorial Attribution',
    author_name: 'Dr. Kelechi Nwosu',
    author_role: 'Chief Financial Analyst & Money Hustle Editor',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 11200,
    reading_time_minutes: 3,
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
<h3>The Scoop</h3>
<p>Nigeria recorded a total foreign merchandise trade surplus of ₦6.32 trillion in the first quarter of the fiscal year, according to the latest Foreign Trade Statistics report published by the National Bureau of Statistics (NBS).</p>
<p>Total export receipts surged by over 42% year-on-year, propelled by rapid expansions in non-oil agricultural produce, chemical fertilizers, and locally refined petroleum products.</p>

<h3>The Stakes</h3>
<p>A swelling trade surplus bolsters Nigeria's external foreign reserves, reinforces exchange rate resilience for the Naira, and signals steady diversification away from crude oil monoculture.</p>

<h3>The Stats</h3>
<p>Highlights from the National Bureau of Statistics trade balance data:</p>
<ul>
  <li><strong>Total Trade Surplus:</strong> ₦6.32 Trillion for Q1</li>
  <li><strong>Top Export Commodities:</strong> Manufactured urea fertilizer, raw sesame seeds, processed cashew nuts, and domestic petroleum derivatives</li>
  <li><strong>Key Trade Partners:</strong> The Netherlands, India, and Spain accounted for 34% of total export shipments</li>
</ul>
    `,
    category_id: 'cat_money_hustle',
    category_name: 'Money Hustle',
    category_slug: 'money-hustle',
    image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Container cargo loading terminal at the Lekki Deep Sea Port, Lagos.',
    image_credit: 'Nigerian Ports Authority / Lekki Port PR',
    image_license: 'Editorial Reference',
    author_name: 'Damilola Adeleke',
    author_role: 'Trade & Markets Bureau Directorate',
    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    views_count: 10450,
    reading_time_minutes: 4,
    source_id: 'src_punch_news',
    source_name: 'The Punch / BusinessDay',
    source_original_url: 'https://punchng.com',
    published_at: '2026-08-25T08:15:00Z',
    updated_at: '2026-08-25T08:15:00Z',
    status: 'published',
  },
];
