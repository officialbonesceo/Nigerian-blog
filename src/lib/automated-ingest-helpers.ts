/**
 * Shared helpers for automated ingestion
 */
export function sanitizeSnippet(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateBaseSlug(title: string): string {
  const clean = (title || 'news-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (clean.length <= 80) return clean;

  const sub = clean.slice(0, 85);
  const lastHyphen = sub.lastIndexOf('-');
  if (lastHyphen > 35) {
    return sub.slice(0, lastHyphen);
  }
  return sub.replace(/-+$/, '');
}
