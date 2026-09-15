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
    slug: 'cbn-holds-interest-rate-at-26-75-naira-stabilizes',
    title: 'CBN Holds Interest Rate at 26.75% as Naira Stabilizes Across Autonomous Windows',
    summary: 'The Monetary Policy Committee has retained the benchmark Monetary Policy Rate (MPR) at 26.75%, supporting lending stability for manufacturers and small enterprise operators while prioritizing headline inflation moderation.',
    content: `
<h3>The Crux: What Happened & Verified Developments</h3>
<p>The Monetary Policy Committee (MPC) of the Central Bank of Nigeria (CBN) has unanimously resolved to retain the benchmark Monetary Policy Rate (MPR) at 26.75%. The policy outcome was delivered by CBN Governor Olayemi Cardoso at the apex bank headquarters in Abuja following two days of rigorous deliberation on macroeconomic indicators, domestic liquidity ratios, and foreign exchange market performance.</p>
<p>In addition to holding the headline rate, the committee preserved the asymmetric corridor at +500/-100 basis points around the MPR. The Cash Reserve Ratio (CRR) for commercial deposit money banks was reaffirmed at 45.0%, while merchant banks remain pegged at 14.0%, and the statutory liquidity ratio remains unchanged at 30.0%. Governor Cardoso indicated that the hold strategy allows prior cumulative tightening rounds to transmit thoroughly across commercial banking credit channels before further interventions are considered.</p>
<p>Central bank leadership underscored that foreign exchange market dynamics have demonstrated noticeable improvement over recent trading cycles, with daily turnover in the Nigerian Autonomous Foreign Exchange Market (NAFEM) averaging between $280 million and $340 million. Sustained diaspora remittances and disciplined autonomous order matching have substantially curtailed the wide arbitrage spreads that previously afflicted parallel street markets.</p>

<h3>Deep-Dive Background & Context</h3>
<p>The decision to maintain rates at 26.75% represents a strategic pause in what has been one of the most aggressive tightening cycles in the central bank's institutional history. Over the past twelve months, the apex bank delivered multiple consecutive interest rate hikes in an urgent bid to contain food and energy price pressures triggered by the removal of petrol subsidies and the floating of the foreign exchange rate.</p>
<p>Historically, elevated interest rates have presented a double-edged sword for developing economies like Nigeria. While tighter monetary policy is essential to defend the currency and attract foreign portfolio investments (FPIs) into open market operation (OMO) treasury bills, it simultaneously inflates the cost of domestic borrowing. Commercial bank prime lending rates hovered between 28% and 34%, forcing manufacturers, logistics operators, and retail merchants to trim capital expenditures and scale back expansion plans.</p>

<h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
<p>For everyday Nigerians, small business owners, and market hustlers in commercial hubs from Alaba in Lagos to Onitsha and Kano, this monetary pause provides much-needed predictability. When interest rates swing unpredictably, commercial banks quickly adjust existing overdraft facilities, immediately escalating the monthly loan repayment burden for retailers and transport fleet owners. By holding the rate steady, the CBN provides a stable financial runway for enterprises budgeting for upcoming quarters.</p>
<p>However, the real test remains at the retail market stall. High borrowing costs continue to ripple down into consumer prices, as distributors pass on financing costs to end consumers. Working families across Nigeria continue to allocate upwards of 60% of household income to basic food and transportation. Until headline inflation moderates toward the mid-teens, the relief felt by ordinary citizens will remain modest, demanding complementary fiscal policies from federal authorities to stimulate agricultural productivity.</p>

<h3>Key Reactions & Official Voices</h3>
<p>Organized private sector stakeholders, including the Manufacturers Association of Nigeria (MAN) and the Lagos Chamber of Commerce and Industry (LCCI), offered measured responses to the announcement. "A rate hold is certainly preferable to another hike, but our members urgently require concessionary financing windows to sustain factory output and prevent staff rationalization," remarked an executive director of the manufacturers' body.</p>
<p>From the regulatory bench, Governor Cardoso was firm regarding the committee's forward posture: <em>"Our foremost mandate is anchoring exchange rate stability and safeguarding the domestic purchasing power of working families. We will not hesitate to adjust policy levers whenever macroeconomic risks demand decisive intervention."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>From the editorial vantage point of 9jaBeacon, the CBN's decision to maintain the MPR at 26.75% is a pragmatic acknowledgment of reality: monetary policy alone cannot cure structural supply-side inflation. Raising rates further would have yielded diminishing returns while needlessly strangling local production lines. Nigeria's inflation problem is fundamentally driven by food transport logistics, road security challenges, and high domestic energy tariffs—none of which can be resolved solely by manipulating central bank interest rate dials.</p>
<p>Governor Cardoso and his team have succeeded in restoring credibility and institutional order to the foreign exchange windows. Yet the wider macroeconomic strategy will remain vulnerable until federal and state ministries coordinate agricultural feeder roads, rail freight, and rural power supply. The central bank has held its ground; it is now up to the fiscal authorities to lower the physical cost of producing and distributing goods across the federation.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>Will commercial banks use this monetary pause to expand accessible, low-interest working capital loans to micro-enterprises and artisan cooperatives?</li>
  <li>How effectively can state governments ramp up food security interventions to complement the central bank's inflation-containment measures?</li>
  <li>If global commodity prices fluctuate unpredictably, does the CBN possess sufficient foreign reserve buffers to maintain autonomous market liquidity without resuming rate hikes?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The Monetary Policy Committee will reconvene for its next statutory assessment in eight weeks. Market analysts and corporate treasurers will closely examine the upcoming National Bureau of Statistics (NBS) Consumer Price Index reports and weekly autonomous FX turnover numbers to gauge whether current price stabilization trends hold steady.</p>
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
<h3>The Crux: What Happened & Verified Developments</h3>
<p>The Federal Government of Nigeria on Tuesday officially inaugurated a 24-member inter-agency committee tasked with harmonizing nationwide memorandums on constitutional restructuring, decentralized state police frameworks, and electoral integrity. The high-level panel comprises seasoned constitutional jurists, state governors, legislative committee chairs, civil society leaders, and representatives from the Nigerian Bar Association (NBA).</p>
<p>Presiding over the inauguration ceremony at the State House Banquet Hall in Abuja, senior administration officials emphasized that modernizing the legal framework is indispensable for deepening democratic institutions, resolving perennial jurisdiction disputes, and bolstering citizen trust in electoral outcomes. The committee has been assigned a clear 90-day mandate to produce an actionable legislative white paper for submission to the National Assembly joint committee on constitutional review.</p>
<p>Specific operational terms of reference include drafting institutional safeguards to prevent executive interference in local council allocations, designing operational accountability mechanisms for proposed state police formations, and standardizing real-time biometric voter verification protocols.</p>

<h3>Deep-Dive Background & Context</h3>
<p>Nigeria's 1999 Constitution (as amended), drafted under military transition authorities, has long been a subject of contentious national debate. Critics across political divides have repeatedly argued that its heavily centralized exclusive legislative list concentrates excessive power in the central government at the expense of sub-national federating units. Previous constitutional reform conferences, including the 2014 National Conference, produced voluminous recommendations that stalled during legislative implementation.</p>
<p>Simultaneously, the 2023 general elections brought renewed urgency to electoral reform. While the Electoral Act 2022 introduced groundbreaking provisions such as the Bimodal Voter Accreditation System (BVAS) and the INEC Result Viewing Portal (IReV), logistical bottlenecks and transmission ambiguities created widespread litigation. Citizens and international election observer missions have consistently called for unambiguous statutory mandates governing electronic results transmission.</p>

<h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
<p>For ordinary Nigerians residing in rural and peri-urban communities, constitutional restructuring is far more than an abstract legal exercise. The establishment of decentralized state and community policing directly impacts the safety of farmers in their fields, traders traveling inter-state highways, and families sleeping in their homes. A centralized police command in Abuja has proved logistically overstretched in responding promptly to localized security emergencies.</p>
<p>Similarly, enforcing direct financial autonomy for the 774 Local Government Areas (LGAs) is the most critical lever for grassroots development. When local councils receive their federal revenue allocations directly without state-level joint account deductions, primary healthcare centers, community drainage networks, and primary schools receive immediate capital funding, revitalizing rural economies across all 36 states.</p>

<h3>Key Reactions & Official Voices</h3>
<p>Civil society coalitions and governance watchdogs have voiced cautious optimism while insisting on public participation. "We welcome this initiative, but it must not become another bureaucratic talk-shop. The Nigerian people have repeatedly made their demands clear: uncompromised local government autonomy, transparent elections, and community-centered security," stated a representative of the Civil Society Legislative Advocacy Centre (CISLAC).</p>
<p>From the legal community, prominent senior advocates stressed the need for strict timelines: <em>"The test of this committee lies in producing concrete, enforceable constitutional amendment bills that the National Assembly and state assemblies can ratify well ahead of the next electoral cycle."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>At 9jaBeacon, our editorial stance is clear: Nigeria cannot continue to govern a dynamic 21st-century nation of over 220 million people with an outdated, overly centralized military-era administrative architecture. True federalism is not an ideological concession; it is an administrative necessity. Giving states the authority to police their jurisdictions and allowing local governments to manage their resources is the only viable path to lasting peace and equitable development.</p>
<p>However, the biggest roadblock has never been drafting recommendations—it has always been the political will of state governors and entrenched political interests who benefit from the status quo. If this committee is to leave a lasting legacy, President Bola Tinubu and the leadership of the National Assembly must demonstrate unyielding political resolve to push these amendments through state houses of assembly without compromise.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>Will state governors genuinely respect local government financial autonomy, or will they devise new administrative loopholes to maintain control over council funds?</li>
  <li>What constitutional checks and balances are necessary to ensure that proposed state police forces are not weaponized against political opponents by incumbent state leaders?</li>
  <li>How can civil society and active citizens mobilize to hold their state assembly members accountable when voting on these crucial constitutional amendments?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The reform committee is scheduled to commence public townhall consultations across the six geopolitical zones within the next three weeks. An interim legislative draft is expected on the floor of both chambers of the National Assembly before the end of the current legislative quarter.</p>
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
    slug: 'lookman-nominated-for-african-footballer-of-the-year',
    title: 'Lookman Nominated for African Footballer of the Year After Stellar Europa League Run',
    summary: 'Super Eagles forward Ademola Lookman leads the continental shortlist following his historic European hat-trick, exemplary national team displays, and tactical evolution across European top-flight football.',
    content: `
