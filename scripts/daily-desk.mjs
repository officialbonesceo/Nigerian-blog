#!/usr/bin/env node
/**
 * 9jaBeacon Daily Desk — strict 1-2/day
 * Images: reject logos -> OG from page -> branded 9jaBeacon card
 * Articles: 420-650 words; unique summaries
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, 'desk', 'state');
const LOCK_FILE = path.join(STATE_DIR, 'daily-lock.json');
const HISTORY_FILE = path.join(STATE_DIR, 'published-urls.jsonl');
const SOCIAL_PENDING = path.join(STATE_DIR, 'social-pending');
const SOCIAL_HISTORY = path.join(STATE_DIR, 'social-history.jsonl');

const MAX = Math.min(2, Math.max(1, parseInt(process.env.MAX_ARTICLES || '1', 10) || 1));
const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const DB_ID = (process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
const TOKEN = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const GEMINI = (process.env.GEMINI_API_KEY || '').trim();
const OPENROUTER = (process.env.OPENROUTER_API_KEY || '').trim();
const INDEXNOW_KEY = (process.env.INDEXNOW_KEY || '70f499f3fc3c41878432eab0610cb2cf').trim();

const ALLOWED_CATEGORIES = ['naija-news', 'business', 'sports', 'world'];
const CATEGORY_IDS = { 'naija-news': 'cat_naija_news', business: 'cat_money_hustle', sports: 'cat_sports', world: 'cat_world' };
const CATEGORY_SEO = {
  'naija-news': { section: 'Nigeria News', keywords: ['Nigeria news', 'Naija news', 'Lagos', 'Abuja', 'politics Nigeria'] },
  business: { section: 'Business', keywords: ['Nigeria business', 'Naira', 'CBN', 'economy', 'markets Nigeria'] },
  sports: { section: 'Sports', keywords: ['Nigeria sports', 'NPFL', 'Super Eagles', 'football Nigeria'] },
  world: { section: 'World', keywords: ['world news', 'international', 'Africa news'] },
};
const RSS_FEEDS = [
  { name: 'Punch', url: 'https://punchng.com/feed/' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed' },
  { name: 'BusinessDay', url: 'https://businessday.ng/feed/' },
];
const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-flash-latest'];
const OPENROUTER_MODELS = ['google/gemini-2.5-flash-preview', 'google/gemini-flash-1.5', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-7b-instruct'];
const LOGO_REJECT = /logo|favicon|sprite|icon[-_/]|brand[-_/]|site[-_]?header|masthead|watermark|badge|avatar|placeholder|default[-_]?img|wp-content\/uploads\/.*logo/i;
const SITE_BASE = 'https://www.9jabeacon.name.ng';

function todayUtc() { return new Date().toISOString().slice(0, 10); }
function ensureState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(SOCIAL_PENDING, { recursive: true });
  if (!fs.existsSync(LOCK_FILE)) fs.writeFileSync(LOCK_FILE, JSON.stringify({ date: '', count: 0, slugs: [] }, null, 2));
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '');
  if (!fs.existsSync(SOCIAL_HISTORY)) fs.writeFileSync(SOCIAL_HISTORY, '');
}
function readLock() {
  ensureState();
  try { return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')); } catch { return { date: '', count: 0, slugs: [] }; }
}
function writeLock(lock) { ensureState(); fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2)); }
function historyHas(url) { return fs.existsSync(HISTORY_FILE) && fs.readFileSync(HISTORY_FILE, 'utf8').includes(url); }
function appendHistory(url, slug) { fs.appendFileSync(HISTORY_FILE, JSON.stringify({ url, slug, at: new Date().toISOString() }) + '\n'); }
function socialAlreadyQueued(slug) {
  const hist = fs.existsSync(SOCIAL_HISTORY) ? fs.readFileSync(SOCIAL_HISTORY, 'utf8') : '';
  if (hist.includes(`"slug":"${slug}"`) || hist.includes(slug)) return true;
  const files = fs.existsSync(SOCIAL_PENDING) ? fs.readdirSync(SOCIAL_PENDING) : [];
  return files.some((f) => f.includes(slug));
}
function queueSocialShare(payload) {
  ensureState();
  if (socialAlreadyQueued(payload.slug)) { console.log('[daily-desk] social dedupe skip', payload.slug); return; }
  fs.writeFileSync(path.join(SOCIAL_PENDING, `${payload.slug}.json`), JSON.stringify(payload, null, 2));
}
function slugify(title) {
  return String(title || 'story').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
}
function escapeXml(s) {
  return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}
function resolveCategory(raw) {
  const slug = String(raw || '').toLowerCase().trim().replace(/_/g, '-');
  if (slug === 'money' || slug === 'hustle' || slug === 'money-hustle' || slug === 'economy') return { slug: 'business', id: CATEGORY_IDS.business };
  if (ALLOWED_CATEGORIES.includes(slug)) return { slug, id: CATEGORY_IDS[slug] };
  return { slug: 'naija-news', id: CATEGORY_IDS['naija-news'] };
}
function normalizeFaq(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = String(item.question || item.q || '').replace(/<[^>]*>/g, '').trim();
    const a = String(item.answer || item.a || '').replace(/<[^>]*>/g, '').trim();
    if (q.length < 8 || a.length < 20) continue;
    out.push({ question: q, answer: a });
    if (out.length >= 4) break;
  }
  return out;
}
function buildFaqHtml(items) {
  const faq = normalizeFaq(items);
  if (faq.length < 2) return '';
  const details = faq.map((item, i) => `\n<details class="group rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">\n  <summary class="flex items-center justify-between gap-3 p-3.5 cursor-pointer list-none select-none">\n    <span class="flex items-center gap-2.5 text-left">\n      <span class="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">${i + 1}</span>\n      <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">${escapeHtml(item.question)}</span>\n    </span>\n  </summary>\n  <div class="px-4 pb-4 pt-1 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-700/60">\n    <p>${escapeHtml(item.answer)}</p>\n  </div>\n</details>`).join('\n');
  return `\n<section class="article-faq-block my-8 not-prose" data-article-faq="1" aria-label="Article FAQ">\n  <div class="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">\n    <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">\n      <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">Reader FAQ</h2>\n      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Quick answers from this report</p>\n    </div>\n    <div class="p-4 sm:p-5 space-y-3">${details}</div>\n  </div>\n</section>`.trim();
}
async function d1(sql, params = []) {
  if (!ACCOUNT || !DB_ID || !TOKEN) throw new Error('Missing Cloudflare D1 secrets');
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors || json));
  return json;
}
async function fetchRss(url) {
  const res = await fetch(url, { headers: { 'User-Agent': '9jaBeaconDailyDesk/1.0 (+https://www.9jabeacon.name.ng)' }, signal: AbortSignal.timeout(20000) });
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
    let image = '';
    const media = block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i) || block.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i);
    if (media) image = media[1].trim();
    if (!image && desc) { const imgTag = desc.match(/<img[^>]+src=["']([^"']+)["']/i); if (imgTag) image = imgTag[1].trim(); }
    if (title && link) {
      items.push({ title: title.replace(/<[^>]+>/g, '').trim(), link: link.trim(), description: (desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500), image: image.startsWith('http') ? image : '' });
    }
  }
  return items;
}
function brandedCover(title, categorySlug) {
  const cat = categorySlug || 'naija-news';
  const catId = cat === 'business' ? 'cat_money_hustle' : cat === 'sports' ? 'cat_sports' : cat === 'world' ? 'cat_world' : 'cat_naija_news';
  const q = new URLSearchParams({ title: String(title || '9jaBeacon').slice(0, 90), cat: catId, source: '9jaBeacon' });
  return { url: `${SITE_BASE}/api/images/card.svg?${q.toString()}`, caption: String(title || '9jaBeacon').slice(0, 120), credit: '9jaBeacon' };
}
function isUsableImageUrl(u) {
  if (!u || typeof u !== 'string') return false;
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.(svg)(\?|$)/i.test(u)) return false;
  if (LOGO_REJECT.test(u)) return false;
  if (/[?&](w|width|h|height)=(1|2|16|32|48|64)\b/i.test(u)) return false;
  return true;
}
async function fetchOgImage(pageUrl) {
  try {
    const res = await fetch(pageUrl, { headers: { 'User-Agent': '9jaBeaconDailyDesk/1.0 (+https://www.9jabeacon.name.ng)', Accept: 'text/html' }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!res.ok) return '';
    const html = await res.text();
    const og = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i) || html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!og) return '';
    let u = og[1].trim();
    if (u.startsWith('//')) u = 'https:' + u;
    return isUsableImageUrl(u) ? u : '';
  } catch { return ''; }
}
async function resolveArticleImage(item, title, categorySlug) {
  if (isUsableImageUrl(item.image)) return { url: item.image, caption: String(title).slice(0, 120), credit: `${item.outlet || 'Source'} photo` };
  if (item.link) { const og = await fetchOgImage(item.link); if (og) return { url: og, caption: String(title).slice(0, 120), credit: `${item.outlet || 'Source'} / page` }; }
  return brandedCover(title, categorySlug);
}
function scoreCompetitiveness(item) {
  const t = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  if (/\b(breaking|exclusive|shock|viral|just in)\b/.test(t)) score += 3;
  if (/\b(tinubu|trump|biden|messi|ronaldo)\b/.test(t)) score += 2;
  if (/\b(policy|guideline|report|survey|budget|scheme|grant|regulation|export|sme|startup|tech|education|health|agriculture)\b/.test(t)) score -= 2;
  if ((item.description || '').length > 400) score -= 1;
  return score;
}
function buildPrompt(item, outlet) {
  return `You are writing for 9jaBeacon, a simple Nigerian news blog.\n\nSOURCE (facts only from this):\nOutlet: ${outlet}\nTitle: ${item.title}\nExcerpt: ${item.description}\n\nTASK:\n1. Choose ONE category from: naija-news | business | sports | world\n2. Write an original article in your own words (420-650 words). Use several <p> tags and 1-2 <h2> section headings. Cover what happened, why it matters, and what readers should know next.\n3. Prefer a clear, less competitive angle when possible.\n4. Attribute once: "According to ${outlet}". Never say verified, rewritten, AI, multi-source, or newsroom.\n5. Add 2-4 FAQ pairs grounded only in the excerpt.\n6. Add 4-8 seo_keywords relevant to the chosen category and story.\n\nReturn ONLY valid JSON (no markdown fences):\n{\n  "category": "naija-news|business|sports|world",\n  "title": "headline under 110 chars",\n  "summary": "2-3 unique sentences (140-260 chars) about THIS story only — never generic blog promo text",\n  "content": "<p>...</p>",\n  "faq": [{"question": "...", "answer": "..."}],\n  "seo_keywords": ["keyword1", "keyword2"]\n}`;
}
function parseModelJson(text) {
  let cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  try { const parsed = JSON.parse(cleaned); if (parsed?.title && parsed?.content && parsed?.category) return normalizeModelPayload(parsed); } catch { /* */ }
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try { const parsed = JSON.parse(slice); if (parsed?.title && parsed?.content && parsed?.category) return normalizeModelPayload(parsed); }
    catch (e) { try { const parsed = JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); if (parsed?.title && parsed?.content && parsed?.category) return normalizeModelPayload(parsed); } catch (e2) { throw new Error(`JSON parse failed: ${e2.message}`); } }
  }
  throw new Error('No valid JSON object with title/content/category');
}
function normalizeModelPayload(parsed) {
  return { category: String(parsed.category), title: String(parsed.title).slice(0, 140), summary: String(parsed.summary || '').slice(0, 320), content: String(parsed.content), faq: normalizeFaq(parsed.faq), seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 10) : [] };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function rewriteWithGemini(item, outlet) {
  if (!GEMINI) return null;
  const prompt = buildPrompt(item, outlet);
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.5 } }) });
      if (!res.ok) { if (res.status === 429) await sleep(1500); continue; }
      const data = await res.json();
      try { const parsed = parseModelJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || ''); console.log('[daily-desk] Gemini ok', model, parsed.category); return parsed; } catch (pe) { console.warn('[daily-desk] Gemini JSON', pe.message); }
    } catch (e) { console.warn('[daily-desk] Gemini', model, e.message); }
  }
  return null;
}
async function rewriteWithOpenRouter(item, outlet) {
  if (!OPENROUTER) return null;
  const prompt = buildPrompt(item, outlet);
  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${OPENROUTER}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://www.9jabeacon.name.ng', 'X-Title': '9jaBeacon Daily Desk' }, body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0.5, messages: [{ role: 'user', content: prompt }] }) });
      if (!res.ok) continue;
      const data = await res.json();
      try { const parsed = parseModelJson(data?.choices?.[0]?.message?.content || ''); console.log('[daily-desk] OpenRouter ok', model); return parsed; } catch (pe) { console.warn('[daily-desk] OR JSON', pe.message); }
    } catch (e) { console.warn('[daily-desk] OpenRouter', model, e.message); }
  }
  return null;
}
async function rewriteArticle(item, outlet) {
  const fromGemini = await rewriteWithGemini(item, outlet);
  if (fromGemini) return fromGemini;
  const fromOr = await rewriteWithOpenRouter(item, outlet);
  if (fromOr) return fromOr;
  throw new Error('No AI model available');
}
async function pingIndexNow(urlList) {
  if (!INDEXNOW_KEY || !urlList.length) return;
  try {
    await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: 'www.9jabeacon.name.ng', key: INDEXNOW_KEY, keyLocation: `https://www.9jabeacon.name.ng/${INDEXNOW_KEY}.txt`, urlList }) });
    console.log('[daily-desk] IndexNow', urlList.length);
  } catch (e) { console.warn('[daily-desk] IndexNow', e.message); }
}
async function main() {
  console.log('[daily-desk] start max=', MAX);
  if (!GEMINI && !OPENROUTER) { console.error('[daily-desk] fatal: no AI keys'); process.exit(1); }
  ensureState();
  let lock = readLock();
  const day = todayUtc();
  if (lock.date !== day) { lock = { date: day, count: 0, slugs: [] }; writeLock(lock); }
  if (lock.count >= MAX) { console.log(`[daily-desk] quota full ${day}: ${lock.count}/${MAX}`); process.exit(0); }
  const remaining = MAX - lock.count;
  const candidates = [];
  for (const feed of RSS_FEEDS) {
    try {
      const xml = await fetchRss(feed.url);
      for (const it of parseItems(xml)) {
        if (historyHas(it.link)) continue;
        candidates.push({ ...it, outlet: feed.name, score: scoreCompetitiveness(it) });
      }
    } catch (e) { console.warn('[daily-desk] feed fail', feed.name, e.message); }
  }
  if (!candidates.length) { console.log('[daily-desk] no candidates'); process.exit(0); }
  candidates.sort((a, b) => a.score - b.score);
  const tryList = candidates.slice(0, Math.max(3, remaining + 2));
  let inserted = 0, lastModelError = null;
  const publishedUrls = [];
  for (const item of tryList) {
    if (inserted >= remaining) break;
    try {
      const rewritten = await rewriteArticle(item, item.outlet);
      const cat = resolveCategory(rewritten.category);
      const seo = CATEGORY_SEO[cat.slug] || CATEGORY_SEO['naija-news'];
      const keywords = [...seo.keywords, ...rewritten.seo_keywords].filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);
      const faqHtml = buildFaqHtml(rewritten.faq);
      let content = String(rewritten.content || '').slice(0, 18000);
      if (faqHtml) content = `${content}\n\n${faqHtml}`;
      content += `\n<!-- seo-keywords: ${keywords.map(escapeHtml).join(', ')} -->`;
      content += `\n<!-- article-section: ${escapeHtml(seo.section)} -->`;
      const baseSlug = slugify(rewritten.title || item.title);
      const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      const id = `art_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();
      const title = String(rewritten.title || item.title).slice(0, 140);
      const summary = String(rewritten.summary || item.description).slice(0, 320);
      const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const plainLen = plainText.length;
      const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
      if (plainLen < 600) { console.warn('[daily-desk] skip thin', title, plainLen); continue; }
      const image = await resolveArticleImage(item, title, cat.slug);
      await d1(`INSERT INTO articles (id, slug, title, summary, content, category_id, author_name, status, published_at, updated_at, source_name, source_original_url, reading_time_minutes, views_count, is_top_story, is_trending, is_breaking, image_url, image_caption, image_credit) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?)`, [id, slug, title, summary, content, cat.id, '9jaBeacon', now, now, item.outlet, item.link, Math.max(1, Math.ceil(wordCount / 200)), image.url, image.caption, image.credit]);
      console.log('[daily-desk] image', image.url.slice(0, 90), image.credit);
      appendHistory(item.link, slug);
      lock.count += 1; lock.slugs.push(slug); writeLock(lock); inserted += 1;
      const pageUrl = `https://www.9jabeacon.name.ng/news/${slug}`;
      publishedUrls.push(pageUrl);
      queueSocialShare({ slug, title, summary, url: pageUrl, category: cat.slug, keywords, source: item.outlet, queued_at: now });
      console.log('[daily-desk] inserted', slug, cat.slug, 'words~', wordCount);
      try {
        const smPath = path.join(ROOT, 'public', 'news-sitemap.xml');
        let sm = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
        const entry = `  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <news:news>\n      <news:publication>\n        <news:name>9jaBeacon</news:name>\n        <news:language>en</news:language>\n      </news:publication>\n      <news:publication_date>${escapeXml(now)}</news:publication_date>\n      <news:title>${escapeXml(title)}</news:title>\n    </news:news>\n  </url>\n`;
        if (sm.includes('</urlset>')) { sm = sm.replace('</urlset>', entry + '</urlset>'); fs.writeFileSync(smPath, sm); }
      } catch (e) { console.warn('[daily-desk] sitemap', e.message); }
      if (inserted >= remaining) break;
    } catch (e) { lastModelError = e; console.error('[daily-desk] item failed', e.message); }
  }
  if (publishedUrls.length) await pingIndexNow(publishedUrls);
  console.log(`[daily-desk] done inserted=${inserted} day=${day} count=${lock.count}/${MAX}`);
  if (inserted === 0 && tryList.length > 0 && lastModelError) { console.error('[daily-desk] fatal: models failed'); process.exit(1); }
}
main().catch((e) => { console.error('[daily-desk] crash', e); process.exit(1); });
