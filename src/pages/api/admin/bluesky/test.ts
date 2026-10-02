import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../../lib/runtime-db';
import { createBlueskySession } from '../../../../lib/bluesky';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = await request.json().catch(() => ({}));
    
    let identifier = body.identifier;
    let appPassword = body.appPassword || body.password;

    // Fall back to saved credentials if not provided in payload
    if (!identifier || !appPassword) {
      const autoSettings = await getAutomationSettings(db);
      const settingsMap: Record<string, string> = {};
      for (const s of autoSettings) settingsMap[s.key] = s.value;
      
      identifier = identifier || settingsMap.bluesky_identifier || '';
      appPassword = appPassword || settingsMap.bluesky_app_password || '';
    }

    if (!identifier || !appPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Please enter your Bluesky Username/Handle and App Password.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authRes = await createBlueskySession({ identifier, appPassword });
    if (!authRes.success || !authRes.session) {
      return new Response(JSON.stringify({
        success: false,
        error: authRes.error || 'Bluesky authentication failed. Check your handle and app password.',
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
