/**
 * Robust XML RSS 2.0 & Atom Parser for Cloudflare Workers
 * Standalone module for extracting structured news from Nigerian feeds
 */
import type { IngestItem } from './types';

export function parseXmlFeed(xml: string): IngestItem[] {
  const items: IngestItem[] = [];

  // Match RSS <item> tags
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractAttribute(itemXml, 'link', 'href');
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || extractTag(itemXml, 'published');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'summary');
    const content = extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'content');
    const author = extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author');
    
    // Extract image enclosure or media:content if available
    let enclosureUrl = extractAttribute(itemXml, 'enclosure', 'url');
    if (!enclosureUrl) {
      enclosureUrl = extractAttribute(itemXml, 'media:content', 'url');
    }
    if (!enclosureUrl) {
      const imgMatch = (content || description).match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        enclosureUrl = imgMatch[1];
      }
    }

    if (title && link) {
      items.push({
        title: cleanCdata(title),
        link: cleanCdata(link).trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description: stripHtml(cleanCdata(description)).slice(0, 350),
        content: content ? cleanCdata(content) : undefined,
        author: author ? cleanCdata(author) : undefined,
        enclosureUrl: enclosureUrl ? cleanCdata(enclosureUrl) : undefined,
      });
    }
  }

  // Atom <entry> format fallback
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
          description: stripHtml(cleanCdata(summary)).slice(0, 350),
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

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
