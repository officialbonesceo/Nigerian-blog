/**
 * 9jaBeacon Bluesky engagement (follows + likes) — Nigerian niche only.
 * Hard limits: max 30 follows / UTC day, max 2 follows / run, max 1 like / run.
 * Strict bio/handle filters so we never follow random foreigners from weak queries (e.g. "Abuja").
 */
import * as fs from 'fs';
import * as path from 'path';

const BSKY = 'https://bsky.social';
const MAX_FOLLOWS_PER_DAY = 30;
const MAX_FOLLOWS_PER_RUN = 2;
const MAX_LIKES_PER_RUN = 1;

/** Prefer multi-word Nigerian queries so search is less noisy than single city names. */
const NICHE_QUERIES = [
  'Nigeria news',
  'Naija news',
  'Nigerian politics',
  'CBN Naira',
  'Super Eagles',
  'Naija business',
  'Lagos Nigeria',
  'Abuja Nigeria',
  'Tinubu Nigeria',
  'INEC Nigeria',
  'Nigerian economy',
  'Port Harcourt Nigeria',
];

const STATE_PATH = path.join(process.cwd(), 'data', 'bluesky-engage-state.json');

type DayState = {
  date: string;
  follows: string[];
  likes: string[];
  followedEver: string[];
};

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): DayState {
  const today = utcDate();
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as DayState;
      if (raw.date === today) {
        return {
          date: today,
          follows: Array.isArray(raw.follows) ? raw.follows : [],
          likes: Array.isArray(raw.likes) ? raw.likes : [],
          followedEver: Array.isArray(raw.followedEver) ? raw.followedEver : [],
        };
      }
      return {
        date: today,
        follows: [],
        likes: [],
        followedEver: Array.isArray(raw.followedEver) ? raw.followedEver : [],
      };
    }
  } catch {}
  return { date: today, follows: [], likes: [], followedEver: [] };
}

function saveState(s: DayState) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

