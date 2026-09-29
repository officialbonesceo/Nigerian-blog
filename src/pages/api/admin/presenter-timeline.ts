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
      presenterId = 'presenter_femi',
      articleId,
      scriptText,
      headline,
      wpm = 140,
      speechRate = 1.0,
      hasBreakingAlert = false,
      outputFormat = 'landscape' // 'landscape' (16:9) | 'vertical' (9:16)
    } = body;

    const presenter = getPresenterById(presenterId) || presenters[0];

    let finalScript = scriptText;
    let finalHeadline = headline;

    if (!finalScript && articleId) {
      const d1 = getD1(locals);
      const article = await getArticleById(d1, articleId);
      if (article) {
        finalHeadline = article.title;
        finalScript = `${article.title}. ${article.summary || article.content?.slice(0, 400) || ''}`;
      }
    }

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
