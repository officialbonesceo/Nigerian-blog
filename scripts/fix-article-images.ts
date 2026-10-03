/**
 * Fix and align all article images in the local SQLite/D1 database
 * Replaces mismatched stock photos (like the rocket photo) with verified
 * authentic Wikipedia photos, topic-specific conceptual photos, or editorial vector assets.
 */
import { getD1, invalidateCache } from '../src/lib/runtime-db';
import { resolveEditorialImage } from '../src/lib/editorial-image';

async function main() {
  console.log('🔄 Aligning all article images with their content...');
  const db = getD1();

  const queryRes = await db.prepare('SELECT id, slug, title, content, category_id, image_url FROM articles').all();
  const articles = queryRes.results || [];
  console.log(`Found ${articles.length} articles to check.`);

  let updatedCount = 0;

  for (const art of articles as any[]) {
    const isBadPhoto = !art.image_url || art.image_url.includes('photo-1541872703');
    if (!isBadPhoto) {
      continue;
    }

    console.log(`\n🔍 Resolving image for: "${art.title}" (${art.category_id})`);
    const resolved = await resolveEditorialImage({
      title: art.title,
      content: art.content,
      category: art.category_id,
      sourceName: '9jaBeacon Editorial Wire',
    });

    console.log(`   -> New Image: ${resolved.imageUrl.slice(0, 80)}...`);
    console.log(`   -> Caption:   ${resolved.imageCaption}`);

    await db.prepare(`
      UPDATE articles 
      SET image_url = ?, image_caption = ?, image_credit = ?, image_license = ?
      WHERE id = ?
    `).bind(
      resolved.imageUrl,
      resolved.imageCaption,
      resolved.imageCredit,
      resolved.imageLicense,
      art.id
    ).run();

    updatedCount++;
  }

  invalidateCache();
  console.log(`\n✅ Completed! Successfully updated and aligned ${updatedCount} articles with context-accurate imagery.`);
}

main().catch(err => {
  console.error('Fatal error during image alignment:', err);
  process.exit(1);
});
