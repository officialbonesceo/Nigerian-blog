import type { APIRoute } from 'astro';
import { verifyBufferTokenAndFetchProfiles, postToBuffer } from '../../../lib/buffer';
import { getD1, getAutomationSettings } from '../../../lib/runtime-db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'verify_token' | 'test_post';
      access_token?: string;
      facebook_profile_id?: string;
      instagram_profile_id?: string;
    };

    const db = getD1(locals);
    const settings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const token = body.access_token || settingsMap.buffer_access_token || '';

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Buffer Access Token is required. Please provide it in settings or the test input.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'test_post') {
      const fbId = body.facebook_profile_id || settingsMap.buffer_profile_ids_facebook || '';
      const igId = body.instagram_profile_id || settingsMap.buffer_profile_ids_instagram || '';

      const testResult = await postToBuffer(
        {
          accessToken: token,
          facebookProfileId: fbId,
          instagramProfileId: igId,
          autoPostEnabled: true,
          maxPostsPerWorkflow: 1,
        },
        {
          title: '9jaBeacon Test Dispatch: Real-Time Verified Nigerian Journalism',
          summary: 'This is a live test dispatch from the 9jaBeacon autonomous newsroom system verifying seamless API integration with Buffer.',
          categoryName: 'Business',
          canonicalUrl: 'https://9jabeacon.pages.dev',
          imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=1200&auto=format&fit=crop',
        }
      );

      return new Response(JSON.stringify(testResult), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default action: verify token and fetch available profiles
    const profilesResult = await verifyBufferTokenAndFetchProfiles(token);
    return new Response(JSON.stringify(profilesResult), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
