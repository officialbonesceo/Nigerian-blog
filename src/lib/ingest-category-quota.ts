import type { D1Database } from '@cloudflare/workers-types';

export const CATEGORY_IDS = ['cat_naija_news', 'cat_money_hustle', 'cat_sports', 'cat_world'] as const;

/** Africa/Lagos has no DST — fixed UTC+1. */
const WAT_OFFSET_MS = 3600_000;

/** Start/end of current Nigerian calendar day, as UTC ISO strings. */
export function watDayRangeUtc(now = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  const y = wat.getUTCFullYear();
  const m = wat.getUTCMonth();
  const d = wat.getUTCDate();
  const startMs = Date.UTC(y, m, d) - WAT_OFFSET_MS;
  const endMs = startMs + 24 * 3600_000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    label: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')} WAT`,
  };
}

/**
 * Count published articles per category for today's WAT window.
 * Throws on query failure so the worker can fail closed (do not treat as zero).
 */
export async function countPublishedTodayByCategory(
  db: D1Database
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of CATEGORY_IDS) counts[id] = 0;

  const { startIso, endIso, label } = watDayRangeUtc();
  const res = await db
    .prepare(
      `SELECT category_id, COUNT(*) AS c
       FROM articles
       WHERE (status = 'published' OR status IS NULL)
         AND published_at >= ?
         AND published_at < ?
       GROUP BY category_id`
    )
    .bind(startIso, endIso)
    .all<{ category_id: string; c: number }>();

  for (const row of res?.results || []) {
    const key = String(row.category_id || '');
    if (key in counts) counts[key] = Number(row.c) || 0;
    else counts[key] = Number(row.c) || 0;
  }
  console.log(`[quota] day=${label}`, counts);
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
