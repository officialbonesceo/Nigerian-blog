/**
 * Content Formatter Utility for 9jaBeacon News Reports
 * - Strips all fallback templates, boilerplate, and scraped artifacts
 * - Ensures each paragraph has a sleek, non-obstructive native banner heading
 * - Guarantees clean 3-4 paragraph journalistic structure
 * - Partitions articles cleanly for in-article native ad placements
 *
 * IMPORTANT: Never strip https:// URLs that sit inside href="..." attributes.
 * Doing so turned <a href="https://..." rel="..."> into href=" rel=" → /news/rel= 404.
 */

export function cleanAndFormatArticleHtml(raw: string | undefined | null): string {
  if (!raw) return '';

  let text = raw.trim();

  // 0. Remove broken source links created by older URL-stripping (href=" rel=...)
  text = text
    .replace(/<a\b[^>]*href\s*=\s*["']?\s*rel\s*=[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<a\b[^>]*href\s*=\s*["']\s*["'][^>]*>\s*Original\s+source\s*<\/a>/gi, '')
    .replace(/<a\b[^>]*>\s*Original\s+source\s*<\/a>/gi, '')
    .replace(/\*?\s*Reporting based on public reporting from[^<*\n.]{0,80}\.?\s*Original\s+source\.?\s*\*?/gi, '')
    .replace(/Verified\s+News\s+Wire\s+Attribution:[^<\n]{0,120}Original\s+Source/gi, '')
    .replace(/\*?\s*Original\s+source\.?\s*\*?/gi, '');

  // 1. Purge all AI thinking processes, thought tokens, and internal reasoning blocks
  text = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/(?:^|\n)\s*(?:Thinking Process|Thought Process|Model Thought|Internal Reasoning|AI Thinking):[\s\S]*?(?=\n\s*\n|<h3>|<p>|$)/gi, '')
    .replace(/(?:^|\n)\s*(?:Here is (?:the|a) (?:rewritten|full) (?:news )?article|Sure,? here (?:is|are)|As an AI(?: language model)?[^\n]*)\s*:?\s*/gi, '')
    .replace(/```(?:html|json|markdown)?/gi, '')
    .replace(/```/g, '');

  // 2. Purge previous writer's personal musings, subjective op-ed takes, and first-person bias
  text = text
    .replace(/(?:in my opinion|in my view|from my perspective|personally speaking|as this writer believes)[^.,;]*([.,;]|$)/gi, '')
    .replace(/(?:the author believes|the writer argues|the original journalist noted)[^.,;]*([.,;]|$)/gi, '');

  // 3. Purge all deprecated fallback template boilerplate, speculative filler, and fake search surges
  text = text
    .replace(/<p>[^<]*observers anticipate[^<]*<\/p>/gi, '')
    .replace(/observers anticipate[^.\n<]*(\.|\n|<|$)/gi, '')
    .replace(/<p>[^<]*the situation remains fluid[^<]*<\/p>/gi, '')
    .replace(/the situation remains fluid[^.\n<]*(\.|\n|<|$)/gi, '')
    .replace(/<p>[^<]*(?:nigerian\s+)?search interest surges[^<]*<\/p>/gi, '')
    .replace(/(?:nigerian\s+)?search interest surges[^.\n<]*(\.|\n|<|$)/gi, '')
    .replace(/200 concurrent queries[^.\n<]*(\.|\n|<|$)/gi, '')
    .replace(/<div[^>]*class="[^"]*editorial-take[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<section[^>]*class="[^"]*editorial-take[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<h3>(?:9jaBeacon\s+)?Editorial Take<\/h3>[\s\S]*?(?=<h[23]|$)/gi, '')
    .replace(/<p>[^<]*As this development continues to unfold across Nigeria,?\s*key questions remain regarding regulatory oversight[^<]*<\/p>/gi, '')
    .replace(/As this development continues to unfold across Nigeria,?\s*key questions remain regarding regulatory oversight[^.\n<]*(\.|\n|<)/gi, '')
    .replace(/<h3>The Stakes<\/h3>[\s\S]*?<p>This development is poised to impact governance, citizens, and relevant market sectors across Nigeria\.?<\/p>/gi, '')
    .replace(/<p>This development is poised to impact governance, citizens, and relevant market sectors across Nigeria\.?<\/p>/gi, '')
    .replace(/<h3>The Stats<\/h3>[\s\S]*?<\/ul>/gi, '')
    .replace(/<blockquote>["']?Accurate, verified reporting remains vital for public awareness["']?[^<]*<\/blockquote>/gi, '')
    .replace(/<li><strong>Status:<\/strong>\s*Active lead verified by 9jaBeacon Editorial Desk<\/li>/gi, '')
    .replace(/<p>Authorities and industry stakeholders are actively monitoring the situation\.?<\/p>/gi, '')
    .replace(/<p>compiling further operational updates[^<]*<\/p>/gi, '')
    .replace(/<p>Field dispatches and corroborating sources[^<]*<\/p>/gi, '')
    .replace(/<h3>The Scoop<\/h3>/gi, '<h3>What happened</h3>');

  // 4. Strip raw RSS junk and bylines — BUT keep real hrefs intact
  // Only remove bare URLs that appear as plain text (not inside attributes)
  text = text
    .replace(/The post\s+.*?appeared first on\s+.*?(\.|$)/gi, '')
    .replace(/Read (more|original report|full story) on\s+.*?(\.|$)/gi, '')
    .replace(/(^|[^"'=\/])(https?:\/\/[^\s\)<>"']+)/gi, '$1')
    .replace(/All rights reserved\b.*?(\.|$)/gi, '')
    .replace(/Copyright\s+©\s+.*?(\.|$)/gi, '')
    .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '');

  // 5. Normalize linebreaks & clean stray non-breaking spaces
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/&nbsp;/g, ' ');

  // 6. Transform Markdown Headings (### Heading, ## Heading, # Heading)
  text = text.replace(/^###\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^##\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^#\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');

  // 7. Bold & Italics conversions
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^\*\n\<\>]+)\*/g, '<em>$1</em>');
  text = text.replace(/\*{2,}/g, '').replace(/(^|\s)\*(?=\s|$)/g, '$1');

  // 8. Blockquotes
  text = text.replace(
    /^>\s+(.+)$/gm,
    '<blockquote class="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-slate-700 dark:text-slate-300 italic font-medium bg-slate-50 dark:bg-slate-900/40 rounded-r-xl">$1</blockquote>'
  );

  // Normalize and repair any legacy or broken nested banner heading divs
  text = text.replace(/<div class="native-banner-heading[^"]*"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>[\s\S]*?<\/div>/gi, (_, title) => {
    const cleanTitle = title.replace(/<[^>]*>/g, '').trim();
    return formatNativeBannerHeading(cleanTitle);
  });
  text = text.replace(/<div class="native-banner-heading[^"]*"[^>]*>/gi, '');
  text = text.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)\s*<\/p>/gi, '$1');
  text = text.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/gi, '$1');
  text = text.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');

  // 9. Parse blocks: match headings and paragraphs
  const rawBlocks = text.split(/(?:<\/p>|<p>|\n\s*\n)/i).map((b) => b.trim()).filter(Boolean);
  const formattedBlocks: string[] = [];

  for (const block of rawBlocks) {
    const h3Match = block.match(/<h[23][^>]*>(.*?)<\/h[23]>/i);
    if (h3Match) {
      const headingText = h3Match[1].replace(/<[^>]*>/g, '').trim();
      if (headingText) {
        formattedBlocks.push(formatNativeBannerHeading(headingText));
      }
      const remainder = block.replace(/<h[23][^>]*>.*?<\/h[23]>/i, '').trim();
      if (remainder) {
        const cleanRemainder = remainder.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
        if (cleanRemainder.length > 20) {
          formattedBlocks.push(`<p>${cleanRemainder}</p>`);
        }
      }
      continue;
    }

    if (/^<(ul|ol|blockquote|div|table)/i.test(block)) {
      formattedBlocks.push(block);
      continue;
    }

    const cleanP = block.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
    if (!cleanP || cleanP.length < 15) continue;

    formattedBlocks.push(`<p>${cleanP}</p>`);
  }

  return formattedBlocks.join('\n\n');
}

