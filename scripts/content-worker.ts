/**
 * Content worker — 1 published article per category per WAT day.
 * Quota is counted from the same D1 the worker writes to (via getD1).
 * Fail closed if the count query fails — never treat error as "0 published".
 */
import { getD1 } from '../src/lib/runtime-db';
import { runIngestionPipeline } from '../src/lib/automated-ingest-pipeline';
import {
  CATEGORY_IDS,
  countPublishedTodayByCategory,
  buildRemainingSlots,
} from '../src/lib/ingest-category-quota';
import { buildLocalDedupIndex } from './actions-local-dedup';

async function main() {
  const maxPerCategory = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_CATEGORY_PER_DAY || '1', 10) || 1, 1),
    3
  );

  console.log('=== 9jaBeacon content worker ===');
  console.log('MAX_ARTICLES_PER_CATEGORY_PER_DAY:', maxPerCategory);

  if (process.env.GITHUB_ACTIONS === 'true' || process.env.USE_LOCAL_DEDUP === 'true') {
    try {
      const index = buildLocalDedupIndex();
      (globalThis as any).__9jaLocalDedup = index;
      process.env.USE_LOCAL_DEDUP = 'true';
      console.log('[worker] local dedup index ready');
    } catch (e: any) {
      console.warn('[worker] local dedup unavailable:', e?.message || e);
    }
  }

  const db = getD1();

  let todayCounts: Record<string, number>;
  try {
    todayCounts = await countPublishedTodayByCategory(db);
  } catch (e: any) {
    console.error(
      '[quota] FAILED to read published-today counts — skipping run (fail closed):',
      e?.message || e
    );
    console.log(JSON.stringify({ fetched: 0, passed: 0, rejected: 0, inserted: 0, errors: ['quota check failed'] }, null, 2));
    process.exit(1);
  }

  const { remainingByCat, totalSlots } = buildRemainingSlots(todayCounts, maxPerCategory);

  for (const id of CATEGORY_IDS) {
    console.log(
      `[quota] ${id}: today=${todayCounts[id] || 0}/${maxPerCategory} remaining=${remainingByCat[id]}`
    );
  }

  if (totalSlots <= 0) {
    console.log('[ingest] All categories filled for today — exit early');
    console.log(
      JSON.stringify(
        { fetched: 0, passed: 0, rejected: 0, inserted: 0, errors: ['all categories at daily cap'] },
        null,
        2
      )
    );
    return;
  }

  const combined = {
    fetched: 0,
    passed: 0,
    rejected: 0,
    inserted: 0,
    errors: [] as string[],
  };

  for (const categoryId of CATEGORY_IDS) {
    const slots = remainingByCat[categoryId] || 0;
    if (slots <= 0) {
      console.log(`[ingest] skip ${categoryId} (at daily cap)`);
      continue;
    }

    console.log(`[ingest] processing ${categoryId} (slots=${slots})`);
    const result = await runIngestionPipeline(db, {
      categoryId,
      maxArticles: slots,
      limitPerSource: 4,
    });

    combined.fetched += result.fetched || 0;
    combined.passed += result.passed || 0;
    combined.rejected += result.rejected || 0;
    combined.inserted += result.inserted || 0;
    if (result.errors?.length) combined.errors.push(...result.errors);
  }

  console.log('=== RESULT ===');
  console.log(JSON.stringify(combined, null, 2));

  if (combined.errors.some((e) => e.startsWith('Pipeline exception:'))) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('content-worker failed:', err);
  process.exit(1);
});
