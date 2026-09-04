/**
 * 9jaBeacon Autonomous News Ingestion Pipeline
 * Powered by rss-parser & Multi-Tier AI Synthesis Engine (Cloudflare Workers AI -> OpenRouter -> Pollinations)
 * Image Engine: Cloudflare Workers AI Flux-1-Schnell (Strict No-Human Policy)
 *
 * Sources: Punch, Vanguard, Reuters, BBC Sports, BBC World, TechCabal,
 *          BusinessDay, Central Bank of Nigeria, CNBC Markets, Al Jazeera, Channels TV
 *
 * The Node/SQLite database is ephemeral during CI. D1 is the production
 * source of truth and is updated only by scripts/sync-local-changes-to-d1.ts.
 */

import Parser from 'rss-parser';
import { db } from '../src/lib/db';
import { uploadToCloudinaryDetailed, verifyCloudinaryConnection } from '../src/lib/cloudinary';
import {
  synthesizeNewsArticle,
  generateEditorialNewsImage,
  type AiCredentialsConfig
} from '../src/lib/ai-engine';

interface SourceRow {
  id: string;
  name: string;
  feed_url: string;
  website_url?: string;
  category_default_id: string;
  is_enabled: number;
  trust_score: number;
  license_notes: string;
}

interface CustomItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  contentEncoded?: string;
  creator?: string;
  mediaContent?: { $: { url: string } };
  enclosure?: { url: string };
}

const parser = new Parser<Record<string, unknown>, CustomItem>({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
});

const EDITORIAL_DESKS: Record<string, { name: string; role: string; avatar: string }> = {
  cat_naija_news: {
    name: '9jaBeacon Editorial Team',
    role: 'National News Desk',
    avatar: '/editorial/naija-news-team.svg',
  },
  cat_money_hustle: {
    name: '9jaBeacon Financial Team',
    role: 'Money & Business Desk',
    avatar: '/editorial/finance-team.svg',
  },
  cat_sports: {
    name: '9jaBeacon Sports Team',
    role: 'Sports Desk',
    avatar: '/editorial/sports-team.svg',
  },
  cat_world: {
    name: '9jaBeacon World Desk',
    role: 'World Affairs Desk',
    avatar: '/editorial/world-team.svg',
  },
};

const DEFAULT_DESK = {
  name: '9jaBeacon Editorial Team',
  role: 'Editorial Desk',
  avatar: '/editorial/naija-news-team.svg',
};

function isGoodArticleImage(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  const badPatterns = [
    'logo', 'favicon', 'icon', 'sprite', 'badge',
    'punch', 'vanguard', 'channels', 'guardian',
    'premiumtimes', 'thisday', 'tribune',
    'placeholder', 'default-image', 'no-image'
  ];
  return !badPatterns.some((p) => lower.includes(p));
}

