import type { APIRoute } from 'astro';
import { getDatabaseDiagnostics } from '../../lib/runtime-db';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const diag = await getDatabaseDiagnostics(locals);

    const isHealthy = diag.articleCount > 0;
    const statusCode = isHealthy ? 200 : 200; // Return 200 so monitoring tools can read the JSON diagnostic

    let recommendation = 'Database connected and actively serving news.';
    if (diag.mode === 'local_sqlite' && diag.activeRuntime.includes('Cloudflare')) {
      recommendation = 'ACTION REQUIRED: On Cloudflare Pages, neither D1 binding "DB" nor Cloudflare API secrets were found. In Cloudflare Pages Dashboard > Settings > Functions > D1 Database Bindings, bind "DB" to your D1 database, or set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID in Environment Variables.';
    } else if (diag.articleCount === 0) {
      recommendation = 'Database is connected but returned 0 published articles. Ensure your GitHub Actions workflow or ingestion script has completed inserting articles into D1.';
    }

    return new Response(
      JSON.stringify(
        {
          status: isHealthy ? 'healthy' : 'attention_required',
          database_mode: diag.mode,
          active_runtime: diag.activeRuntime,
          has_direct_d1_binding: diag.hasDirectBinding,
          has_rest_api_secrets: diag.hasRestApiSecrets,
          published_articles_count: diag.articleCount,
          active_sources_count: diag.sourceCount,
          latest_article: diag.latestArticle,
          query_error: diag.queryError,
          recommendation,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
