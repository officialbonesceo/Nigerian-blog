import type { APIRoute } from 'astro';
import { updateAutomationSetting, updateSiteSetting } from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, settings } = body;

    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ error: 'Settings object is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (type === 'automation') {
      for (const [key, value] of Object.entries(settings)) {
        updateAutomationSetting(key, String(value));
      }
    } else if (type === 'site') {
      for (const [key, value] of Object.entries(settings)) {
        updateSiteSetting(key, String(value));
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
