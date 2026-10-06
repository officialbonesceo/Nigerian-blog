import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const wranglerDir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const sourceDbPath = path.resolve(process.cwd(), '9jabeacon.db');

if (!fs.existsSync(sourceDbPath)) {
  console.error('Source 9jabeacon.db does not exist');
  process.exit(1);
}

if (!fs.existsSync(wranglerDir)) {
  fs.mkdirSync(wranglerDir, { recursive: true });
}

// Target sqlite file
const targetFile = path.join(wranglerDir, '77312c3b9ae73bbfac76bf2a4751d6093a4b72f3be14a3377a4a80101b0bca29.sqlite');

// Remove corrupted WAL and SHM
if (fs.existsSync(`${targetFile}-wal`)) fs.unlinkSync(`${targetFile}-wal`);
if (fs.existsSync(`${targetFile}-shm`)) fs.unlinkSync(`${targetFile}-shm`);

// Copy clean database
fs.copyFileSync(sourceDbPath, targetFile);

// Ensure _cf_METADATA exists in target for Miniflare
const targetDb = new Database(targetFile);
targetDb.exec(`
  CREATE TABLE IF NOT EXISTS _cf_METADATA (key INTEGER PRIMARY KEY, value INTEGER);
  INSERT OR REPLACE INTO _cf_METADATA (key, value) VALUES (2, 7815);
`);

console.log('Target integrity:', targetDb.pragma('integrity_check'));
console.log('Target article count:', targetDb.prepare('SELECT count(*) as count FROM articles').get());
targetDb.close();
console.log('✅ Successfully synced 9jabeacon.db to Miniflare D1 datastore!');
