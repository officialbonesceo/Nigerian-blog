/**
 * Bluesky / AT Protocol Autonomous Publishing & Algorithmic Growth Engine for 9jaBeacon
 * 
 * Features:
 * - Direct AT Protocol REST API integration (Zero external dependencies).
 * - Algorithmic hook crafting (Category-tailored punchy leads, breaking alerts, curiosity gaps).
 * - Exact UTF-8 byte slice facet extraction for clickable links and discovery hashtags.
 * - Rich external embed cards (app.bsky.embed.external) with uploaded thumbnail blobs.
 * - Visual concept & image ideas generator for high-retention social posts.
 * - Session token caching with automatic re-auth to bypass login rate limits.
 * - Fail-closed error handling with telemetry logging.
 */

import { GoogleGenAI } from '@google/genai';

export interface BlueskyCredentials {
  identifier: string; // Handle (e.g. 9jabeacon.bsky.social) or email
  appPassword: string; // App Password generated in Bluesky Settings (xxxx-xxxx-xxxx-xxxx)
  autoPostEnabled?: boolean;
}

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<{
    $type: 'app.bsky.richtext.facet#link' | 'app.bsky.richtext.facet#tag';
    uri?: string;
    tag?: string;
  }>;
}

export interface BlueskyPostPayload {
  title: string;
  summary: string;
  category?: string;
  imageUrl?: string;
  slug: string;
  canonicalUrl?: string;
  customText?: string;
}

export interface BlueskyPostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  postUrl?: string;
  error?: string;
}

export interface AlgorithmicHookOption {
  id: string;
  style: string;
  badge: string;
  text: string;
  characterCount: number;
}

export interface AlgorithmicPostDraft {
  hooks: AlgorithmicHookOption[];
  hashtags: string[];
  imageIdea: {
    concept: string;
    suggestedOverlayText: string;
    styleDirection: string;
  };
  cardPreview: {
    title: string;
    description: string;
    url: string;
    imageUrl?: string;
  };
}

export interface BlueskyPostMetric {
  uri: string;
  rkey: string;
  url: string;
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  totalEngagements: number;
  externalTitle?: string;
  externalThumb?: string;
}

export interface BlueskyChannelAnalytics {
  success: boolean;
  actor: string;
  displayName: string;
  avatar: string;
  banner: string;
  description: string;
  did: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  createdAt: string;
  totalLikes: number;
  totalReposts: number;
  totalReplies: number;
  totalQuotes: number;
  totalEngagements: number;
  avgEngagementPerPost: number;
  recentPosts: BlueskyPostMetric[];
  fetchedAt: string;
  error?: string;
}

const BSKY_SERVICE = 'https://bsky.social';

// In-memory session cache to avoid hitting the 30 logins / 5 minutes rate limit
let cachedSession: { session: BlueskySession; expiresAt: number; key: string } | null = null;

/**
 * Computes exact UTF-8 byte offset in a string.
 * Bluesky AT Protocol requires byte indices, not UTF-16 character indices.
 */
export function getUtf8ByteLength(str: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  return new TextEncoder().encode(str).length;
}

/**
 * Creates or retrieves an authenticated AT Protocol Session with username and App Password
 */
export async function createBlueskySession(
  credentials: BlueskyCredentials,
  forceRefresh = false
): Promise<{ success: boolean; session?: BlueskySession; error?: string }> {
  const cleanId = (credentials.identifier || '').trim().replace(/^@/, '');
  const cleanPass = (credentials.appPassword || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'Bluesky Handle and App Password are required.' };
  }

  const cacheKey = `${cleanId}:${cleanPass}`;
  const now = Date.now();

  if (!forceRefresh && cachedSession && cachedSession.key === cacheKey && cachedSession.expiresAt > now) {
    return { success: true, session: cachedSession.session };
  }

  try {
    const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: cleanId,
        password: cleanPass,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `Authentication failed (HTTP ${res.status})`,
      };
    }

    const session: BlueskySession = {
      did: data.did,
      handle: data.handle,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
      displayName: data.displayName || data.handle,
      avatar: data.avatar,
    };

    // Cache session for 50 minutes (tokens typically valid for 2 hours)
    cachedSession = {
      session,
      expiresAt: now + 50 * 60 * 1000,
      key: cacheKey,
    };

    return {
      success: true,
      session,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Bluesky authentication timed out (10s)' : err.message || String(err),
    };
  }
}

