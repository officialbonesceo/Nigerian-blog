-- Run once in Cloudflare Dashboard → D1 → your 9jaBeacon DB → Console
-- These stop full-table scans on isDuplicate and cut free-tier burn.

CREATE INDEX IF NOT EXISTS idx_articles_source_original_url ON articles(source_original_url);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category_status_pub ON articles(category_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rejected_original_url ON rejected_articles(original_url);
