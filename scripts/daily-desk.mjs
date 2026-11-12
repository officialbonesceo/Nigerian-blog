#!/usr/bin/env node
/**
 * 9jaBeacon Daily Desk — strict 1–2/day
 * Category is NEVER chosen by the model — only from fixed rules:
 *   sports | business | world | naija-news
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

const RSS_FEEDS = [
  { name: 'Punch', url: 'https://punchng.com/feed/', hint: 'naija-news' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', hint: 'naija-news' },
  { name: 'BusinessDay', url: 'https://businessday.ng/feed/', hint: 'business' },
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

/** Fixed-category classifier — AI never picks this. */
function pickCategory(title, description, feedHint) {
  const t = `${title || ''} ${description || ''}`.toLowerCase();

  const sports =
    /\b(match|league|player|coach|tournament|afcon|npfl|fifa|uefa|epl|premier league|champions league|la liga|serie a|bundesliga|goal|transfer|super eagles|osimhen|football|soccer|stadium|fixture|boxing|nba|athletics)\b/;
  const business =
    /\b(cbn|naira|ngx|inflation|bank|fintech|gdp|forex|fx|crude|oil|refinery|dangote|nnpc|revenue|tax|interest rate|stock|shares|market|bonds|startup|economy|economic|company|investment|manufactur)\b/;
  const world =
    /\b(ukraine|gaza|israel|palestine|washington|white house|kremlin|putin|zelensky|biden|trump|united nations|nato|china|taiwan|foreign|europe|asia)\b/;
  const nigeria =
    /\b(nigeria|nigerian|lagos|abuja|kano|tinubu|inec|senate|governor|rivers|port harcourt)\b/;

  if (sports.test(t) && !/\b(olori|traditional ruler|minister|inec|senate)\b/.test(t)) {
    return { id: 'cat_sports', slug: 'sports' };
  }
  if (world.test(t) && !nigeria.test(title || '')) {
    return { id: 'cat_world', slug: 'world' };
  }
  if (business.test(t) && !/\b(tinubu|inec|police|efcc|court|election|kidnap)\b/.test(t)) {
    return { id: 'cat_money_hustle', slug: 'business' };
  }
  if (feedHint === 'business') return { id: 'cat_money_hustle', slug: 'business' };
  if (feedHint === 'sports') return { id: 'cat_sports', slug: 'sports' };
  if (feedHint === 'world') return { id: 'cat_world', slug: 'world' };
  return { id: 'cat_naija_news', slug: 'naija-news' };
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

function localRewrite(item, outlet) {
  const summary = (item.description || item.title).slice(0, 280);
  const body = item.description || item.title;
  const content = [
    `<p>According to ${outlet}, ${body.slice(0, 700)}</p>`,
    `<p>This report is based on public coverage from ${outlet}. Figures and details may be updated by the original publisher.</p>`,
  ].join('');
  return {
    title: item.title.slice(0, 110),
    summary,
    content,
  };
}

async function rewriteWithGemini(item, outlet) {
  if (!GEMINI) return null;
  const prompt = `Write a short news blog post for 9jaBeacon.
Rules:
- Use your own words only from the excerpt
- Attribute with "According to ${outlet}"
- Do NOT say verified, rewritten, AI, multi-source, or newsroom
- 150-220 words as simple HTML <p> paragraphs only
- Return JSON: {"title":"...","summary":"...","content":"..."}
- Do NOT choose or include a category field

Title: ${item.title}
Excerpt: ${item.description}`;

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
              temperature: 0.4,
            },
          }),
        }
      );
      if (!res.ok) {
        console.warn('[daily-desk] Gemini', model, res.status);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
      if (parsed?.title && parsed?.content) {
        console.log('[daily-desk] Gemini ok', model);
        return {
          title: String(parsed.title).slice(0, 140),
          summary: String(parsed.summary || item.description).slice(0, 320),
          content: String(parsed.content),
        };
      }
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
        messages: [
          {
            role: 'user',
            content: `Write a short news blog post for 9jaBeacon from this excerpt only. Own words. Attribute "According to ${outlet}". No verified/AI claims. JSON keys: title, summary, content (HTML p tags, 150-220 words). No category field.\nTitle: ${item.title}\nExcerpt: ${item.description}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('[daily-desk] OpenRouter', res.status);
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '').trim());
    if (parsed?.title && parsed?.content) {
      console.log('[daily-desk] OpenRouter ok');
      return {
        title: String(parsed.title).slice(0, 140),
        summary: String(parsed.summary || item.description).slice(0, 320),
        content: String(parsed.content),
      };
    }
  } catch (e) {
    console.warn('[daily-desk] OpenRouter', e.message);
  }
  return null;
}

async function rewriteArticle(item, outlet) {
  return (
    (await rewriteWithGemini(item, outlet)) ||
    (await rewriteWithOpenRouter(item, outlet)) ||
    localRewrite(item, outlet)
  );
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
        candidates.push({ ...it, outlet: feed.name, hint: feed.hint });
      }
    } catch (e) {
      console.warn('[daily-desk] feed fail', feed.name, e.message);
    }
  }
  if (!candidates.length) {
    console.log('[daily-desk] no new candidates');
    process.exit(0);
  }
  console.log('[daily-desk] candidates', candidates.length);

  let inserted = 0;
  for (const item of candidates) {
    if (inserted >= remaining) break;
    try {
      // Category FIRST — deterministic, never from model
      const cat = pickCategory(item.title, item.description, item.hint);
      const rewritten = await rewriteArticle(item, item.outlet);
      const baseSlug = slugify(rewritten.title || item.title);
      const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      const id = `art_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();
      const title = String(rewritten.title || item.title).slice(0, 140);
      const summary = String(rewritten.summary || item.description).slice(0, 320);
      const content = String(rewritten.content || '').slice(0, 20000);
      if (content.replace(/<[^>]+>/g, ' ').trim().length < 120) {
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
          Math.max(1, Math.ceil(content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 200)),
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
      console.error('[daily-desk] item failed', e.message);
    }
  }

  console.log(`[daily-desk] done inserted=${inserted} day=${day} count=${lock.count}/${MAX}`);
  if (inserted === 0) process.exitCode = 0;
}

main().catch((e) => {
  console.error('[daily-desk] fatal', e);
  process.exit(1);
});
