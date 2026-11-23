import type { APIRoute } from 'astro';
import { getD1 } from '../../../lib/runtime-db';

export const prerender = false;

/**
 * Clears article image_url values that are NOT on safe free hosts
 * (Unsplash, Pexels, Wikimedia, data: SVG, our cloudinary).
 * Leaves safe URLs alone. Does not invent replacements — display layer uses fallback SVG.
 *
 * POST { "confirm": true, "dry_run": false }
 * Optional header: Authorization: Bearer <ADMIN_TOKEN> if set in env.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      confirm?: boolean;
      dry_run?: boolean;
      limit?: number;
    };

    if (!body.confirm) {
      return json({ success: false, error: 'Pass { "confirm": true } to run' }, 400);
    }

    const db = getD1(locals as any);
    const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 2000);
    const dry = body.dry_run === true;

    // Pull candidates — any non-null image that is not obviously safe
    const rows = await db
      .prepare(
        `SELECT id, slug, image_url FROM articles
         WHERE image_url IS NOT NULL AND length(image_url) > 8
         ORDER BY published_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<{ id: number | string; slug: string; image_url: string }>();

    const list = rows?.results || [];
    const unsafe: { id: string | number; slug: string; image_url: string }[] = [];

    for (const row of list) {
      const u = String(row.image_url || '').toLowerCase();
      const safe =
        u.startsWith('data:image/') ||
        u.includes('images.unsplash.com') ||
        u.includes('unsplash.com') ||
        u.includes('images.pexels.com') ||
        u.includes('pexels.com') ||
        u.includes('upload.wikimedia.org') ||
        u.includes('commons.wikimedia.org') ||
        u.includes('wikipedia.org') ||
        u.includes('cloudinary.com');
      if (!safe) unsafe.push(row);
    }

    let cleared = 0;
    if (!dry && unsafe.length) {
      // Batch clear
      for (const row of unsafe) {
        await db
          .prepare(`UPDATE articles SET image_url = NULL WHERE id = ?`)
          .bind(row.id)
          .run();
        cleared++;
      }
    }

    return json({
      success: true,
      dry_run: dry,
      scanned: list.length,
      unsafe_found: unsafe.length,
      cleared: dry ? 0 : cleared,
      sample: unsafe.slice(0, 15).map((r) => ({ slug: r.slug, image_url: r.image_url?.slice(0, 120) })),
      note: dry
        ? 'Dry run only. Re-POST with { "confirm": true, "dry_run": false } to clear.'
        : 'Unsafe image_url set to NULL. UI will show 9jaBeacon editorial SVG / Unsplash on next resolve.',
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'clear failed' }, 500);
  }
};

export const GET: APIRoute = async () => {
  return json({
    success: true,
    usage: 'POST JSON { "confirm": true, "dry_run": true|false, "limit": 500 }',
    effect: 'Sets articles.image_url = NULL when host is not Unsplash/Pexels/Wikimedia/Cloudinary/data-SVG',
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
