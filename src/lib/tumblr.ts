/**
 * Tumblr Autonomous Syndication Engine for 9jaBeacon
 * 
 * Supports Tumblr API v2 publishing:
 * - RFC 5849 / RFC 3986 compliant OAuth 1.0a HMAC-SHA1 signed requests
 * - OAuth 2.0 / Bearer Token authorization fallback
 * - Auto-retries across auth strategies to eliminate false-negative 401s
 * - Auto-tags posts (#Nigeria, #NaijaNews, #9jaBeacon, Category)
 * - Embeds high-res canonical image, punchy excerpt, and backlink to 9jaBeacon
 */

import crypto from 'node:crypto';

export interface TumblrPostPayload {
  title: string;
  summary: string;
  content?: string;
  imageUrl?: string;
  canonicalUrl: string;
  category?: string;
  tags?: string[];
  blogIdentifier?: string;
  accessToken?: string;
  consumerKey?: string;
  consumerSecret?: string;
  token?: string;
  tokenSecret?: string;
}

export interface TumblrPublishResult {
  success: boolean;
  postId?: string | number;
  postUrl?: string;
  error?: string;
}

/**
 * Strict RFC 3986 percent-encoding required by OAuth 1.0a (RFC 5849 §3.6).
 * Standard JavaScript encodeURIComponent leaves ! ' ( ) * unescaped,
 * which causes HMAC-SHA1 signature mismatches and HTTP 401 Unauthorized.
 */
export function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Generates an OAuth 1.0a Authorization header for Tumblr v2 endpoints.
 */
function generateOAuth1Header(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  bodyParams?: Record<string, string>;
}): { authHeader: string; signedBody: string } {
  const { method, url, consumerKey, consumerSecret, token, tokenSecret, bodyParams = {} } = params;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  // Collect all parameters (OAuth header parameters + form body parameters)
  const allParams: Record<string, string> = { ...oauthParams, ...bodyParams };
  const sortedKeys = Object.keys(allParams).sort();

  const paramString = sortedKeys
    .map((k) => `${rfc3986(k)}=${rfc3986(allParams[k])}`)
    .join('&');

  const cleanUrl = url.split('?')[0];
  const baseString = [
    method.toUpperCase(),
    rfc3986(cleanUrl),
    rfc3986(paramString),
  ].join('&');

  const signingKey = `${rfc3986(consumerSecret)}&${rfc3986(tokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(oauthParams[k])}"`);

  const authHeader = `OAuth ${headerParts.join(', ')}`;

  // The request body MUST use the exact same RFC 3986 encoding (spaces as %20, not +)
  const bodyKeys = Object.keys(bodyParams).sort();
  const signedBody = bodyKeys
    .map((k) => `${rfc3986(k)}=${rfc3986(bodyParams[k])}`)
    .join('&');

  return { authHeader, signedBody };
}

/**
 * Normalizes blog identifier (e.g., '9jabeacon' -> '9jabeacon.tumblr.com')
 */
export function normalizeTumblrBlog(blog: string): string {
  const clean = blog.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (clean.includes('.')) {
    return clean;
  }
  return `${clean}.tumblr.com`;
}

/**
 * Publishes a verified news wire story to Tumblr with automatic fallback across auth methods.
 */