/**
 * Uploads an image blob to Bluesky PDS for embed cards or photo posts.
 * Strictly adheres to 2MB maximum limit with type detection.
 */
export async function uploadBlueskyBlob(
  accessJwt: string,
  imageInput: string | ArrayBuffer | Uint8Array,
  mimeType = 'image/jpeg'
): Promise<{ success: boolean; blobRef?: any; error?: string }> {
  try {
    let binaryData: Uint8Array;

    if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:')) {
        const parts = imageInput.split(',');
        const mimeMatch = imageInput.match(/data:([^;]+);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        
        if (imageInput.includes(';base64,')) {
          const binaryStr = Buffer.from(parts[1], 'base64');
          binaryData = new Uint8Array(binaryStr);
        } else {
          const decoded = decodeURIComponent(parts[1]);
          binaryData = new TextEncoder().encode(decoded);
          mimeType = 'image/svg+xml';
        }
      } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        const imgRes = await fetch(imageInput, { signal: AbortSignal.timeout(10000) });
        if (!imgRes.ok) throw new Error(`Failed to download image (HTTP ${imgRes.status})`);
        const contentType = imgRes.headers.get('content-type');
        if (contentType) mimeType = contentType.split(';')[0].trim();
        const buffer = await imgRes.arrayBuffer();
        binaryData = new Uint8Array(buffer);
      } else {
        throw new Error('Unsupported image input format');
      }
    } else {
      binaryData = new Uint8Array(imageInput);
    }

    // Bluesky strict ceiling: max 2MB for images
    if (binaryData.length > 2 * 1024 * 1024) {
      return { success: false, error: 'Image exceeds Bluesky 2MB limit' };
    }

    const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessJwt}`,
        'Content-Type': mimeType,
      },
      body: binaryData as any,
      signal: AbortSignal.timeout(15000),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || `Blob upload failed (HTTP ${res.status})` };
    }

    return { success: true, blobRef: data.blob };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Extracts exact UTF-8 byte facets (links and hashtags) from any post text.
 * Guarantees zero facet misalignment when emojis or unicode characters are present.
 */
export function extractFacetsFromText(text: string): BlueskyFacet[] {
  const facets: BlueskyFacet[] = [];

  // 1. Detect URLs
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0];
    const cleanUrl = rawUrl.replace(/[.,!?;:]+$/, '');
    const byteStart = getUtf8ByteLength(text.slice(0, match.index));
    const byteEnd = byteStart + getUtf8ByteLength(cleanUrl);
    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#link',
        uri: cleanUrl,
      }],
    });
  }

  // 2. Detect Hashtags (e.g. #Nigeria #NaijaNews #Economy)
  const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_\u0080-\uFFFF]+)/g;
  while ((match = tagRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const tagWithHash = match[1];
    const tagClean = tagWithHash.slice(1);
    const leadingWhitespaceLen = fullMatch.length - tagWithHash.length;
    const tagCharIndex = match.index + leadingWhitespaceLen;

    const byteStart = getUtf8ByteLength(text.slice(0, tagCharIndex));
    const byteEnd = byteStart + getUtf8ByteLength(tagWithHash);

    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#tag',
        tag: tagClean,
      }],
    });
  }

  return facets;
}

/**
 * Category-specific algorithmic hashtags optimized for Bluesky Discovery Feeds
 */
export function getCategoryHashtags(category?: string): string[] {
  const cat = (category || '').toLowerCase();
  if (cat.includes('business') || cat.includes('money') || cat.includes('economy')) {
    return ['Nigeria', 'NaijaBusiness', 'Economy', 'Naira'];
  }
  if (cat.includes('sport')) {
    return ['NaijaSports', 'SuperEagles', 'Football', 'Nigeria'];
  }
  if (cat.includes('world')) {
    return ['WorldNews', 'GlobalAffairs', 'Breaking'];
  }
  if (cat.includes('tech')) {
    return ['NaijaTech', 'AfricaTech', 'Startups', 'Nigeria'];
  }
  return ['Nigeria', 'NaijaNews', 'BreakingNews'];
}

/**
 * Crafts an engaging, high-CTR post tailored for Bluesky's feed algorithm.
 * Strictly respects the 300-grapheme ceiling.
 */
export function composeAlgorithmicPost(article: {
  title: string;
  summary: string;
  category?: string;
  canonicalUrl: string;
}): { text: string; facets: BlueskyFacet[] } {
  const cat = (article.category || '').toLowerCase();
  
  let hook = '⚡ BREAKING:';
  if (cat.includes('business') || cat.includes('money')) {
    hook = '📈 MARKET ALERT:';
  } else if (cat.includes('sport')) {
    hook = '🦅 SPORTS DESK:';
  } else if (cat.includes('world')) {
    hook = '🌍 GLOBAL WIRE:';
  }

  const tags = getCategoryHashtags(article.category);
  const tagString = tags.map(t => `#${t}`).join(' ');

  const cleanTitle = (article.title || '').replace(/<[^>]+>/g, '').trim();
  const cleanSummary = (article.summary || '').replace(/<[^>]+>/g, '').trim();
  const cta = 'Read full report on 9jaBeacon:';
  const url = article.canonicalUrl;

  let bodyDraft = `${hook} ${cleanTitle}\n\n`;
  const footerDraft = `\n\n${cta} ${url}\n\n${tagString}`;

  const remainingSpace = 295 - (bodyDraft.length + footerDraft.length);
  if (remainingSpace > 35 && cleanSummary) {
    const truncatedSummary = cleanSummary.slice(0, remainingSpace - 3).trim() + '...';
    bodyDraft += `${truncatedSummary}`;
  }

  const fullText = (bodyDraft + footerDraft).trim();
  const facets = extractFacetsFromText(fullText);

  return { text: fullText, facets };
}

