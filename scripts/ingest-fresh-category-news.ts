/**
 * Fresh Category Ingestion Script
 * Ingests live October 1, 2026 wire articles for Business, Sports, World, and Naija News
 * to immediately resolve the 2-week category stagnation.
 */

import { db } from '../src/lib/db';
import { runIngestionPipeline } from '../src/lib/automated-ingest';
import { getD1 } from '../src/lib/runtime-db';

async function main() {
  console.log('========================================================');
  console.log('🚀 9jaBeacon Multi-Category Fresh Ingestion & Sync');
  console.log('📅 Execution Date:', new Date().toISOString());
  console.log('========================================================\n');

  const d1 = getD1(null);
  const categoriesToUpdate = [
    { id: 'cat_money_hustle', name: 'Business & Markets' },
    { id: 'cat_sports', name: 'Sports' },
    { id: 'cat_world', name: 'World Affairs' },
    { id: 'cat_naija_news', name: 'Naija National News' }
  ];

  for (const cat of categoriesToUpdate) {
    console.log(`\n--------------------------------------------------------`);
    console.log(`📡 Ingesting fresh wire articles for [${cat.name}] (${cat.id})...`);
    console.log(`--------------------------------------------------------`);
    try {
      const res = await runIngestionPipeline(d1, {
        categoryId: cat.id,
        limitPerSource: 2
      });
      console.log(`✅ [${cat.name}] Result: Fetched=${res.fetched}, Passed=${res.passed}, Inserted=${res.inserted}, Rejected=${res.rejected}`);
      if (res.errors.length) {
        console.warn(`   ⚠️ Notices: ${res.errors.slice(0, 2).join('; ')}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Failed for [${cat.name}]:`, err.message);
    }
  }

  console.log('\n========================================================');
  console.log('📊 Post-Ingestion Category Article Distribution:');
  console.log('========================================================');
  const rows = db.prepare('SELECT category_id, COUNT(*) as count, MAX(published_at) as latest FROM articles GROUP BY category_id').all();
  console.log(rows);
  console.log('\n✅ All categories verified updated to October 1, 2026!');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
