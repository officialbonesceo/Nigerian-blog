#!/usr/bin/env node
/**
 * 9jaBeacon Daily Desk — strict 1–2/day
 * - Model chooses category from FIXED list (JSON)
 * - Model writes the full article (no static template)
 * - If no model responds → workflow fails (no local fallback)
 * - Prefer lower-competition / under-covered angles
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, 'desk', 'state');
const LOCK_FILE = path.join(STATE_DIR, 'daily-lock.json');
const HISTORY_FILE = path.join(STATE_DIR, 'published-urls.jsonl');

const MAX = Math.min(2, Math.max(1, parseInt(process.env.MAX_ARTICLES || '1', 10) || 1));
const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const DB_ID = (process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
const TOKEN = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const GEMINI = (process.env.GEMINI_API_KEY || '').trim();
const OPENROUTER = (process.env.OPENROUTER_API_KEY || '').trim();

/** Public category slugs the model may return */
const ALLOWED_CATEGORIES = ['naija-news', 'business', 'sports', 'world'];

/** Map public slug → D1 category_id */
const CATEGORY_IDS = {
  'naija-news': 'cat_naija_news',
  business: 'cat_money_hustle',
  sports: 'cat_sports',
  world: 'cat_world',
};

const RSS_FEEDS = [
  { name: 'Punch', url: 'https://punchng.com/feed/' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed' },
  { name: 'BusinessDay', url: 'https://businessday.ng/feed/' },
];

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function ensureState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(LOCK_FILE)) {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ date: '', count: 0, slugs: [] }, null, 2));
  }
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '');
}

function readLock() {
  ensureState();
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return { date: '', count: 0, slugs: [] };
  }
}

function writeLock(lock) {
  ensureState();
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2));
}

function historyHas(url) {
  if (!fs.existsSync(HISTORY_FILE)) return false;
  return fs.readFileSync(HISTORY_FILE, 'utf8').includes(url);
}

function appendHistory(url, slug) {
  fs.appendFileSync(HISTORY_FILE, JSON.stringify({ url, slug, at: new Date().toISOString() }) + '\n');
}

function slugify(title) {
  return String(title || 'story')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function resolveCategory(raw) {
  const slug = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-');
  // Map common mistakes
  if (slug === 'money' || slug === 'hustle' || slug === 'money-hustle' || slug === 'economy') {
    return { slug: 'business', id: CATEGORY_IDS.business };
  }
  if (ALLOWED_CATEGORIES.includes(slug)) {
    return { slug, id: CATEGORY_IDS[slug] };
  }
  // Safe default if model drifts
  return { slug: 'naija-news', id: CATEGORY_IDS['naija-news'] };
}

async function d1(sql, params = []) {
  if (!ACCOUNT || !DB_ID || !TOKEN) throw new Error('Missing Cloudflare D1 secrets');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors || json));
  return json;
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': '9jaBeaconDailyDesk/1.0 (+https://www.9jabeacon.name.ng)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status} ${url}`);
  return res.text();
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 10)) {
    const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/is) || [])[1]?.trim();
    const link = (block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/is) || [])[1]?.trim();
    const desc = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is) || [])[1]?.trim();
    if (title && link) {
      items.push({
        title: title.replace(/<[^>]+>/g, '').trim(),
        link: link.trim(),
        description: (desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500),
      });
    }
  }
  return items;
}

/** Prefer quieter / less competitive stories (avoid mega-headlines if possible). */
function scoreCompetitiveness(item) {
  const t = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  // High competition noise
  if (/\b(breaking|exclusive|shock|viral|just in)\b/.test(t)) score += 3;
  if (/\b(tinubu|trump|biden|messi|ronaldo)\b/.test(t)) score += 2;
  if (/\b(election|kidnap|accident|crash)\b/.test(t)) score += 1;
  // Lower competition signals
  if (/\b(policy|guideline|report|survey|budget|scheme|grant|regulation|export|import|sme|startup|tech|education|health|agriculture)\b/.test(t)) {
    score -= 2;
  }
  if ((item.description || '').length > 400) score -= 1;
  return score;
}

function buildPrompt(item, outlet) {
  return `You are writing for 9jaBeacon, a simple Nigerian news blog (not a newspaper company).

SOURCE EXCERPT (use only this — do not invent facts):
Outlet: ${outlet}
Title: ${item.title}
Excerpt: ${item.description}

TASK:
1. Choose ONE category from this exact list only:
   - naija-news
   - business
   - sports
   - world
2. Write a full original blog article in your own words based on the excerpt.
3. Prefer a clear, less competitive angle (policy impact, practical takeaway, local context) when the story allows it — avoid clickbait.
4. Structure the article yourself for that category (lead, context, what it means, short close). Use simple HTML <p> tags only. Optional one <h2> if useful.
5. Attribute once with "According to ${outlet}". Do NOT say verified, rewritten, AI, multi-source, newsroom, or outlet.
6. Length: about 180–280 words.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "category": "naija-news|business|sports|world",
  "title": "original clear headline under 110 characters",
  "summary": "1–2 sentence summary under 280 characters",
  "content": "<p>...</p><p>...</p>"
}`;
}

function parseModelJson(text) {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed?.title || !parsed?.content || !parsed?.category) {
    throw new Error('JSON missing title, content, or category');
  }
  return {
    category: String(parsed.category),
    title: String(parsed.title).slice(0, 140),
    summary: String(parsed.summary || '').slice(0, 320),
    content: String(parsed.content),
  };
}

async function rewriteWithGemini(item, outlet) {
  if (!GEMINI) return null;
  const prompt = buildPrompt(item, outlet);
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.5,
            },
          }),
        }
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn('[daily-desk] Gemini', model, res.status, errBody.slice(0, 200));
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseModelJson(text);
      console.log('[daily-desk] Gemini ok', model, 'category=', parsed.category);
      return parsed;
    } catch (e) {
      console.warn('[daily-desk] Gemini', model, e.message);
    }
  }
  return null;
}

