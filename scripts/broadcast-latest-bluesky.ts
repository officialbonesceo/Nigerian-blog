/**
 * 9jaBeacon - Standalone Bluesky Broadcast Script
 * Can be run in CI (GitHub Actions) or CLI: npx tsx scripts/broadcast-latest-bluesky.ts
 */

import { db } from '../src/lib/db';
import { postToBluesky, checkIfUrlAlreadyOnBlueskyTimeline } from '../src/lib/bluesky';

async function main() {
  console.log('=====================================================');
  console.log('🦋 9jaBeacon Bluesky Syndication Dispatcher');
  console.log(`📅 Execution Time: ${new Date().toISOString()}`);
  console.log('=====================================================');

  const identifier = (process.env.BLUESKY_IDENTIFIER || '').trim();
  const appPassword = (process.env.BLUESKY_APP_PASSWORD || '').trim();
  const targetSlug = process.argv[2] || process.env.TARGET_SLUG || '';
  const force = process.env.FORCE_BROADCAST === 'true' || process.argv.includes('--force');

  if (!identifier || !appPassword) {
    console.error('❌ Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD.');
    console.error('   Please configure these repository secrets in GitHub Actions or in .env.');
    process.exit(1);
  }

  let article: any = null;

  if (targetSlug) {
    article = db.prepare('SELECT * FROM articles WHERE slug = ?').get(targetSlug);
    if (!article) {
      console.error(`❌ Article with slug "${targetSlug}" not found in database.`);
      process.exit(1);
    }

    // Check if target article has already been broadcasted
    if (!force) {
      const alreadyBroadcasted = db.prepare(`
        SELECT * FROM automation_logs 
        WHERE event_type = 'BLUESKY_PUBLISH_SUCCESS' 
          AND (source_id = ? OR message LIKE ?)
      `).get(article.id, `%${article.slug}%`);

      if (alreadyBroadcasted) {
        console.log(`ℹ️ Deduplication: Article "${article.title}" (/news/${article.slug}) was already broadcasted.`);
        console.log(`   Previous log: ${(alreadyBroadcasted as any)?.message}`);
        console.log(`   Pass --force or FORCE_BROADCAST=true to override.`);
        process.exit(0);
      }
    }
  } else {
    // Scan up to 30 recent published articles to find the first unsyndicated story
    const candidateArticles = db.prepare(`
      SELECT * FROM articles 
      WHERE status = 'published' 
      ORDER BY published_at DESC 
      LIMIT 30
    `).all() as any[];

    if (!candidateArticles.length) {
      console.log('ℹ️ No published articles found in database to broadcast.');
      process.exit(0);
    }

    // Retrieve prior successful publish logs
    const existingLogs = db.prepare(`
      SELECT source_id, message FROM automation_logs 
      WHERE event_type = 'BLUESKY_PUBLISH_SUCCESS'
    `).all() as Array<{ source_id?: string; message?: string }>;

    const loggedIds = new Set(existingLogs.map(l => l.source_id).filter(Boolean));
    const loggedMessages = existingLogs.map(l => l.message || '').join(' ');

    console.log(`🔍 Scanning ${candidateArticles.length} recent articles for first unsyndicated story...`);

    for (const candidate of candidateArticles) {
      // 1. Check local logs & syndicated flag
      if (candidate.syndicated_bluesky === 1 || loggedIds.has(candidate.id) || loggedIds.has(candidate.slug) || loggedMessages.includes(candidate.slug)) {
        continue;
      }

      // 2. Check live Bluesky timeline
      if (!force) {
        const liveCheck = await checkIfUrlAlreadyOnBlueskyTimeline(identifier, candidate.slug);
        if (liveCheck.exists) {
          console.log(`   ⏭️ Skipping "/news/${candidate.slug}" (already on Bluesky timeline)`);
          try {
            db.prepare(`
              INSERT INTO automation_logs (id, event_type, source_id, message, level)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              'BLUESKY_PUBLISH_SUCCESS',
              candidate.id,
              `[slug: ${candidate.slug}] Timeline sync: ${liveCheck.postUrl || candidate.slug}`,
              'info'
            );
            db.prepare('UPDATE articles SET syndicated_bluesky = 1 WHERE id = ? OR slug = ?').run(candidate.id, candidate.slug);
          } catch {}
          continue;
        }
      }

      // Found an unsyndicated story!
      article = candidate;
      break;
    }

    if (!article) {
      console.log('✅ Deduplication check passed: All 30 recent published stories have already been broadcasted to Bluesky.');
      console.log('   No new unsyndicated stories found. Skipping to prevent repetitive feed spam.');
      process.exit(0);
    }
  }

  console.log(`📰 Article Selected: "${article.title}"`);
  console.log(`   Slug: /news/${article.slug}`);
  console.log(`   Category: ${article.category_id || 'general'}`);
  console.log(`   Image: ${article.image_url ? 'Yes' : 'None'}`);

  console.log(`\n🚀 Broadcasting to Bluesky account: @${identifier}...`);

  const result = await postToBluesky({
    title: article.title,
    summary: article.summary,
    category: article.category_id,
    imageUrl: article.image_url,
    slug: article.slug,
    canonicalUrl: `https://www.9jabeacon.name.ng/news/${article.slug}`,
  }, {
    identifier,
    appPassword,
  }, 'https://www.9jabeacon.name.ng');

  if (result.success) {
    console.log(`✅ Successfully published to Bluesky!`);
    console.log(`🔗 Live Post URL: ${result.postUrl}`);
    console.log(`🆔 AT Protocol URI: ${result.uri}`);

    try {
      db.prepare(`
        INSERT INTO automation_logs (id, event_type, source_id, message, level)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        'BLUESKY_PUBLISH_SUCCESS',
        article.id,
        `[slug: ${article.slug}] CI Syndication to Bluesky: ${result.postUrl}`,
        'info'
      );
      db.prepare('UPDATE articles SET syndicated_bluesky = 1 WHERE id = ? OR slug = ?').run(article.id, article.slug);
    } catch {}

    // If running in CI with D1 credentials, also persist log directly to production D1
    const d1DbId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_DATABASE_ID || '').trim();
    const d1Token = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
    const d1Account = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    if (d1DbId && d1Token && d1Account) {
      try {
        const { executeD1Query } = await import('../src/lib/d1-sync');
        await executeD1Query(`
          INSERT INTO automation_logs (id, event_type, source_id, message, level)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          'BLUESKY_PUBLISH_SUCCESS',
          article.id,
          `[slug: ${article.slug}] CI Bluesky broadcast: ${result.postUrl}`,
          'info'
        ], { accountId: d1Account, apiToken: d1Token, databaseNameOrId: d1DbId });
        console.log(`📡 Log synced to production D1 database.`);
      } catch (d1Err: any) {
        console.warn('   (Notice: D1 log sync notice)', d1Err.message);
      }
    }
  } else {
    console.error(`❌ Bluesky broadcast failed: ${result.error}`);
    try {
      db.prepare(`
        INSERT INTO automation_logs (id, event_type, source_id, message, level)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        'BLUESKY_PUBLISH_ERROR',
        article.id,
        `CI Bluesky error: ${result.error}`,
        'error'
      );
    } catch {}
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in Bluesky broadcast:', err);
  process.exit(1);
});
