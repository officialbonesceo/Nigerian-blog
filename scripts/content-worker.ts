/**
 * Content worker — max 1 published article per run (site-wide), and at most
 * MAX_ARTICLES_PER_CATEGORY_PER_DAY per category (default 1).
 * Fail closed if quota count fails — never treat error as "0 published".
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
    2
  );
  // Site-wide hard cap (default 1 article per day / run)
  const maxPerRun = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_RUN || '1', 10) || 1, 1),
    4
  );

  console.log('=== 9jaBeacon content worker ===');
  console.log('MAX_ARTICLES_PER_CATEGORY_PER_DAY:', maxPerCategory);
  console.log('MAX_ARTICLES_PER_RUN (global):', maxPerRun);

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
    console.log(
      JSON.stringify(
        { fetched: 0, passed: 0, rejected: 0, inserted: 0, errors: ['quota check failed'] },
        null,
        2
      )
    );
    process.exit(1);
  }

  const totalToday = Object.values(todayCounts).reduce((a, b) => a + (b || 0), 0);
  if (totalToday >= maxPerRun) {
    console.log(
      `[ingest] Site already has ${totalToday} article(s) today (cap=${maxPerRun}) — exit early`
    );
    console.log(
      JSON.stringify(
        {
          fetched: 0,
          passed: 0,
          rejected: 0,
          inserted: 0,
          errors: ['global daily cap reached'],
        },
        null,
        2
      )
    );
    return;
  }

  const { remainingByCat, totalSlots } = buildRemainingSlots(todayCounts, maxPerCategory);
  let slotsLeft = Math.min(totalSlots, maxPerRun - totalToday);

  for (const id of CATEGORY_IDS) {
    console.log(
      `[quota] ${id}: today=${todayCounts[id] || 0}/${maxPerCategory} remaining=${remainingByCat[id]}`
    );
  }
  console.log(`[quota] global slots this run: ${slotsLeft}`);

  if (slotsLeft <= 0) {
    console.log('[ingest] No slots left — exit early');
    console.log(
      JSON.stringify(
        { fetched: 0, passed: 0, rejected: 0, inserted: 0, errors: ['no slots'] },
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
    if (slotsLeft <= 0) break;

    const catSlots = remainingByCat[categoryId] || 0;
    if (catSlots <= 0) {
      console.log(`[ingest] skip ${categoryId} (at category daily cap)`);
      continue;
    }

    const take = Math.min(catSlots, slotsLeft);
    console.log(`[ingest] processing ${categoryId} (slots=${take})`);
    const result = await runIngestionPipeline(db, {
      categoryId,
      maxArticles: take,
      limitPerSource: 3,
    });

    combined.fetched += result.fetched || 0;
    combined.passed += result.passed || 0;
    combined.rejected += result.rejected || 0;
    combined.inserted += result.inserted || 0;
    if (result.errors?.length) combined.errors.push(...result.errors);

    slotsLeft -= result.inserted || 0;
    if ((result.inserted || 0) > 0 && maxPerRun <= 1) {
      console.log('[ingest] global 1/day cap — stopping after first insert');
      break;
    }
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