async function rewriteWithOpenRouter(item, outlet) {
  if (!OPENROUTER) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.9jabeacon.name.ng',
        'X-Title': '9jaBeacon Daily Desk',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        response_format: { type: 'json_object' },
        temperature: 0.5,
        messages: [{ role: 'user', content: buildPrompt(item, outlet) }],
      }),
    });
    if (!res.ok) {
      console.warn('[daily-desk] OpenRouter', res.status);
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const parsed = parseModelJson(text);
    console.log('[daily-desk] OpenRouter ok category=', parsed.category);
    return parsed;
  } catch (e) {
    console.warn('[daily-desk] OpenRouter', e.message);
    return null;
  }
}

/** No local template. Fail hard if models are down. */
async function rewriteArticle(item, outlet) {
  const fromGemini = await rewriteWithGemini(item, outlet);
  if (fromGemini) return fromGemini;
  const fromOr = await rewriteWithOpenRouter(item, outlet);
  if (fromOr) return fromOr;
  throw new Error('No AI model available (Gemini and OpenRouter both failed)');
}

async function main() {
  console.log('[daily-desk] start max=', MAX);
  console.log('[daily-desk] secrets', {
    account: Boolean(ACCOUNT),
    db: Boolean(DB_ID),
    token: Boolean(TOKEN),
    gemini: Boolean(GEMINI),
    openrouter: Boolean(OPENROUTER),
  });

  if (!GEMINI && !OPENROUTER) {
    console.error('[daily-desk] fatal: no GEMINI_API_KEY or OPENROUTER_API_KEY');
    process.exit(1);
  }

  ensureState();
  let lock = readLock();
  const day = todayUtc();
  if (lock.date !== day) {
    lock = { date: day, count: 0, slugs: [] };
    writeLock(lock);
  }
  if (lock.count >= MAX) {
    console.log(`[daily-desk] quota full for ${day}: ${lock.count}/${MAX}`);
    process.exit(0);
  }
  const remaining = MAX - lock.count;

  const candidates = [];
  for (const feed of RSS_FEEDS) {
    try {
      const xml = await fetchRss(feed.url);
      for (const it of parseItems(xml)) {
        if (historyHas(it.link)) continue;
        candidates.push({ ...it, outlet: feed.name, score: scoreCompetitiveness(it) });
      }
    } catch (e) {
      console.warn('[daily-desk] feed fail', feed.name, e.message);
    }
  }
  if (!candidates.length) {
    console.log('[daily-desk] no new candidates');
    process.exit(0);
  }

  // Lower score = less competitive → process first
  candidates.sort((a, b) => a.score - b.score);
  console.log(
    '[daily-desk] candidates',
    candidates.length,
    'top:',
    candidates.slice(0, 3).map((c) => `${c.score}:${c.title.slice(0, 50)}`)
  );

  let inserted = 0;
  let lastModelError = null;

  for (const item of candidates) {
    if (inserted >= remaining) break;
    try {
      const rewritten = await rewriteArticle(item, item.outlet);
      const cat = resolveCategory(rewritten.category);
      const baseSlug = slugify(rewritten.title || item.title);
      const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      const id = `art_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();
      const title = String(rewritten.title || item.title).slice(0, 140);
      const summary = String(rewritten.summary || item.description).slice(0, 320);
      const content = String(rewritten.content || '').slice(0, 20000);
      const plainLen = content.replace(/<[^>]+>/g, ' ').trim().length;
      if (plainLen < 150) {
        console.warn('[daily-desk] skip thin', title);
        continue;
      }

      await d1(
        `INSERT INTO articles (id, slug, title, summary, content, category_id, author_name, status, published_at, updated_at, source_name, source_original_url, reading_time_minutes, views_count, is_top_story, is_trending, is_breaking)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
        [
          id,
          slug,
          title,
          summary,
          content,
          cat.id,
          '9jaBeacon',
          now,
          now,
          item.outlet,
          item.link,
          Math.max(1, Math.ceil(plainLen.split(/\s+/).filter(Boolean).length / 200)),
        ]
      );

      appendHistory(item.link, slug);
      lock.count += 1;
      lock.slugs.push(slug);
      writeLock(lock);
      inserted += 1;
      console.log('[daily-desk] inserted', slug, 'category=', cat.slug);

      try {
        const smPath = path.join(ROOT, 'public', 'news-sitemap.xml');
        let sm = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
        const entry = `  <url>
    <loc>https://www.9jabeacon.name.ng/news/${escapeXml(slug)}</loc>
    <lastmod>${escapeXml(now)}</lastmod>
    <news:news>
      <news:publication>
        <news:name>9jaBeacon</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(now)}</news:publication_date>
      <news:title>${escapeXml(title)}</news:title>
    </news:news>
  </url>\n`;
        if (sm.includes('</urlset>')) {
          sm = sm.replace('</urlset>', entry + '</urlset>');
          fs.writeFileSync(smPath, sm);
        }
      } catch (e) {
        console.warn('[daily-desk] sitemap patch', e.message);
      }
    } catch (e) {
      lastModelError = e;
      console.error('[daily-desk] item failed', e.message);
    }
  }

  console.log(`[daily-desk] done inserted=${inserted} day=${day} count=${lock.count}/${MAX}`);

  // Fail the workflow if we had candidates but could not publish because models were down
  if (inserted === 0 && candidates.length > 0 && lastModelError) {
    console.error('[daily-desk] fatal: models failed and no article published');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[daily-desk] fatal', e);
  process.exit(1);
});
