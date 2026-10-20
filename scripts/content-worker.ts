/**
 * Content worker entry for GitHub Actions.
 *
 * Quota policy:
 * - Max MAX_ARTICLES_PER_CATEGORY_PER_DAY (default 2) published per category per UTC day
 * - Categories already at cap are skipped entirely (no RSS fetch for their sources)
 * - Only unfilled categories are processed, each with maxArticles = remaining slots
 */
import { getD1 } from '../src/lib/runtime-db';
import { runIngestionPipeline } from '../src/lib/automated-ingest-pipeline';
import {
  CATEGORY_IDS,
  countPublishedTodayByCategory,
  buildRemainingSlots,
} from '../src/lib/ingest-category-quota';

async function main() {
  const maxPerCategory = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_CATEGORY_PER_DAY || '2', 10) || 2, 1),
    5
  );

  console.log('=== 9jaBeacon content worker ===');
  console.log('MAX_ARTICLES_PER_CATEGORY_PER_DAY:', maxPerCategory);
  console.log('Mode: per-category quota → skip full desks → RSS → rank → rewrite');

  const db = getD1();
  const todayCounts = await countPublishedTodayByCategory(db);
  const { remainingByCat, totalSlots } = buildRemainingSlots(todayCounts, maxPerCategory);

  for (const id of CATEGORY_IDS) {
    console.log(
      `[quota] ${id}: today=${todayCounts[id] || 0}/${maxPerCategory} remaining=${remainingByCat[id]}`
    );
  }

  if (totalSlots <= 0) {
    console.log('[ingest] All categories filled for today — no RSS/AI work');
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
      console.log(`[ingest] skip ${categoryId} (already at daily cap)`);
      continue;
    }

    console.log(`[ingest] processing ${categoryId} (slots=${slots})`);
    const result = await runIngestionPipeline(db, {
      categoryId,
      maxArticles: slots,
      limitPerSource: 5,
    });

    combined.fetched += result.fetched || 0;
    combined.passed += result.passed || 0;
    combined.rejected += result.rejected || 0;
    combined.inserted += result.inserted || 0;
    if (result.errors?.length) combined.errors.push(...result.errors);

    console.log(
      `[ingest] ${categoryId} done: inserted=${result.inserted} rejected=${result.rejected}`
    );
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
