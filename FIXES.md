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
