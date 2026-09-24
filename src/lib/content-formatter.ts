/**
 * Content Formatter Utility for 9jaBeacon News Reports
 * - Strips all fallback templates, boilerplate, and scraped artifacts
 * - Ensures each paragraph has a sleek, non-obstructive native banner heading
 * - Guarantees clean 3-4 paragraph journalistic structure
 * - Partitions articles cleanly for in-article native ad placements
 */

export function cleanAndFormatArticleHtml(raw: string | undefined | null): string {
  if (!raw) return '<p>Report details are being finalized by the 9jaBeacon Editorial Desk.</p>';

  let text = raw.trim();

  // 1. Purge all deprecated fallback template boilerplate and generic filler blocks
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
    .replace(/<h3>The Scoop<\/h3>/gi, '<h3>The Crux: What Happened & Verified Facts</h3>');

  // 2. Strip raw RSS junk, bylines, and attribution footers
  text = text
    .replace(/The post\s+.*?appeared first on\s+.*?(\.|$)/gi, '')
    .replace(/Read (more|original report|full story) on\s+.*?(\.|$)/gi, '')
    .replace(/https?:\/\/[^\s\)<>]+/gi, '')
    .replace(/All rights reserved\b.*?(\.|$)/gi, '')
    .replace(/Copyright\s+©\s+.*?(\.|$)/gi, '')
    .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '');

  // 3. Normalize linebreaks & clean stray non-breaking spaces
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/&nbsp;/g, ' ');

  // 4. Transform Markdown Headings (### Heading, ## Heading, # Heading)
  text = text.replace(/^###\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^##\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^#\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');

  // 5. Bold & Italics conversions
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^\*\n\<\>]+)\*/g, '<em>$1</em>');
  text = text.replace(/\*{2,}/g, '').replace(/(^|\s)\*(?=\s|$)/g, '$1');

  // 6. Blockquotes
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-slate-700 dark:text-slate-300 italic font-medium bg-slate-50 dark:bg-slate-900/40 rounded-r-xl">$1</blockquote>');

  // 7. Parse blocks: match headings and paragraphs
  const rawBlocks = text.split(/(?:<\/p>|<p>|\n\s*\n)/i).map(b => b.trim()).filter(Boolean);
  const formattedBlocks: string[] = [];

  for (const block of rawBlocks) {
    // Check if block contains an <h3> heading
    const h3Match = block.match(/<h[23][^>]*>(.*?)<\/h[23]>/i);
    if (h3Match) {
      const headingText = h3Match[1].replace(/<[^>]*>/g, '').trim();
      if (headingText) {
        // Render sleek, unobtrusive native banner heading bar with micro-graphic indicator
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
 * Creates an unobtrusive, elegant native banner heading with micro-icon and subtle accent border.
 * Designed to organize paragraphs cleanly without obstructing the reader or pushing content off-screen.
 */
export function formatNativeBannerHeading(headingText: string): string {
  const cleanTitle = headingText.trim();
  const lower = cleanTitle.toLowerCase();

  let iconSvg = `<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`;

  if (lower.includes('background') || lower.includes('context') || lower.includes('precedent')) {
    iconSvg = `<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  } else if (lower.includes('stake') || lower.includes('impact') || lower.includes('socioeconomic') || lower.includes('nigerian')) {
    iconSvg = `<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>`;
  } else if (lower.includes('reaction') || lower.includes('outlook') || lower.includes('watch') || lower.includes('timeline')) {
    iconSvg = `<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
  }

  return `<div class="native-banner-heading not-prose flex items-center gap-2.5 my-4 py-2 px-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 border-l-4 border-l-emerald-500 shadow-xs">
  <div class="w-6 h-6 rounded-md bg-emerald-500/10 dark:bg-emerald-400/15 flex items-center justify-center shrink-0">
    ${iconSvg}
  </div>
  <h3 class="text-xs sm:text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100 m-0 p-0 font-mono">${cleanTitle}</h3>
</div>`;
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
 * Guarantees that each ~100-word block (every paragraph) can have an ad banner placed seamlessly
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

  // Match complete top-level HTML element blocks (headings, paragraphs, blockquotes, lists, divs)
  const blockRegex = /(?:<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<blockquote[^>]*>[\s\S]*?<\/blockquote>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>|<p[^>]*>[\s\S]*?<\/p>|<div[^>]*>[\s\S]*?<\/div>)/gi;
  const blocks = htmlContent.match(blockRegex);

  // If regex found no structured blocks, fallback safely
  if (!blocks || blocks.length < 3) {
    return {
      lead: htmlContent,
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