export async function postToTumblr(payload: TumblrPostPayload): Promise<TumblrPublishResult> {
  const rawBlog = (
    payload.blogIdentifier ||
    process.env.TUMBLR_BLOG_IDENTIFIER ||
    process.env.TUMBLR_BLOG_NAME ||
    '9jabeacon.tumblr.com'
  ).trim();

  const blogId = normalizeTumblrBlog(rawBlog);
  const shortBlogId = rawBlog.replace(/\.tumblr\.com$/i, '');

  const consumerKey = (payload.consumerKey || process.env.TUMBLR_CONSUMER_KEY || '').trim();
  const consumerSecret = (payload.consumerSecret || process.env.TUMBLR_CONSUMER_SECRET || '').trim();
  const token = (payload.token || payload.accessToken || process.env.TUMBLR_TOKEN || process.env.TUMBLR_ACCESS_TOKEN || '').trim();
  const tokenSecret = (payload.tokenSecret || process.env.TUMBLR_TOKEN_SECRET || '').trim();

  if (!rawBlog) {
    return { success: false, error: 'Missing TUMBLR_BLOG_IDENTIFIER (e.g. 9jabeacon.tumblr.com)' };
  }

  if (!token && !consumerKey) {
    return {
      success: false,
      error: 'Missing Tumblr credentials. Set TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET or TUMBLR_ACCESS_TOKEN in secrets.',
    };
  }

  // Guarantee valid raster HTTPS image (Tumblr photo posts reject SVGs and relative paths)
  let validImageUrl = (payload.imageUrl || '').trim();
  if (
    !validImageUrl ||
    validImageUrl.startsWith('data:') ||
    validImageUrl.includes('.svg') ||
    !validImageUrl.startsWith('http')
  ) {
    const cat = (payload.category || '').toLowerCase();
    if (cat.includes('sport')) {
      validImageUrl = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80';
    } else if (cat.includes('business') || cat.includes('money') || cat.includes('economy')) {
      validImageUrl = 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80';
    } else if (cat.includes('tech')) {
      validImageUrl = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';
    } else {
      validImageUrl = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80';
    }
  }

  // Build clean tags
  const tagsList = ['Nigeria', 'NaijaNews', '9jaBeacon', 'BreakingNews'];
  if (payload.category) {
    tagsList.push(payload.category.replace(/[^a-zA-Z0-9]/g, ''));
  }
  if (payload.tags && Array.isArray(payload.tags)) {
    tagsList.push(...payload.tags);
  }
  const cleanTags = Array.from(new Set(tagsList)).join(',');

  // Build rich HTML body
  const cleanSummary = (payload.summary || '').replace(/<[^>]*>?/gm, '').trim();
  let bodyHtml = '';

  if (validImageUrl) {
    bodyHtml += `<p><a href="${payload.canonicalUrl}" target="_blank" rel="noopener noreferrer"><img src="${validImageUrl}" alt="${payload.title.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin-bottom:12px;" /></a></p>`;
  }

  bodyHtml += `<h2><a href="${payload.canonicalUrl}" target="_blank" rel="noopener noreferrer" style="color:#0f172a;text-decoration:none;">${payload.title}</a></h2>`;
  bodyHtml += `<p><strong>${cleanSummary}</strong></p>`;

  let snippet = '';
  if (payload.content) {
    snippet = payload.content.replace(/<[^>]*>?/gm, '').slice(0, 400).trim();
    if (snippet && snippet !== cleanSummary) {
      bodyHtml += `<p>${snippet}...</p>`;
    }
  }

  bodyHtml += `<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;" />`;
  bodyHtml += `<p style="padding:12px 16px;background:#f8fafc;border-left:4px solid #10b981;border-radius:6px;"><strong>Read the complete verified investigative report on 9jaBeacon:</strong><br /><a href="${payload.canonicalUrl}" target="_blank" rel="noopener noreferrer" style="color:#10b981;font-weight:bold;">${payload.canonicalUrl}</a></p>`;

  const hasImage = Boolean(validImageUrl && validImageUrl.startsWith('http'));
  const bodyParams: Record<string, string> = hasImage
    ? {
        type: 'photo',
        source: validImageUrl,
        caption: bodyHtml,
        link_url: payload.canonicalUrl,
        tags: cleanTags,
        format: 'html',
        canonical_url: payload.canonicalUrl,
      }
    : {
        type: 'text',
        title: payload.title,
        body: bodyHtml,
        tags: cleanTags,
        format: 'html',
        canonical_url: payload.canonicalUrl,
      };

  // Attempt strategies:
  // Strategy 1: OAuth 1.0a HMAC-SHA1 signed with full domain (e.g. 9jabeacon.tumblr.com)
  // Strategy 2: OAuth 1.0a HMAC-SHA1 signed with short blog name (e.g. 9jabeacon)
  // Strategy 3: OAuth 2.0 Bearer token (Authorization: Bearer <token>)
  // Strategy 4: Bearer token with JSON NPF endpoint

  const candidates: Array<{
    name: string;
    endpoint: string;
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  }> = [];

  // If full OAuth 1.0a credentials provided
  if (consumerKey && consumerSecret && token && tokenSecret) {
    const ep1 = `https://api.tumblr.com/v2/blog/${blogId}/post`;
    const { authHeader: h1, signedBody: b1 } = generateOAuth1Header({
      method: 'POST',
      url: ep1,
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
      bodyParams,
    });
    candidates.push({
      name: 'OAuth 1.0a (Full Blog Identifier)',
      endpoint: ep1,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': h1,
      },
      body: b1,
    });

    if (shortBlogId !== blogId) {
      const ep2 = `https://api.tumblr.com/v2/blog/${shortBlogId}/post`;
      const { authHeader: h2, signedBody: b2 } = generateOAuth1Header({
        method: 'POST',
        url: ep2,
        consumerKey,
        consumerSecret,
        token,
        tokenSecret,
        bodyParams,
      });
      candidates.push({
        name: 'OAuth 1.0a (Short Blog Name)',
        endpoint: ep2,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': h2,
        },
        body: b2,
      });
    }
  }

  // If token is present, also add OAuth 2.0 Bearer strategies
  if (token) {
    candidates.push({
      name: 'OAuth 2.0 Bearer Token (Form)',
      endpoint: `https://api.tumblr.com/v2/blog/${blogId}/post`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    // Neue Post Format (NPF) JSON payload
    const npfBody = JSON.stringify({
      content: [
        ...(validImageUrl ? [{ type: 'image', media: [{ url: validImageUrl }] }] : []),
        { type: 'text', subtype: 'heading1', text: payload.title },
        { type: 'text', text: cleanSummary },
        { type: 'text', subtype: 'link', text: `Read on 9jaBeacon: ${payload.canonicalUrl}`, url: payload.canonicalUrl },
      ],
      tags: cleanTags,
    });

    candidates.push({
      name: 'OAuth 2.0 Bearer Token (NPF JSON)',
      endpoint: `https://api.tumblr.com/v2/blog/${blogId}/posts`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: npfBody,
    });
  }

  let lastError = 'No strategies available';

  for (const strategy of candidates) {
    try {
      console.log(`     🔄 Attempting Tumblr dispatch via: ${strategy.name}...`);
      const response = await fetch(strategy.endpoint, {
        method: strategy.method,
        headers: strategy.headers,
        body: strategy.body,
      });

      const data: any = await response.json().catch(() => ({}));

      if (response.ok && (data?.meta?.status === 201 || data?.meta?.status === 200 || data?.response?.id)) {
        const postId = data?.response?.id || data?.response?.id_string;
        const postUrl = `https://${blogId}/post/${postId}`;
        return {
          success: true,
          postId,
          postUrl,
        };
      }

      const msg = data?.meta?.msg || data?.response?.errors?.[0]?.message || data?.errors?.[0]?.message || response.statusText;
      lastError = `Tumblr HTTP ${response.status} (${strategy.name}): ${msg || 'Unauthorized/Forbidden'}`;
      console.warn(`     ⚠️ Strategy [${strategy.name}] returned: ${lastError}`);

      // If error is NOT a 401/404 authentication error (e.g. rate limit 429), break early
      if (response.status !== 401 && response.status !== 404 && response.status !== 403) {
        break;
      }
    } catch (err: any) {
      lastError = `Network error on ${strategy.name}: ${err.message}`;
      console.warn(`     ⚠️ ${lastError}`);
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Live deduplication check against the Tumblr blog.
 * 3-Tier Multi-Check:
 * 1. Official Tumblr API v2 (/v2/blog/{blog}/posts) with API key / OAuth
 * 2. Blog public RSS feed (/rss)
 * 3. Blog public HTML timeline page
 *
 * Prevents double-broadcasting and guarantees zero spamming across all CI runs.
 */
export async function checkIfUrlAlreadyOnTumblrBlog(
  blogIdentifier: string,
  targetSlugOrUrl: string,
  titleSnippet?: string,
  credentials?: { consumerKey?: string; token?: string }
): Promise<{ exists: boolean; postUrl?: string }> {
  try {
    const rawBlog = (blogIdentifier || '').trim();
    if (!rawBlog) return { exists: false };
    const clean = rawBlog.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    const blogUrl = clean.includes('.') ? clean : `${clean}.tumblr.com`;

    const cleanTarget = (targetSlugOrUrl || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/news\//, '')
      .replace(/\/+$/, '')
      .replace(/\.html$/, '');

    const cleanTitle = (titleSnippet || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const titleKeywords = cleanTitle.split(' ').filter((w) => w.length > 3).slice(0, 5);

    const apiKey = (credentials?.consumerKey || process.env.TUMBLR_CONSUMER_KEY || '').trim();
    const token = (credentials?.token || process.env.TUMBLR_TOKEN || process.env.TUMBLR_ACCESS_TOKEN || '').trim();

    // --- TIER 1: Official Tumblr API v2 ---
    if (apiKey || token) {
      try {
        const apiUrl = apiKey
          ? `https://api.tumblr.com/v2/blog/${blogUrl}/posts?api_key=${encodeURIComponent(apiKey)}&limit=30`
          : `https://api.tumblr.com/v2/blog/${blogUrl}/posts?limit=30`;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const apiRes = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(6000) });
        if (apiRes.ok) {
          const apiJson: any = await apiRes.json().catch(() => ({}));
          const posts = apiJson?.response?.posts || [];
          if (Array.isArray(posts) && posts.length > 0) {
            for (const p of posts) {
              const postUrl = p.post_url || p.url || '';
              const haystack = [
                p.summary || '',
                p.title || '',
                p.caption || '',
                p.body || '',
                p.slug || '',
                p.link_url || '',
                postUrl,
                JSON.stringify(p.tags || []),
              ].join(' ').toLowerCase();

              // Check slug / target URL
              if (cleanTarget && cleanTarget.length > 3 && haystack.includes(cleanTarget)) {
                return { exists: true, postUrl };
              }

              // Check title matching
              if (titleKeywords.length >= 3) {
                const matchCount = titleKeywords.filter((w) => haystack.includes(w)).length;
                if (matchCount >= Math.min(titleKeywords.length, 3)) {
                  return { exists: true, postUrl };
                }
              }
            }
          }
        }
      } catch {}
    }

    // --- TIER 2: Public RSS Feed ---
    try {
      const rssUrl = `https://${blogUrl}/rss`;
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const xml = (await res.text()).toLowerCase();
        if (cleanTarget && cleanTarget.length > 3 && xml.includes(cleanTarget)) {
          return { exists: true };
        }
        if (titleKeywords.length >= 3) {
          const matchCount = titleKeywords.filter((w) => xml.includes(w)).length;
          if (matchCount >= Math.min(titleKeywords.length, 3)) {
            return { exists: true };
          }
        }
      }
    } catch {}

    // --- TIER 3: Public Blog HTML Page ---
    try {
      const htmlRes = await fetch(`https://${blogUrl}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (htmlRes.ok) {
        const html = (await htmlRes.text()).toLowerCase();
        if (cleanTarget && cleanTarget.length > 3 && (html.includes(cleanTarget) || html.includes(`/news/${cleanTarget}`))) {
          return { exists: true };
        }
        if (titleKeywords.length >= 3) {
          const matchCount = titleKeywords.filter((w) => html.includes(w)).length;
          if (matchCount >= Math.min(titleKeywords.length, 3)) {
            return { exists: true };
          }
        }
      }
    } catch {}

    return { exists: false };
  } catch {
    return { exists: false };
  }
}
