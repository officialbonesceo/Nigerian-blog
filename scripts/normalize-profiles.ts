import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';
import { EDITORIAL_PROFILES, DEFAULT_EDITORIAL_PROFILE } from './profile-definitions';

const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const cloudflareApiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || process.env.CLOUDFLARE_DATABASE_ID || '').trim();

function normalizeLocal() {
  const update = db.prepare(`UPDATE articles SET author_name = ?, author_role = ?, author_avatar = ? WHERE category_id = ?`);
  const transaction = db.transaction(() => {
    for (const [categoryId, profile] of Object.entries(EDITORIAL_PROFILES)) {
      update.run(profile.name, profile.role, profile.avatar, categoryId);
    }
    db.prepare(`UPDATE articles SET author_name = ?, author_role = ?, author_avatar = ? WHERE category_id NOT IN ('cat_naija_news','cat_money_hustle','cat_sports','cat_world') OR category_id IS NULL`).run(
      DEFAULT_EDITORIAL_PROFILE.name,
      DEFAULT_EDITORIAL_PROFILE.role,
      DEFAULT_EDITORIAL_PROFILE.avatar,
    );
  });
  transaction();
}

async function normalizeD1() {
  if (!cloudflareAccountId || !cloudflareApiToken || !databaseId) {
    console.log('D1 profile normalization skipped: Cloudflare credentials/database ID are not configured.');
    return;
  }

  const statements = Object.entries(EDITORIAL_PROFILES).map(([categoryId, profile]) => ({
    sql: 'UPDATE articles SET author_name = ?, author_role = ?, author_avatar = ? WHERE category_id = ?',
    params: [profile.name, profile.role, profile.avatar, categoryId],
  }));
  statements.push({
    sql: `UPDATE articles SET author_name = ?, author_role = ?, author_avatar = ? WHERE category_id IS NULL OR category_id NOT IN ('cat_naija_news','cat_money_hustle','cat_sports','cat_world')`,
    params: [DEFAULT_EDITORIAL_PROFILE.name, DEFAULT_EDITORIAL_PROFILE.role, DEFAULT_EDITORIAL_PROFILE.avatar],
  });

  const result = await executeD1Query('SELECT 1', [], { accountId: cloudflareAccountId, apiToken: cloudflareApiToken, databaseNameOrId: databaseId });
  if (!result.success) throw new Error(`D1 connection failed: ${result.error}`);

  const batch = await Promise.all(statements.map((statement) => executeD1Query(statement.sql, statement.params, {
    accountId: cloudflareAccountId,
    apiToken: cloudflareApiToken,
    databaseNameOrId: databaseId,
  })));
  const failed = batch.find((item) => !item.success);
  if (failed) throw new Error(`D1 profile update failed: ${failed.error}`);
}

async function main() {
  normalizeLocal();
  await normalizeD1();
  console.log('Editorial profiles normalized: no fabricated individual journalist identities remain for article authors.');
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
