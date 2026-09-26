/**
 * 9jaBeacon Sports Category Mis-Tagging Remediation Script
 * 
 * Specifically checks for and reclassifies articles incorrectly tagged as Sports:
 * - Olori Atuwatse III / polygamy / Olu of Warri -> Naija News (culture / royalty)
 * - Married gym instructor & feminist activist dispute -> Naija News (social / relationship)
 * - Lisk blockchain winds down -> Business or World (crypto / business)
 * - Education Minister Alausa / diaspora research -> Naija News (education / policy)
 * - Nigeria–German steel investment talks -> Business (bilateral trade / investment)
 * 
 * Runs locally on SQLite and synchronizes to Cloudflare D1 if configured.
 */

import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';
import { EDITORIAL_PROFILES } from './profile-definitions';
import { applyCategoryPostOverrides } from '../src/lib/category-mapper';

const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const cloudflareApiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || process.env.CLOUDFLARE_DATABASE_ID || '').trim();

function getEditorialProfile(cat: string) {
  if (cat in EDITORIAL_PROFILES) {
    return EDITORIAL_PROFILES[cat as keyof typeof EDITORIAL_PROFILES];
  }
  return EDITORIAL_PROFILES['cat_naija_news'];
}

function fixLocalDb() {
  const rows = db.prepare(
    `SELECT id, title, summary, content, category_id FROM articles WHERE category_id IN ('cat_sports', 'sports')`
  ).all() as Array<{ id: string; title: string; summary: string; content: string; category_id: string }>;

  console.log(`[Sports Fix] Found ${rows.length} total sports articles in local database.`);
  let fixedCount = 0;

  const updateStmt = db.prepare(
    `UPDATE articles SET category_id = ?, author_name = ?, author_role = ?, author_avatar = ? WHERE id = ?`
  );

  const transaction = db.transaction(() => {
    for (const art of rows) {
      const targetCat = applyCategoryPostOverrides('cat_sports', art.title || '', (art.summary || '') + ' ' + (art.content || ''));
      if (targetCat !== 'cat_sports') {
        const profile = getEditorialProfile(targetCat);
        updateStmt.run(targetCat, profile.name, profile.role, profile.avatar, art.id);
        console.log(`  ✅ Reclassified [${art.id}] "${art.title?.slice(0, 50)}..." -> ${targetCat}`);
        fixedCount++;
      }
    }
  });

  transaction();
  console.log(`[Sports Fix] Local database remediation complete: ${fixedCount} articles reclassified.`);
  return fixedCount;
}

async function fixRemoteD1() {
  if (!cloudflareAccountId || !cloudflareApiToken || !databaseId) {
    console.log('[Sports Fix] Remote D1 remediation skipped: Cloudflare credentials not set in current shell.');
    return;
  }

  console.log('[Sports Fix] Connecting to Cloudflare D1 to inspect live sports category articles...');
  const queryRes = await executeD1Query(
    `SELECT id, title, summary, category_id FROM articles WHERE category_id IN ('cat_sports', 'sports')`,
    [],
    { accountId: cloudflareAccountId, apiToken: cloudflareApiToken, databaseNameOrId: databaseId }
  );

  const rawData = (queryRes.result?.[0]?.results || queryRes.result || []) as Array<{ id: string; title: string; summary: string; category_id: string }>;
  if (!queryRes.success || !Array.isArray(rawData)) {
    console.warn('[Sports Fix] Could not query remote D1 articles:', queryRes.error);
    return;
  }

  const articles = rawData;
  console.log(`[Sports Fix] Found ${articles.length} sports articles in remote D1.`);

  const updates: Array<{ id: string; targetCat: string }> = [];
  for (const art of articles) {
    const targetCat = applyCategoryPostOverrides('cat_sports', art.title || '', art.summary || '');
    if (targetCat !== 'cat_sports') {
      updates.push({ id: art.id, targetCat });
    }
  }

  if (updates.length === 0) {
    console.log('[Sports Fix] No mislabeled sports articles found in remote D1.');
    return;
  }

  for (const u of updates) {
    const profile = getEditorialProfile(u.targetCat);
    const updateRes = await executeD1Query(
      `UPDATE articles SET category_id = ?, author_name = ?, author_role = ?, author_avatar = ? WHERE id = ?`,
      [u.targetCat, profile.name, profile.role, profile.avatar, u.id],
      { accountId: cloudflareAccountId, apiToken: cloudflareApiToken, databaseNameOrId: databaseId }
    );
    if (updateRes.success) {
      console.log(`  ✅ D1 Reclassified [${u.id}] -> ${u.targetCat}`);
    } else {
      console.warn(`  ⚠️ D1 Update failed for [${u.id}]:`, updateRes.error);
    }
  }
}

async function main() {
  fixLocalDb();
  await fixRemoteD1();
  db.close();
}

main().catch((err) => {
  console.error('[Sports Fix] Fatal error:', err);
  process.exit(1);
});
