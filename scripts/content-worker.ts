/**
 * Content worker entry for GitHub Actions.
 * Per-category daily cap (default 2) — skip filled categories before RSS fetch.
 */
import { getD1 } from '../src/lib/runtime-db';
import { runIngestionPipeline } from '../src/lib/automated-ingest-pipeline';

async function main() {
  // Global ceiling still exists, but category quota is the main throttle
  const maxArticles = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_RUN || '8', 10) || 8, 1),
    12
  );
  const maxPerCategory = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_CATEGORY_PER_DAY || '2', 10) || 2, 1),
    5
  );

  console.log('=== 9jaBeacon content worker ===');
  console.log('MAX_ARTICLES_PER_RUN:', maxArticles);
  console.log('MAX_ARTICLES_PER_CATEGORY_PER_DAY:', maxPerCategory);
  console.log('Mode: skip filled categories → RSS only open desks → rank → full-text → rewrite');

  const db = getD1();
  const result = await runIngestionPipeline(db, {
    maxArticles,
    maxPerCategoryPerDay: maxPerCategory,
    limitPerSource: 5,
  });

  console.log('=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.errors.some((e) => e.startsWith('Pipeline exception:'))) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('content-worker failed:', err);
  process.exit(1);
});
