import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../../lib/runtime-db';
import { getBlueskyChannelAnalytics } from '../../../../lib/bluesky';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const queryHandle = url.searchParams.get('handle') || '';

    let identifier = queryHandle.trim();

    if (!identifier) {
      const db = getD1(locals);
      const envIdentifier = (
        (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '') ||
        (locals as any)?.runtime?.env?.BLUESKY_IDENTIFIER ||
        (import.meta as any).env?.BLUESKY_IDENTIFIER ||
        ''
      ).trim();

      const autoSettings = await getAutomationSettings(db);
      const settingsMap: Record<string, string> = {};
      for (const s of autoSettings) settingsMap[s.key] = s.value;

      identifier = envIdentifier || settingsMap.bluesky_identifier || '9jabeacon.bsky.social';
    }

    const analytics = await getBlueskyChannelAnalytics(identifier);

    return new Response(JSON.stringify(analytics), {
      status: analytics.success ? 200 : 200, // Return 200 even with empty/new profile with analytics.success = false
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=15', // 15-second micro-cache for high-concurrency efficiency
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || String(err),
      fetchedAt: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
