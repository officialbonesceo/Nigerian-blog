/**
 * Fix and align all article images across the 9jaBeacon database
 * Replaces mismatched stock photos (such as syringe injection on arrest, rocket on politics, bus on police)
 * with verified authentic Wikipedia photos, topic-accurate legal/police/finance imagery, or dynamic Unsplash/Pexels photos.
 */
import { db } from '../src/lib/db';
import { getD1, invalidateCache } from '../src/lib/runtime-db';
import { resolveEditorialImage } from '../src/lib/editorial-image';

async function main() {
  console.log('🔄 Aligning all article images across the entire website...');

  const articles = db.prepare('SELECT id, slug, title, content, category_id, image_url, source_name FROM articles').all() as any[];
  console.log(`Found ${articles.length} articles to evaluate.`);

  let updatedCount = 0;

  for (const art of articles) {
    const currentUrl = (art.image_url || '').toLowerCase();
    
    // Mismatch heuristics
    const isSyringePhoto = currentUrl.includes('photo-1584515979956-d9f6e5d09982');
    const isRocketPhoto = currentUrl.includes('photo-1541872703');
    const isBusPhoto = currentUrl.includes('photo-1544620347-c4fd4a3d5957');
    const isFallback = !currentUrl || currentUrl.includes('fallback') || currentUrl.includes('placeholder') || currentUrl.startsWith('data:');
    
    // Check if proprietary BBC/wire agency image
    const isRestrictedWire = currentUrl.includes('bbci.co.uk') || currentUrl.includes('bbc.com') || currentUrl.includes('gettyimages') || currentUrl.includes('reuters') || currentUrl.includes('apnews') || currentUrl.includes('punchng.com') || currentUrl.includes('vanguardngr.com');

    // Title context
    const lowerTitle = (art.title || '').toLowerCase();
    const isCrimeOrLawStory = /\b(police|arrest|suspect|robbery|gunmen|bandits|kidnap|efcc|icpc|ndlea|fraud|detained|custody|court|judge|tribunal|arraigned)\b/i.test(lowerTitle);
    const isMilitaryStory = /\b(troops|military|army|soldiers|ambush|clearance|counter-insurgency|fansan yamma|defence)\b/i.test(lowerTitle);
    const isFoodOrHealthStory = /\b(palm oil|herbal|poisoning|food|hospital|health|consumer protection)\b/i.test(lowerTitle);
    const isNamedLeader = /\b(tinubu|shettima|sanwo-?olu|fubara|wike|peter\s+obi|atiku|buhari|emefiele|cardoso|dangote|adeleke|soludo|otu|mutfwang|keyamo)\b/i.test(lowerTitle);

    const hasBusOnMilitaryOrCrime = (isMilitaryStory || isCrimeOrLawStory) && isBusPhoto;
    const hasSyringeOnCrimeOrFood = (isCrimeOrLawStory || isFoodOrHealthStory) && isSyringePhoto;
    const hasRocketOnGeneral = isRocketPhoto && !lowerTitle.includes('space') && !lowerTitle.includes('rocket');
    const hasGenericOnLeader = isNamedLeader && (isBusPhoto || isRocketPhoto || isSyringePhoto || isFallback);

    const needsReevaluation =
      isFallback ||
      isRestrictedWire ||
      hasBusOnMilitaryOrCrime ||
      hasSyringeOnCrimeOrFood ||
      hasRocketOnGeneral ||
      hasGenericOnLeader;

    if (!needsReevaluation) {
      continue;
    }

    console.log(`\n🔍 Re-aligning image for: "${art.title}" (${art.category_id})`);
    console.log(`   Old Image: ${art.image_url?.slice(0, 70)}...`);

    const resolved = await resolveEditorialImage({
      title: art.title,
      content: art.content,
      category: art.category_id,
      sourceName: art.source_name || '9jaBeacon Wire',
    });

    console.log(`   -> New Image: ${resolved.imageUrl.slice(0, 80)}...`);
    console.log(`   -> Caption:   ${resolved.imageCaption}`);

    // Update in local SQLite db (9jabeacon.db)
    db.prepare(`
      UPDATE articles 
      SET image_url = ?, image_caption = ?, image_credit = ?, image_license = ?
      WHERE id = ?
    `).run(
      resolved.imageUrl,
      resolved.imageCaption,
      resolved.imageCredit,
      resolved.imageLicense,
      art.id
    );

    // Also update directly in any Miniflare SQLite databases in .wrangler state
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const Database = (await import('better-sqlite3')).default;
      const miniflareDir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
      if (fs.existsSync(miniflareDir)) {
        const files = fs.readdirSync(miniflareDir);
        for (const f of files) {
          if (f.endsWith('.sqlite')) {
            const mfDb = new Database(path.join(miniflareDir, f));
            mfDb.prepare(`
              UPDATE articles 
              SET image_url = ?, image_caption = ?, image_credit = ?, image_license = ?
              WHERE id = ?
            `).run(
              resolved.imageUrl,
              resolved.imageCaption,
              resolved.imageCredit,
              resolved.imageLicense,
              art.id
            );
            mfDb.close();
          }
        }
      }
    } catch {}

    // Also update in runtime-db if D1 binding exists
    try {
      const runtimeDb = getD1();
      await runtimeDb.prepare(`
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
    } catch {}

    updatedCount++;
  }

  try {
    invalidateCache();
  } catch {}

  console.log(`\n✅ Completed! Successfully updated and aligned ${updatedCount} articles with context-accurate imagery.`);
}

main().catch(err => {
  console.error('Fatal error during image alignment:', err);
  process.exit(1);
});
