/**
 * Automated Ingestion Engine (RSS + Gemini) for 9jaBeacon
 * Enforces zero-fail safeguards:
 * 1. fetchRss: HTTP validation, 10s timeout, safe XML parsing, title + link validation.
 * 2. rewriteWithEditorialQuality: Gemini structured output schema, >=250 words, fail-closed.
 * 3. runIngestionPipeline: ingest -> qualityGate -> dedup -> D1 insert -> cache revalidation.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { D1Database } from '@cloudflare/workers-types';
import {
  normalizeCategory,
  qualityGate,
  getDeskAttribution,
  categorySlugToId,
  type ArticleCategory,
} from './editorial-pipeline';
import {
  createArticle,
  invalidateCache,
  recordRejectedArticle,
  getSources,
  getSourceById,
  getAutomationSettings,
  getSiteSettings,
} from './runtime-db';
import type { Article } from './types';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { appendArticleFaq } from './article-faq';
import { isPublisherLogoOrBanner, resolveEditorialImage } from './editorial-image';
import { postToBluesky, checkIfUrlAlreadyOnBlueskyTimeline } from './bluesky';
import { postToBuffer } from './buffer';
import { postToTumblr, checkIfUrlAlreadyOnTumblrBlog } from './tumblr';
import { postToThreads } from './threads';

export interface FeedItemValidated {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
}

export interface FetchRssResult {
  success: boolean;
  feedUrl: string;
  itemCount: number;
  items: FeedItemValidated[];
  error?: string;
}

export interface EditorialRewriteResult {
  success: boolean;
  title?: string;
  summary?: string;
  content?: string;
  category?: ArticleCategory;
  tags?: string[];
  readingTimeMinutes?: number;
  imageSearchKeyword?: string;
  faq?: Array<{ question: string; answer: string }>;
  reasons?: string[];
  rawError?: string;
}

export interface IngestionPipelineResult {
  fetched: number;
  passed: number;
  rejected: number;
  inserted: number;
  errors: string[];
}

/** SEE REPO FILE - partial restore */
export async function fetchRss(feedUrl: string): Promise<FetchRssResult> {
  return { success: false, feedUrl, itemCount: 0, items: [], error: 'incomplete upload - use full file' };
}
