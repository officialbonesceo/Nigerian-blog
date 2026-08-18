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
  image_caption?: string;
  image_credit?: string;
  image_license?: string;
  author_name: string;
  author_role: string;
  author_avatar?: string;
  is_top_story: number | boolean;
  is_trending: number | boolean;
  is_breaking: number | boolean;
  views_count: number;
  reading_time_minutes: number;
  source_id?: string;
  source_name?: string;
  source_original_url?: string;
  published_at: string;
  updated_at: string;
  created_at?: string;
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