async function createSession(identifier: string, password: string) {
  const res = await fetch(`${BSKY}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.replace(/^@/, ''), password }),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `auth ${res.status}`);
  return data as { did: string; handle: string; accessJwt: string };
}

async function api(
  jwt: string,
  method: string,
  nsid: string,
  body?: any,
  query?: Record<string, string>
) {
  const q = query ? '?' + new URLSearchParams(query).toString() : '';
  const res = await fetch(`${BSKY}/xrpc/${nsid}${q}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const NG_KEYS = [
  'nigeria', 'naija', 'nigerian', 'lagos', 'abuja', 'naira', 'cbn', 'tinubu',
  'inec', 'super eagles', 'npfl', 'port harcourt', 'portharcourt', 'kano',
  'ibadan', '9ja', 'efcc', 'nnpc', 'dangote', 'fg nigeria', 'aso rock',
  'rivers state', 'anambra', 'enugu', 'oyo state', 'kaduna', 'japa',
  'naira life', 'nigerian news', 'channelstv', 'arise news', 'punch nigeria',
];

const FOREIGN_HARD = [
  'russia', 'russian', 'moscow', 'ukraine', 'kyiv', 'belarus',
  'china only', 'beijing', 'iran', 'tehran', 'north korea',
];

function textBlob(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function ngScore(text: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const k of NG_KEYS) {
    if (t.includes(k)) score += k.length > 8 ? 2 : 1;
  }
  return score;
}

function isForeignOnly(text: string): boolean {
  const t = text.toLowerCase();
  const hasForeign = FOREIGN_HARD.some((k) => t.includes(k));
  if (!hasForeign) return false;
  return ngScore(t) < 2;
}

function isNigerianProfile(actor: any): boolean {
  const handle = (actor.handle || '').toLowerCase();
  const blob = textBlob(actor.displayName, actor.description, handle);
  if (isForeignOnly(blob)) return false;
  if (ngScore(blob) >= 2) return true;
  if (['nigeria', 'naija', 'lagos', 'abuja', '9ja', 'naira'].some((k) => handle.includes(k))) {
    return true;
  }
  return false;
}

function isActiveEnough(actor: any): boolean {
  const followers = Number(actor.followersCount ?? actor.followers ?? 0);
  const posts = Number(actor.postsCount ?? actor.posts ?? 0);
  if (followers === 0 && posts === 0) {
    const blob = textBlob(actor.displayName, actor.description, actor.handle);
    return ngScore(blob) >= 3 || (actor.description || '').length > 40;
  }
  if (posts === 0 && followers < 5) return false;
  return true;
}

async function main() {
  console.log('=== 9jaBeacon Bluesky engagement ===');
  console.log('UTC:', new Date().toISOString());

  const identifier = (process.env.BLUESKY_IDENTIFIER || '').trim();
  const password = (process.env.BLUESKY_APP_PASSWORD || '').trim();
  if (!identifier || !password) {
    console.error('Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD');
    process.exit(1);
  }

  const state = loadState();
  const followsLeftToday = Math.max(0, MAX_FOLLOWS_PER_DAY - state.follows.length);
  const followsThisRun = Math.min(MAX_FOLLOWS_PER_RUN, followsLeftToday);

  console.log(
    `Day ${state.date}: follows today ${state.follows.length}/${MAX_FOLLOWS_PER_DAY}, room this run ${followsThisRun}`
  );

  if (followsThisRun === 0 && MAX_LIKES_PER_RUN === 0) {
    console.log('Daily follow budget exhausted. Exiting cleanly.');
    process.exit(0);
  }

  const session = await createSession(identifier, password);
  console.log('Authed as', session.handle, session.did);

  let followed = 0;
  if (followsThisRun > 0) {
    const q = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
    console.log('Search posts for authors:', q);
    const candidates: any[] = [];
    try {
      const feed = await api(session.accessJwt, 'GET', 'app.bsky.feed.searchPosts', undefined, {
        q,
        limit: '30',
        sort: 'latest',
      });
      for (const p of feed.posts || []) {
        const a = p.author;
        if (!a?.did) continue;
        if (!isNigerianProfile(a)) continue;
        if (!isActiveEnough(a)) continue;
        candidates.push(a);
      }
    } catch (e: any) {
      console.warn('Post-author search failed:', e.message || e);
    }

    if (candidates.length < followsThisRun * 3) {
      const aq = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
      console.log('Search actors fallback:', aq);
      try {
        const actors = await api(session.accessJwt, 'GET', 'app.bsky.actor.searchActors', undefined, {
          q: aq,
          limit: '30',
        });
        for (const actor of actors.actors || []) {
          if (!isNigerianProfile(actor)) continue;
          if (!isActiveEnough(actor)) continue;
          candidates.push(actor);
        }
      } catch (e: any) {
        console.warn('Actor search failed:', e.message || e);
      }
    }

    const seen = new Set<string>();
    const unique = candidates.filter((a) => {
      if (!a.did || seen.has(a.did)) return false;
      seen.add(a.did);
      return true;
    });

    for (const actor of unique) {
      if (followed >= followsThisRun) break;
      const did = actor.did as string;
      if (did === session.did) continue;
      if (state.follows.includes(did) || state.followedEver.includes(did)) continue;
      if (actor.viewer?.following) {
        state.followedEver.push(did);
        continue;
      }
      try {
        await api(session.accessJwt, 'POST', 'com.atproto.repo.createRecord', {
          repo: session.did,
          collection: 'app.bsky.graph.follow',
          record: {
            $type: 'app.bsky.graph.follow',
            subject: did,
            createdAt: new Date().toISOString(),
          },
        });
        state.follows.push(did);
        state.followedEver.push(did);
        followed++;
        console.log(
          `Followed @${actor.handle} score=${ngScore(textBlob(actor.displayName, actor.description, actor.handle))} (${did})`
        );
        await new Promise((r) => setTimeout(r, 4000 + Math.random() * 3000));
      } catch (e: any) {
        console.warn('Follow skip:', actor.handle, e.message || e);
        if (e.status === 429) break;
      }
    }
  }

  let liked = 0;
  if (MAX_LIKES_PER_RUN > 0) {
    const q = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
    console.log('Search posts to like:', q);
    try {
      const feed = await api(session.accessJwt, 'GET', 'app.bsky.feed.searchPosts', undefined, {
        q,
        limit: '25',
        sort: 'latest',
      });
      const posts: any[] = feed.posts || [];
      for (const p of posts) {
        if (liked >= MAX_LIKES_PER_RUN) break;
        const uri = p.uri as string;
        const cid = p.cid as string;
        const text = p.record?.text || '';
        const authorDid = p.author?.did;
        if (!uri || !cid) continue;
        if (state.likes.includes(uri)) continue;
        if (authorDid === session.did) continue;
        const authorBlob = textBlob(p.author?.handle, p.author?.displayName, p.author?.description);
        if (ngScore(text) < 1 && ngScore(authorBlob) < 2) continue;
        if (isForeignOnly(text + ' ' + authorBlob)) continue;
        if (p.viewer?.like) continue;
        try {
          await api(session.accessJwt, 'POST', 'com.atproto.repo.createRecord', {
            repo: session.did,
            collection: 'app.bsky.feed.like',
            record: {
              $type: 'app.bsky.feed.like',
              subject: { uri, cid },
              createdAt: new Date().toISOString(),
            },
          });
          state.likes.push(uri);
          liked++;
          console.log(`Liked ${uri}`);
          await new Promise((r) => setTimeout(r, 3000));
        } catch (e: any) {
          console.warn('Like skip:', e.message || e);
          if (e.status === 429) break;
        }
      }
    } catch (e: any) {
      console.warn('Post search failed:', e.message || e);
    }
  }

  saveState(state);
  console.log(`Done. follows+${followed} likes+${liked} | day follows ${state.follows.length}/${MAX_FOLLOWS_PER_DAY}`);
}

main().catch((e) => {
  console.error('Fatal (non-spam safe exit):', e.message || e);
  process.exit(0);
});