<h3>The Crux: What Happened & Verified Developments</h3>
<p>Super Eagles attacking sensation Ademola Lookman has been officially nominated by the Confederation of African Football (CAF) as a frontline contender for the prestigious African Footballer of the Year award. The formal nomination announcement, delivered from CAF operational headquarters in Cairo, caps an extraordinary twelve months in which Lookman established himself as one of world football's most decisive match-winners on both club and international stages.</p>
<p>The 26-year-old forward delivered a masterclass campaign with Italian Serie A outfit Atalanta, culminating in a historic hat-trick against previously undefeated German champions Bayer Leverkusen in the UEFA Europa League final in Dublin. Lookman's historic treble marked the first hat-trick scored in a single-leg European club final in fifty-five years, cementing his name into modern continental folklore.</p>
<p>On the international stage, Lookman was instrumental in Nigeria's journey to the Africa Cup of Nations (AFCON) final in Côte d'Ivoire, delivering three crucial goals and two assists in high-stakes knockout fixtures while earning a coveted spot in the CAF Team of the Tournament.</p>

<h3>Deep-Dive Background & Context</h3>
<p>Lookman's ascent to the pinnacle of African football represents an inspiring testament to perseverance and tactical resilience. Having navigated challenging loan spells across Charlton Athletic, Everton, RB Leipzig, Fulham, and Leicester City, his permanent transition to Italian football under tactician Gian Piero Gasperini provided the tactical discipline and positional freedom necessary to unlock his full athletic and technical maturity.</p>
<p>Should Lookman claim the golden crown in Marrakech, it will mark consecutive African Player of the Year triumphs for Nigeria following Victor Osimhen's historic victory the previous year. Prior to Osimhen's coronation, Nigeria had endured a painful 24-year drought since Nwankwo Kanu claimed the award in 1999. Back-to-back victories would definitively validate the ongoing golden era of Nigerian attacking talent making waves across European football.</p>