/**
 * Creates an elegant, fully semantic heading with micro-accent indicator.
 */
export function formatNativeBannerHeading(headingText: string): string {
  const cleanTitle = headingText.trim();
  return `<h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 mt-7 mb-3 pb-1.5 border-b border-emerald-500/20 not-prose break-words">
  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
  <span class="leading-tight tracking-tight">${cleanTitle}</span>
</h3>`;
}

export interface ArticleSections {
  lead: string;
  middle1: string;
  middle2: string;
  middle3: string;
  conclusion: string;
  totalBlocks: number;
}

export function partitionArticleForAds(htmlContent: string): ArticleSections {
  if (!htmlContent) {
    return {
      lead: '',
      middle1: '',
      middle2: '',
      middle3: '',
      conclusion: '',
      totalBlocks: 0,
    };
  }

  let sanitized = htmlContent.replace(/<div class="native-banner-heading[^"]*"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>[\s\S]*?<\/div>/gi, (_, title) => {
    return formatNativeBannerHeading(title.replace(/<[^>]*>/g, '').trim());
  });
  sanitized = sanitized.replace(/<div class="native-banner-heading[^"]*"[^>]*>/gi, '');
  sanitized = sanitized.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)\s*<\/p>/gi, '$1');
  sanitized = sanitized.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/gi, '$1');
  sanitized = sanitized.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');

  const blockRegex =
    /(?:<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<blockquote[^>]*>[\s\S]*?<\/blockquote>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>|<p[^>]*>[\s\S]*?<\/p>)/gi;
  const blocks = sanitized.match(blockRegex);

  if (!blocks || blocks.length < 3) {
    return {
      lead: sanitized,
      middle1: '',
      middle2: '',
      middle3: '',
      conclusion: '',
      totalBlocks: blocks ? blocks.length : 1,
    };
  }

  if (blocks.length <= 4) {
    return {
      lead: blocks.slice(0, 2).join('\n\n'),
      middle1: blocks.slice(2).join('\n\n'),
      middle2: '',
      middle3: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  if (blocks.length <= 6) {
    return {
      lead: blocks.slice(0, 2).join('\n\n'),
      middle1: blocks.slice(2, 4).join('\n\n'),
      middle2: blocks.slice(4).join('\n\n'),
      middle3: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  const cut3 = Math.min(blocks.length - 1, 6);
  return {
    lead: blocks.slice(0, 2).join('\n\n'),
    middle1: blocks.slice(2, 4).join('\n\n'),
    middle2: blocks.slice(4, cut3).join('\n\n'),
    middle3: blocks.slice(cut3).join('\n\n'),
    conclusion: '',
    totalBlocks: blocks.length,
  };
}
