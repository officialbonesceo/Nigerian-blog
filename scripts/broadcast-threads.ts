/**
 * 9jaBeacon - Standalone Meta Threads Broadcast Script
 * Can be run in CI (GitHub Actions) or CLI: npx tsx scripts/broadcast-threads.ts
 */

import { db } from '../src/lib/db';
import { postToThreads } from '../src/lib/threads';

async function main() {
  console.log('=====================================================');
  console.log('🧵 9jaBeacon Meta Threads Syndication Dispatcher');
  console.log(`📅 Execution Time: ${new Date().toISOString()}`);
  console.log('=====================================================');

  const userId = (process.env.THREADS_USER_ID || '').trim();
  const accessToken = (process.env.THREADS_ACCESS_TOKEN || '').trim();
  const targetSlug = process.argv[2] || process.env.TARGET_SLUG || '';
  const force = process.env.FORCE_BROADCAST === 'true' || process.argv.includes('--force');

  if (!userId || !accessToken) {
    console.error('❌ Missing THREADS_USER_ID or THREADS_ACCESS_TOKEN.');
    console.error('   Please configure THREADS_USER_ID and THREADS_ACCESS_TOKEN in GitHub Actions Secrets or .env.');
    process.exit(1);
  }

  let article: any = null;

  if (targetSlug) {
    article = db.prepare('SELECT * FROM articles WHERE slug = ?').get(targetSlug);
    if (!article) {
      console.error(`❌ Article with slug "${targetSlug}" not found in database.`);
      process.exit(1);
    }
  } else {
    // Scan recent published articles to find the first unsyndicated story
    const candidateArticles = db.prepare(`
      SELECT * FROM articles 
      WHERE status = 'published' 
      ORDER BY published_at DESC 
      LIMIT 25
    `).all() as any[];

    if (!candidateArticles.length) {
      console.log('ℹ️ No published articles found in database to broadcast.');
      process.exit(0);
    }

    if (force) {
      article = candidateArticles[0];
    } else {
      for (const cand of candidateArticles) {
        const logged = db.prepare(`
          SELECT * FROM automation_logs 
          WHERE event_type = 'THREADS_PUBLISH_SUCCESS' 
            AND (source_id = ? OR message LIKE ?)
        `).get(cand.id, `%${cand.slug}%`);

        if (!logged) {
          article = cand;
          break;
        }
      }

      if (!article) {
        console.log(`✅ All ${candidateArticles.length} recent articles have already been broadcasted to Threads.`);
        process.exit(0);
      }
    }
  }

  console.log(`📰 Selected article: "${article.title}"`);
  console.log(`🔗 Slug: /news/${article.slug}`);

  const siteUrl = (process.env.SITE_URL || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');
  const canonicalUrl = `${siteUrl}/news/${article.slug}`;

  const res = await postToThreads({
    title: article.title,
    summary: article.summary || '',
    canonicalUrl,
    category: article.category_id || '',
    imageUrl: article.image_url || '',
    userId,
    accessToken,
  });

  if (res.success) {
    console.log(`✅ Successfully published to Threads!`);
    console.log(`🔗 Post URL: ${res.postUrl}`);

    try {
      db.prepare(`
        INSERT INTO automation_logs (id, event_type, source_id, message, level, created_at)
        VALUES (?, 'THREADS_PUBLISH_SUCCESS', ?, ?, 'info', CURRENT_TIMESTAMP)
      `).run(
        'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        article.id,
        `Dispatched to Threads: ${res.postUrl || article.slug}`
      );
    } catch {}
  } else {
    console.error(`❌ Threads syndication error: ${res.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
