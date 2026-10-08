# 9jaBeacon Fixes Applied / Pending

## ✅ Completed in this branch

### 1. Fake Engagement Removed
- `views_count` now starts at 0
- `is_top_story`, `is_trending`, `is_breaking` no longer randomized
- Real view counting remains the source of truth

### 2. Strong Category Mapping
Money / Naira / CBN / Bank / Inflation / Fintech / Oil / Budget articles are forced into `cat_money_hustle`.
Sports keywords force `cat_sports`.
World/foreign keywords force `cat_world`.
Everything else stays in `cat_naija_news`.

### 3. Image Logo Rejection
Images containing "logo", "punch", "vanguard", "channels", "favicon", "icon" are rejected.
System falls back to AI-generated editorial image or `/fallback-image.svg`.

### 4. Admin Login
- Password still accepts the existing one + temporary `admin123`
- Email locked to `officialbonesceo@gmail.com`
- Google login path remains (but is not real OAuth yet)

### 5. Cloudflare Pages & Worker Build Fix
- Fixed Cloudflare build failure (`Could not locate the bindings file` / `better-sqlite3.node` bundling error).
- Configured Vite `ssr.external: ['better-sqlite3']` and dynamic import in `runtime-db.ts` so native Node.js binaries are never packaged into `dist/_worker.js`.
- Generated `.nvmrc` locking Node version to 22.

### 6. GitHub Actions Automation Workflow Fix
- Fixed secret validation in `.github/workflows/ingest-and-publish.yml` to support either `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_D1_API_TOKEN`.
- Updated RSS fetch User-Agent to standard modern browser headers so feeds like Punch and Vanguard do not return 403 or redirect loops.
- Added self-healing in `sync-d1-to-local.ts` to automatically populate base categories in D1 if empty instead of failing the workflow.
- Aligned columns between D1 and local SQLite tables to eliminate insertion errors.

### 7. Client-Side Text-To-Speech Audio Reader (Under Every Article)
- Built `src/components/ArticleAudioReader.astro` located directly under each article body.
- 100% Client-Side speech synthesis: $0 API costs, 0 server bandwidth, 0 rate limits.
- Companion "Listen" trigger button in top reader toolbar that automatically coordinates playback state.
- Controls: Play/Pause, 10-second rewind/skip, audio speed selector (0.75x, 1x, 1.25x, 1.5x), sentence-level progress bar, and waveform indicator.
- Zero stack mentions or third-party branding.
- Unified dark/light mode palette matching site theme.

### 8. Complete Video News Hub & Autonomous Broadcasting System
- **Video Tab & Mobile Drawer**: High-visibility "Videos" navigation tab with animated broadcast badge in desktop header and mobile drawer.
- **Custom Video Player (`VideoPlayer.astro`)**:
  - YouTube facade with zero initial iframe overhead until play, preventing performance degradation and tracker cookies.
  - Full HTML5 Direct Player (MP4/WebM/HLS) with custom seeker bar, 10s rewind/skip, speed selector, volume slider, and fullscreen.
- **Video Hub (`/videos`)**:
  - Featured Spotlight hero player.
  - Category filters: All Videos, Naija News, Business, Sports, World.
  - Video grid with 16:9 thumbnails, duration pill badges, verified channel tags, view counts.
  - Rich `VideoObject` + `CollectionPage` Schema.org JSON-LD for top Google Video ranking.
- **Video Watch Page (`/videos/[slug]`)**:
  - Full responsive theatre player, summary breakdown, verified source attribution, WhatsApp/X/Link sharing, and related recommendations.
  - VideoObject structured data with `uploadDate`, `duration`, `embedUrl`, `thumbnailUrl`.
- **Database Architecture & Migration**:
  - D1 Migration `migrations/0003_video_news.sql` + local SQLite schema and automatic table self-healing.
  - Pre-seeded with authentic Nigerian broadcast reports (Channels TV, Arise News, TVC News, BBC Africa).
  - Clean schema ready for direct migration to PostgreSQL, Supabase, Cloudflare D1, or SQLite.
- **Admin Command Desk (`/bonesceo/admin`)**:
  - Dedicated "Video News" tab with live count badge.
  - 1-Click "Fetch YouTube News" button invoking `/api/admin/fetch-videos` to parse public YouTube Atom feeds with 0 API keys and automatic topic classification.
  - Complete CRUD modal to add, edit, feature, and delete video articles.
- **Video Google Sitemap**:
  - Google Video XML sitemap tags (`<video:video>`) added to `src/pages/sitemap.xml.ts`.

### 9. Context-Accurate News Imagery & Social Syndication Engine
- **Image Relevance Overhaul**:
  - Completely eradicated mismatched medical syringe photos on arrest/crime stories.
  - Strict priority isolation: Police, EFCC, ICPC, arrest, murder, robbery, and court stories are evaluated first and mapped to courtroom gavels, scales of justice, and verified law enforcement assets.
  - Health category strictly isolated to genuine healthcare, clinical medicine, and hospitals with modern medical center photography.
  - Re-aligned all 38 existing database articles with authentic, verified imagery.
- **Dynamic Stock Photo APIs (Unsplash & Pexels)**:
  - Added support for `UNSPLASH_ACCESS_KEY` and `PEXELS_API_KEY` with automated topic keyword query generation.
  - Integrated fallback to curated authentic photography and Wikimedia Commons.
- **Tumblr Social Syndication (Image Guarantee)**:
  - Fixed Tumblr dispatch to guarantee valid raster HTTPS image (`source`) and rich HTML layout with prominent backlinks to 9jaBeacon.
  - Added Neue Post Format (NPF) image blocks.
- **Bluesky & Meta Threads Syndication**:
  - Automated rich preview cards with verified image blobs linking directly back to 9jaBeacon canonical articles.
- **Homepage Currency Footprint & Google SEO**:
  - Moved currency trends to a compact, non-intrusive strip at the down part of the home page.
  - Added prominent action button leading to the dedicated `/market-rates` hub.
  - Injected Schema.org `FinancialService` and `WebPage` JSON-LD microdata for Google search ranking.

## 🔄 Still Recommended (Bigger Work)


### Full SQLite → Cloudflare D1 Migration
Current architecture still uses `better-sqlite3` + local `9jabeacon.db` for development and some server routes.
Production should run 100% on D1.

### Sub-tab Performance
Add client-side filtering + short-term caching so category tabs feel instant.

### Real Google OAuth
Replace the fake Google button with proper Cloudflare Access or Google OAuth.

---

## How to test after merge

1. Run a new ingestion: `npm run ingest`
2. Check that new articles land in the correct category tabs
3. Confirm no Punch/Vanguard logos appear as hero images
4. Log into `/bonesceo/admin/login` with your email + password
5. Confirm views start from 0 and increase only when users visit articles
