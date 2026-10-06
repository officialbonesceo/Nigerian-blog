/**
 * Tumblr Autonomous Syndication Engine for 9jaBeacon
 * 
 * Supports Tumblr API v2 publishing:
 * - OAuth 2.0 / Bearer Token authorization
 * - OAuth 1.0a HMAC-SHA1 signed requests
 * - Rich NPF (Neue Post Format) & Legacy Text/Photo formats
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
}): string {
  const { method, url, consumerKey, consumerSecret, token, tokenSecret, bodyParams = {} } = params;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...bodyParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url.split('?')[0]),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);

  return `OAuth ${headerParts.join(', ')}`;
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
 * Publishes a verified news wire story to Tumblr.
 */
export async function postToTumblr(payload: TumblrPostPayload): Promise<TumblrPublishResult> {
  const blogId = normalizeTumblrBlog(
    payload.blogIdentifier ||
    process.env.TUMBLR_BLOG_IDENTIFIER ||
    process.env.TUMBLR_BLOG_NAME ||
    '9jabeacon.tumblr.com'
  );

  const consumerKey = payload.consumerKey || process.env.TUMBLR_CONSUMER_KEY || '';
  const consumerSecret = payload.consumerSecret || process.env.TUMBLR_CONSUMER_SECRET || '';
  const token = payload.token || payload.accessToken || process.env.TUMBLR_TOKEN || process.env.TUMBLR_ACCESS_TOKEN || '';
  const tokenSecret = payload.tokenSecret || process.env.TUMBLR_TOKEN_SECRET || '';

  if (!blogId) {
    return { success: false, error: 'Missing TUMBLR_BLOG_IDENTIFIER (e.g. 9jabeacon.tumblr.com)' };
  }

  if (!token && !consumerKey) {
    return {
      success: false,
      error: 'Missing Tumblr credentials. Set TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET or TUMBLR_ACCESS_TOKEN in secrets.',
    };
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

  if (payload.imageUrl) {
    bodyHtml += `<p><img src="${payload.imageUrl}" alt="${payload.title.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
  }

  bodyHtml += `<h3>${payload.title}</h3>`;
  bodyHtml += `<p><strong>${cleanSummary}</strong></p>`;

  if (payload.content) {
    // Include excerpt paragraph from content if available
    const snippet = payload.content.replace(/<[^>]*>?/gm, '').slice(0, 350).trim();
    if (snippet && snippet !== cleanSummary) {
      bodyHtml += `<p>${snippet}...</p>`;
    }
  }

  bodyHtml += `<hr />`;
  bodyHtml += `<p><em>Read the full verified report on 9jaBeacon:</em> <a href="${payload.canonicalUrl}" target="_blank" rel="noopener noreferrer">${payload.canonicalUrl}</a></p>`;

  const endpoint = `https://api.tumblr.com/v2/blog/${blogId}/post`;

  try {
    let authHeader = '';
    const bodyParams: Record<string, string> = {
      type: 'text',
      title: payload.title,
      body: bodyHtml,
      tags: cleanTags,
      format: 'html',
      canonical_url: payload.canonicalUrl,
    };

    if (consumerKey && consumerSecret && token && tokenSecret) {
      // Full OAuth 1.0a flow
      authHeader = generateOAuth1Header({
        method: 'POST',
        url: endpoint,
        consumerKey,
        consumerSecret,
        token,
        tokenSecret,
        bodyParams,
      });
    } else if (token) {
      // OAuth 2.0 Bearer token flow
      authHeader = `Bearer ${token}`;
    }

    const formBody = new URLSearchParams(bodyParams).toString();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: formBody,
    });

    const data: any = await response.json();

    if (response.ok && (data?.meta?.status === 201 || data?.meta?.status === 200 || data?.response?.id)) {
      const postId = data?.response?.id || data?.response?.id_string;
      const postUrl = `https://${blogId}/post/${postId}`;
      return {
        success: true,
        postId,
        postUrl,
      };
    }

    const errorMessage = data?.meta?.msg || data?.response?.errors?.[0]?.message || response.statusText || 'Tumblr publication failed';
    return {
      success: false,
      error: `Tumblr API HTTP ${response.status}: ${errorMessage}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network exception during Tumblr publish: ${err.message}`,
    };
  }
}
