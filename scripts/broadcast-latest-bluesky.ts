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
    // Automatically select the latest published article that has NEVER been syndicated to Bluesky
    try {
      article = db.prepare(`
        SELECT * FROM articles 
        WHERE status = 'published' 
          AND id NOT IN (
            SELECT source_id FROM automation_logs 
            WHERE event_type = 'BLUESKY_PUBLISH_SUCCESS' AND source_id IS NOT NULL
          )
        ORDER BY published_at DESC 
        LIMIT 1
      `).get();
    } catch {
      article = null;
    }

    if (!article) {
      console.log('✅ Deduplication check passed: All published stories in database have already been syndicated to Bluesky.');
      console.log('   No new unsyndicated stories found. Skipping redundant post to prevent timeline spam.');
      process.exit(0);
    }
  }

  // Live timeline check against Bluesky author feed to avoid any duplicate posts across different runs
  if (!force) {
    console.log(`🔍 Verifying against live Bluesky timeline for duplicate prevention...`);
    const liveCheck = await checkIfUrlAlreadyOnBlueskyTimeline(identifier, article.slug);
    if (liveCheck.exists) {
      console.log(`ℹ️ Live timeline check: Story "/news/${article.slug}" already exists on Bluesky timeline.`);
      console.log(`   Live URL: ${liveCheck.postUrl || 'Active on profile'}`);
      console.log(`   Skipping duplicate broadcast. Pass --force to override.`);

      // Sync local log so subsequent queries avoid checking it again
      try {
        db.prepare(`
          INSERT INTO automation_logs (id, event_type, source_id, message, level)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          'BLUESKY_PUBLISH_SUCCESS',
          article.id,
          `Deduplicated via live timeline: ${liveCheck.postUrl || article.slug}`,
          'info'
        );
      } catch {}

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
        `CI Syndication to Bluesky: ${result.postUrl}`,
        'info'
      );
    } catch {}
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
