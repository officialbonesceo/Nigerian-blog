import type { D1Database } from '@cloudflare/workers-types';
import { invalidateCache } from './runtime-db';

/** Real UPDATE — previously a no-op stub so image/edits never stuck. */
export async function updateArticle(
  db: D1Database,
  id: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  try {
    const allowed = [
      'title',
      'summary',
      'content',
      'category_id',
      'image_url',
      'image_caption',
      'image_credit',
      'image_license',
      'author_name',
      'author_role',
      'author_avatar',
      'is_top_story',
      'is_trending',
      'is_breaking',
      'reading_time_minutes',
      'source_id',
      'source_name',
      'source_original_url',
      'published_at',
      'status',
      'slug',
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, k) && patch[k] !== undefined) {
        sets.push(`${k}=?`);
        vals.push(patch[k]);
      }
    }
    if (!sets.length) return false;
    sets.push('updated_at=?');
    vals.push(new Date().toISOString());
    vals.push(id);
    const r = await db.prepare(`UPDATE articles SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    const n = Number((r as any)?.meta?.changes || 0);
    if (n) invalidateCache();
    return n > 0;
  } catch (err) {
    console.error('updateArticle', err);
    return false;
  }
}

/** Real DELETE FROM articles — not status hide. */
export async function deleteArticle(db: D1Database, idOrSlug: string): Promise<boolean> {
  try {
    let r = await db.prepare('DELETE FROM articles WHERE id = ?').bind(idOrSlug).run();
    let n = Number((r as any)?.meta?.changes || 0);
    if (!n) {
      r = await db.prepare('DELETE FROM articles WHERE slug = ?').bind(idOrSlug).run();
      n = Number((r as any)?.meta?.changes || 0);
    }
    if (n) invalidateCache();
    return n > 0;
  } catch (err) {
    console.error('deleteArticle', err);
    return false;
  }
}

/** Bulk hard-delete by ids. */
export async function deleteArticlesByIds(db: D1Database, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    if (await deleteArticle(db, id)) deleted++;
  }
  return deleted;
}
