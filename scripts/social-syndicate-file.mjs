#!/usr/bin/env node
/**
 * File-based social syndication — NO database reads or writes.
 * Reads desk/state/social-pending/*.json
 * Dedupes via social-history.jsonl + pending filenames
 * Posts to Bluesky (if secrets) and logs Tumblr intent
 * Deletes pending file after successful attempt + appends history
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PENDING = path.join(ROOT, 'desk', 'state', 'social-pending');
const HISTORY = path.join(ROOT, 'desk', 'state', 'social-history.jsonl');

const BLUESKY_ID = (process.env.BLUESKY_IDENTIFIER || '').trim();
const BLUESKY_PASS = (process.env.BLUESKY_APP_PASSWORD || '').trim();
const BLUESKY_ON = String(process.env.BLUESKY_AUTO_POST_ENABLED || 'true').toLowerCase() !== 'false';
const TUMBLR_ON = String(process.env.TUMBLR_AUTO_POST_ENABLED || 'false').toLowerCase() === 'true';

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

async function blueskyPost(text) {
  if (!BLUESKY_ON || !BLUESKY_ID || !BLUESKY_PASS) {
    console.log('[social] Bluesky skipped (disabled or missing secrets)');
    return { ok: false, reason: 'skipped' };
  }
  // Create session
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
  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: text.slice(0, 300),
        createdAt: new Date().toISOString(),
      },
    }),
  });
  if (!postRes.ok) {
    const t = await postRes.text();
    throw new Error(`Bluesky post ${postRes.status}: ${t.slice(0, 200)}`);
  }
  const data = await postRes.json();
  return { ok: true, uri: data.uri };
}

function buildPostText(item) {
  const bits = [item.title, item.url].filter(Boolean);
  let text = bits.join('\n\n');
  if (item.summary) {
    const short = String(item.summary).slice(0, 120);
    text = `${item.title}\n\n${short}\n\n${item.url}`;
  }
  return text.slice(0, 300);
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
  const url = item.url || '';
  if (historyHas(slug, url)) {
    console.log('[social] dedupe history', slug);
    fs.unlinkSync(filePath);
    return;
  }

  const text = buildPostText(item);
  let bluesky = { ok: false };
  try {
    bluesky = await blueskyPost(text);
    if (bluesky.ok) console.log('[social] Bluesky ok', bluesky.uri);
  } catch (e) {
    console.error('[social] Bluesky fail', e.message);
  }

  if (TUMBLR_ON) {
    console.log('[social] Tumblr enabled but API post not configured in this runner — logged only');
  }

  appendHistory({
    slug,
    url,
    at: new Date().toISOString(),
    bluesky: bluesky.ok || false,
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
    .slice(0, 5); // hard cap per run
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
