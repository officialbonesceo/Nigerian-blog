#!/usr/bin/env node
/**
 * File-based social syndication — NO database reads or writes.
 * Reads desk/state/social-pending/*.json
 * Dedupes via social-history.jsonl
 * Bluesky: facets so URLs are clickable + optional external card
 * Tumblr: posts when secrets are present
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const PENDING = path.join(ROOT, 'desk', 'state', 'social-pending');
const HISTORY = path.join(ROOT, 'desk', 'state', 'social-history.jsonl');

const BLUESKY_ID = (process.env.BLUESKY_IDENTIFIER || '').trim();
const BLUESKY_PASS = (process.env.BLUESKY_APP_PASSWORD || '').trim();
const BLUESKY_ON = String(process.env.BLUESKY_AUTO_POST_ENABLED || 'true').toLowerCase() !== 'false';
const TUMBLR_ON = String(process.env.TUMBLR_AUTO_POST_ENABLED || 'true').toLowerCase() !== 'false';

const SITE = 'https://www.9jabeacon.name.ng';

function ensure() {
  fs.mkdirSync(PENDING, { recursive: true });
  if (!fs.existsSync(HISTORY)) fs.writeFileSync(HISTORY, '');
}

function historyHas(slug, url) {
  const body = fs.readFileSync(HISTORY, 'utf8');
  if (slug && body.includes(`"slug":"${slug}"`)) return true;
  if (url && body.includes(url)) return true;
  return false;
}

function appendHistory(row) {
  fs.appendFileSync(HISTORY, JSON.stringify(row) + '\n');
}

/** Always full https://www… so clients + facets resolve cleanly */
function normalizeArticleUrl(raw, slug) {
  if (slug) return `${SITE}/news/${slug}`;
  let u = String(raw || '').trim();
  if (!u) return SITE;
  u = u.replace(/^http:\/\//i, 'https://');
  u = u.replace(/^https?:\/\/(?:www\.)?9jabeacon\.name\.ng/i, SITE);
  if (u.startsWith('www.')) u = 'https://' + u;
  if (!/^https?:\/\//i.test(u)) u = SITE + (u.startsWith('/') ? u : '/' + u);
  return u;
}

function utf8Len(str) {
  return Buffer.byteLength(str, 'utf8');
}

/** Bluesky requires UTF-8 byte facets for clickable links */
function extractLinkFacets(text) {
  const facets = [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0];
    const cleanUrl = rawUrl.replace(/[.,!?;:]+$/, '');
    const byteStart = utf8Len(text.slice(0, match.index));
    const byteEnd = byteStart + utf8Len(cleanUrl);
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: cleanUrl }],
    });
  }
  const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_]+)/g;
  while ((match = tagRegex.exec(text)) !== null) {
    const full = match[0];
    const tagWithHash = match[1];
    const lead = full.length - tagWithHash.length;
    const idx = match.index + lead;
    const byteStart = utf8Len(text.slice(0, idx));
    const byteEnd = byteStart + utf8Len(tagWithHash);
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: tagWithHash.slice(1) }],
    });
  }
  return facets;
}

function buildPostText(item) {
  const url = normalizeArticleUrl(item.url, item.slug);
  const title = String(item.title || '9jaBeacon').slice(0, 120);
  const summary = String(item.summary || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  let text = summary
    ? `${title}\n\n${summary}\n\n${url}\n\n#Nigeria #NaijaNews`
    : `${title}\n\n${url}\n\n#Nigeria #NaijaNews`;
  if (text.length > 300) {
    text = `${title.slice(0, 80)}\n\n${url}\n\n#Nigeria #NaijaNews`.slice(0, 300);
  }
  return { text, url };
}

async function blueskyPost(text, cardUrl, title, summary) {
  if (!BLUESKY_ON || !BLUESKY_ID || !BLUESKY_PASS) {
    console.log('[social] Bluesky skipped (disabled or missing secrets)');
    return { ok: false, reason: 'skipped' };
  }
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: BLUESKY_ID, password: BLUESKY_PASS }),
  });
  if (!sessionRes.ok) {
    const t = await sessionRes.text();
    throw new Error(`Bluesky session ${sessionRes.status}: ${t.slice(0, 200)}`);
  }
  const session = await sessionRes.json();
  const facets = extractLinkFacets(text);
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };
  if (facets.length) record.facets = facets;
  // External link card (makes URL area clearly tappable)
  if (cardUrl) {
    record.embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: cardUrl,
        title: String(title || '9jaBeacon').slice(0, 200),
        description: String(summary || '').slice(0, 300),
      },
    };
  }
  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });
  if (!postRes.ok) {
    const t = await postRes.text();
    throw new Error(`Bluesky post ${postRes.status}: ${t.slice(0, 200)}`);
  }
  const data = await postRes.json();
  return { ok: true, uri: data.uri };
}

function rfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauth1Header({ method, url, consumerKey, consumerSecret, token, tokenSecret, bodyParams }) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...bodyParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join('&');
  const base = [method.toUpperCase(), rfc3986(url.split('?')[0]), rfc3986(paramString)].join('&');
  const key = `${rfc3986(consumerSecret)}&${rfc3986(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  const header =
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(', ');
  const body = Object.keys(bodyParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(bodyParams[k])}`)
    .join('&');
  return { header, body };
}

async function tumblrPost(item, pageUrl) {
  if (!TUMBLR_ON) {
    console.log('[social] Tumblr disabled');
    return { ok: false, reason: 'disabled' };
  }
  const blogRaw = (process.env.TUMBLR_BLOG_IDENTIFIER || process.env.TUMBLR_BLOG_NAME || '').trim();
  const consumerKey = (process.env.TUMBLR_CONSUMER_KEY || '').trim();
  const consumerSecret = (process.env.TUMBLR_CONSUMER_SECRET || '').trim();
  const token = (process.env.TUMBLR_TOKEN || process.env.TUMBLR_ACCESS_TOKEN || '').trim();
  const tokenSecret = (process.env.TUMBLR_TOKEN_SECRET || '').trim();
  if (!blogRaw) {
    console.log('[social] Tumblr skipped (no TUMBLR_BLOG_IDENTIFIER)');
    return { ok: false, reason: 'missing blog' };
  }
  if (!token && !consumerKey) {
    console.log('[social] Tumblr skipped (no credentials)');
    return { ok: false, reason: 'missing secrets' };
  }
  const blogId = blogRaw.includes('.') ? blogRaw.replace(/^https?:\/\//, '').replace(/\/+$/, '') : `${blogRaw}.tumblr.com`;
  const title = String(item.title || '9jaBeacon');
  const summary = String(item.summary || '').replace(/<[^>]+>/g, '').slice(0, 280);
  const bodyHtml = `<h2><a href="${pageUrl}">${title.replace(/</g, '')}</a></h2><p>${summary.replace(/</g, '')}</p><p><a href="${pageUrl}">Read on 9jaBeacon →</a></p>`;
  const bodyParams = {
    type: 'text',
    title,
    body: bodyHtml,
    tags: 'Nigeria,NaijaNews,9jaBeacon',
    format: 'html',
    canonical_url: pageUrl,
  };
  const endpoint = `https://api.tumblr.com/v2/blog/${blogId}/post`;
  // OAuth 1.0a first
  if (consumerKey && consumerSecret && token && tokenSecret) {
    const { header, body } = oauth1Header({
      method: 'POST',
      url: endpoint,
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
      bodyParams,
    });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: header },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.response?.id || data?.meta?.status === 201)) {
      const postId = data?.response?.id;
      return { ok: true, url: `https://${blogId}/post/${postId}` };
    }
    console.warn('[social] Tumblr OAuth1 fail', res.status, JSON.stringify(data).slice(0, 180));
  }
  // Bearer fallback
  if (token) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.response?.id || data?.meta?.status === 201)) {
      const postId = data?.response?.id;
      return { ok: true, url: `https://${blogId}/post/${postId}` };
    }
    console.warn('[social] Tumblr bearer fail', res.status, JSON.stringify(data).slice(0, 180));
    return { ok: false, reason: `http ${res.status}` };
  }
  return { ok: false, reason: 'auth failed' };
}

async function processOne(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let item;
  try {
    item = JSON.parse(raw);
  } catch (e) {
    console.error('[social] bad json', filePath, e.message);
    fs.unlinkSync(filePath);
    return;
  }
  const slug = item.slug || '';
  const pageUrl = normalizeArticleUrl(item.url, slug);
  item.url = pageUrl;
  if (historyHas(slug, pageUrl)) {
    console.log('[social] dedupe history', slug);
    fs.unlinkSync(filePath);
    return;
  }

  const { text } = buildPostText(item);
  let bluesky = { ok: false };
  let tumblr = { ok: false };
  try {
    bluesky = await blueskyPost(text, pageUrl, item.title, item.summary);
    if (bluesky.ok) console.log('[social] Bluesky ok', bluesky.uri);
  } catch (e) {
    console.error('[social] Bluesky fail', e.message);
  }
  try {
    tumblr = await tumblrPost(item, pageUrl);
    if (tumblr.ok) console.log('[social] Tumblr ok', tumblr.url);
  } catch (e) {
    console.error('[social] Tumblr fail', e.message);
  }

  appendHistory({
    slug,
    url: pageUrl,
    at: new Date().toISOString(),
    bluesky: bluesky.ok || false,
    tumblr: tumblr.ok || false,
    title: item.title,
  });
  fs.unlinkSync(filePath);
  console.log('[social] done', slug);
}

async function main() {
  ensure();
  const files = fs
    .readdirSync(PENDING)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .slice(0, 5);
  if (!files.length) {
    console.log('[social] no pending');
    return;
  }
  console.log('[social] pending', files.length);
  for (const f of files) {
    await processOne(path.join(PENDING, f));
  }
}

main().catch((e) => {
  console.error('[social] fatal', e);
  process.exit(1);
});
