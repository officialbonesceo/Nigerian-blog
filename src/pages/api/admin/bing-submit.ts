import type { APIRoute } from 'astro';
import { getD1, getSiteSettings, getArticles } from '../../../lib/runtime-db';
import { submitUrlToBing, submitUrlBatchToBing, submitToIndexNow } from '../../../lib/bing-api';

export const prerender = false;

interface BingRequestBody {
  action?: 'submit_single' | 'submit_batch' | 'submit_all_recent' | 'test_connection' | 'submit_indexnow';
  url?: string;
  urls?: string[];
  apiKey?: string;
  siteUrl?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as BingRequestBody;
    const settings = await getSiteSettings(db);

    const apiKey = (body.apiKey || settings.bing_api_key || '').trim();
    const siteUrl = (body.siteUrl || settings.site_url || 'https://9jabeacon.name.ng').replace(/\/+$/, '');
    const indexNowKey = (settings.indexnow_key || apiKey || '').trim();

    const config = {
      apiKey,
      siteUrl,
      autoSubmitEnabled: settings.bing_auto_submit_enabled === '1' || settings.bing_auto_submit_enabled === 'true',
      indexNowKey,
    };

    if (body.action === 'test_connection') {
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Bing Webmaster API Key is not configured. Please paste your API key in the Bing tab.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Test with the homepage
      const result = await submitUrlToBing(`${siteUrl}/`, config);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'submit_single') {
      const urlToSubmit = (body.url || '').trim();
      if (!urlToSubmit) {
        return new Response(
          JSON.stringify({ success: false, error: 'A valid URL is required for submission.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const bingRes = await submitUrlToBing(urlToSubmit, config);

      // Also trigger IndexNow if key is present
      let indexNowRes = null;
      if (indexNowKey) {
        try {
          const host = new URL(siteUrl).hostname;
          indexNowRes = await submitToIndexNow([urlToSubmit], { host, key: indexNowKey });
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: bingRes.success,
          bing: bingRes,
          indexNow: indexNowRes,
          message: bingRes.message,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'submit_batch') {
      const urls = (body.urls || []).filter(Boolean);
      if (!urls.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'At least one URL is required in the batch list.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const batchRes = await submitUrlBatchToBing(urls, config);
      return new Response(JSON.stringify(batchRes), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'submit_all_recent') {
      // Pull recent published articles (up to 50) and submit batch
      const articles = await getArticles(db, { limit: 50, status: 'published' });
      const articleUrls = articles.map((a) => `${siteUrl}/news/${a.slug}`);
      const sitePages = [`${siteUrl}/`, `${siteUrl}/category/naija-news`, `${siteUrl}/category/business`, `${siteUrl}/category/politics`];
      const allUrls = Array.from(new Set([...sitePages, ...articleUrls])).slice(0, 100);

      const batchRes = await submitUrlBatchToBing(allUrls, config);

      let indexNowRes = null;
      if (indexNowKey) {
        try {
          const host = new URL(siteUrl).hostname;
          indexNowRes = await submitToIndexNow(allUrls, { host, key: indexNowKey });
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: batchRes.success,
          totalSubmitted: allUrls.length,
          bing: batchRes,
          indexNow: indexNowRes,
          message: batchRes.message,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action specified. Choose submit_single, submit_batch, submit_all_recent, or test_connection.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
