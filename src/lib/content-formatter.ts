/**
 * Content Formatter Utility for 9jaBeacon News Reports
 * Cleans up raw AI markdown (asterisks, hashtags, bullets)
 * Breaks massive text walls into clean, journalistic paragraphs (2-3 sentences max)
 * Converts fact sheets & editorial questions into high-contrast callout boxes
 * Supports smart ad insertions across long investigative reports
 */

export function cleanAndFormatArticleHtml(raw: string | undefined | null): string {
  if (!raw) return '<p>Report details are being finalized by the 9jaBeacon Editorial Desk.</p>';

  let text = raw.trim();

  // 1. Strip raw RSS junk and attribution footers
  text = text
    .replace(/The post\s+.*?appeared first on\s+.*?(\.|$)/gi, '')
    .replace(/Read (more|original report|full story) on\s+.*?(\.|$)/gi, '')
    .replace(/All rights reserved\b.*?(\.|$)/gi, '')
    .replace(/Copyright\s+©\s+.*?(\.|$)/gi, '');

  // 2. Normalize linebreaks & clean stray non-breaking spaces
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/&nbsp;/g, ' ');

  // 3. Remove existing wrapper <p> if it wraps the whole text into a single giant block
  if (text.startsWith('<p>') && text.endsWith('</p>') && (text.match(/<p>/gi) || []).length === 1) {
    text = text.slice(3, -4).trim();
  }

  // 4. Transform Markdown Headings (### Heading, ## Heading, # Heading)
  text = text.replace(/^###\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^##\s+(.+)$/gm, '\n\n<h3>$1</h3>\n\n');
  text = text.replace(/^#\s+(.+)$/gm, '\n\n<h2>$1</h2>\n\n');

  // 5. Transform specific Editorial Sections into structured subheads
  text = text.replace(/(^|\n)(Key Fact Sheet & Corroborated Details|Key Facts|Key Fact Sheet)/gi, '\n\n<h3 class="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-6 mb-2">Key Fact Sheet & Corroborated Details</h3>\n\n');
  text = text.replace(/(^|\n)(Editorial Take & Questions to Watch|Editorial Perspective|Questions to Watch)/gi, '\n\n<h3 class="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-6 mb-2">Editorial Take & Questions to Watch</h3>\n\n');

  // 6. Handle inline metadata labels like "Source:", "Subject:", "Classification:"
  text = text.replace(/(^|\n)(Source:)\s*(.+)/gi, '\n\n<p class="text-sm font-medium text-slate-600 dark:text-slate-400"><strong class="text-slate-900 dark:text-slate-100">Source:</strong> $3</p>\n\n');
  text = text.replace(/(^|\n)(Subject:)\s*(.+)/gi, '\n\n<p class="text-sm font-medium text-slate-600 dark:text-slate-400"><strong class="text-slate-900 dark:text-slate-100">Subject:</strong> $3</p>\n\n');
  text = text.replace(/(^|\n)(Classification:)\s*(.+)/gi, '\n\n<p class="text-sm font-medium text-slate-600 dark:text-slate-400"><strong class="text-slate-900 dark:text-slate-100">Classification:</strong> $3</p>\n\n');

  // 7. Bold & Italics conversions
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^\*\n\<\>]+)\*/g, '<em>$1</em>');

  // 8. Strip any leftover lone or trailing asterisks (e.g. "**" or "* ")
  text = text.replace(/\*{2,}/g, '').replace(/(^|\s)\*(?=\s|$)/g, '$1');

  // 9. Blockquotes
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-slate-700 dark:text-slate-300 italic font-medium bg-slate-50 dark:bg-slate-900/40 rounded-r-xl">$1</blockquote>');

  // 10. Extract or split into semantic paragraphs
  // Split on double newlines or existing HTML tags
  const rawParagraphs = text.split(/(?:<\/p>|<p>|\n\s*\n)/i).map(p => p.trim()).filter(Boolean);
  const formattedBlocks: string[] = [];

  for (const block of rawParagraphs) {
    // If it's already an HTML heading, blockquote, or list, keep it
    if (/^<(h[1-6]|ul|ol|blockquote|div|table)/i.test(block)) {
      formattedBlocks.push(block);
      continue;
    }

    // Clean any stray tags inside
    const cleanBlock = block.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
    if (!cleanBlock) continue;

    // Check sentence length: if paragraph is a giant wall of text (> 320 chars or > 3 sentences), split into journalistic paragraphs
    const sentences = cleanBlock.match(/[^.!?]+[.!?]+(?:["'”’\s]+|$)/g);
    if (sentences && sentences.length > 3) {
      let currentChunk = '';
      let sentenceCount = 0;
      for (const sentence of sentences) {
        currentChunk += sentence;
        sentenceCount++;
        // Break after 2 to 3 sentences for comfortable mobile reading
        if (sentenceCount >= 2 && currentChunk.length >= 180) {
          formattedBlocks.push(`<p>${currentChunk.trim()}</p>`);
          currentChunk = '';
          sentenceCount = 0;
        }
      }
      if (currentChunk.trim()) {
        formattedBlocks.push(`<p>${currentChunk.trim()}</p>`);
      }
    } else {
      formattedBlocks.push(`<p>${cleanBlock}</p>`);
    }
  }

  return formattedBlocks.join('\n\n');
}

export interface ArticleSections {
  lead: string;
  middle1: string;
  middle2: string;
  conclusion: string;
  totalBlocks: number;
}

/**
 * Splits an article into multiple sections for strategic ad placement
 * (Slot 1 after ~3rd paragraph, Slot 2 further down in long stories)
 */
export function partitionArticleForAds(htmlContent: string): ArticleSections {
  const blocks = htmlContent.split(/<\/p>|<\/h3>|<\/blockquote>/i).map(b => b.trim()).filter(Boolean);

  // If article is brief (< 4 blocks), keep as single lead
  if (blocks.length < 4) {
    return {
      lead: htmlContent,
      middle1: '',
      middle2: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  // If article is medium (4 - 7 blocks), place 1 ad around paragraph 2-3
  if (blocks.length <= 7) {
    const cut = Math.min(3, Math.floor(blocks.length / 2));
    const part1 = blocks.slice(0, cut).map(b => (b.startsWith('<') ? b : `<p>${b}</p>`)).join('\n');
    const part2 = blocks.slice(cut).map(b => (b.startsWith('<') ? b : `<p>${b}</p>`)).join('\n');
    return {
      lead: part1,
      middle1: part2,
      middle2: '',
      conclusion: '',
      totalBlocks: blocks.length,
    };
  }

  // If article is long (8+ blocks), place 2 ads: one after paragraph 3, another around paragraph 7
  const cut1 = 3;
  const cut2 = Math.min(blocks.length - 2, Math.floor(blocks.length * 0.65));

  const part1 = blocks.slice(0, cut1).map(b => (b.startsWith('<') ? b : `<p>${b}</p>`)).join('\n');
  const part2 = blocks.slice(cut1, cut2).map(b => (b.startsWith('<') ? b : `<p>${b}</p>`)).join('\n');
  const part3 = blocks.slice(cut2).map(b => (b.startsWith('<') ? b : `<p>${b}</p>`)).join('\n');

  return {
    lead: part1,
    middle1: part2,
    middle2: part3,
    conclusion: '',
    totalBlocks: blocks.length,
  };
}

