/**
 * Full-page article extract for shortlisted candidates only.
 * Used after ranking so we do not scrape every RSS item.
 * Soft-fail: never throws; returns empty body on block/timeout/paywall.
 */

export interface FullArticleExtract {
  success: boolean;
  url: string;
  title?: string;
  text: string;
  wordCount: number;
  error?: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMainHtml(html: string): string {
  const candidates: string[] = [];
  const patterns = [
    /<article[\s\S]*?<\/article>/i,
    /<div[^>]+(?:class|id)=["'][^"']*(?:article-body|story-body|entry-content|post-content|article__body|story__content|content-body)[^"']*["'][\s\S]*?<\/div>/i,
    /<main[\s\S]*?<\/main>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[0].length > 400) candidates.push(m[0]);
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }
  // Fallback: collect paragraph blocks
  const paras = html.match(/<p[\s\S]*?<\/p>/gi) || [];
  return paras.slice(0, 40).join('\n');
}

/**
 * Fetch article URL and return cleaned plain text (capped).
 * Legal posture: public HTTP only, short timeout, no auth bypass, soft-fail.
 */
export async function fetchFullArticleText(
  url: string,
  options: { timeoutMs?: number; maxChars?: number } = {}
): Promise<FullArticleExtract> {
  const cleanUrl = (url || '').trim();
  const timeoutMs = options.timeoutMs ?? 12000;
  const maxChars = options.maxChars ?? 8000;

  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { success: false, url: cleanUrl, text: '', wordCount: 0, error: 'Invalid URL' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; 9jaBeaconBot/1.0; +https://www.9jabeacon.name.ng; editorial-research)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-NG,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        url: cleanUrl,
        text: '',
        wordCount: 0,
        error: `HTTP ${res.status}`,
      };
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (ctype && !ctype.includes('html') && !ctype.includes('xml') && !ctype.includes('text')) {
      return {
        success: false,
        url: cleanUrl,
        text: '',
        wordCount: 0,
        error: `Unsupported content-type ${ctype}`,
      };
    }

    const html = await res.text();
    if (!html || html.length < 200) {
      return { success: false, url: cleanUrl, text: '', wordCount: 0, error: 'Empty HTML' };
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 200) : undefined;

    const main = extractMainHtml(html);
    let text = stripTags(main || html);

    // Drop very short nav-like residue
    if (text.length < 120) {
      return {
        success: false,
        url: cleanUrl,
        title,
        text: '',
        wordCount: 0,
        error: 'Extract too thin',
      };
    }

    text = text.slice(0, maxChars);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      success: wordCount >= 80,
      url: cleanUrl,
      title,
      text,
      wordCount,
      error: wordCount >= 80 ? undefined : 'Word count below minimum',
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      success: false,
      url: cleanUrl,
      text: '',
      wordCount: 0,
      error: err?.name === 'AbortError' ? 'Timeout' : err?.message || 'Fetch failed',
    };
  }
}
