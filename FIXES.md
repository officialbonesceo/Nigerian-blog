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
