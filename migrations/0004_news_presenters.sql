-- Cloudflare D1 & Relational Migration: 0004_news_presenters.sql
-- Presenters & Sprites Table for 9jaBeacon AI Broadcast Anchors

CREATE TABLE IF NOT EXISTS presenters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  bio TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  sprite_url TEXT NOT NULL,
  poses_json TEXT NOT NULL,
  preferred_categories TEXT NOT NULL, -- JSON array of category IDs
  accent TEXT DEFAULT 'Nigerian English',
  voice_settings_json TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presenters_status ON presenters(status);
CREATE INDEX IF NOT EXISTS idx_presenters_gender ON presenters(gender);
CREATE INDEX IF NOT EXISTS idx_presenters_order ON presenters(display_order);

-- Initial seed data for the 4 9jaBeacon presenters
INSERT OR IGNORE INTO presenters (
  id, name, gender, role, department, bio, avatar_url, sprite_url, poses_json, preferred_categories, accent, voice_settings_json, status, display_order
) VALUES
(
  'presenter_femi',
  'Femi Adeleke',
  'male',
  'Senior National Affairs & Breaking Politics Anchor',
  'National Desk & Governance',
  'Authoritative broadcast journalist with over a decade covering Aso Rock, presidential directives, legislative debates, and national security briefings across Nigeria.',
  '/presenters/femi.jpg',
  '/presenters/femi.jpg',
  '{"idle":{"x":"0%","y":"0%"},"speaking":{"x":"100%","y":"0%"},"breaking":{"x":"0%","y":"100%"},"wrap":{"x":"100%","y":"100%"}}',
  '["cat_naija_news","cat_politics","cat_security"]',
  'Nigerian English (Authoritative / Baritone)',
  '{"pitch":0.95,"rate":1.0,"lang":"en-NG","preferred_gender":"male"}',
  'active',
  1
),
(
  'presenter_amaka',
  'Amaka Okafor',
  'female',
  'Chief Primetime & Special Investigative Anchor',
  'Primetime & Investigative Unit',
  'Renowned investigative journalist and evening news anchor known for razor-sharp reporting on civic accountability, economy, human rights, and breaking national developments.',
  '/presenters/amaka.jpg',
  '/presenters/amaka.jpg',
  '{"idle":{"x":"0%","y":"0%"},"speaking":{"x":"100%","y":"0%"},"breaking":{"x":"0%","y":"100%"},"wrap":{"x":"100%","y":"100%"}}',
  '["cat_naija_news","cat_politics","cat_world"]',
  'Nigerian English (Clear / Crisp Soprano)',
  '{"pitch":1.1,"rate":1.0,"lang":"en-NG","preferred_gender":"female"}',
  'active',
  2
),
(
  'presenter_tunde',
  'Babatunde Bello',
  'male',
  'Economy, Fintech & Business Intelligence Anchor',
  'Money, Tech & Markets',
  'Financial analyst and modern tech presenter decoding Central Bank monetary shifts, FX markets, Nigerian startup ecosystems, and practical wealth strategies.',
  '/presenters/tunde.jpg',
  '/presenters/tunde.jpg',
  '{"idle":{"x":"0%","y":"0%"},"speaking":{"x":"100%","y":"0%"},"breaking":{"x":"0%","y":"100%"},"wrap":{"x":"100%","y":"100%"}}',
  '["cat_money_hustle","cat_tech_vibes"]',
  'Nigerian English (Energetic / Analytical)',
  '{"pitch":1.0,"rate":1.05,"lang":"en-NG","preferred_gender":"male"}',
  'active',
  3
),
(
  'presenter_zainab',
  'Zainab Aliyu',
  'female',
  'Culture, Lifestyle & Global Diaspora Anchor',
  'Culture, Sports & Global Affairs',
  'Dynamic broadcast journalist chronicling Nollywood, Afrobeats global milestones, African diaspora excellence, grassroots sports, and cross-continental cultural narratives.',
  '/presenters/zainab.jpg',
  '/presenters/zainab.jpg',
  '{"idle":{"x":"0%","y":"0%"},"speaking":{"x":"100%","y":"0%"},"breaking":{"x":"0%","y":"100%"},"wrap":{"x":"100%","y":"100%"}}',
  '["cat_culture_lifestyle","cat_sports","cat_world"]',
  'Nigerian English (Eloquent / Engaging)',
  '{"pitch":1.05,"rate":0.98,"lang":"en-NG","preferred_gender":"female"}',
  'active',
  4
);