/**
 * Generates 3 algorithmic hook options, discovery hashtags, and high-retention visual/image concepts.
 * Uses Gemini if available, or robust editorial rule-based templates if offline or rate-limited.
 */
export async function generateAlgorithmicHooksAndImageIdeas(article: {
  title: string;
  summary: string;
  category?: string;
  slug: string;
  canonicalUrl?: string;
  siteUrl?: string;
}): Promise<AlgorithmicPostDraft> {
  const baseUrl = (article.siteUrl || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');
  const canonicalUrl = article.canonicalUrl || `${baseUrl}/news/${article.slug}`;
  const cleanTitle = (article.title || '').replace(/<[^>]+>/g, '').trim();
  const cleanSummary = (article.summary || '').replace(/<[^>]+>/g, '').trim();
  const cat = (article.category || 'naija-news').toLowerCase();
  const tags = getCategoryHashtags(cat);

  const fallbackResult: AlgorithmicPostDraft = {
    hooks: [
      {
        id: 'breaking',
        style: 'Breaking Wire (Urgency & Speed)',
        badge: 'High CTR',
        text: `⚡ BREAKING: ${cleanTitle}\n\n${cleanSummary.slice(0, 110)}...\n\nRead full report on 9jaBeacon 👇\n${canonicalUrl}\n\n#${tags[0]} #${tags[1]}`,
        characterCount: 0,
      },
      {
        id: 'curiosity',
        style: 'Civic & Financial Impact (Curiosity Gap)',
        badge: 'High Engagement',
        text: `🤔 What does this mean for Nigeria?\n\n"${cleanTitle}"\n\nHere is what you need to know:\n${canonicalUrl}\n\n#${tags[0]} #${tags[2] || tags[1]}`,
        characterCount: 0,
      },
      {
        id: 'data',
        style: 'Key Fact / Deep-Dive Breakdown',
        badge: 'Authority',
        text: `📊 ESSENTIAL DISPATCH:\n\n${cleanTitle}\n\nVerified background and context on 9jaBeacon:\n${canonicalUrl}\n\n#${tags.slice(0, 3).join(' #')}`,
        characterCount: 0,
      },
    ],
    hashtags: tags,
    imageIdea: {
      concept: `High-impact quote/headline card with bold gold & white typography on a dark forest-green (#0B291B) background, featuring the 9jaBeacon badge in the top right.`,
      suggestedOverlayText: cleanTitle.length > 50 ? cleanTitle.slice(0, 48) + '...' : cleanTitle,
      styleDirection: `Split-screen visual: editorial imagery on the left, clear statistical or headline summary callout on the right with verified checkmark.`,
    },
    cardPreview: {
      title: cleanTitle,
      description: cleanSummary.slice(0, 160),
      url: canonicalUrl,
    },
  };

  // Recalculate character counts
  for (const h of fallbackResult.hooks) {
    h.characterCount = h.text.length;
  }

  // Try Gemini if API key is configured
  const apiKey = (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') || '';
  if (!apiKey) {
    return fallbackResult;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are a senior social media editor for 9jaBeacon, Nigeria's premier digital newsroom.
We are crafting high-retention, high-CTR posts for Bluesky (AT Protocol).

STRICT CONSTRAINTS:
1. Every hook MUST be under 230 characters, leaving room for the website link "${canonicalUrl}" and 2-3 hashtags so total characters never exceed 290.
2. No spammy words. High journalistic authority, urgency, curiosity, or financial/civic relevance for Nigerians.
3. Suggest an image/graphic idea that makes readers stop scrolling in a vertical social feed.

ARTICLE:
Title: ${cleanTitle}
Summary: ${cleanSummary}
Category: ${cat}
URL: ${canonicalUrl}

Return ONLY valid JSON matching this exact structure:
{
  "hooks": [
    {
      "id": "breaking",
      "style": "Breaking Urgency",
      "badge": "High CTR",
      "text": "⚡ BREAKING: ... [URL] #Tags"
    },
    {
      "id": "impact",
      "style": "Civic & Financial Impact",
      "badge": "Engagement",
      "text": "🤔 ... [URL] #Tags"
    },
    {
      "id": "data",
      "style": "Key Stat / Fact",
      "badge": "Authority",
      "text": "📊 ... [URL] #Tags"
    }
  ],
  "hashtags": ["Nigeria", "NaijaNews"],
  "imageIdea": {
    "concept": "Visual card idea...",
    "suggestedOverlayText": "Short text for graphic...",
    "styleDirection": "Design advice..."
  }
}
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const candidateText = response.text?.trim() || '';
    if (candidateText) {
      const parsed = JSON.parse(candidateText);
      if (Array.isArray(parsed.hooks) && parsed.hooks.length > 0) {
        return {
          hooks: parsed.hooks.map((h: any, i: number) => ({
            id: h.id || `hook-${i}`,
            style: h.style || fallbackResult.hooks[i]?.style || 'Editorial Hook',
            badge: h.badge || 'Recommended',
            text: h.text || fallbackResult.hooks[i]?.text || '',
            characterCount: (h.text || '').length,
          })),
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : fallbackResult.hashtags,
          imageIdea: parsed.imageIdea || fallbackResult.imageIdea,
          cardPreview: fallbackResult.cardPreview,
        };
      }
    }
  } catch (aiErr: any) {
    console.warn('[Bluesky AI Crafting Notice]: Falling back to editorial templates. Cause:', aiErr.message);
  }

  return fallbackResult;
}

/**
 * Publishes an article to Bluesky with an algorithmic post, rich facets,
 * and an external embed card with thumbnail.
 */
export async function postToBluesky(
  article: BlueskyPostPayload,
  credentials: BlueskyCredentials,
  siteBaseUrl = 'https://www.9jabeacon.name.ng'
): Promise<BlueskyPostResult> {
  const sessionRes = await createBlueskySession(credentials);
  if (!sessionRes.success || !sessionRes.session) {
    return { success: false, error: sessionRes.error || 'Failed to authenticate with Bluesky' };
  }

  const { accessJwt, did } = sessionRes.session;
  const canonicalUrl = article.canonicalUrl || `${siteBaseUrl.replace(/\/+$/, '')}/news/${article.slug}`;

  // 1. Compose post text and facets
  let text = '';
  let facets: BlueskyFacet[] = [];

  if (article.customText && article.customText.trim()) {
    text = article.customText.trim();
    // Ensure under 300 characters
    if (text.length > 300) {
      text = text.slice(0, 297) + '...';
    }
    facets = extractFacetsFromText(text);
  } else {
    const composed = composeAlgorithmicPost({
      title: article.title,
      summary: article.summary,
      category: article.category,
      canonicalUrl,
    });
    text = composed.text;
    facets = composed.facets;
  }

  // 2. Upload thumbnail blob if image is available
  let thumbBlobRef: any = null;
  if (article.imageUrl && !article.imageUrl.includes('placeholder')) {
    const blobRes = await uploadBlueskyBlob(accessJwt, article.imageUrl);
    if (blobRes.success) {
      thumbBlobRef = blobRes.blobRef;
    }
  }

  // 3. Build rich embed card (app.bsky.embed.external)
  const embed: any = {
    $type: 'app.bsky.embed.external',
    external: {
      uri: canonicalUrl,
      title: article.title,
      description: article.summary.slice(0, 250),
    },
  };

  if (thumbBlobRef) {
    embed.external.thumb = thumbBlobRef;
  }

  // 4. Create the post record in Bluesky repository
  const postRecord: any = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    facets: facets.length ? facets : undefined,
    embed,
  };

  try {
    const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: postRecord,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data: any = await res.json();
    if (!res.ok) {
      // If token expired, invalidate cache
      if (res.status === 401) {
        cachedSession = null;
      }
      return { success: false, error: data.message || `Posting failed (HTTP ${res.status})` };
    }

    const rkey = data.uri ? data.uri.split('/').pop() : '';
    const postUrl = `https://bsky.app/profile/${sessionRes.session.handle}/post/${rkey}`;

    return {
      success: true,
      uri: data.uri,
      cid: data.cid,
      postUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Fetches realtime channel analytics for Bluesky profile and author feed.
 * Utilizes AT Protocol's public XRPC gateway (zero-latency, no rate limit blocking).
 */
export async function getBlueskyChannelAnalytics(rawIdentifier?: string): Promise<BlueskyChannelAnalytics> {
  const defaultActor = '9jabeacon.bsky.social';
  let actor = (rawIdentifier || '').trim();
  if (!actor) {
    actor = defaultActor;
  }
  // Sanitize handle if user provided full URL or @ prefix
  actor = actor.replace(/^https?:\/\/bsky\.app\/profile\//i, '').replace(/^@/, '').replace(/\/$/, '').trim();
  if (!actor) actor = defaultActor;

  try {
    // 1. Fetch public profile
    const profileRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!profileRes.ok) {
      const errJson: any = await profileRes.json().catch(() => ({}));
      return {
        success: false,
        actor,
        displayName: '',
        avatar: '',
        banner: '',
        description: '',
        did: '',
        followersCount: 0,
        followsCount: 0,
        postsCount: 0,
        createdAt: '',
        totalLikes: 0,
        totalReposts: 0,
        totalReplies: 0,
        totalQuotes: 0,
        totalEngagements: 0,
        avgEngagementPerPost: 0,
        recentPosts: [],
        fetchedAt: new Date().toISOString(),
        error: errJson.message || `Failed to fetch profile (HTTP ${profileRes.status})`,
      };
    }

    const profile: any = await profileRes.json();

    // 2. Fetch author feed to aggregate real-time engagement
    let recentPosts: BlueskyPostMetric[] = [];
    let totalLikes = 0;
    let totalReposts = 0;
    let totalReplies = 0;
    let totalQuotes = 0;

    try {
      const feedRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=15`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (feedRes.ok) {
        const feedData: any = await feedRes.json();
        const feedItems = Array.isArray(feedData.feed) ? feedData.feed : [];

        recentPosts = feedItems.map((item: any) => {
          const post = item.post || {};
          const record = post.record || {};
          const rkey = post.uri ? post.uri.split('/').pop() : '';
          const url = `https://bsky.app/profile/${post.author?.handle || actor}/post/${rkey}`;

          const likeCount = Number(post.likeCount || 0);
          const repostCount = Number(post.repostCount || 0);
          const replyCount = Number(post.replyCount || 0);
          const quoteCount = Number(post.quoteCount || 0);
          const totalEngagements = likeCount + repostCount + replyCount + quoteCount;

          totalLikes += likeCount;
          totalReposts += repostCount;
          totalReplies += replyCount;
          totalQuotes += quoteCount;

          let externalTitle: string | undefined = undefined;
          let externalThumb: string | undefined = undefined;
          if (post.embed?.$type === 'app.bsky.embed.external#view' && post.embed.external) {
            externalTitle = post.embed.external.title;
            externalThumb = post.embed.external.thumb;
          }

          return {
            uri: post.uri || '',
            rkey: rkey || '',
            url,
            text: record.text || '',
            createdAt: record.createdAt || post.indexedAt || '',
            likeCount,
            repostCount,
            replyCount,
            quoteCount,
            totalEngagements,
            externalTitle,
            externalThumb,
          };
        });
      }
    } catch {
      // feed fetch failure is non-fatal for profile
    }

    const totalEngagements = totalLikes + totalReposts + totalReplies + totalQuotes;
    const avgEngagementPerPost = recentPosts.length > 0
      ? Number((totalEngagements / recentPosts.length).toFixed(1))
      : 0;

    return {
      success: true,
      actor: profile.handle || actor,
      displayName: profile.displayName || profile.handle || actor,
      avatar: profile.avatar || '',
      banner: profile.banner || '',
      description: profile.description || '',
      did: profile.did || '',
      followersCount: Number(profile.followersCount || 0),
      followsCount: Number(profile.followsCount || 0),
      postsCount: Number(profile.postsCount || 0),
      createdAt: profile.createdAt || '',
      totalLikes,
      totalReposts,
      totalReplies,
      totalQuotes,
      totalEngagements,
      avgEngagementPerPost,
      recentPosts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      actor,
      displayName: '',
      avatar: '',
      banner: '',
      description: '',
      did: '',
      followersCount: 0,
      followsCount: 0,
      postsCount: 0,
      createdAt: '',
      totalLikes: 0,
      totalReposts: 0,
      totalReplies: 0,
      totalQuotes: 0,
      totalEngagements: 0,
      avgEngagementPerPost: 0,
      recentPosts: [],
      fetchedAt: new Date().toISOString(),
      error: err.message || String(err),
    };
  }
}

/**
 * Live deduplication check against the AT Protocol author feed.
 * Prevents double-broadcasting the same story across automated runs or CI schedules.
 */
export async function checkIfUrlAlreadyOnBlueskyTimeline(actor: string, targetSlugOrUrl: string): Promise<{ exists: boolean; postUrl?: string }> {
  try {
    const analytics = await getBlueskyChannelAnalytics(actor);
    if (!analytics || !analytics.success || !Array.isArray(analytics.recentPosts)) {
      return { exists: false };
    }

    const cleanTarget = targetSlugOrUrl.toLowerCase().trim().replace(/^https?:\/\/[^/]+/i, '');
    for (const post of analytics.recentPosts) {
      const textMatch = post.text.toLowerCase().includes(cleanTarget);
      const titleMatch = post.externalTitle && post.externalTitle.toLowerCase().includes(cleanTarget);
      if (textMatch || titleMatch) {
        return { exists: true, postUrl: post.url };
      }
    }

    return { exists: false };
  } catch {
    return { exists: false };
  }
}


