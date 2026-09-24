import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../lib/runtime-db';
import { runFullModelDiscoveryAndHealthCheck } from '../../../lib/dynamic-model-discovery';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    const autoSettings = await getAutomationSettings(db).catch(() => []);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const openrouterApiKey = (settingsMap.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
    const cloudflareAccountId = (settingsMap.cloudflare_account_id || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const cloudflareApiToken = (settingsMap.cloudflare_api_token || process.env.CLOUDFLARE_API_TOKEN || '').trim();

    const report = await runFullModelDiscoveryAndHealthCheck({
      openrouterApiKey: openrouterApiKey || undefined,
      cloudflareAccountId: cloudflareAccountId || undefined,
      cloudflareApiToken: cloudflareApiToken || undefined,
    });

    return new Response(JSON.stringify({
      success: true,
      report,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || String(err),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as {
      openrouter_api_key?: string;
      cloudflare_account_id?: string;
      cloudflare_api_token?: string;
    };

    const autoSettings = await getAutomationSettings(db).catch(() => []);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const openrouterApiKey = (body.openrouter_api_key || settingsMap.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
    const cloudflareAccountId = (body.cloudflare_account_id || settingsMap.cloudflare_account_id || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const cloudflareApiToken = (body.cloudflare_api_token || settingsMap.cloudflare_api_token || process.env.CLOUDFLARE_API_TOKEN || '').trim();

    const report = await runFullModelDiscoveryAndHealthCheck({
      openrouterApiKey: openrouterApiKey || undefined,
      cloudflareAccountId: cloudflareAccountId || undefined,
      cloudflareApiToken: cloudflareApiToken || undefined,
    });

    return new Response(JSON.stringify({
      success: true,
      report,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || String(err),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
