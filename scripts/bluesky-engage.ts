/**
 * 9jaBeacon Bluesky engagement (follows + likes) — Nigerian niche only.
 * Hard limits: max 30 follows / UTC day, max 2 follows / run, max 1 like / run.
 * Safe against rate limits; never spam. Uses existing BLUESKY_* secrets.
 */
import * as fs from 'fs';
import * as path from 'path';

const BSKY = 'https://bsky.social';
const MAX_FOLLOWS_PER_DAY = 30;
const MAX_FOLLOWS_PER_RUN = 2;
const MAX_LIKES_PER_RUN = 1;

const NICHE_QUERIES = [
  'Nigeria news',
  'Naija news',
  'Lagos',
  'Abuja',
  'Nigerian politics',
  'CBN Naira',
  'Super Eagles',
  'Naija business',
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

function looksNigerian(text: string): boolean {
  const t = (text || '').toLowerCase();
  const keys = [
    'nigeria', 'naija', 'lagos', 'abuja', 'naira', 'cbn', 'tinubu', 'inec',
    'super eagles', 'npfl', 'portharcourt', 'port harcourt', 'kano', 'ibadan',
    '9ja', 'nigerian', 'efcc', 'nnpc', 'dangote',
  ];
  return keys.some((k) => t.includes(k));
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

  console.log(`Day ${state.date}: follows today ${state.follows.length}/${MAX_FOLLOWS_PER_DAY}, room this run ${followsThisRun}`);

  if (followsThisRun === 0 && MAX_LIKES_PER_RUN === 0) {
    console.log('Daily follow budget exhausted. Exiting cleanly.');
    process.exit(0);
  }

  const session = await createSession(identifier, password);
  console.log('Authed as', session.handle, session.did);

  let followed = 0;
  if (followsThisRun > 0) {
    const q = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
    console.log('Search actors:', q);
    try {
      const actors = await api(session.accessJwt, 'GET', 'app.bsky.actor.searchActors', undefined, {
        q,
        limit: '25',
      });
      const list: any[] = actors.actors || [];
      for (const actor of list) {
        if (followed >= followsThisRun) break;
        const did = actor.did as string;
        if (!did || did === session.did) continue;
        if (state.follows.includes(did) || state.followedEver.includes(did)) continue;
        const bio = `${actor.displayName || ''} ${actor.description || ''} ${actor.handle || ''}`;
        if (!looksNigerian(bio) && !looksNigerian(q)) continue;
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
          console.log(`Followed @${actor.handle} (${did})`);
          await new Promise((r) => setTimeout(r, 4000 + Math.random() * 3000));
        } catch (e: any) {
          console.warn('Follow skip:', actor.handle, e.message || e);
          if (e.status === 429) break;
        }
      }
    } catch (e: any) {
      console.warn('Actor search failed:', e.message || e);
    }
  }

  let liked = 0;
  if (MAX_LIKES_PER_RUN > 0) {
    const q = NICHE_QUERIES[Math.floor(Math.random() * NICHE_QUERIES.length)];
    console.log('Search posts:', q);
    try {
      const feed = await api(session.accessJwt, 'GET', 'app.bsky.feed.searchPosts', undefined, {
        q,
        limit: '20',
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
        if (!looksNigerian(text) && !looksNigerian(p.author?.handle || '') && !looksNigerian(p.author?.displayName || '')) {
          continue;
        }
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
