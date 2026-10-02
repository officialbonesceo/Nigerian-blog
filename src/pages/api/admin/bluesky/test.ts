import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../../lib/runtime-db';
import { createBlueskySession } from '../../../../lib/bluesky';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    const envIdentifier = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_IDENTIFIER ||
      (import.meta as any).env?.BLUESKY_IDENTIFIER ||
      ''
    ).trim();

    const envAppPassword = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_APP_PASSWORD : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_APP_PASSWORD ||
      (import.meta as any).env?.BLUESKY_APP_PASSWORD ||
      ''
    ).trim();

    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) settingsMap[s.key] = s.value;

    const identifier = envIdentifier || settingsMap.bluesky_identifier || '';
    const hasPassword = Boolean(envAppPassword || settingsMap.bluesky_app_password);
    const source = envIdentifier && envAppPassword ? 'environment' : (settingsMap.bluesky_app_password ? 'database' : 'missing');

    return new Response(JSON.stringify({
      configured: Boolean(identifier && hasPassword),
      identifier: identifier ? identifier.replace(/^@/, '') : '',
      source,
      hasPassword,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ configured: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = await request.json().catch(() => ({}));

    const envIdentifier = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_IDENTIFIER ||
      (import.meta as any).env?.BLUESKY_IDENTIFIER ||
      ''
    ).trim();

    const envAppPassword = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_APP_PASSWORD : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_APP_PASSWORD ||
      (import.meta as any).env?.BLUESKY_APP_PASSWORD ||
      ''
    ).trim();

    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) settingsMap[s.key] = s.value;

    const identifier = (body.identifier || envIdentifier || settingsMap.bluesky_identifier || '').trim();
    const appPassword = (body.appPassword || envAppPassword || settingsMap.bluesky_app_password || '').trim();

    if (!identifier || !appPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bluesky credentials not found. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in your server environment (.env).',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authRes = await createBlueskySession({ identifier, appPassword });
    if (!authRes.success || !authRes.session) {
      return new Response(JSON.stringify({
        success: false,
        error: authRes.error || 'Bluesky authentication failed. Check your server credentials.',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      profile: {
        handle: authRes.session.handle,
        displayName: authRes.session.displayName || authRes.session.handle,
        did: authRes.session.did,
        avatar: authRes.session.avatar || null,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal server error while connecting to Bluesky.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
