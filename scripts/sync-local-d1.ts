import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const wranglerDir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const wranglerFile = path.join(wranglerDir, '77312c3b9ae73bbfac76bf2a4751d6093a4b72f3be14a3377a4a80101b0bca29.sqlite');
const rootDbFile = path.resolve(process.cwd(), '9jabeacon.db');

if (!fs.existsSync(wranglerDir)) {
  fs.mkdirSync(wranglerDir, { recursive: true });
}

// If root 9jabeacon.db exists, sync to wrangler
if (fs.existsSync(rootDbFile)) {
  if (fs.existsSync(`${wranglerFile}-wal`)) fs.unlinkSync(`${wranglerFile}-wal`);
  if (fs.existsSync(`${wranglerFile}-shm`)) fs.unlinkSync(`${wranglerFile}-shm`);
  fs.copyFileSync(rootDbFile, wranglerFile);
} else if (fs.existsSync(wranglerFile)) {
  // If only wrangler exists, copy to root 9jabeacon.db
  fs.copyFileSync(wranglerFile, rootDbFile);
}

// Ensure _cf_METADATA exists in wrangler target for Miniflare
if (fs.existsSync(wranglerFile)) {
  const targetDb = new Database(wranglerFile);
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS _cf_METADATA (key INTEGER PRIMARY KEY, value INTEGER);
    INSERT OR REPLACE INTO _cf_METADATA (key, value) VALUES (2, 7815);
  `);
  console.log('Wrangler D1 integrity:', targetDb.pragma('integrity_check'));
  console.log('Wrangler D1 articles count:', targetDb.prepare('SELECT count(*) as count FROM articles').get());
  targetDb.close();
}

console.log('✅ Bi-directional SQLite / Miniflare sync complete!');
