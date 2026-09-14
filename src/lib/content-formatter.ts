/**
 * Content Formatter Utility for 9jaBeacon News Reports
 * Cleans up raw AI markdown (asterisks, hashtags, bullets)
 * Converts to rich, semantic HTML paragraphs, bold highlights, italics, and clean headings
 */

export function cleanAndFormatArticleHtml(raw: string | undefined | null): string {
  if (!raw) return '<p>Report details are being finalized by the 9jaBeacon Editorial Desk.</p>';

  let text = raw.trim();

  // If already formatted with proper HTML structure, clean internal stray markdown and return
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(text);

  if (hasHtmlTags) {
    // Clean rogue asterisks inside existing HTML tags or between them
    text = text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_{2}(.*?)_{2}/g, '<strong>$1</strong>')
      .replace(/_{1}(.*?)_{1}/g, '<em>$1</em>');

    // Remove any accidental markdown header symbols remaining inside html
    text = text.replace(/^#{1,6}\s*(.*?)$/gm, '<h3>$1</h3>');

    // Ensure paragraphs are properly spaced
    return text;
  }

  // Raw text / Markdown pipeline:
  // 1. Normalize newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Headings (### Heading -> <h3>Heading</h3>)
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');

  // 3. Bold + Italics (***text*** or ___text___)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // 4. Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // 5. Italics (*text* or _text_)
  text = text.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // 6. Blockquotes (> quote)
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-1 my-3 text-slate-700 dark:text-slate-300 italic font-medium">$1</blockquote>');

  // 7. Bullet lists (- item or * item)
  const lines = text.split('\n');
  const formattedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^[-*•]\s+(.+)$/.test(line)) {
      if (!inList) {
        formattedLines.push('<ul class="list-disc pl-5 space-y-1.5 my-3">');
        inList = true;
      }
      formattedLines.push(line.replace(/^[-*•]\s+(.+)$/, '<li>$1</li>'));
    } else {
      if (inList) {
        formattedLines.push('</ul>');
        inList = false;
      }
      if (line) {
        formattedLines.push(line);
      }
    }
  }
  if (inList) {
    formattedLines.push('</ul>');
  }

  // 8. Wrap standalone lines into <p> tags if not already an HTML tag
  const resultBlocks: string[] = [];
  for (const block of formattedLines) {
    if (/^<(h[1-6]|ul|ol|blockquote|div|table|p)/i.test(block)) {
      resultBlocks.push(block);
    } else {
      resultBlocks.push(`<p>${block}</p>`);
    }
  }

  return resultBlocks.join('\n\n');
}

/**
 * Splits an article HTML into two parts for inserting an in-article banner
 * between paragraphs or sections naturally without breaking markup.
 */
export function insertInArticleAd(html: string, adSnippet: string): string {
  if (!adSnippet || !adSnippet.trim()) return html;

  // Find a good midpoint heading or paragraph tag to insert after
  const targetSplit = /<\/h3>|<\/p>/gi;
  const matches: number[] = [];
  let match;
  while ((match = targetSplit.exec(html)) !== null) {
    matches.push(match.index + match[0].length);
  }

  // If there are at least 3 blocks, insert after the 2nd or 3rd block (around the crux / background)
  if (matches.length >= 3) {
    const splitIndex = matches[Math.min(2, Math.floor(matches.length / 2))];
    return html.slice(0, splitIndex) + '\n\n' + adSnippet + '\n\n' + html.slice(splitIndex);
  }

  // Fallback: append before the last paragraph
  return html + '\n\n' + adSnippet;
}