<h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
<p>Beyond the celebratory headlines and television highlight reels, Lookman's international recognition reverberates deeply across Nigeria's grassroots sports landscape. In local viewing centers from Ajegunle and Surulere in Lagos to Aba, Warri, and Kaduna, football serves as an unmatched cultural unifier and emotional escape from daily economic pressures. When a Super Eagles star shines on the world stage, it revitalizes national pride and provides tangible hope for millions of aspiring youth.</p>
<p>Commercial stakes are equally high for domestic football academies. International scout delegations and talent scouts routinely increase their investments in Nigerian grassroots scouting showcases when Nigerian stars command global attention. Lookman's success directly enhances the market valuation of emerging domestic talent, opening lucrative professional pathways for local footballers and youth coaches nationwide.</p>

<h3>Key Reactions & Official Voices</h3>
<p>The Nigeria Football Federation (NFF) released an official commendation praising Lookman's work ethic and exemplary national commitment. "Ademola has consistently demonstrated the grit, humility, and excellence that define Nigerian spirit on the pitch. His performance in Dublin and at the AFCON made over 200 million compatriots immensely proud," stated NFF President Ibrahim Gusau.</p>
<p>Atalanta manager Gian Piero Gasperini also weighed in: <em>"Ademola has developed an elite understanding of space, tactical timing, and final-third execution. He plays with the passion and intensity of an athlete who knows the entire continent is watching him."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>From the sports desk of 9jaBeacon, Lookman's nomination is not just an individual triumph; it is a profound lesson in player development and patience. Modern sports commentary is notoriously impatient, frequently labeling emerging athletes as 'inconsistent' before they find the tactical system and mental maturity to thrive. Lookman did not let early career skepticism define him; he adapted to Italian defensive structures, perfected his pressing duties, and turned himself into a complete attacker.</p>
<p>However, Nigerian football authorities must not allow individual brilliance to paper over systemic administrative cracks. Lookman and Osimhen represent generational talents, but Nigeria's national team cannot depend perpetually on moments of individual magic while foundational matters like pitch maintenance, timely coach compensation, and grassroots league infrastructure lag behind. To truly dominate African football for the next decade, the NFF must build modern institutional scaffolding around our world-class stars.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>Does Lookman's historic Europa League final hat-trick give him the decisive edge over rival nominees from Morocco and South Africa?</li>
  <li>How can the Super Eagles coaching crew best build an attacking tactical system that maximizes the complementary strengths of both Lookman and Osimhen?</li>
  <li>What concrete steps must the NFF take to ensure domestic NPFL players receive equivalent technical coaching and scouting opportunities?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The official CAF Awards Gala is slated to take place in Marrakech, Morocco in December. National team head coaches, technical directors, and accredited African sports journalists will submit their verified ballots over the coming weeks.</p>
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
    source_name: 'BBC Sport',
    source_original_url: 'https://www.bbc.com/sport',
    published_at: '2026-08-25T11:15:00Z',
    updated_at: '2026-08-25T11:15:00Z',
    status: 'published',
  },
  {
    id: 'art_world_un_climate_accord',
    slug: 'global-green-energy-investment-surpasses-two-trillion-world-summit',
    title: 'Global Clean Energy Investment Surpasses $2 Trillion at Historic UN Climate Summit',
    summary: 'International leaders and development finance institutions pledge unprecedented funding for emerging economy grids, sovereign risk guarantees, and decentralized solar infrastructure.',
    content: `
<h3>The Crux: What Happened & Verified Developments</h3>
<p>Annual worldwide capital deployment into renewable energy generation, battery storage systems, and decentralized mini-grids has officially surpassed $2.1 trillion, according to landmark data presented at the United Nations Climate and Sustainable Energy Assembly. The high-level plenary brought together over 140 energy ministers, multilateral development bank chiefs, and sovereign wealth portfolio managers to ratify the Global Clean Grid Transition Accord.</p>
<p>Under the newly ratified framework, a specialized $120 billion concessional guarantee syndicate backed by the World Bank, the African Development Bank (AfDB), and European climate facilities was officially unlocked. The facility is explicitly structured to de-risk private equity investments in developing economies across Sub-Saharan Africa and Southeast Asia, shielding commercial developers from currency conversion volatility and sovereign default risks.</p>
<p>Delegates established binding milestones requiring that at least 35% of all multilateral energy disbursements be directed into decentralized off-grid solar, agricultural cold-storage hubs, and high-voltage transmission upgrades in developing nations before 2030.</p>

<h3>Deep-Dive Background & Context</h3>
<p>For over two decades, African nations have faced disproportionate financial headwinds when attempting to modernize their power sectors. Despite possessing over 60% of the globe's finest solar irradiation resources, the African continent historically attracted less than 3% of global renewable energy investment. International private capital routinely demanded prohibitive risk premiums of 14% to 22% for African utility loans, compared to 3% to 5% in North America and Western Europe.</p>
<p>This stark capital cost disparity severely curtailed the pace of electrification. In Nigeria, where over 85 million citizens lack reliable access to the national grid and businesses spend an estimated $14 billion annually running private diesel and petrol generators, the transition toward distributed clean energy is not merely an environmental preference—it is an existential economic imperative.</p>

<h3>The Stakes: Real-Life Impact on Everyday Citizens</h3>
<p>For Nigerian market women, cold-chain poultry farmers, and cottage manufacturers, affordable clean energy translates directly into lower operating overhead and reduced food spoilage. In rural farming settlements where up to 40% of fresh tomato and cassava harvests perish before reaching urban markets due to lack of refrigeration, solar-powered community cold hubs financed under this accord can triple farm gate revenues.</p>
<p>In urban centers, the proliferation of commercial rooftop solar and mini-grids provides a clean alternative to noisy, expensive fossil-fueled generating sets. With commercial petrol prices exceeding ₦1,000 per liter across many states, transitioning to decentralized solar micro-utilities enables barbershops, pharmacies, and tech co-working hubs to reduce monthly energy expenditure by up to 50%.</p>

<h3>Key Reactions & Official Voices</h3>
<p>African leaders at the summit emphasized that the global climate discourse must respect the continent's developmental realities. "We cannot talk about clean transitions in the abstract while millions of our hospitals still deliver babies using phone flashlights. Energy transition for Africa must mean energy expansion and industrialization," affirmed an executive commissioner from the African Union Energy Directorate.</p>
<p>From the private investment sector, international clean infrastructure syndicate leaders stated: <em>"The provision of first-loss sovereign risk guarantees fundamentally alters the investment calculus, enabling global pension funds to deploy long-term capital into Nigerian utility projects with confidence."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>At 9jaBeacon, we view this $2 trillion global milestone with clear-eyed realism. While massive funding figures announced at international summits generate triumphant press releases, the true measure of success will be determined not in Geneva or New York, but in rural communities across Zamfara, Benue, and Cross River. All too often, international climate finance becomes trapped in layers of bureaucratic consulting fees and protracted feasibility studies, delivering minimal wattage to ordinary citizens.</p>
<p>Nigeria's Federal Ministry of Power and Rural Electrification Agency (REA) must take proactive ownership of these funds. They must ensure that concessionary loans bypass political favoritism and go directly to reputable domestic mini-grid developers with proven track records of reliable grassroots service delivery. True green energy must serve the Nigerian working class, not international boardroom consultants.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>How can state governments create transparent regulatory environments that allow independent solar developers to deploy mini-grids without cumbersome state-level taxes?</li>
  <li>Will international financing bodies genuinely disburse funds to local African engineering firms, or will contracts disproportionately favor foreign multinational conglomerates?</li>
  <li>What consumer financing models can be established so everyday households can purchase solar inverter systems with manageable monthly installment plans?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The first tranche of $15 billion in multilateral risk-mitigated credit facilities is scheduled for tender opening in the fourth quarter. National energy agencies across West Africa will publish eligible mini-grid project clusters for competitive developer bidding before the end of the year.</p>
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
    reading_time_minutes: 4,
    source_id: 'src_reuters_world',
    source_name: 'Reuters',
    source_original_url: 'https://www.reuters.com',
    published_at: '2026-08-25T10:30:00Z',
    updated_at: '2026-08-25T10:30:00Z',
    status: 'published',
  },
  {
    id: 'art_techcabal_fintech_hustle',
    slug: 'nigerian-fintechs-cross-border-payment-volumes-surge',
    title: 'Nigerian Fintechs Tap Cross-Border Trade as Instant FX Settlement Surges 65%',
    summary: 'Lagos-based payment innovators and digital remittance hubs expand merchant corridors across Ghana, Kenya, and the UK with instant local currency payouts.',
    content: `
<h3>The Crux: What Happened & Verified Developments</h3>
<p>African cross-border payments processed by Nigerian digital fintech rails surged to an unprecedented $4.85 billion in the latest fiscal quarter, according to consolidated transaction reports published by the Nigeria Inter-Bank Settlement System (NIBSS) and regional fintech aggregators. The remarkable 65% quarterly expansion was propelled by direct API integrations with Pan-African payment switches, automated multi-currency virtual accounts, and instant local currency settlement protocols.</p>
<p>Leading Lagos-based payment infrastructure companies reported exponential volume growth across high-frequency merchant corridors connecting Nigeria, Ghana, Kenya, South Africa, and the United Kingdom. By automating foreign exchange liquidity matching and eliminating legacy intermediary routing nodes, these digital engines have reduced average cross-border transaction settlement times from four business days to under thirty seconds.</p>
<p>The breakthrough allows Nigerian digital service exporters, creative producers, import-export wholesalers, and regional transport providers to invoice and collect customer payments across multiple currencies with automated real-time conversion into their local bank accounts.</p>

<h3>Deep-Dive Background & Context</h3>
<p>For decades, intra-African commerce was crippled by an absurd banking anomaly: transferring money between neighboring African nations frequently required routing transactions through correspondent banks in London, Frankfurt, or New York. A merchant in Lagos paying a supplier in Accra or Nairobi had to convert Naira to US Dollars or British Pounds, which the recipient's bank subsequently converted to Ghanaian Cedis or Kenyan Shillings, incurring multiple currency conversion spreads and processing fees of up to 12% per transaction.</p>
<p>The operationalization of the Pan-African Payment and Settlement System (PAPSS) under the African Continental Free Trade Area (AfCFTA), combined with aggressive private innovation from Nigerian fintech founders, has dismantled these archaic barriers. Nigerian fintechs built localized liquidity pools that settle transactions directly between African currencies, saving merchants hundreds of millions of dollars in unnecessary transaction friction.</p>

<h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
<p>This payment revolution provides direct economic liberation for over 450,000 Nigerian digital freelancers, remote software engineers, graphic artists, and e-commerce traders. Rather than relying on perilous informal currency hawkers or watching substantial percentages of their earnings vanish in wire fees, young professionals can now invoice international clients transparently and receive funds directly into their Nigerian accounts at prevailing interbank rates.</p>
<p>For cross-border traders traveling to regional markets like Cotonou, Lomé, and Kumasi, digital settlement eliminates the severe security risks associated with carrying bulky physical cash across borders. Merchants can now purchase fabrics, agricultural produce, and automotive spare parts via digital mobile wallets, safeguarding their capital while accelerating inventory turnover.</p>

<h3>Key Reactions & Official Voices</h3>
<p>Fintech industry executives and trade economists have celebrated the milestone as a turning point for African economic integration. "We are witnessing the death of correspondent banking friction in Africa. When money moves as quickly and cheaply as a WhatsApp message, African trade volumes multiply organically," remarked the chief executive officer of a leading payment gateway in Yaba, Lagos.</p>
<p>Central Bank of Nigeria officials noted: <em>"The expansion of licensed, compliant digital remittance channels reinforces transparency and brings vital diaspora inflows into official banking records, supporting national foreign exchange reserves."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>In our analysis at 9jaBeacon, Nigeria’s fintech sector is the definitive proof of what Nigerian youth ingenuity can accomplish when given even the slightest operational breathing room. In the face of erratic electricity, infrastructure deficits, and complex domestic regulatory landscapes, our software engineers and financial architects have constructed world-class financial technology that rivals Silicon Valley and London.</p>
<p>However, regulators must resist the temptation to treat fintech innovation as a cash cow for opportunistic taxation or arbitrary compliance freezes. The role of the Central Bank and statutory security agencies must be to nurture innovation while enforcing rigorous anti-money laundering (AML) and know-your-customer (KYC) standards. If Nigeria is to become the undeniable financial capital of the African continent, regulatory policy must be collaborative, predictable, and forward-looking.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>How can regulatory agencies and commercial banks safeguard cross-border fintech infrastructure against sophisticated international cyber-fraud syndicates?</li>
  <li>What practical steps can rural and unbanked market traders take to adopt these digital cross-border payment tools without fear of technology intimidation?</li>
  <li>Will regional monetary authorities establish a unified African digital currency settlement framework to further lower cross-border transaction fees?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The African Continental Free Trade Area secretariat and regional central banks are set to roll out Phase II of the unified merchant settlement protocol next month, onboarding an additional 12 commercial banking syndicates and over 4,000 corporate exporters across West Africa.</p>
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
    reading_time_minutes: 4,
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
    summary: 'The National Bureau of Statistics reports a substantial merchandise trade surplus driven by urea fertilizer, processed cashew, sesame seeds and refined petroleum products.',
    content: `
<h3>The Crux: What Happened & Verified Developments</h3>
<p>Nigeria posted a robust foreign merchandise trade surplus of ₦6.32 trillion in the opening quarter of the fiscal year, according to the official Foreign Trade Statistics Bulletin released by the National Bureau of Statistics (NBS) in Abuja. Total export earnings rose by an impressive 42.8% year-on-year to reach ₦19.18 trillion, while total import expenditure contracted to ₦12.86 trillion, cementing Nigeria's strongest quarterly trade balance in five years.</p>
<p>The statistical bureau highlighted that while crude petroleum continues to constitute a significant share of aggregate receipts, the fastest-growing revenue contributors emerged from non-oil manufacturing and agro-processing corridors. Granular manufactured urea fertilizer, processed cashew kernels, sesame seeds, cocoa beans, and domestically refined petroleum distillates recorded double-digit volume expansions to destinations across Western Europe, South America, and West Africa.</p>
<p>Simultaneously, total foreign exchange spent on importing finished consumer food staples and refined petroleum products dropped noticeably, reflecting early gains from domestic refinery output and local agricultural substitution initiatives.</p>

<h3>Deep-Dive Background & Context</h3>
<p>For over four decades, Nigeria's trade balance was dangerously fragile, tethered almost entirely to the erratic whims of global benchmark Brent crude prices. Whenever international oil prices crashed, Nigeria's trade surplus vanished overnight, plunging external reserves into crisis and triggering severe currency devaluations. Generations of economic planners lamented the nation's inability to diversify its export basket beyond unrefined hydrocarbons.</p>
<p>The latest trade data indicates that years of capital investments in domestic industrial capacity—particularly mega-scale fertilizer production plants in Rivers, Lagos, and Edo, alongside modernized agro-commodity aggregation clusters in the northern belt—are beginning to yield structural dividends. Nigeria has effectively transformed from a chronic fertilizer importer into one of the Atlantic basin's premier exporters of manufactured urea, serving agriculture giants like Brazil and the United States.</p>

<h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
<p>A sustained commercial trade surplus provides critical, non-debt balance-of-payments support for the Central Bank of Nigeria's foreign exchange reserves. When the nation earns more foreign exchange from exports than it spends on imports, the domestic currency gains natural organic support in autonomous trading windows, reducing the need for emergency external loans and IMF facilities.</p>
<p>For ordinary Nigerian families and market traders, a stronger trade balance is the ultimate shield against imported inflation. When the Naira stabilizes on the back of solid export earnings, the landing cost of essential imported raw materials, industrial machinery, and pharmaceuticals stabilizes, preventing the sudden price spikes that erode the purchasing power of everyday citizens.</p>

<h3>Key Reactions & Official Voices</h3>
<p>Industry leaders and the Nigerian Association of Chambers of Commerce, Industry, Mines, and Agriculture (NACCIMA) commended the report while calling for accelerated port decongestion. "These figures validate the undeniable resilience of Nigerian manufacturers and farmers. However, our port terminals in Apapa, Tin Can, and Onne must operate with 24-hour automated scanning efficiency to prevent export cargoes from spoiling along access corridors," stated a NACCIMA vice president.</p>
<p>The Ministry of Industry, Trade and Investment responded affirmatively: <em>"Our strategic priority is eliminating non-tariff barriers and expanding phytosanitary compliance labs across all geopolitical zones to ensure Nigerian non-oil products meet international standards without delay."</em></p>

<h3>Writer’s Take: Editorial Perspective</h3>
<p>From the editorial board of 9jaBeacon, this ₦6.32 trillion trade surplus is an immensely encouraging signal, but it must not become an excuse for official complacency. A significant portion of this surplus was achieved because domestic import expenditure was depressed by high exchange rates, which forced many businesses to scale back their purchases of foreign machinery and equipment. True, sustainable prosperity cannot be built purely on import compression; it must be powered by explosive, value-added export expansion.</p>
<p>Exporting raw cashew nuts and unprocessed cocoa beans still leaves the vast majority of economic value on table for foreign processors in Europe and Asia. The next phase of Nigeria's industrialization must focus uncompromisingly on domestic agro-processing: turning cocoa into finished chocolate, processing sesame seeds into culinary oils, and converting raw cotton into garments right here on Nigerian soil. That is how we create millions of dignified jobs for our youth.</p>

<h3>Critical Questions for Nigerians to Consider</h3>
<ul>
  <li>How can state governments support smallholder farmers with mechanized equipment and security to multiply agricultural export yields?</li>
  <li>What incentives can commercial deposit banks provide to encourage private investors to build agro-processing factories in rural agricultural clusters?</li>
  <li>Will the Nigerian Ports Authority and customs services maintain ongoing reforms to completely eradicate extortion and clearance delays along export corridors?</li>
</ul>

<h3>Looking Ahead: Timeline & What to Watch</h3>
<p>The Ministry of Trade is scheduled to roll out the expanded ₦50 billion Export Expansion Facility Programme next quarter, targeting an initial cohort of 1,500 verified small and medium agro-processors seeking European and North American phytosanitary import certifications.</p>
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
    source_name: 'The Punch Newspapers',
    source_original_url: 'https://punchng.com',
    published_at: '2026-08-25T08:15:00Z',
    updated_at: '2026-08-25T08:15:00Z',
    status: 'published',
  },
];
