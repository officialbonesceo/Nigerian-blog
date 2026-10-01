/**
 * 9jaBeacon Automated Content Synchronization & Publishing Worker
 * Synchronizes verified wire bulletins, handles editorial synthesis, and updates publication channels.
 *
 * Ephemeral CI runtime: Remote D1 instance serves as the production datastore,
 * updated through scripts/sync-upstream.ts.
 */

import Parser from 'rss-parser';
import { db } from '../src/lib/db';
import { initialCategories, initialSources } from '../src/lib/seed-data';
import { uploadToCloudinaryDetailed, verifyCloudinaryConnection } from '../src/lib/cloudinary';
import {
  synthesizeNewsArticle,
  generateEditorialNewsImage,
  type AiCredentialsConfig
} from '../src/lib/ai-engine';
import {
  discoverOpenRouterFreeModels,
  discoverCloudflareModels,
  getVerifiedWorkingOpenRouterModels,
  getVerifiedWorkingCloudflareModels,
} from '../src/lib/dynamic-model-discovery';
import {
  fetchGoogleTrendsNigeria,
  compileTrendingBriefingBundle,
  checkTodayPublishedCount,
} from '../src/lib/trending-search-engine';

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
  const geminiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'true')
    ? process.env.GEMINI_API_KEY
    : dbSettings.gemini_api_key;

  const aiConfig: AiCredentialsConfig = {
    geminiApiKey: geminiKey,
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
  console.log(`  ✨ Google Gemini AI:     ${aiConfig.geminiApiKey ? '✅ Configured (gemini-3.5-flash / gemini-3.6-flash)' : 'ℹ️ Not set'}`);

  let workingOpenRouterModels: string[] = [];
  let workingCloudflareModels: string[] = [];

  // Live Discovery for OpenRouter Free Models
  if (aiConfig.openrouterApiKey) {
    try {
      console.log('  🌐 OpenRouter: Probing endpoint for working & free models...');
      const orResult = await getVerifiedWorkingOpenRouterModels(aiConfig.openrouterApiKey, { maxToProbe: 4 });
      workingOpenRouterModels = orResult.workingModels;
      console.log(`     ✅ Found ${workingOpenRouterModels.length} working free models: ${workingOpenRouterModels.slice(0, 3).join(', ')}`);
    } catch (e: any) {
      console.warn(`     ⚠️ OpenRouter probe notice: ${e.message}`);
    }
  } else {
    try {
      const orDiscovered = await discoverOpenRouterFreeModels();
      console.log(`  🌐 OpenRouter Catalog:   ℹ️ Discovered ${orDiscovered.length} free models (Top: ${orDiscovered.slice(0, 3).join(', ')})`);
      workingOpenRouterModels = orDiscovered;
    } catch {}
  }

  // Live Discovery for Cloudflare Workers AI Models
  if (aiConfig.cloudflareAccountId && aiConfig.cloudflareApiToken) {
    try {
      console.log('  ⚡ Cloudflare: Searching endpoint for deployed LLM models...');
      const cfResult = await getVerifiedWorkingCloudflareModels(aiConfig.cloudflareAccountId, aiConfig.cloudflareApiToken, { maxToProbe: 4 });
      workingCloudflareModels = cfResult.workingModels;
      console.log(`     ✅ Found ${workingCloudflareModels.length} working models: ${workingCloudflareModels.slice(0, 3).join(', ')}`);
    } catch (e: any) {
      console.warn(`     ⚠️ Cloudflare probe notice: ${e.message}`);
    }
  } else {
    try {
      const cfDiscovered = await discoverCloudflareModels();
      console.log(`  ⚡ Cloudflare Catalog:   ℹ️ Discovered ${cfDiscovered.length} active models (Top: ${cfDiscovered.slice(0, 3).join(', ')})`);
      workingCloudflareModels = cfDiscovered;
    } catch {}
  }

  aiConfig.workingOpenRouterModels = workingOpenRouterModels;
  aiConfig.workingCloudflareModels = workingCloudflareModels;

  console.log(`  🌸 Pollinations Server:   ${aiConfig.pollinationsApiKey ? '✅ Configured' : 'ℹ️ Optional fallback'}`);
  console.log('----------------------------------------------------------------\n');

  // Ensure categories exist in database
  const catCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount === 0) {
    console.log('⚠️ Categories table empty. Seeding essential 9jaBeacon news desks...');
    const insertCat = db.prepare(`
      INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order)
      VALUES (@id, @slug, @name, @description, @icon, @color, @follower_count, @display_order)
    `);
    for (const cat of initialCategories) {
      insertCat.run(cat);
    }
  }

  // Ensure active verified news sources exist
  let sources = db.prepare('SELECT * FROM sources WHERE is_enabled = 1').all() as SourceRow[];
  if (!sources.length) {
    console.log('⚠️ No active sources found in database. Initializing verified Nigerian news RSS feeds...');
    const insertSrc = db.prepare(`
      INSERT OR IGNORE INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes)
      VALUES (@id, @name, @feed_url, @website_url, @category_default_id, @is_enabled, @is_official, @trust_score, @license_notes, @fetch_interval_minutes)
    `);
    for (const src of initialSources) {
      insertSrc.run({
        ...src,
        is_enabled: src.is_enabled ?? 1,
        is_official: src.is_official ?? 0,
        trust_score: src.trust_score ?? 95,
        license_notes: src.license_notes ?? '',
        fetch_interval_minutes: src.fetch_interval_minutes ?? 30,
      });
    }
    sources = db.prepare('SELECT * FROM sources WHERE is_enabled = 1').all() as SourceRow[];
  }
  console.log(`📡 Loaded ${sources.length} active verified RSS news feeds.`);

  const MAX_ARTICLES_PER_RUN = Math.max(parseInt(process.env.MAX_ARTICLES_PER_RUN || '3', 10), 1);
  const dailyQuota = checkTodayPublishedCount(db);
  console.log(`📊 Daily In-Depth Editorial Target: ${dailyQuota.count} / ${dailyQuota.maxAllowed} published today.`);
  if (!dailyQuota.canPublishMore && !process.env.FORCE_RUN) {
    console.log(`✅ Daily quota of ${dailyQuota.maxAllowed} comprehensive articles reached for today. Skipping run to preserve high editorial standards and avoid content dilution.`);
    db.close();
    return;
  }
  const remainingToday = Math.min(MAX_ARTICLES_PER_RUN, Math.max(dailyQuota.maxAllowed - dailyQuota.count, 1));

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
      source_id, source_name, source_original_url, published_at, updated_at, created_at, status
    ) VALUES (
      @id, @slug, @title, @summary, @content, @category_id, @image_url, @image_caption,
      @image_credit, @image_license, @author_name, @author_role, @author_avatar,
      @is_top_story, @is_trending, @is_breaking, @views_count, @reading_time_minutes,
      @source_id, @source_name, @source_original_url, @published_at, @updated_at, @created_at, @status
    )
  `);

  const insertLog = db.prepare(`
    INSERT INTO automation_logs (id, event_type, source_id, message, level)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateSourceCount = db.prepare(`UPDATE sources SET last_fetched_at = ? WHERE id = ?`);

  // Phase 0: Target Real-Time Google Trends Nigeria
  console.log('\n🔥 Phase 0: Querying Google Trends Nigeria for real-time high-volume searches...');
  try {
    const trendingSearches = await fetchGoogleTrendsNigeria();
    console.log(`  🔍 Found ${trendingSearches.length} trending search queries in Nigeria.`);
    for (const trend of trendingSearches.slice(0, 3)) {
      if (totalPublished >= remainingToday) break;
      console.log(`  🎯 Evaluating search trend: "${trend.query}" (${trend.approxTraffic})`);

      const existing = db.prepare('SELECT id FROM articles WHERE title LIKE ? OR summary LIKE ?').get(`%${trend.query}%`, `%${trend.query}%`);
      if (existing) {
        console.log(`     ⏭️ Topic already covered recently. Skipping.`);
        continue;
      }

      const briefing = await compileTrendingBriefingBundle(trend);
      if (!briefing) continue;

      console.log(`     📝 Synthesizing In-Depth Search Story: "${briefing.title.slice(0, 60)}..."`);
      const aiResult = await synthesizeNewsArticle({
        title: briefing.title,
        sourceName: briefing.sourceName,
        originalUrl: briefing.originalUrl,
        description: briefing.description,
        content: briefing.content,
        categoryDefault: briefing.categoryDefault,
      }, aiConfig);

      if (!aiResult.success || !aiResult.title || !aiResult.content) {
        console.warn(`     ⚠️ AI synthesis skipped: ${aiResult.error}`);
        continue;
      }

      const categoryId = aiResult.categoryId || briefing.categoryDefault;
      const desk = EDITORIAL_DESKS[categoryId] || DEFAULT_DESK;
      const slugBase = slugify(aiResult.title);
      let slug = slugBase;
      const existingArticle = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
      if (existingArticle) {
        let counter = 2;
        while (db.prepare('SELECT id FROM articles WHERE slug = ?').get(`${slugBase}-${counter}`)) counter++;
        slug = `${slugBase}-${counter}`;
      }
      const articleId = 'art_' + Date.now();

      let finalImageUrl = '/fallback-image.svg';
      const generatedImage = await generateEditorialNewsImage({ title: aiResult.title, categoryId, summary: aiResult.summary }, aiConfig);
      if (generatedImage.imageUrl) {
        const uploadRes = await uploadToCloudinaryDetailed(generatedImage.imageUrl, { cloudName, uploadPreset, folder: '9jabeacon/articles' });
        if (uploadRes.success && uploadRes.url.includes('res.cloudinary.com')) {
          finalImageUrl = uploadRes.url;
          totalCloudinarySuccess++;
        }
      }

      try {
        if (totalPublished === 0) {
          try { db.prepare("UPDATE articles SET is_top_story = 0 WHERE is_top_story = 1").run(); } catch {}
        }
        insertArticle.run({
          id: articleId, slug, title: aiResult.title, summary: aiResult.summary, content: aiResult.content,
          category_id: categoryId, image_url: finalImageUrl, image_caption: `Verified investigative report on trending national topic: ${trend.query}.`,
          image_credit: briefing.sourceName, image_license: 'Editorial Fair Attribution',
          author_name: desk.name, author_role: desk.role, author_avatar: desk.avatar,
          is_top_story: totalPublished === 0 ? 1 : 0, is_trending: 1, is_breaking: 1,
          views_count: 0, reading_time_minutes: aiResult.readingTimeMinutes || 4,
          source_id: 'src_trending_engine', source_name: briefing.sourceName, source_original_url: briefing.originalUrl,
          published_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_at: new Date().toISOString(), status: 'published',
        });
        totalPublished++;
        console.log(`     ✅ [STORED TRENDING LEAD] ${articleId} | /news/${slug}`);
      } catch (err: any) {
        console.error(`     ❌ Insert error: ${err.message}`);
      }
    }
  } catch (trendErr: any) {
    console.warn(`  ⚠️ Google Trends scanner notice: ${trendErr.message}`);
  }

  // Phase 1: Ingest feeds and collect candidates across all enabled wire sources
  interface RankedCandidate {
    source: SourceRow;
    item: CustomItem;
    score: number;
  }

  const candidatePool: RankedCandidate[] = [];

  const HIGH_IMPACT_KEYWORDS = [
    'breaking', 'cbn', 'naira', 'tinubu', 'president', 'federal', 'inflation',
    'court', 'senate', 'police', 'subsidy', 'economy', 'budget', 'fuel',
    'efcc', 'super eagles', 'osimhen', 'afcon', 'techcabal', 'fintech', 'tax'
  ];

  for (const source of sources) {
    console.log(`\n📻 Scanning Wire Feed: [${source.name}] (${source.feed_url})`);

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
      console.log(`  📑 Found ${feedItems.length} items.`);
      updateSourceCount.run(new Date().toISOString(), source.id);
    } catch (fetchErr: any) {
      console.warn(`  ⚠️ Feed fetch failed for ${source.name}: ${fetchErr.message}`);
      insertLog.run('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), 'FEED_FETCH_ERROR', source.id, `Failed to fetch feed: ${fetchErr.message}`, 'error');
      continue;
    }

    for (const item of feedItems.slice(0, 5)) {
      if (!item.title || !item.link) continue;
      const titleLower = item.title.toLowerCase();

      // Skip obvious commercial promotions or non-news boilerplate
      if (titleLower.includes('sponsored') || titleLower.includes('press release')) continue;

      const existing = db.prepare('SELECT id FROM articles WHERE source_original_url = ? OR title = ?').get(item.link, item.title);
      if (existing) {
        totalDuplicatesSkipped++;
        continue;
      }

      // Calculate quality & journalistic score
      let score = (source.trust_score || 70);

      // Boost for high-impact topics
      for (const kw of HIGH_IMPACT_KEYWORDS) {
        if (titleLower.includes(kw)) {
          score += 15;
        }
      }

      // Boost for content depth & imagery
      const contentLen = (item.contentEncoded || item.content || item.contentSnippet || '').length;
      if (contentLen > 500) score += 20;
      else if (contentLen > 200) score += 10;

      if (item.enclosure?.url || item.mediaContent?.$?.url) {
        score += 10;
      }

      // Boost for recency
      if (item.pubDate || item.isoDate) {
        const itemDate = new Date(item.pubDate || item.isoDate || '').getTime();
        if (!isNaN(itemDate)) {
          const ageHours = (Date.now() - itemDate) / (1000 * 60 * 60);
          if (ageHours <= 6) score += 25;
          else if (ageHours <= 18) score += 15;
        }
      }

      candidatePool.push({ source, item, score });
    }
  }

  // Sort candidates by highest journalistic quality score within each category
  candidatePool.sort((a, b) => b.score - a.score);

  // Group candidate pool by category to guarantee diverse category coverage (prevents Naija News monopolizing all slots)
  const poolByCat: Record<string, RankedCandidate[]> = {
    cat_money_hustle: [],
    cat_sports: [],
    cat_world: [],
    cat_naija_news: [],
  };
  for (const c of candidatePool) {
    const k = c.source.category_default_id || 'cat_naija_news';
    if (poolByCat[k]) poolByCat[k].push(c);
    else poolByCat.cat_naija_news.push(c);
  }

  // Interleave candidates so Business, Sports, World, and Naija News each get an equal turn
  const balancedCandidates: RankedCandidate[] = [];
  const catKeys = ['cat_money_hustle', 'cat_sports', 'cat_world', 'cat_naija_news'];
  const maxPoolDepth = Math.max(...catKeys.map((k) => poolByCat[k].length), 0);
  for (let d = 0; d < maxPoolDepth; d++) {
    for (const k of catKeys) {
      if (poolByCat[k][d]) balancedCandidates.push(poolByCat[k][d]);
    }
  }

  const activeCandidates = balancedCandidates.length ? balancedCandidates : candidatePool;
  console.log(`\n🎯 Evaluated ${candidatePool.length} fresh leads across all feeds (${poolByCat.cat_money_hustle.length} Business, ${poolByCat.cat_sports.length} Sports, ${poolByCat.cat_world.length} World, ${poolByCat.cat_naija_news.length} Naija News). Balanced selection active.`);

  // Phase 2: Synthesize and publish the curated stories
  for (const candidate of activeCandidates) {
    if (totalPublished >= MAX_ARTICLES_PER_RUN) break;

    const { source, item, score } = candidate;
    totalProcessed++;

    console.log(`\n  📝 [Score ${score}] Synthesizing Top Lead: "${item.title?.slice(0, 65)}..." (${source.name})`);
    const rawDescription = item.contentSnippet || item.content || '';
    const rawContent = (item.contentEncoded || item.content || rawDescription).trim();

    // Fail-closed requirement: source_url and source_excerpt must be present
    if (!item.link || !rawContent || rawContent.length < 50) {
      console.warn(`  🛑 [INPUT REJECTION] Candidate missing required source_url or source_excerpt.`);
      continue;
    }

    const aiResult = await synthesizeNewsArticle({
      title: item.title || '',
      sourceName: source.name,
      originalUrl: item.link || '',
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
      // Continue to next ranked candidate in pool
      continue;
    }

      const providerLabel = `${aiResult.provider || 'unknown'} (${aiResult.modelUsed || 'default'})`;
      aiUsageStats[providerLabel] = (aiUsageStats[providerLabel] || 0) + 1;
      const categoryId = aiResult.categoryId || source.category_default_id || 'cat_naija_news';
      const desk = EDITORIAL_DESKS[categoryId] || DEFAULT_DESK;
      const slugBase = slugify(aiResult.title);
      let slug = slugBase;
      // Guarantee clean URL without random hashes, only numbering on rare collision
      const existingArticle = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
      if (existingArticle) {
        let counter = 2;
        while (db.prepare('SELECT id FROM articles WHERE slug = ?').get(`${slugBase}-${counter}`)) {
          counter++;
        }
        slug = `${slugBase}-${counter}`;
      }
      const articleId = 'art_' + Date.now();

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
        if (totalPublished === 0) {
          try { db.prepare("UPDATE articles SET is_top_story = 0 WHERE is_top_story = 1").run(); } catch {}
        }
        insertArticle.run({
          id: articleId, slug, title: aiResult.title, summary: aiResult.summary, content: aiResult.content,
          category_id: categoryId, image_url: finalImageUrl, image_caption: imageCaption, image_credit: imageCredit,
          image_license: source.license_notes || 'Editorial Fair Attribution', author_name: desk.name,
          author_role: desk.role, author_avatar: desk.avatar,
          is_top_story: totalPublished === 0 ? 1 : 0,
          is_trending: totalPublished < 4 ? 1 : 0,
          is_breaking: totalPublished < 2 ? 1 : 0,
          views_count: 0, reading_time_minutes: aiResult.readingTimeMinutes || 4, source_id: source.id,
          source_name: source.name, source_original_url: item.link, published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(), created_at: new Date().toISOString(), status: 'published',
        });
        totalPublished++;
        console.log(`     ✅ [STORED] ${articleId} | /news/${slug}`);
        insertLog.run('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), 'ARTICLE_PUBLISHED', source.id, `Synthesized & published "${aiResult.title.slice(0, 50)}..." via ${aiResult.provider} (${aiResult.modelUsed}).`, 'info');
      } catch (insertErr: any) {
        console.error(`     ❌ Database insertion error: ${insertErr.message}`);
      }

      if (totalPublished >= MAX_ARTICLES_PER_RUN) break;
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
  const decoded = text
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/gi, '')
    .replace(/&amp;/gi, 'and')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/['’]/g, '');
  return decoded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 85);
}

main().catch((err) => {
  console.error('💥 Fatal error in ingestion pipeline:', err);
  process.exit(1);
});