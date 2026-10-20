import type { D1Database } from '@cloudflare/workers-types';

export const CATEGORY_IDS = ['cat_naija_news', 'cat_money_hustle', 'cat_sports', 'cat_world'] as const;

export async function countPublishedTodayByCategory(
  db: D1Database
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of CATEGORY_IDS) counts[id] = 0;
  try {
    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);
    const res = await db
      .prepare(
        `SELECT category_id, COUNT(*) AS c
         FROM articles
         WHERE (status = 'published' OR status IS NULL)
           AND published_at >= ?
         GROUP BY category_id`
      )
      .bind(startUtc.toISOString())
      .all<{ category_id: string; c: number }>();
    for (const row of res?.results || []) {
      counts[String(row.category_id || '')] = Number(row.c) || 0;
    }
  } catch (e: any) {
    console.warn('[ingest] category count failed:', e?.message || e);
  }
  return counts;
}

export function normalizeSourceCategoryId(raw: string | null | undefined): string {
  const s = String(raw || '').toLowerCase();
  if (s.includes('money') || s.includes('business')) return 'cat_money_hustle';
  if (s.includes('sport')) return 'cat_sports';
  if (s.includes('world')) return 'cat_world';
  if (s.includes('naija') || s.includes('news')) return 'cat_naija_news';
  return s && s.startsWith('cat_') ? s : 'cat_naija_news';
}

export function buildRemainingSlots(
  todayCounts: Record<string, number>,
  maxPerCategory: number
): { remainingByCat: Record<string, number>; totalSlots: number } {
  const remainingByCat: Record<string, number> = {};
  let totalSlots = 0;
  for (const id of CATEGORY_IDS) {
    const left = Math.max(0, maxPerCategory - (todayCounts[id] || 0));
    remainingByCat[id] = left;
    totalSlots += left;
  }
  return { remainingByCat, totalSlots };
}
