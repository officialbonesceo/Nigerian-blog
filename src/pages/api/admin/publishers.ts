import type { APIRoute } from 'astro';
import { getD1, getPublishers, getPublisherById, createPublisher, updatePublisher, togglePublisherStatus, deletePublisher } from '../../../lib/runtime-db';
import type { Publisher } from '../../../lib/types';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const url = new URL(request.url);
    const onlyActive = url.searchParams.get('onlyActive') === 'true';
    const publishers = await getPublishers(db, { onlyActive });

    return new Response(JSON.stringify({ success: true, publishers }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body: any = await request.json().catch(() => ({}));
    const action = body.action || 'save';

    if (action === 'toggle') {
      const { id, is_active } = body;
      if (!id) {
        return new Response(JSON.stringify({ success: false, error: 'Missing publisher ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const ok = await togglePublisherStatus(db, id, !!is_active);
      return new Response(JSON.stringify({ success: ok }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'save' || action === 'create' || action === 'update') {
      const pubData = body.publisher || body;
      if (!pubData.name || !pubData.role) {
        return new Response(JSON.stringify({ success: false, error: 'Name and role are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const id = pubData.id || `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const slug = (pubData.slug || pubData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();

      const existing = await getPublisherById(db, id);
      let ok = false;
      if (existing) {
        ok = await updatePublisher(db, id, {
          name: pubData.name,
          slug,
          role: pubData.role,
          school: pubData.school || 'MUA',
          bio: pubData.bio || '',
          avatar_url: pubData.avatar_url || '/fallback-avatar.svg',
          category_specialty: pubData.category_specialty || 'cat_naija_news',
          is_verified_bot: pubData.is_verified_bot ?? 1,
          is_active: pubData.is_active ?? 1,
        });
      } else {
        const newPub: Publisher = {
          id,
          name: pubData.name,
          slug,
          role: pubData.role,
          school: pubData.school || 'MUA',
          bio: pubData.bio || '',
          avatar_url: pubData.avatar_url || '/fallback-avatar.svg',
          category_specialty: pubData.category_specialty || 'cat_naija_news',
          articles_count: 0,
          is_verified_bot: pubData.is_verified_bot ?? 1,
          is_active: pubData.is_active ?? 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        ok = await createPublisher(db, newPub);
      }

      return new Response(JSON.stringify({ success: ok, id, slug }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const url = new URL(request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      const body: any = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Publisher ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ok = await deletePublisher(db, id);
    return new Response(JSON.stringify({ success: ok }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
