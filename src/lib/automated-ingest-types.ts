/**
 * Types for automated ingestion
 */
import type { ArticleCategory } from './editorial-pipeline';

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
