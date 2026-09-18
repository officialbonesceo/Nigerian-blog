import type { RssFeedItem } from './types';
import { isPublisherLogoOrBanner } from './editorial-image';

/**
 * Lightweight, robust RSS 2.0 and Atom XML parser for Cloudflare Workers & Node runtimes
 */
export async function fetchAndParseRssFeed(feedUrl: string): Promise<{
  success: boolean;
  title?: string;
  description?: string;
  link?: string;
  itemCount?: number;
  items?: RssFeedItem[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const xmlText = await response.text();
    const items = parseXmlFeed(xmlText);

    // Extract channel metadata
    const titleMatch = xmlText.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descMatch = xmlText.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

    return {
      success: true,
      title: titleMatch ? cleanCdata(titleMatch[1]) : 'RSS Source',
      description: descMatch ? cleanCdata(descMatch[1]) : '',
      itemCount: items.length,
      items: items.slice(0, 15), // Return latest 15 items
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Feed request timed out (10s limit)' : err.message || 'Unknown parsing error',
    };
  }
}

function parseXmlFeed(xml: string): RssFeedItem[] {
  const items: RssFeedItem[] = [];

  // Match RSS <item> tags
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractAttribute(itemXml, 'link', 'href');
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || extractTag(itemXml, 'published');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'summary');
    const content = extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'content');
    const author = extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author');
    
    // Extract image enclosure, media:content, media:thumbnail or embedded <img>
    let enclosureUrl: string | undefined = extractAttribute(itemXml, 'enclosure', 'url') || undefined;
    if (!enclosureUrl) {
      enclosureUrl = extractAttribute(itemXml, 'media:content', 'url') || undefined;
    }
    if (!enclosureUrl) {
      enclosureUrl = extractAttribute(itemXml, 'media:thumbnail', 'url') || undefined;
    }
    if (!enclosureUrl) {
      // Check for nested <media:thumbnail url="..." />
      const mediaThumbMatch = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      if (mediaThumbMatch) {
        enclosureUrl = mediaThumbMatch[1];
      }
    }
    if (!enclosureUrl) {
      // Check for <img src="..." in content:encoded or description
      const imgMatch = (content || description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && !imgMatch[1].includes('feedburner') && !imgMatch[1].includes('1x1') && !imgMatch[1].includes('doubleclick')) {
        enclosureUrl = imgMatch[1];
      }
    }

    // Clean and validate enclosure URL - MUST NOT be a publisher logo, badge or banner
    if (enclosureUrl) {
      enclosureUrl = cleanCdata(enclosureUrl).trim();
      if (!enclosureUrl.startsWith('http://') && !enclosureUrl.startsWith('https://')) {
        enclosureUrl = undefined;
      } else if (isPublisherLogoOrBanner(enclosureUrl)) {
        // Explicitly reject publisher logos, site watermarks, and headers
        enclosureUrl = undefined;
      }
    }

    if (title && link) {
      items.push({
        title: cleanCdata(title),
        link: cleanCdata(link).trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description: cleanRssSnippet(description).slice(0, 350),
        content: content ? cleanCdata(content) : undefined,
        author: author ? cleanCdata(author) : undefined,
        enclosureUrl: enclosureUrl ? cleanCdata(enclosureUrl) : undefined,
      });
    }
  }

  // Also support Atom <entry> format if standard RSS yielded no items
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const entryXml of entryMatches) {
      const title = extractTag(entryXml, 'title');
      const link = extractAttribute(entryXml, 'link', 'href') || extractTag(entryXml, 'link');
      const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
      const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');

      if (title && link) {
        items.push({
          title: cleanCdata(title),
          link: cleanCdata(link).trim(),
          pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          description: cleanRssSnippet(summary).slice(0, 350),
        });
      }
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function extractAttribute(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s+${attr}=["']([^"']+)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function cleanCdata(str: string): string {
  if (!str) return '';
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
}

export function cleanRssSnippet(rawText: string): string {
  if (!rawText) return '';
  let text = stripHtml(cleanCdata(rawText));

  // 1. Remove non-English translation artifacts (e.g., Arabic 'اقرأ هذا باللغة العربية')
  text = text.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').trim();

  // 2. Remove typical journalist byline prefixes (e.g., 'By Dayo Johnson Akure', 'By John Doe -')
  text = text.replace(/^By\s+([A-Za-z\s\.,'-]{3,35})(?:\s+(?:Akure|Lagos|Abuja|Kano|Ibadan|Kaduna|Enugu|Port Harcourt|Benin City|London|Washington|New York|Paris))?\s*[:\-\—\n]?\s*/i, '');

  // 3. Remove mid-text or trailing 'Read More' or 'read more' directives and URLs
  text = text
    .replace(/(?:Read\s+More|read\s+more|READ\s+MORE|Read\s+original\s+report|Continue\s+reading|The\s+post\s+.*?appeared\s+first\s+on\s+.*?)(?::\s*https?:\/\/\S+|\.\.\.|\.|$)/gi, '')
    .replace(/https?:\/\/[^\s\)]+/gi, '');

  // 4. Remove bullet artifacts, leading ellipses, or repetitive dashes
  text = text
    .replace(/^[\s…\.\-•–—]+/, '')
    .replace(/[\s…\.\-•–—]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
