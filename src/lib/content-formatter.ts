/**
 * Content Formatter Utility for 9jaBeacon News Reports
 * - Strips all fallback templates, boilerplate, and scraped artifacts
 * - Ensures each paragraph has a sleek, non-obstructive native banner heading
 * - Guarantees clean 3-4 paragraph journalistic structure
 * - Partitions articles cleanly for in-article native ad placements
 */

export function cleanAndFormatArticleHtml(raw: string | undefined | null): string {
  if (!raw) return '';

  let text = raw.trim();

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

  // 3. Purge all deprecated fallback template boilerplate and generic filler blocks
  text = text
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
    .replace(/<h3>The Scoop<\/h3>/gi, '<h3>The Crux: What Happened & Verified Facts</h3>');

  // 4. Strip raw RSS junk, bylines, and attribution footers
  text = text
    .replace(/The post\s+.*?appeared first on\s+.*?(\.|$)/gi, '')
    .replace(/Read (more|original report|full story) on\s+.*?(\.|$)/gi, '')
    .replace(/https?:\/\/[^\s\)<>]+/gi, '')
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
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-slate-700 dark:text-slate-300 italic font-medium bg-slate-50 dark:bg-slate-900/40 rounded-r-xl">$1</blockquote>');

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
  const rawBlocks = text.split(/(?:<\/p>|<p>|\n\s*\n)/i).map(b => b.trim()).filter(Boolean);
  const formattedBlocks: string[] = [];

  for (const block of rawBlocks) {
    // Check if block contains an <h3> heading
    const h3Match = block.match(/<h[23][^>]*>(.*?)<\/h[23]>/i);
    if (h3Match) {
      const headingText = h3Match[1].replace(/<[^>]*>/g, '').trim();
      if (headingText) {
        // Render sleek, semantic, fail-proof heading
        const bannerHtml = formatNativeBannerHeading(headingText);
        formattedBlocks.push(bannerHtml);
      }
      // If there's text after the heading in the same block, format that too
      const remainder = block.replace(/<h[23][^>]*>.*?<\/h[23]>/i, '').trim();
      if (remainder) {
        const cleanRemainder = remainder.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
        if (cleanRemainder.length > 20) {
          formattedBlocks.push(`<p>${cleanRemainder}</p>`);
        }
      }
      continue;
    }

    // Keep lists or blockquotes intact
    if (/^<(ul|ol|blockquote|div|table)/i.test(block)) {
      formattedBlocks.push(block);
      continue;
    }

    // Clean standard paragraph content
    const cleanP = block.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
    if (!cleanP || cleanP.length < 15) continue;

    formattedBlocks.push(`<p>${cleanP}</p>`);
  }

  return formattedBlocks.join('\n\n');
}

/**
 * Creates an elegant, fully semantic heading with micro-accent indicator.
 * Pure semantic HTML (<h3 ...>) avoids nested divs that break responsive rendering on mobile.
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

/**
 * Splits an article into multiple sections for strategic ad placement
 * Guarantees that each block group (~100 words each) can have an ad banner placed seamlessly
 * Accurately extracts complete, well-formed HTML blocks without breaking tags
 */
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

  // Pre-sanitize any legacy nested banner divs in the content to prevent layout splitting bugs
  let sanitized = htmlContent.replace(/<div class="native-banner-heading[^"]*"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>[\s\S]*?<\/div>/gi, (_, title) => {
    return formatNativeBannerHeading(title.replace(/<[^>]*>/g, '').trim());
  });
  sanitized = sanitized.replace(/<div class="native-banner-heading[^"]*"[^>]*>/gi, '');
  sanitized = sanitized.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)\s*<\/p>/gi, '$1');
  sanitized = sanitized.replace(/<p>\s*(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)/gi, '$1');
  sanitized = sanitized.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');

  // Match complete top-level HTML element blocks (headings, paragraphs, blockquotes, lists)
  // Strictly avoiding unconstrained div matching which causes unclosed flex parent bugs
  const blockRegex = /(?:<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<blockquote[^>]*>[\s\S]*?<\/blockquote>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>|<p[^>]*>[\s\S]*?<\/p>)/gi;
  const blocks = sanitized.match(blockRegex);

  // If regex found no structured blocks, fallback safely
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

  // Articles have headings + paragraphs. A 300+ word article typically has 4 to 8 blocks.
  // We want to insert an ad between each major paragraph group (~100 words each).
  if (blocks.length <= 4) {
    const part1 = blocks.slice(0, 2).join('\n\n');
    const part2 = blocks.slice(2).join('\n\n');
    return {
      lead: part1,
      middle1: part2,
      middle2: '',
      middle3: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  if (blocks.length <= 6) {
    const cut1 = 2;
    const cut2 = 4;
    return {
      lead: blocks.slice(0, cut1).join('\n\n'),
      middle1: blocks.slice(cut1, cut2).join('\n\n'),
      middle2: blocks.slice(cut2).join('\n\n'),
      middle3: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  // 7+ blocks (full 350+ word deep-dive article)
  // Split into 4 distinct segments (Paragraph 1 group, Paragraph 2 group, Paragraph 3 group, Final group)
  const cut1 = 2;
  const cut2 = 4;
  const cut3 = Math.min(blocks.length - 1, 6);

  return {
    lead: blocks.slice(0, cut1).join('\n\n'),
    middle1: blocks.slice(cut1, cut2).join('\n\n'),
    middle2: blocks.slice(cut2, cut3).join('\n\n'),
    middle3: blocks.slice(cut3).join('\n\n'),
    conclusion: '',
    totalBlocks: blocks.length,
  };
}

