import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dbs = [
  path.resolve(process.cwd(), '9jabeacon.db'),
  path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/77312c3b9ae73bbfac76bf2a4751d6093a4b72f3be14a3377a4a80101b0bca29.sqlite')
];

// Verified high-speed Unsplash CDN fallbacks by category
const categoryBackups: Record<string, string[]> = {
  cat_money_hustle: [
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  ],
  cat_sports: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1489944445391-11dd35574549?auto=format&fit=crop&w=1200&q=80',
  ],
  cat_naija_news: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1579208575657-c595a05383b7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
  ],
  cat_world: [
    'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  ],
};

async function checkUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (res.ok) return true;
    if (res.status === 403 || res.status === 405) {
      // Some CDNs reject HEAD, test with small GET range
      const getRes = await fetch(url, { headers: { Range: 'bytes=0-100', 'User-Agent': 'Mozilla/5.0' } });
      return getRes.ok;
    }
    return false;
  } catch {
    return false;
  }
}

async function verifyAndFix() {
  for (const dbPath of dbs) {
    if (!fs.existsSync(dbPath)) continue;
    console.log(`\nChecking database: ${path.basename(dbPath)}`);
    const db = new Database(dbPath);
    const articles = db.prepare('SELECT id, title, image_url, category_id FROM articles').all() as any[];
    console.log(`Checking ${articles.length} articles...`);

    let fixedCount = 0;
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      let ok = await checkUrl(art.image_url);
      if (!ok) {
        const catList = categoryBackups[art.category_id] || categoryBackups.cat_naija_news;
        const fallback = catList[i % catList.length];
        db.prepare('UPDATE articles SET image_url = ? WHERE id = ?').run(fallback, art.id);
        console.log(`Fixing broken image for "${art.title.slice(0, 40)}..." -> ${fallback.slice(0, 50)}`);
        fixedCount++;
      }
    }
    console.log(`Finished ${path.basename(dbPath)}: ${fixedCount} broken images replaced with verified CDN assets.`);
    db.close();
  }
}

verifyAndFix();
