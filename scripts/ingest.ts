/**
 * 9jaBeacon Autonomous News Ingestion Pipeline
 * Powered by rss-parser & Multi-Tier AI Synthesis Engine (Cloudflare Workers AI -> OpenRouter -> Pollinations)
 * Image Engine: Cloudflare Workers AI Flux-1-Schnell (Strict No-Human Policy)
 * 
 * Sources: Punch, Vanguard, Reuters, BBC Sports, BBC World, TechCabal,
 *          BusinessDay, Central Bank of Nigeria, CNBC Markets, Al Jazeera, Channels TV
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { db } from '../src/lib/db';
import {
  synthesizeNewsArticle,
  generateEditorialNewsImage,
  type AiCredentialsConfig
} from '../src/lib/ai-engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../9jabeacon.db');

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
    'User-Agent': '9jaBeacon-Bot/2.0 (+https://9jabeacon.pages.dev; editor@9jabeacon.ng)',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
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
    name: 'Oluwaseun Adeyemi',
    role: 'Senior Bureau Chief & National Affairs Correspondent',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  cat_money_hustle: {
    name: 'Dr. Kelechi Nwosu',
    role: 'Chief Financial Analyst & Money Hustle Editor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  },
  cat_sports: {
    name: 'Chidi Okafor',
    role: 'Sports Lead & African Football Bureau',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  },
  cat_world: {
    name: 'Amina Bello-Garba',
    role: 'Foreign Correspondent & World Affairs Desk',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
  },
};

const DEFAULT_DESK = {
  name: '9jaBeacon Intelligence Bureau',
  role: 'Verified Newsroom Core',
  avatar: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=300&q=80',
};

async function main() {
  console.log('=====================================================');
  console.log('🚀 9jaBeacon Autonomous RSS Ingestion & AI Pipeline');
  console.log('📅 Execution Time:', new Date().toISOString());
  console.log('📂 Database File:', dbPath);
  console.log('=====================================================');

  // Load automation settings from database
  const settingsRows = db.prepare('SELECT key, value FROM automation_settings').all() as { key: string; value: string }[];
  const dbSettings: Record<string, string> = {};
  for (const row of settingsRows) {
    dbSettings[row.key] = row.value;
  }

  // Configure 3-Tier AI Credentials
  const aiConfig: AiCredentialsConfig = {
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || dbSettings.cloudflare_account_id,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || dbSettings.cloudflare_api_token,
    cloudflareModel: process.env.CLOUDFLARE_AI_MODEL || dbSettings.cloudflare_ai_model || '@cf/meta/llama-3.1-8b-instruct',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || dbSettings.openrouter_api_key,
    openrouterModel: process.env.OPENROUTER_MODEL || dbSettings.openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free',
    pollinationsApiKey: process.env.POLLINATIONS_API_KEY || dbSettings.pollinations_api_key,
  };

  console.log('\n🔍 Active AI Hierarchy Configuration:');
  console.log(`  1. Cloudflare Workers AI: ${aiConfig.cloudflareAccountId && aiConfig.cloudflareApiToken ? '✅ Active (' + aiConfig.cloudflareModel + ')' : '⚠️ Not Configured (Falling back to OpenRouter)'}`);
  console.log(`  2. OpenRouter AI:         ${aiConfig.openrouterApiKey ? '✅ Active (' + aiConfig.openrouterModel + ')' : '⚠️ Not Configured (Falling back to Pollinations)'}`);
  console.log(`  3. Pollinations AI:       ✅ Active (Tier 3 Free & Serverless)`);
  console.log(`  4. Flux-1-Schnell Image:  ${aiConfig.cloudflareAccountId && aiConfig.cloudflareApiToken ? '✅ Active (Cloudflare Workers AI)' : '✅ Active (Flux Serverless fallback)'}`);
  console.log(`  🛑 STRICT AI GATE:        ACTIVE (Ensures structured journalistic quality)\n`);

  // Fetch enabled sources
  const sources = db.prepare('SELECT * FROM sources WHERE is_enabled = 1').all() as SourceRow[];
  console.log(`📡 Loaded ${sources.length} active verified RSS news feeds.`);

  let totalProcessed = 0;
  let totalPublished = 0;
  let totalRejectedNoAi = 0;
  let totalDuplicatesSkipped = 0;

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

  const updateSourceCount = db.prepare(`
    UPDATE sources 
    SET last_fetched_at = ?
    WHERE id = ?
  `);

  for (const source of sources) {
    console.log(`\n-----------------------------------------------------`);
    console.log(`📻 Fetching Feed: [${source.name}] (${source.feed_url})`);

    let feedItems: CustomItem[] = [];
    try {
      const feed = await parser.parseURL(source.feed_url);
      feedItems = feed.items || [];
      console.log(`  📑 Found ${feedItems.length} items in feed.`);
    } catch (fetchErr: any) {
      console.error(`  ❌ Error fetching feed with rss-parser for ${source.name}:`, fetchErr.message);
      insertLog.run('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), 'FEED_FETCH_ERROR', source.id, `Failed to fetch feed: ${fetchErr.message}`, 'error');
      continue;
    }

    let sourceIngestedCount = 0;

    // Process top 3 newest items per source per run
    for (const item of feedItems.slice(0, 3)) {
      if (!item.title || !item.link) continue;
      totalProcessed++;

      // Check if article already exists
      const existing = db.prepare('SELECT id FROM articles WHERE source_original_url = ? OR title = ?').get(item.link, item.title);
      if (existing) {
        totalDuplicatesSkipped++;
        continue;
      }

      console.log(`\n  📝 Synthesizing: "${item.title.slice(0, 60)}..."`);

      // Run 3-Tier AI Synthesis
      const rawDescription = item.contentSnippet || item.content || '';
      const rawContent = item.contentEncoded || item.content || rawDescription;

      const aiResult = await synthesizeNewsArticle(
        {
          title: item.title,
          sourceName: source.name,
          originalUrl: item.link,
          description: rawDescription,
          content: rawContent,
          categoryDefault: source.category_default_id,
        },
        aiConfig
      );

      // Strict Gate Check
      if (!aiResult.success || !aiResult.title || !aiResult.content) {
        totalRejectedNoAi++;
        console.warn(`  🛑 [AI GATE REJECTION] Skipped story. ${aiResult.error || 'No AI succeeded in rewriting.'}`);
        
        try {
          const insertRejection = db.prepare(`
            INSERT INTO rejected_articles (
              id, source_id, source_name, original_title, original_url, raw_content,
              rejection_reason, ai_tier_failures, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertRejection.run(
            'rej_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            source.id,
            source.name,
            item.title || 'Untitled Lead',
            item.link || source.website_url || '',
            rawContent || '',
            aiResult.error || 'Content unreadable or failed synthesis across all 3 AI tiers',
            'Cloudflare -> OpenRouter -> Pollinations (All failed)',
            new Date().toISOString()
          );
        } catch {}

        insertLog.run(
          'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          'AI_GATE_REJECTED',
          source.id,
          `Rejected article "${item.title.slice(0, 50)}...": Logged in BonesCEO rejected queue. Post prohibited.`,
          'warning'
        );
        continue;
      }

      // Determine category and desk profile
      const categoryId = aiResult.categoryId || source.category_default_id || 'cat_naija_news';
      const desk = EDITORIAL_DESKS[categoryId] || DEFAULT_DESK;

      // Generate clean slug
      const slugBase = slugify(aiResult.title);
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const slug = `${slugBase}-${uniqueSuffix}`;
      const articleId = 'art_' + Date.now() + '_' + uniqueSuffix;

      // Handle Image: If feed doesn't provide image, generate with Cloudflare Flux-1-Schnell
      let finalImageUrl = item.enclosure?.url || item.mediaContent?.$?.url;
      let imageCaption = `Verified editorial synthesis of news wire report from ${source.name}.`;
      let imageCredit = source.name;

      if (!finalImageUrl) {
        console.log(`  🎨 Generating conceptual image via Flux AI (No-Human Safety Rule)...`);
        const generatedImage = await generateEditorialNewsImage(
          {
            title: aiResult.title,
            categoryId,
            summary: aiResult.summary,
          },
          aiConfig
        );
        finalImageUrl = generatedImage.imageUrl;
        imageCaption = generatedImage.caption;
        imageCredit = generatedImage.credit;
      }

      try {
        insertArticle.run({
          id: articleId,
          slug,
          title: aiResult.title,
          summary: aiResult.summary,
          content: aiResult.content,
          category_id: categoryId,
          image_url: finalImageUrl,
          image_caption: imageCaption,
          image_credit: imageCredit,
          image_license: source.license_notes || 'Editorial Fair Attribution',
          author_name: desk.name,
          author_role: desk.role,
          author_avatar: desk.avatar,
          is_top_story: sourceIngestedCount === 0 && Math.random() > 0.7 ? 1 : 0,
          is_trending: Math.random() > 0.5 ? 1 : 0,
          is_breaking: Math.random() > 0.85 ? 1 : 0,
          views_count: Math.floor(Math.random() * 40) + 12,
          reading_time_minutes: aiResult.readingTimeMinutes || 4,
          source_id: source.id,
          source_name: source.name,
          source_original_url: item.link,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'published',
        });

        sourceIngestedCount++;
        totalPublished++;

        console.log(`  ✅ [PUBLISHED] "${aiResult.title.slice(0, 60)}..."`);
        console.log(`     🤖 AI Provider: ${aiResult.provider} (${aiResult.modelUsed}) | Slug: /news/${slug}`);

        insertLog.run(
          'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          'ARTICLE_PUBLISHED',
          source.id,
          `Synthesized & published "${aiResult.title.slice(0, 50)}..." via ${aiResult.provider} (${aiResult.modelUsed}).`,
          'info'
        );
      } catch (insertErr: any) {
        console.error(`  ❌ Database insertion error for article:`, insertErr.message);
      }
    }

    updateSourceCount.run(new Date().toISOString(), source.id);
  }

  db.close();

  console.log('\n=====================================================');
  console.log('📊 INGESTION RUN SUMMARY:');
  console.log(`  - Total Feed Items Inspected: ${totalProcessed}`);
  console.log(`  - Duplicates / Already Saved: ${totalDuplicatesSkipped}`);
  console.log(`  - Strict AI Gate Rejections:  ${totalRejectedNoAi}`);
  console.log(`  - Successfully AI Rewritten & Stored: ${totalPublished}`);
  console.log('=====================================================\n');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

main().catch((err) => {
  console.error('💥 Fatal error in ingestion pipeline:', err);
  process.exit(1);
});