async function main() {
  console.log('=====================================================');
  console.log('🚀 9jaBeacon Autonomous RSS Ingestion & AI Pipeline');
  console.log('📅 Execution Time:', new Date().toISOString());
  console.log('=====================================================');

  const settingsRows = db.prepare('SELECT key, value FROM automation_settings').all() as { key: string; value: string }[];
  const dbSettings: Record<string, string> = {};
  for (const row of settingsRows) dbSettings[row.key] = row.value;

  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== 'true')
    ? process.env.CLOUDFLARE_ACCOUNT_ID
    : dbSettings.cloudflare_account_id;
  const cfToken = (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN !== 'true')
    ? process.env.CLOUDFLARE_API_TOKEN
    : (process.env.CLOUDFLARE_D1_API_TOKEN && process.env.CLOUDFLARE_D1_API_TOKEN !== 'true' ? process.env.CLOUDFLARE_D1_API_TOKEN : dbSettings.cloudflare_api_token);
  const cfModel = (process.env.CLOUDFLARE_AI_MODEL && process.env.CLOUDFLARE_AI_MODEL !== 'true')
    ? process.env.CLOUDFLARE_AI_MODEL
    : (dbSettings.cloudflare_ai_model || '@cf/meta/llama-3.1-8b-instruct');
  const orKey = (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'true')
    ? process.env.OPENROUTER_API_KEY
    : dbSettings.openrouter_api_key;
  const orModel = (process.env.OPENROUTER_MODEL && process.env.OPENROUTER_MODEL !== 'true')
    ? process.env.OPENROUTER_MODEL
    : (dbSettings.openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free');
  const polKey = (process.env.POLLINATIONS_API_KEY && process.env.POLLINATIONS_API_KEY !== 'true')
    ? process.env.POLLINATIONS_API_KEY
    : dbSettings.pollinations_api_key;

  const aiConfig: AiCredentialsConfig = {
    cloudflareAccountId: cfAccount,
    cloudflareApiToken: cfToken,
    cloudflareModel: cfModel,
    openrouterApiKey: orKey,
    openrouterModel: orModel,
    pollinationsApiKey: polKey,
  };

  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'true')
    ? process.env.CLOUDINARY_CLOUD_NAME
    : (dbSettings.cloudinary_cloud_name || 'phwka7ak');
  const uploadPreset = (process.env.CLOUDINARY_UPLOAD_PRESET && process.env.CLOUDINARY_UPLOAD_PRESET !== 'true')
    ? process.env.CLOUDINARY_UPLOAD_PRESET
    : (dbSettings.cloudinary_upload_preset || 'voxawell');

  console.log('\n🔎 RUNNING LIVE API CONNECTION & DIAGNOSTIC VERIFICATION:');
  console.log('----------------------------------------------------------------');
  const cloudinaryCheck = await verifyCloudinaryConnection(cloudName, uploadPreset);
  console.log(`  ☁️ Cloudinary CDN:       ${cloudinaryCheck.verified ? '✅ VERIFIED' : `⚠️ ${cloudinaryCheck.message}`}`);
  console.log(`  ⚡ Cloudflare Workers AI: ${aiConfig.cloudflareAccountId && aiConfig.cloudflareApiToken ? '✅ Configured' : 'ℹ️ Not set'}`);
  console.log(`  🌐 OpenRouter AI Pool:    ${aiConfig.openrouterApiKey ? '✅ Configured' : 'ℹ️ Not set'}`);
  console.log(`  🌸 Pollinations Server:   ${aiConfig.pollinationsApiKey ? '✅ Configured' : 'ℹ️ Optional fallback'}`);
  console.log('----------------------------------------------------------------\n');

  const sources = db.prepare('SELECT * FROM sources WHERE is_enabled = 1').all() as SourceRow[];
  console.log(`📡 Loaded ${sources.length} active verified RSS news feeds.`);

  const MAX_ARTICLES_PER_RUN = 10;
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalPublished = 0;
  let totalRejectedNoAi = 0;
  let totalDuplicatesSkipped = 0;
  let totalCloudinarySuccess = 0;
  let totalCloudinaryFallback = 0;
  const aiUsageStats: Record<string, number> = {};

  const insertArticle = db.prepare(`
    INSERT INTO articles (
      id, slug, title, summary, content, category_id, image_url, image_caption,
      image_credit, image_license, author_name, author_role, author_avatar,
      is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
      source_id, source_name, source_original_url, published_at, updated_at, status
    ) VALUES (
      @id, @slug, @title, @summary, @content, @category_id, @image_url, @image_caption,
      @image_credit, @image_license, @author_name, @author_role, @author_avatar,
      @is_top_story, @is_trending, @is_breaking, @views_count, @reading_time_minutes,
      @source_id, @source_name, @source_original_url, @published_at, @updated_at, @status
    )
  `);

  const insertLog = db.prepare(`
    INSERT INTO automation_logs (id, event_type, source_id, message, level)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateSourceCount = db.prepare(`UPDATE sources SET last_fetched_at = ? WHERE id = ?`);

  for (const source of sources) {
    if (totalPublished >= MAX_ARTICLES_PER_RUN) break;
    console.log(`\n📻 Fetching Feed: [${source.name}] (${source.feed_url})`);

    let feedItems: CustomItem[] = [];
    try {
      const feedRes = await fetch(source.feed_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!feedRes.ok) throw new Error(`HTTP ${feedRes.status}`);
      const feed = await parser.parseString(await feedRes.text());
      feedItems = feed.items || [];
      console.log(`  📑 Found ${feedItems.length} items in feed.`);
    } catch (fetchErr: any) {
      console.warn(`  ⚠️ Feed fetch failed for ${source.name}: ${fetchErr.message}`);
      insertLog.run('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), 'FEED_FETCH_ERROR', source.id, `Failed to fetch feed: ${fetchErr.message}`, 'error');
      continue;
    }

    for (const item of feedItems.slice(0, 3)) {
      if (!item.title || !item.link) continue;
      totalProcessed++;
      const existing = db.prepare('SELECT id FROM articles WHERE source_original_url = ? OR title = ?').get(item.link, item.title);
      if (existing) {
        totalDuplicatesSkipped++;
        continue;
      }

      console.log(`\n  📝 Synthesizing: "${item.title.slice(0, 60)}..."`);
      const rawDescription = item.contentSnippet || item.content || '';
      const rawContent = item.contentEncoded || item.content || rawDescription;
      const aiResult = await synthesizeNewsArticle({
        title: item.title,
        sourceName: source.name,
        originalUrl: item.link,
        description: rawDescription,
        content: rawContent,
        categoryDefault: source.category_default_id,
      }, aiConfig);

      if (!aiResult.success || !aiResult.title || !aiResult.content) {
        totalRejectedNoAi++;
        console.warn(`  🛑 [AI GATE REJECTION] ${aiResult.error || 'No AI succeeded.'}`);
        try {
          db.prepare(`INSERT INTO rejected_articles (id, source_id, source_name, original_title, original_url, raw_content, rejection_reason, ai_tier_failures, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run('rej_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), source.id, source.name, item.title, item.link, rawContent || '', aiResult.error || 'AI synthesis failed', 'Cloudflare -> OpenRouter -> Pollinations (All failed)', new Date().toISOString());
        } catch {}
        continue;
      }

      const providerLabel = `${aiResult.provider || 'unknown'} (${aiResult.modelUsed || 'default'})`;
      aiUsageStats[providerLabel] = (aiUsageStats[providerLabel] || 0) + 1;
      const categoryId = aiResult.categoryId || source.category_default_id || 'cat_naija_news';
      const desk = EDITORIAL_DESKS[categoryId] || DEFAULT_DESK;
      const slugBase = slugify(aiResult.title);
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const slug = `${slugBase}-${uniqueSuffix}`;
      const articleId = 'art_' + Date.now() + '_' + uniqueSuffix;

      let rawImageUrl = item.enclosure?.url || item.mediaContent?.$?.url;
      let imageCaption = `Verified editorial synthesis of news wire report from ${source.name}.`;
      let imageCredit = source.name;
      if (!isGoodArticleImage(rawImageUrl)) rawImageUrl = undefined;

      if (!rawImageUrl) {
        const generatedImage = await generateEditorialNewsImage({ title: aiResult.title, categoryId, summary: aiResult.summary }, aiConfig);
        rawImageUrl = generatedImage.imageUrl;
        imageCaption = generatedImage.caption;
        imageCredit = generatedImage.credit;
      }

      let finalImageUrl = rawImageUrl;
      if (rawImageUrl) {
        const uploadRes = await uploadToCloudinaryDetailed(rawImageUrl, { cloudName, uploadPreset, folder: '9jabeacon/articles' });
        if (uploadRes.success && uploadRes.url.includes('res.cloudinary.com')) {
          finalImageUrl = uploadRes.url;
          totalCloudinarySuccess++;
        } else {
          totalCloudinaryFallback++;
        }
      }
      if (!finalImageUrl) finalImageUrl = '/fallback-image.svg';

      try {
        insertArticle.run({
          id: articleId, slug, title: aiResult.title, summary: aiResult.summary, content: aiResult.content,
          category_id: categoryId, image_url: finalImageUrl, image_caption: imageCaption, image_credit: imageCredit,
          image_license: source.license_notes || 'Editorial Fair Attribution', author_name: desk.name,
          author_role: desk.role, author_avatar: desk.avatar, is_top_story: 0, is_trending: 0, is_breaking: 0,
          views_count: 0, reading_time_minutes: aiResult.readingTimeMinutes || 4, source_id: source.id,
          source_name: source.name, source_original_url: item.link, published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(), status: 'published',
        });
        totalPublished++;
        console.log(`     ✅ [STORED] ${articleId} | /news/${slug}`);
        insertLog.run('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), 'ARTICLE_PUBLISHED', source.id, `Synthesized & published "${aiResult.title.slice(0, 50)}..." via ${aiResult.provider} (${aiResult.modelUsed}).`, 'info');
      } catch (insertErr: any) {
        console.error(`     ❌ Database insertion error: ${insertErr.message}`);
      }

      if (totalPublished >= MAX_ARTICLES_PER_RUN) break;
    }

    updateSourceCount.run(new Date().toISOString(), source.id);
  }

  db.close();
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n================================================================');
  console.log('📊 9JABEACON INGESTION PIPELINE EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`  - Total Execution Time:            ${elapsedSeconds}s`);
  console.log(`  - Total Feed Items Inspected:      ${totalProcessed}`);
  console.log(`  - Duplicates / Already Saved:      ${totalDuplicatesSkipped}`);
  console.log(`  - Strict AI Gate Rejections:       ${totalRejectedNoAi}`);
  console.log(`  - Successfully Published Articles: ${totalPublished} (Capped at max ${MAX_ARTICLES_PER_RUN})`);
  console.log(`  - Cloudinary Images Uploaded:      ${totalCloudinarySuccess}`);
  if (totalCloudinaryFallback > 0) console.log(`  - Images using Wire Fallback:      ${totalCloudinaryFallback}`);
  console.log('\n  🤖 AI Model Distribution in this Run:');
  for (const [provider, count] of Object.entries(aiUsageStats)) console.log(`     • ${provider}: ${count} article(s)`);
  console.log('================================================================\n');
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

main().catch((err) => {
  console.error('💥 Fatal error in ingestion pipeline:', err);
  process.exit(1);
});