export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  follower_count: number;
  display_order: number;
}

export interface Source {
  id: string;
  name: string;
  feed_url: string;
  website_url: string;
  category_default_id: string;
  is_enabled: number | boolean;
  is_official: number | boolean;
  trust_score: number;
  license_notes: string;
  last_fetched_at: string | null;
  fetch_interval_minutes: number;
  created_at?: string;
  category_name?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  image_url: string;
  image_caption?: string | null;
  image_credit?: string | null;
  image_license?: string | null;
  author_name: string;
  author_role: string;
  author_avatar?: string | null;
  is_top_story: number | boolean;
  is_trending: number | boolean;
  is_breaking: number | boolean;
  views_count: number;
  reading_time_minutes: number;
  source_id?: string | null;
  source_name?: string | null;
  source_original_url?: string | null;
  published_at: string;
  updated_at: string;
  created_at?: string | null;
  status: 'published' | 'draft' | 'archived';
}

export interface AutomationSetting {
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
}

export interface AutomationLog {
  id: string;
  event_type: string;
  source_id?: string;
  source_name?: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  created_at: string;
}

export interface ArticleReport {
  id: string;
  article_id: string;
  article_title?: string;
  article_slug?: string;
  reason: string;
  details?: string;
  reporter_email?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface RejectedArticle {
  id: string;
  source_id?: string;
  source_name?: string;
  original_title: string;
  original_url: string;
  raw_content?: string;
  rejection_reason: string;
  ai_tier_failures?: string;
  status: 'rejected' | 'resolved' | 'published';
  created_at: string;
}

export interface VisitorAnalyticsLog {
  id: string;
  session_id: string;
  visit_date: string;
  page_path: string;
  user_agent?: string;
  referrer?: string;
  device_type?: string;
  created_at: string;
}

export interface RssFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content?: string;
  guid?: string;
  author?: string;
  categories?: string[];
  enclosureUrl?: string;
}

export interface ArticleComment {
  id: string;
  article_slug: string;
  article_title?: string;
  parent_id?: string | null;
  reply_to_user?: string | null;
  user_name: string;
  sentiment: 'agree' | 'disagree' | 'neutral' | 'perspective';
  content: string;
  likes_count: number;
  created_at: string;
  status: 'published' | 'hidden';
  replies?: ArticleComment[];
}

export interface VideoArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  video_url: string;
  video_type: 'youtube' | 'mp4' | 'vimeo' | 'hls';
  thumbnail_url: string;
  duration_seconds: number;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  views_count: number;
  is_featured: number | boolean;
  status: 'published' | 'draft' | 'archived';
  source_name: string;
  source_channel_url?: string | null;
  published_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface VideoQueryOptions {
  limit?: number;
  offset?: number;
  categoryId?: string;
  featuredOnly?: boolean;
  search?: string;
  status?: string;
}

