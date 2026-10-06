/**
 * 9jaBeacon - Standalone Tumblr Broadcast Script
 * Can be run in CI (GitHub Actions) or CLI: npx tsx scripts/broadcast-tumblr.ts
 */

import { db } from '../src/lib/db';
import { postToTumblr } from '../src/lib/tumblr';

async function main() {
  console.log('=====================================================');
  console.log('📟 9jaBeacon Tumblr Syndication Dispatcher');
  console.log(`📅 Execution Time: ${new Date().toISOString()}`);
  console.log('=====================================================');

  let dbBlogId = '';
  let dbToken = '';
  let dbKey = '';
  let dbSecret = '';
  let dbTokenSecret = '';
  try {
    const s = db.prepare('SELECT key, value FROM automation_settings').all() as any[];
    for (const row of s) {
      if (row.key === 'tumblr_blog_identifier') dbBlogId = row.value;
      if (row.key === 'tumblr_token' || row.key === 'tumblr_access_token') dbToken = row.value;
      if (row.key === 'tumblr_consumer_key') dbKey = row.value;
      if (row.key === 'tumblr_consumer_secret') dbSecret = row.value;
      if (row.key === 'tumblr_token_secret') dbTokenSecret = row.value;
    }
  } catch {}

  const blogId = (process.env.TUMBLR_BLOG_IDENTIFIER || process.env.TUMBLR_BLOG_NAME || dbBlogId || '').trim();
  const token = (process.env.TUMBLR_TOKEN || process.env.TUMBLR_ACCESS_TOKEN || dbToken || '').trim();
  const consumerKey = (process.env.TUMBLR_CONSUMER_KEY || dbKey || '').trim();
  const consumerSecret = (process.env.TUMBLR_CONSUMER_SECRET || dbSecret || '').trim();
  const tokenSecret = (process.env.TUMBLR_TOKEN_SECRET || dbTokenSecret || '').trim();
  const targetSlug = process.argv[2] || process.env.TARGET_SLUG || '';
  const force = process.env.FORCE_BROADCAST === 'true' || process.argv.includes('--force');

  if (!blogId) {
    console.error('❌ Missing TUMBLR_BLOG_IDENTIFIER (e.g. 9jabeacon.tumblr.com).');
    console.error('   Please configure this secret in GitHub Actions, .env, or in the 9jaBeacon Admin Panel.');
    process.exit(1);
  }

  if (!token && !consumerKey) {
    console.error('❌ Missing Tumblr credentials.');
    console.error('   Please configure TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET');
    console.error('   or TUMBLR_ACCESS_TOKEN in GitHub Actions Secrets, .env, or in the Admin Panel.');
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
          WHERE event_type = 'TUMBLR_PUBLISH_SUCCESS' 
            AND (source_id = ? OR message LIKE ?)
        `).get(cand.id, `%${cand.slug}%`);

        if (!logged) {
          article = cand;
          break;
        }
      }

      if (!article) {
        console.log(`✅ All ${candidateArticles.length} recent articles have already been broadcasted to Tumblr.`);
        process.exit(0);
      }
    }
  }

  console.log(`📰 Selected article: "${article.title}"`);
  console.log(`🔗 Slug: /news/${article.slug}`);

  const siteUrl = (process.env.SITE_URL || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');
  const canonicalUrl = `${siteUrl}/news/${article.slug}`;

  const res = await postToTumblr({
    title: article.title,
    summary: article.summary || '',
    content: article.content || '',
    imageUrl: article.image_url || '',
    canonicalUrl,
    category: article.category_id || '',
    blogIdentifier: blogId,
    token,
    consumerKey,
    consumerSecret,
    tokenSecret,
  });

  if (res.success) {
    console.log(`✅ Successfully published to Tumblr!`);
    console.log(`🔗 Post URL: ${res.postUrl}`);

    try {
      db.prepare(`
        INSERT INTO automation_logs (id, event_type, source_id, message, level, created_at)
        VALUES (?, 'TUMBLR_PUBLISH_SUCCESS', ?, ?, 'info', CURRENT_TIMESTAMP)
      `).run(
        'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        article.id,
        `Dispatched to Tumblr: ${res.postUrl || article.slug}`
      );
    } catch {}
  } else {
    console.error(`❌ Tumblr syndication error: ${res.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
