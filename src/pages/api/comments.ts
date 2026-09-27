import type { APIRoute } from 'astro';
import { getD1, getArticleComments, createArticleComment, likeArticleComment } from '../../lib/runtime-db';
import { fetchArticleComments, postArticleComment, upvoteComment } from '../../lib/firebase';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: 'Article slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getD1(locals);
    // 1. Fetch from SQL / D1 primary storage
    const sqlComments = await getArticleComments(db, slug);

    // 2. Fetch from Firestore (cloud multi-user sync)
    let firestoreComments: any[] = [];
    try {
      firestoreComments = await fetchArticleComments(slug);
    } catch (e) {
      console.warn('[API /comments] Firestore fetch fallback:', e);
    }

    // Multi-tier Deduplication:
    // 1. By unique ID
    // 2. By content fingerprint (prevents duplicate display if stored under differing database IDs)
    const seenMap = new Map<string, any>();
    const seenFingerprints = new Set<string>();

    for (const c of sqlComments) {
      const parentKey = c.parent_id || 'root';
      const fingerprint = `${(c.user_name || '').toLowerCase()}_${(c.content || '').trim().toLowerCase()}_${parentKey}`;
      if (seenFingerprints.has(fingerprint)) {
        continue; // Prevent duplicate display from repeated submits
      }
      seenFingerprints.add(fingerprint);
      seenMap.set(c.id, {
        id: c.id,
        articleSlug: c.article_slug,
        articleTitle: c.article_title || '',
        parentId: c.parent_id || null,
        replyToUser: c.reply_to_user || null,
        userName: c.user_name,
        sentiment: c.sentiment || 'perspective',
        content: c.content,
        likesCount: Number(c.likes_count) || 0,
        createdAt: new Date(c.created_at).getTime() || Date.now(),
        source: 'database',
      });
    }

    for (const fc of firestoreComments) {
      const parentKey = fc.parentId || 'root';
      const fingerprint = `${(fc.userName || '').toLowerCase()}_${(fc.content || '').trim().toLowerCase()}_${parentKey}`;
      if (!seenMap.has(fc.id) && !seenFingerprints.has(fingerprint)) {
        seenFingerprints.add(fingerprint);
        seenMap.set(fc.id, {
          id: fc.id,
          articleSlug: fc.articleSlug,
          articleTitle: fc.articleTitle || '',
          parentId: fc.parentId || null,
          replyToUser: fc.replyToUser || null,
          userName: fc.userName,
          sentiment: fc.sentiment || 'perspective',
          content: fc.content,
          likesCount: fc.likesCount || 0,
          createdAt: typeof fc.createdAt === 'number' ? fc.createdAt : Date.now(),
          source: 'firestore',
        });
      }
    }

    const allComments = Array.from(seenMap.values());
    const totalCount = allComments.length;

    // Build hierarchical nested comment structure
    const commentMap = new Map<string, any>();
    const topLevelComments: any[] = [];

    for (const c of allComments) {
      c.replies = [];
      commentMap.set(c.id, c);
    }

    for (const c of allComments) {
      if (c.parentId && commentMap.has(c.parentId)) {
        const parent = commentMap.get(c.parentId);
        parent.replies.push(c);
      } else {
        topLevelComments.push(c);
      }
    }

    // Sort top-level comments newest first, and nested replies chronologically
    topLevelComments.sort((a, b) => b.createdAt - a.createdAt);
    for (const top of topLevelComments) {
      top.replies.sort((a: any, b: any) => a.createdAt - b.createdAt);
    }

    return new Response(
      JSON.stringify({
        success: true,
        comments: topLevelComments,
        rawComments: allComments,
        total: totalCount,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /comments GET Error]', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to load comments',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body: any = await request.json().catch(() => ({}));
    const db = getD1(locals);

    // Handle like / upvote action
    if (body.action === 'like') {
      const commentId = String(body.commentId || '');
      if (!commentId) {
        return new Response(JSON.stringify({ success: false, error: 'commentId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Upvote in SQL
      await likeArticleComment(db, commentId);

      // Best-effort upvote in Firestore
      upvoteComment(commentId).catch(() => {});

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle new comment or reply submission
    const articleSlug = String(body.articleSlug || '').trim();
    const articleTitle = String(body.articleTitle || '').trim();
    const userName = String(body.userName || '').trim() || 'Verified Reader';
    const content = String(body.content || '').trim();
    const sentiment = String(body.sentiment || 'perspective');
    const parentId = body.parentId ? String(body.parentId).trim() : null;
    const replyToUser = body.replyToUser ? String(body.replyToUser).trim() : null;

    if (!articleSlug) {
      return new Response(JSON.stringify({ success: false, error: 'Article slug is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (userName.length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'Please enter a name of at least 2 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (content.length < 3) {
      return new Response(JSON.stringify({ success: false, error: 'Your perspective must be at least 3 characters long.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate consistent single ID shared across database and Firestore
    const sharedCommentId = 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // 1. Persist directly to SQL / D1 primary storage (ensures 100% reliability)
    const sqlResult = await createArticleComment(db, {
      id: sharedCommentId,
      article_slug: articleSlug,
      article_title: articleTitle,
      parent_id: parentId,
      reply_to_user: replyToUser,
      user_name: userName,
      sentiment,
      content,
    });

    if (!sqlResult.success || !sqlResult.comment) {
      return new Response(
        JSON.stringify({ success: false, error: sqlResult.error || 'Failed to save comment to database.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Asynchronously sync to Firestore using the exact same comment ID
    postArticleComment({
      id: sharedCommentId,
      articleSlug,
      articleTitle,
      parentId,
      replyToUser,
      userName,
      content,
      sentiment: sentiment as any,
    }).catch((fireErr) => {
      console.warn('[API /comments] Async Firestore sync notice:', fireErr?.message || fireErr);
    });

    return new Response(
      JSON.stringify({
        success: true,
        comment: {
          id: sqlResult.comment.id,
          articleSlug: sqlResult.comment.article_slug,
          articleTitle: sqlResult.comment.article_title,
          parentId: sqlResult.comment.parent_id,
          replyToUser: sqlResult.comment.reply_to_user,
          userName: sqlResult.comment.user_name,
          sentiment: sqlResult.comment.sentiment,
          content: sqlResult.comment.content,
          likesCount: sqlResult.comment.likes_count,
          createdAt: new Date(sqlResult.comment.created_at).getTime(),
          replies: [],
          source: 'database',
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[API /comments POST Error]', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Internal server error while publishing comment.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
