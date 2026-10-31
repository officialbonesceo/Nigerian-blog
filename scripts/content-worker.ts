/**
 * HARD DISABLED 2026-11-01
 * Automated news ingest is frozen. Do not re-enable until D1 write tokens
 * are rotated and quota is under control. This file used to run the full
 * RSS → AI rewrite → D1 insert pipeline.
 */
console.error('[content-worker] DISABLED — automated ingest is permanently paused in this repo.');
console.error('No articles will be fetched or inserted.');
process.exit(1);
