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

export type PresenterPose = 'idle' | 'speaking' | 'breaking' | 'wrap';
export type PresenterGaze = 'audience' | 'book' | 'screen';
export type PresenterArmState = 'desk_rest' | 'gesture_screen' | 'hold_notes';
export type BroadcastStageMode = 'studio' | 'b_roll';

// 9JA BEACON 16-Pose Core Library
export type CorePoseId = 
  | 'idle'
  | 'speaking_desk'
  | 'speaking_open_hands'
  | 'serious'
  | 'breaking_alert'
  | 'point_left'
  | 'point_right'
  | 'present_screen'
  | 'two_hand_explain'
  | 'emphasis'
  | 'reading_bulletin'
  | 'teleprompter'
  | 'listening'
  | 'reacting'
  | 'transition'
  | 'closing';

export type ArmGesture =
  | 'hands_resting'
  | 'hands_together'
  | 'hand_open_left'
  | 'hand_open_right'
  | 'both_hands_open'
  | 'point_left'
  | 'point_right'
  | 'explain_left'
  | 'explain_right'
  | 'emphasize_one'
  | 'hold_paper'
  | 'hold_tablet'
  | 'wave_goodbye';

export type GazeDirection =
  | 'gaze_camera'
  | 'gaze_left'
  | 'gaze_right'
  | 'gaze_down'
  | 'gaze_desk'
  | 'gaze_screen'
  | 'gaze_audience';

export type FacialExpression =
  | 'neutral'
  | 'friendly'
  | 'serious'
  | 'concerned'
  | 'surprised'
  | 'urgent'
  | 'happy'
  | 'solemn'
  | 'confident';

export type MouthFrame =
  | 'closed'
  | 'open_small'
  | 'open_medium'
  | 'open_wide'
  | 'smile';

export interface PresenterPoseCoordinates {
  x: string;
  y: string;
  name: string;
  description: string;
  gaze?: PresenterGaze;
  armState?: PresenterArmState;
  corePose?: CorePoseId;
  armGesture?: ArmGesture;
  gazeDirection?: GazeDirection;
  expression?: FacialExpression;
  mouthFrame?: MouthFrame;
}

export interface NewsPresenter {
  id: string;
  name: string;
  gender: 'male' | 'female';
  role: string;
  department: string;
  bio: string;
  avatar_url: string;
  sprite_url: string;
  poses: Record<PresenterPose, PresenterPoseCoordinates>;
  preferred_categories: string[];
  accent: string;
  voice_settings: {
    pitch: number;
    rate: number;
    lang: string;
    preferred_gender: 'male' | 'female';
  };
  status: 'active' | 'archived';
  display_order: number;
}

export interface Publisher {
  id: string;
  name: string;
  slug: string;
  role: string;
  school: string; // "MUA"
  bio: string;
  avatar_url: string;
  category_specialty: string;
  articles_count: number;
  is_verified_bot: number | boolean;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

