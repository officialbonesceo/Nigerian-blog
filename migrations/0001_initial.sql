-- Cloudflare D1 Migration: 0001_initial.sql
-- NaijaPulse Schema: Categories, Sources, Articles, Automation, Logs, Settings

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'newspaper',
  color TEXT DEFAULT '#008751',
  follower_count INTEGER DEFAULT 1250,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  category_default_id TEXT,
  is_enabled INTEGER DEFAULT 1,
  is_official INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 95.0,
  license_notes TEXT,
  last_fetched_at TEXT,
  fetch_interval_minutes INTEGER DEFAULT 30,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_default_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category_id TEXT NOT NULL,
  image_url TEXT,
  image_caption TEXT,
  image_credit TEXT,
  image_license TEXT,
  author_name TEXT DEFAULT 'NaijaPulse Desk',
  author_role TEXT DEFAULT 'Editorial Contributor',
  author_avatar TEXT,
  is_top_story INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  is_breaking INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 120,
  reading_time_minutes INTEGER DEFAULT 4,
  source_id TEXT,
  source_name TEXT,
  source_original_url TEXT,
  published_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'published',
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_top ON articles(is_top_story);
CREATE INDEX IF NOT EXISTS idx_articles_trending ON articles(is_trending);

CREATE TABLE IF NOT EXISTS article_reports (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  article_title TEXT,
  article_slug TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  reporter_email TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rejected_articles (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  source_name TEXT,
  original_title TEXT NOT NULL,
  original_url TEXT NOT NULL,
  raw_content TEXT,
  rejection_reason TEXT NOT NULL,
  ai_tier_failures TEXT,
  status TEXT DEFAULT 'rejected',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visitor_analytics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  page_path TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  device_type TEXT DEFAULT 'mobile',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source_id TEXT,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed Initial Categories
INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order) VALUES
('cat_naija_news', 'naija-news', 'Naija News', 'Breaking national reports, state assemblies, executive governance, infrastructure, and citizen stories across Nigeria.', 'flag', '#008751', 28400, 1),
('cat_money_hustle', 'money-hustle', 'Money Hustle', 'Wealth creation, side hustles, SME strategies, Naira FX rates, fintech investments, banking and market opportunities.', 'trending-up', '#0284c7', 34100, 2),
('cat_sports', 'sports', 'Sports', 'Super Eagles, Premier League, NPFL, UEFA Champions League, boxing, combat sports, and Nigerian athletics worldwide.', 'trophy', '#16a34a', 41200, 3),
('cat_world', 'world', 'World', 'International breaking events, geopolitics, global technology shifts, diplomacy, and diaspora developments.', 'globe', '#6366f1', 19800, 4);

-- Seed Initial Sources
INSERT OR IGNORE INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes) VALUES
('src_punch_news', 'The Punch Newspapers', 'https://punchng.com/feed/', 'https://punchng.com', 'cat_naija_news', 1, 1, 96.5, 'National daily RSS feed with canonical attribution', 30),
('src_vanguard_news', 'Vanguard News Nigeria', 'https://www.vanguardngr.com/feed/', 'https://www.vanguardngr.com', 'cat_naija_news', 1, 0, 94.5, 'National breaking news and investigative wire', 30),
('src_channels_tv', 'Channels Television', 'https://www.channelstv.com/feed/', 'https://www.channelstv.com', 'cat_naija_news', 1, 1, 97.5, 'Broadcast journalism desk with breaking national coverage', 30),
('src_von_news', 'Voice of Nigeria (VON Official)', 'https://von.gov.ng/feed/', 'https://von.gov.ng', 'cat_naija_news', 1, 1, 98.0, 'Federal Government official international broadcast station', 30),
('src_techcabal', 'TechCabal African Innovation', 'https://techcabal.com/feed/', 'https://techcabal.com', 'cat_money_hustle', 1, 1, 96.0, 'Fintech, venture rounds, and SME tech growth', 45),
('src_businessday', 'BusinessDay Nigeria', 'https://businessday.ng/feed/', 'https://businessday.ng', 'cat_money_hustle', 1, 1, 97.0, 'Markets, corporate earnings, and FX movements', 30),
('src_cbn_press', 'Central Bank of Nigeria (CBN Feed)', 'https://www.cbn.gov.ng/RSS/cbn_press_releases.xml', 'https://www.cbn.gov.ng', 'cat_money_hustle', 1, 1, 99.5, 'Official monetary policy and banking guidelines', 60),
('src_cnbc_markets', 'CNBC Global Markets & Wealth', 'https://search.cnbc.com/rs/search/combinedlist/view.xml?partnerId=wrss01&id=100003114', 'https://www.cnbc.com', 'cat_money_hustle', 1, 0, 95.0, 'Global indices, commodities, and wealth strategies', 45),
('src_bbc_sport', 'BBC Sport Global', 'https://feeds.bbci.co.uk/sport/rss.xml', 'https://www.bbc.com/sport', 'cat_sports', 1, 1, 98.0, 'Football, Super Eagles stars abroad, and athletics', 30),
('src_skysports_football', 'Sky Sports Premier League', 'https://www.skysports.com/rss/12040', 'https://www.skysports.com', 'cat_sports', 1, 0, 96.0, 'Transfer news and league match analysis', 30),
('src_reuters_world', 'Reuters World News Wire', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://www.reuters.com', 'cat_world', 1, 1, 98.5, 'Global diplomatic summits and geopolitical reports', 30),
('src_aljazeera_world', 'Al Jazeera International', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://www.aljazeera.com', 'cat_world', 1, 1, 95.5, 'Global South and international affairs', 30);

-- Seed Initial Site & Automation Settings
INSERT OR IGNORE INTO automation_settings (key, value, description) VALUES
('cloudflare_account_id', '', 'Cloudflare Account ID for Tier 1 Primary Workers AI'),
('cloudflare_api_token', '', 'Cloudflare API Token with Workers AI read/write permission'),
('cloudflare_ai_model', '@cf/meta/llama-3.1-8b-instruct', 'Primary Cloudflare Workers AI model'),
('openrouter_model', 'meta-llama/llama-3.3-70b-instruct:free', 'Selected active OpenRouter model for Tier 2 Fallback'),
('openrouter_api_key', '', 'API Key for OpenRouter multi-model inference'),
('pollinations_api_key', '', 'Optional API Token for Tier 3 Pollinations AI'),
('auto_publish', 'true', 'Automatically publish rewritten articles or hold in draft state for review'),
('cron_interval_minutes', '30', 'Scheduled automation ingestion trigger interval in minutes');

INSERT OR IGNORE INTO site_settings (key, value) VALUES
('site_name', '9jaBeacon'),
('site_tagline', 'Your Trusted Light on Nigerian News. Fast. Verified. Unbiased.'),
('contact_email', 'officialbonesceo@gmail.com'),
('admin_email', 'officialbonesceo@gmail.com');

-- Seed Initial Starter Articles (Prevents empty site)
INSERT OR IGNORE INTO articles (
  id, slug, title, summary, content, category_id, image_url, image_caption,
  image_credit, image_license, author_name, author_role, author_avatar,
  is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
  source_id, source_name, source_original_url, published_at, updated_at, status
) VALUES
(
  'art_cbn_mpr_2025',
  'cbn-keeps-interest-rate-at-26-75-money-hustle',
  'CBN Holds Interest Rate at 26.75% as Naira Stabilizes Across Autonomous Windows',
  'The Monetary Policy Committee has retained the benchmark Monetary Policy Rate (MPR) at 26.75%, supporting lending stability for manufacturers and small enterprise operators.',
  '<h3>The Scoop</h3><p>The Monetary Policy Committee of the Central Bank of Nigeria has unanimously resolved to retain the benchmark Monetary Policy Rate at 26.75% following thorough deliberation on inflation indicators and currency dynamics.</p><h3>The Stakes</h3><p>For entrepreneurs, hustle builders, and everyday businesses across Nigeria, the rate pause provides a steady borrowing cost environment, averting sudden jumps in commercial loan repayments.</p><h3>The Stats</h3><p>Monetary Policy Rate: Retained at 26.75%. Cash Reserve Ratio: 45.0% for commercial deposit money banks. Autonomous FX trading volume averaged $340M with rising diaspora remittances.</p>',
  'cat_money_hustle',
  'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=1200&q=80',
  'Central Bank of Nigeria Headquarters in Abuja.',
  'CBN Corporate Communications',
  'Public Interest Information Use',
  'Dr. Kelechi Nwosu',
  'Chief Financial Analyst & Money Hustle Editor',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  1, 1, 0, 16420, 4,
  'src_cbn_press', 'Central Bank of Nigeria', 'https://www.cbn.gov.ng',
  datetime('now', '-2 hours'), datetime('now', '-2 hours'), 'published'
),
(
  'art_electoral_reform_review',
  'fg-inaugurates-committee-to-review-1999-constitution-and-electoral-laws',
  'FG Inaugurates High-Powered Committee to Review 1999 Constitution and Electoral Laws',
  'The Federal Government has launched a multi-stakeholder panel to harmonize public recommendations on state policing, local government financial autonomy, and electronic polling unit transmission.',
  '<h3>The Scoop</h3><p>The Federal Government of Nigeria officially inaugurated a 24-member inter-agency committee tasked with harmonizing public memorandums on constitutional restructuring, state police framework, and electoral transparency.</p><h3>The Stakes</h3><p>Constitutional reviews address long-standing demands for decentralized community policing, fiscal federalism, and foolproof electronic transmission of election polling unit results.</p><h3>The Stats</h3><p>Timeline: Interim draft due to the National Assembly within 90 days. Focus Areas: State policing guidelines, local council financial autonomy, and diaspora voting framework.</p>',
  'cat_naija_news',
  'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
  'National Assembly Complex in Three Arms Zone, Abuja.',
  'VON Archive',
  'Official Information',
  'Oluwaseun Adeyemi',
  'Senior Bureau Chief & National Affairs Correspondent',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  0, 0, 1, 9840, 4,
  'src_von_news', 'Voice of Nigeria', 'https://von.gov.ng',
  datetime('now', '-3 hours'), datetime('now', '-3 hours'), 'published'
),
(
  'art_lookman_super_eagles',
  'lookman-nominated-for-african-footballer-of-the-year-super-eagles',
  'Lookman Nominated for African Footballer of the Year After Stellar Europa League Run',
  'Super Eagles forward Ademola Lookman leads the nominations following his historic European hat-trick and exceptional national team contributions.',
  '<h3>The Scoop</h3><p>Super Eagles attacking sensation Ademola Lookman has been officially nominated by the Confederation of African Football (CAF) as a frontrunner for the African Footballer of the Year award.</p><h3>The Stakes</h3><p>Lookman global recognition underscores the rising prominence of Nigerian talent in world football and keeps Nigeria at the pinnacle of African football awards.</p><h3>The Stats</h3><p>Europa League Final: 3 goals vs Bayer Leverkusen in Dublin. National Team: 3 goals and key assists during the AFCON campaign.</p>',
  'cat_sports',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
  'Nigerian football fans celebrating at international match.',
  'NFF Media / Open Sports',
  'Fair Use Sports Journalism',
  'Chidi Okafor',
  'Sports Lead & African Football Bureau',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  0, 1, 0, 22100, 3,
  'src_bbc_sport', 'BBC Sport / Channels TV', 'https://www.bbc.com/sport',
  datetime('now', '-4 hours'), datetime('now', '-4 hours'), 'published'
);
