import type { APIRoute } from 'astro';
import { getPresenterById, presenters } from '../../../lib/presenters-data';
import { generatePresenterTimeline } from '../../../lib/presenter-timeline';
import { getD1, getArticleById } from '../../../lib/runtime-db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const session = cookies.get('admin_session');
    if (!session || !session.value) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = ((await request.json().catch(() => ({}))) || {}) as Record<string, any>;
    const {
      presenterId: requestedPresenterId,
      articleId,
      mode, // 'trending' | 'most_read' | 'manual'
      scriptText,
      headline,
      wpm = 140,
      speechRate = 1.0,
      hasBreakingAlert = false,
      outputFormat = 'landscape' // 'landscape' (16:9) | 'vertical' (9:16)
    } = body;

    let finalScript = scriptText;
    let finalHeadline = headline;
    let autoPresenterId = requestedPresenterId || 'presenter_femi';
    let keyPoints = [
      'Major structural policy update announced with immediate nationwide effect.',
      'Federal and state stakeholders align on comprehensive implementation.',
      'Verified coverage and real-time updates on www.9jabeacon.name.ng'
    ];

    const d1 = getD1(locals);

    // Auto-fetch Trending or Most Read news if requested
    if (mode === 'trending' || mode === 'most_read' || articleId === 'auto_trending' || articleId === 'auto_most_read' || (articleId && articleId.length > 5)) {
      let targetArticle: any = null;
      if (articleId && articleId.length > 5 && articleId !== 'auto_trending' && articleId !== 'auto_most_read') {
        targetArticle = await getArticleById(d1, articleId);
      } else if (mode === 'most_read' || articleId === 'auto_most_read') {
        const { getMostReadArticles } = await import('../../../lib/runtime-db');
        const list = await getMostReadArticles(d1, 1);
        if (list && list.length > 0) targetArticle = list[0];
      } else {
        const { getTopStory, getBreakingArticles } = await import('../../../lib/runtime-db');
        targetArticle = await getTopStory(d1);
        if (!targetArticle) {
          const breaking = await getBreakingArticles(d1, 1);
          if (breaking && breaking.length > 0) targetArticle = breaking[0];
        }
      }

      if (targetArticle) {
        finalHeadline = targetArticle.title;
        const cleanSummary = (targetArticle.summary || targetArticle.content?.slice(0, 320) || '').replace(/<[^>]+>/g, '').trim();
        finalScript = `Good evening. Top story on 9jaBeacon News: ${targetArticle.title}. ${cleanSummary}. For verified citizen reporting and developing updates, visit www.9jabeacon.name.ng.`;

        // Extract key bullet points for side projection
        const sentences = cleanSummary.split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean);
        if (sentences.length >= 2) {
          keyPoints = [
            sentences[0].slice(0, 85),
            sentences[1].slice(0, 85),
            'Full verified coverage on www.9jabeacon.name.ng'
          ];
        }

        // Auto-assign beat anchor based on category if presenter was not manually picked
        if (!requestedPresenterId) {
          const cat = targetArticle.category_id || '';
          if (cat.includes('money') || cat.includes('tech') || cat.includes('business')) {
            autoPresenterId = 'presenter_tunde';
          } else if (cat.includes('culture') || cat.includes('lifestyle') || cat.includes('sports')) {
            autoPresenterId = 'presenter_zainab';
          } else if (cat.includes('investigat') || cat.includes('metro')) {
            autoPresenterId = 'presenter_amaka';
          } else {
            autoPresenterId = 'presenter_femi';
          }
        }
      }
    }

    const presenter = getPresenterById(autoPresenterId) || presenters[0];

    if (!finalScript) {
      finalScript = `${presenter.name} reporting live from the 9jaBeacon national newsroom. Top headlines across Nigeria today.`;
    }

    const timeline = generatePresenterTimeline(presenter.id, finalScript, {
      wpm: Number(wpm) || 140,
      speechRate: Number(speechRate) || 1.0,
      hasBreakingAlert: Boolean(hasBreakingAlert)
    });

    const githubWorkflowPayload = {
      workflow: 'generate-broadcast-video.yml',
      inputs: {
        presenter_id: presenter.id,
        article_id: articleId || '',
        headline: finalHeadline || '9jaBeacon News Bulletin',
        custom_script: finalScript,
        has_breaking_alert: String(hasBreakingAlert),
        output_format: outputFormat
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        presenter,
        script: finalScript,
        headline: finalHeadline,
        keyPoints,
        timeline,
        githubWorkflowPayload
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Failed to generate presenter timeline'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
