/**
 * RSS fetch for 9jaBeacon
 */
import { isPublisherLogoOrBanner } from './editorial-image';
import type { FeedItemValidated, FetchRssResult } from './automated-ingest-types';
import { sanitizeSnippet } from './automated-ingest-helpers';

/**
 * 1. fetchRss: Validates source HTTP response, enforces 10s timeout, parses XML safely,
 * and validates each item has non-empty title + link.
 */
export async function fetchRss(feedUrl: string): Promise<FetchRssResult> {
  const cleanUrl = (feedUrl || '').trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return {
      success: false,
      feedUrl,
      itemCount: 0,
      items: [],
      error: 'Invalid feed URL scheme (must be http/https)',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 9jaBeacon/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*;q=0.1',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        feedUrl: cleanUrl,
        itemCount: 0,
        items: [],
        error: `Source HTTP error ${response.status}: ${response.statusText}`,
      };
    }

    const xml = await response.text();
    if (!xml || xml.length < 50) {
      return {
        success: false,
        feedUrl: cleanUrl,
        itemCount: 0,
        items: [],
        error: 'Feed response body was empty or too small to be valid XML',
      };
    }

    const items: FeedItemValidated[] = [];
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const matches = xml.match(itemRegex) || [];

    for (const rawItem of matches) {
      const titleMatch = rawItem.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? sanitizeSnippet(titleMatch[1]) : '';

      let link = '';
      const linkTagMatch = rawItem.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      if (linkTagMatch && linkTagMatch[1] && linkTagMatch[1].startsWith('http')) {
        link = linkTagMatch[1].trim();
      } else {
        const hrefMatch = rawItem.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1]) {
          link = hrefMatch[1].trim();
        }
      }

      if (!title || title.length < 10 || !link || !link.startsWith('http')) {
        continue;
      }

      const dateMatch = rawItem.match(/<(?:pubDate|published|updated|dc:date)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated|dc:date)>/i);
      const pubDate = dateMatch ? dateMatch[1].trim() : undefined;

      const descMatch = rawItem.match(/<(?:description|summary)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i);
      const description = descMatch ? sanitizeSnippet(descMatch[1]) : '';

      const contentMatch = rawItem.match(/<(?:content:encoded|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content:encoded|content)>/i);
      const content = contentMatch ? sanitizeSnippet(contentMatch[1]) : '';

      let imageUrl: string | undefined;
      const enclosureMatch = rawItem.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      if (enclosureMatch && enclosureMatch[1].startsWith('http')) {
        imageUrl = enclosureMatch[1].trim();
      }
      if (!imageUrl) {
        const mediaMatch = rawItem.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i);
        if (mediaMatch && mediaMatch[1].startsWith('http')) {
          imageUrl = mediaMatch[1].trim();
        }
      }
      if (!imageUrl) {
        const imgMatch = (content || description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1].startsWith('http') && !imgMatch[1].includes('1x1') && !imgMatch[1].includes('feedburner')) {
          imageUrl = imgMatch[1].trim();
        }
      }

      if (imageUrl && isPublisherLogoOrBanner(imageUrl)) {
        imageUrl = undefined;
      }

      items.push({
        title,
        link,
        pubDate,
        description,
        content: content || description,
        imageUrl,
      });
    }

    return {
      success: true,
      feedUrl: cleanUrl,
      itemCount: items.length,
      items: items.slice(0, 15),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      feedUrl: cleanUrl,
      itemCount: 0,
      items: [],
      error: err.name === 'AbortError' ? 'RSS fetch timed out (10s limit exceeded)' : err.message || 'Unknown network error',
    };
  }
}
