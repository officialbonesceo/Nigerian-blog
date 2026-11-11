#!/usr/bin/env node
/**
 * 9jaBeacon Daily Desk — NEW engine (2026-11-11)
 * - Hard max 1–2 articles per calendar day (UTC)
 * - File lock in desk/state/ (no DB scan for dedupe of daily quota)
 * - Category: business | naija-news | sports | world only (never money/hustle)
 * - Old content-delivery / automated-ingest-pipeline stay disabled
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
const TOKEN = (process.env.CLOUDFLARE_D1_API_TOKEN || '').trim();
const GEMINI = (process.env.GEMINI_API_KEY || '').trim();

const RSS_FEEDS = [
  { name: 'Punch', url: 'https://punchng.com/feed/', category: 'naija-news' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', category: 'naija-news' },
  { name: 'BusinessDay', url: 'https://businessday.ng/feed/', category: 'business' },
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
  const body = fs.readFileSync(HISTORY_FILE, 'utf8');
  return body.includes(url);
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
    headers: { 'User-Agent': '9jaBeaconDailyDesk/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status} ${url}`);
  return res.text();
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 8)) {
    const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/is) || [])[1]?.trim();
    const link = (block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/is) || [])[1]?.trim();
    const desc = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is) || [])[1]?.trim();
    if (title && link) {
      items.push({
        title: title.replace(/<[^>]+>/g, '').trim(),
        link: link.trim(),
        description: (desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200),
      });
    }
  }
  return items;
}

function normalizeCategory(raw) {
  const c = String(raw || '').toLowerCase();
  if (c.includes('sport')) return { id: 'cat_sports', slug: 'sports' };
  if (c.includes('world') || c.includes('foreign')) return { id: 'cat_world', slug: 'world' };
  if (c.includes('business') || c.includes('money') || c.includes('hustle') || c.includes('market')) {
    return { id: 'cat_money_hustle', slug: 'business' }; // DB id kept; public slug is business
  }
  return { id: 'cat_naija_news', slug: 'naija-news' };
}

async function rewriteWithGemini(item, outlet) {
  if (!GEMINI) {
    // No AI: short original-language summary attribution only
    const summary = item.description.slice(0, 280) || item.title;
    const content = `<p>According to ${outlet}, ${item.description.slice(0, 600) || item.title}</p><p><em>Source: ${outlet}. Details may be updated by the original publisher.</em></p>`;
    return { title: item.title.slice(0, 110), summary, content, category: 'naija-news' };
  }
  const prompt = `Write a short news blog post for 9jaBeacon based only on this excerpt.
Rules: use your own words; attribute "According to ${outlet}"; do not say verified/rewritten/AI; category one of naija-news|business|sports|world; 150-250 words HTML paragraphs only.
Title: ${item.title}
Excerpt: ${item.description}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              content: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['title', 'summary', 'content', 'category'],
          },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
  return parsed;
}

async function main() {
  console.log('[daily-desk] start max=', MAX);
  ensureState();
  let lock = readLock();
  const day = todayUtc();
  if (lock.date !== day) {
    lock = { date: day, count: 0, slugs: [] };
    writeLock(lock);
  }
  if (lock.count >= MAX) {
    console.log(`[daily-desk] quota full for ${day}: ${lock.count}/${MAX} — exit`);
    process.exit(0);
  }
  const remaining = MAX - lock.count;

  const candidates = [];
  for (const feed of RSS_FEEDS) {
    try {
      const xml = await fetchRss(feed.url);
      for (const it of parseItems(xml)) {
        if (historyHas(it.link)) continue;
        candidates.push({ ...it, outlet: feed.name, defaultCat: feed.category });
      }
    } catch (e) {
      console.warn('[daily-desk] feed fail', feed.name, e.message);
    }
  }
  if (!candidates.length) {
    console.log('[daily-desk] no new candidates');
    process.exit(0);
  }

  let inserted = 0;
  for (const item of candidates) {
    if (inserted >= remaining) break;
    try {
      const rewritten = await rewriteWithGemini(item, item.outlet);
      const cat = normalizeCategory(rewritten.category || item.defaultCat);
      const baseSlug = slugify(rewritten.title || item.title);
      const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      const id = `art_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();
      const title = String(rewritten.title || item.title).slice(0, 140);
      const summary = String(rewritten.summary || item.description).slice(0, 320);
      const content = String(rewritten.content || '').slice(0, 20000);
      if (content.length < 200) {
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
          Math.max(1, Math.ceil(content.split(/\s+/).length / 200)),
        ]
      );

      appendHistory(item.link, slug);
      lock.count += 1;
      lock.slugs.push(slug);
      writeLock(lock);
      inserted += 1;
      console.log('[daily-desk] inserted', slug, cat.slug);

      // patch news-sitemap (append one url, escape XML)
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
      console.error('[daily-desk] item failed', e.message);
    }
  }

  console.log(`[daily-desk] done inserted=${inserted} day=${day} count=${lock.count}/${MAX}`);
}

main().catch((e) => {
  console.error('[daily-desk] fatal', e);
  process.exit(1);
});
