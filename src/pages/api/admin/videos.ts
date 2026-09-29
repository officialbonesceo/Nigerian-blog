import type { APIRoute } from 'astro';
import {
  getD1,
  getVideoArticles,
  getVideoArticleById,
  createVideoArticle,
  updateVideoArticle,
  deleteVideoArticle
} from '../../../lib/runtime-db';
import type { VideoArticle } from '../../../lib/types';

// Helper to extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const db = getD1(locals);

    const singleId = url.searchParams.get('id');
    if (singleId) {
      const video = await getVideoArticleById(db, singleId);
      if (!video) {
        return new Response(JSON.stringify({ error: 'Video not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, video }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;
    const categoryId = url.searchParams.get('category_id') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const status = url.searchParams.get('status') || 'all';

    const { videos, total } = await getVideoArticles(db, {
      limit,
      offset,
      categoryId,
      search,
      status
    });

    return new Response(
      JSON.stringify({
        success: true,
        videos,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/videos GET error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json()) as Partial<VideoArticle>;

    if (!body.title || !body.video_url) {
      return new Response(JSON.stringify({ error: 'Title and Video URL are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Auto-detect YouTube thumbnail if not provided
    let thumbnailUrl = body.thumbnail_url;
    const ytId = extractYouTubeId(body.video_url);
    if (!thumbnailUrl && ytId) {
      thumbnailUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }

    const video = await createVideoArticle(db, {
      ...body,
      video_type: ytId ? 'youtube' : (body.video_type || 'mp4'),
      thumbnail_url: thumbnailUrl || 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    });

    return new Response(JSON.stringify({ success: true, video }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('API /api/admin/videos POST error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json()) as Partial<VideoArticle> & { id: string };

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Video ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await updateVideoArticle(db, body.id, body);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Video not found or update failed' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updated = await getVideoArticleById(db, body.id);
    return new Response(JSON.stringify({ success: true, video: updated }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('API /api/admin/videos PUT error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Video ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await deleteVideoArticle(db, id);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('API /api/admin/videos DELETE error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
