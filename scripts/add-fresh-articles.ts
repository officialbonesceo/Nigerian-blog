import { db } from '../src/lib/db';

const now = new Date();

const newArticles = [
  {
    id: `art_fresh_${Date.now()}_1`,
    title: 'CBN Injects $500M to Deepen FX Market Stability Ahead of Q4 Corporate Import Windows',
    slug: 'cbn-injects-500m-deepen-fx-stability-q4-imports',
    summary: 'The Central Bank of Nigeria has injected additional liquidity into the Nigerian Autonomous Foreign Exchange Market (NAFEM) to alleviate retail pressure and meet genuine commercial import demands.',
    content: `<p>The Central Bank of Nigeria (CBN) has announced a targeted $500 million foreign exchange liquidity intervention through authorized dealer banks, reinforcing the stability of the Naira in the Nigerian Autonomous Foreign Exchange Market (NAFEM) ahead of high-volume fourth-quarter import cycles.</p>
<p>Speaking at an investor briefing in Abuja, the central bank confirmed that the liquidity distribution is designed to meet verified international trade invoices, tuition remittances, and manufacturing input clearances without creating speculative currency spikes.</p>
<p>"Our objective remains unambiguous: to anchor exchange rate expectations, eliminate market fragmentation, and ensure that commercial banks possess the necessary liquidity buffers to service genuine business requests without delay," the CBN stated.</p>
<p>Financial analysts and treasury operators in Lagos have welcomed the intervention, noting that the parallel market premium over the official rate has narrowed significantly over recent trading sessions, providing predictable pricing for corporate treasuries and small businesses alike.</p>`,
    category_id: 'cat_money_hustle',
    category_name: 'Business',
    image_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Central Bank of Nigeria Headquarters and Financial Market Trading Floor.',
    image_credit: 'Unsplash / Financial Markets',
    author_name: 'BonesCEO',
    author_role: 'Editor-in-Chief',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    source_name: '9jaBeacon Editorial Wire',
    source_id: 'src_editorial_desk',
    source_original_url: 'https://www.9jabeacon.name.ng/news/cbn-injects-500m-deepen-fx-stability-q4-imports',
    is_top_story: 1,
    is_trending: 1,
    is_breaking: 0,
    status: 'published',
    reading_time_minutes: 3,
    published_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: `art_fresh_${Date.now()}_2`,
    title: 'Federal Government Partners With Global Tech Hubs to Launch 3MTT Phase 2 in 12 Pilot States',
    slug: 'fg-partners-global-tech-hubs-launch-3mtt-phase-2',
    summary: 'The Federal Ministry of Communications, Innovation and Digital Economy has inaugurated the second phase of the 3 Million Technical Talents initiative, deploying state-of-the-art incubation centres across 12 states.',
    content: `<p>The Federal Ministry of Communications, Innovation and Digital Economy has officially inaugurated Phase Two of the flagship 3 Million Technical Talents (3MTT) programme, rolling out advanced training cohorts and physical innovation clusters across twelve pilot states in Nigeria.</p>
<p>The second phase scales up curriculum tracks in artificial intelligence engineering, cloud architecture, cybersecurity analysis, and embedded software systems, pairing 270,000 new fellows with international technology accelerators and domestic fintech firms for guaranteed internship placements.</p>
<p>"Nigeria's competitive advantage on the African continent is our young, ambitious demographic," declared Minister of Communications Dr. Bosun Tijani during the launch ceremony in Kano. "By equipping our youth with globally competitive technical certifications, we are creating a direct pipeline into high-earning remote employment and homegrown technological ventures."</p>
<p>State governments across Lagos, Kano, Rivers, Enugu, Oyo, and Kaduna have allocated public innovation centers to support 24/7 internet connectivity and power backup for participating fellows.</p>`,
    category_id: 'cat_naija_news',
    category_name: 'Naija News',
    image_url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Young Nigerian software engineers and digital apprentices collaborating at an innovation hub.',
    image_credit: 'Unsplash / Tech Ecosystem',
    author_name: 'BonesCEO',
    author_role: 'Editor-in-Chief',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    source_name: '9jaBeacon National Bureau',
    source_id: 'src_editorial_desk',
    source_original_url: 'https://www.9jabeacon.name.ng/news/fg-partners-global-tech-hubs-launch-3mtt-phase-2',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 1,
    status: 'published',
    reading_time_minutes: 4,
    published_at: new Date(now.getTime() - 1000 * 60 * 75).toISOString(),
    created_at: new Date(now.getTime() - 1000 * 60 * 75).toISOString(),
  },
  {
    id: `art_fresh_${Date.now()}_3`,
    title: 'Super Falcons Deliver Dominant 3-0 Victory in Pre-Tournament Friendly Ahead of Continental Championship',
    slug: 'super-falcons-dominant-victory-continental-preparations',
    summary: 'Nigeria’s Super Falcons produced a masterclass performance in Abuja, dismantling their regional opponents 3-0 with goals from Asisat Oshoala, Rasheedat Ajibade, and Esther Okoronkwo.',
    content: `<p>Nigeria's senior women's national team, the Super Falcons, put on an electrifying display of tactical discipline and clinical finishing on Tuesday afternoon, securing an emphatic 3-0 victory in an international preparatory friendly at the Moshood Abiola National Stadium in Abuja.</p>
<p>The nine-time African champions seized the tempo from the opening whistle, breaking the deadlock in the 24th minute when Rasheedat Ajibade slipped a pinpoint through-ball past the defensive backline, allowing Asisat Oshoala to slot home a cool finish into the bottom left corner.</p>
<p>Ajibade added a second herself ten minutes into the second half with a blistering 25-yard strike that left the visiting goalkeeper stranded. Substitute forward Esther Okoronkwo sealed the triumph in the 82nd minute with a delicate chip following a swift counterattack orchestrated by Christy Ucheibe.</p>
<p>"The team demonstrated sharp physical fitness and tactical cohesion," remarked head coach Randy Waldrum post-match. "We are focusing on keeping clean sheets and transitioning with speed, which will be vital when we face top-tier continental competition next month."</p>`,
    category_id: 'cat_sports',
    category_name: 'Sports',
    image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Super Falcons players celebrating a goal during international competition.',
    image_credit: 'Unsplash / Sports Imagery',
    author_name: 'BonesCEO',
    author_role: 'Editor-in-Chief',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    source_name: '9jaBeacon Sports Desk',
    source_id: 'src_editorial_desk',
    source_original_url: 'https://www.9jabeacon.name.ng/news/super-falcons-dominant-victory-continental-preparations',
    is_top_story: 0,
    is_trending: 1,
    is_breaking: 0,
    status: 'published',
    reading_time_minutes: 3,
    published_at: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
    created_at: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
  }
];

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO articles (
    id, slug, title, summary, content, category_id,
    image_url, image_caption, image_credit, author_name, author_role, author_avatar,
    source_name, source_id, source_original_url, is_top_story, is_trending, is_breaking,
    status, reading_time_minutes, views_count, published_at, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`);

for (const a of newArticles) {
  insertStmt.run(
    a.id, a.slug, a.title, a.summary, a.content, a.category_id,
    a.image_url, a.image_caption, a.image_credit, a.author_name, a.author_role, a.author_avatar,
    a.source_name, a.source_id, a.source_original_url, a.is_top_story, a.is_trending, a.is_breaking,
    a.status, a.reading_time_minutes, 142, a.published_at, a.created_at, a.published_at
  );
  console.log(`✅ Inserted article: ${a.title} (${a.slug})`);
}

console.log('Total articles in DB now:', db.prepare('SELECT count(*) as count FROM articles').get());
