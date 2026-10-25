import type { APIRoute } from 'astro';
import { getD1 } from '../../../lib/runtime-db';

export const prerender = false;

/**
 * POST { ids: string[], exportFirst?: boolean }
 * Real DELETE FROM articles — not a status hide.
 * If exportFirst=true, response includes full rows before delete so client can save JSON.
 * Auth: session cookie bonesceo_admin=1 OR Bearer ADMIN_SECRET / CRON_SECRET
 */
function isAuthed(request: Request): boolean {
  const cookie = request.headers.get('cookie') || '';
  if (cookie.includes('bonesceo_admin=1')) return true;
  const expected =
    (typeof process !== 'undefined' && (process.env?.ADMIN_SECRET || process.env?.CRON_SECRET)) || '';
  if (!expected) return cookie.includes('bonesceo_admin=1');
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${expected}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAuthed(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[];
      slugs?: string[];
      exportFirst?: boolean;
      deleteDuplicatesOnly?: boolean;
    };

    const db = getD1(locals);
    let exported: any[] = [];
    let deleted = 0;

    if (body.deleteDuplicatesOnly) {
      // Export dups then hard-delete extras (keep oldest per source_original_url)
      if (body.exportFirst) {
        const res = await db
          .prepare(
            `SELECT * FROM articles WHERE id IN (
              SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                  PARTITION BY source_original_url ORDER BY published_at ASC, id ASC
                ) AS rn
                FROM articles
                WHERE source_original_url IS NOT NULL AND TRIM(source_original_url) != ''
              ) t WHERE rn > 1
            )`
          )
          .all();
        exported = res?.results || [];
      }
      const del = await db
        .prepare(
          `DELETE FROM articles WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY source_original_url ORDER BY published_at ASC, id ASC
              ) AS rn
              FROM articles
              WHERE source_original_url IS NOT NULL AND TRIM(source_original_url) != ''
            ) t WHERE rn > 1
          )`
        )
        .run();
      deleted = Number((del as any)?.meta?.changes || 0);

      // title dups
      const del2 = await db
        .prepare(
          `DELETE FROM articles WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY title ORDER BY published_at ASC, id ASC
              ) AS rn FROM articles
            ) t WHERE rn > 1
          )`
        )
        .run();
      deleted += Number((del2 as any)?.meta?.changes || 0);
    } else {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      const slugs = Array.isArray(body.slugs) ? body.slugs.filter(Boolean) : [];
      if (!ids.length && !slugs.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provide ids[], slugs[], or deleteDuplicatesOnly:true' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (body.exportFirst) {
        for (const id of ids) {
          const row = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
          if (row) exported.push(row);
        }
        for (const slug of slugs) {
          const row = await db.prepare('SELECT * FROM articles WHERE slug = ?').bind(slug).first();
          if (row) exported.push(row);
        }
      }

      for (const id of ids) {
        const r = await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
        deleted += Number((r as any)?.meta?.changes || 0);
      }
      for (const slug of slugs) {
        const r = await db.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
        deleted += Number((r as any)?.meta?.changes || 0);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted,
        exportedCount: exported.length,
        exported: body.exportFirst ? exported : undefined,
        note: 'Rows removed with DELETE FROM articles (hard delete). D1 free tier does not offer a separate vault; deleted rows are gone from the live database.',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
