import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: any = await request.json().catch(() => ({}));
    const userToken = (body.user_access_token || '').trim();
    const appId = (body.app_id || '').trim();
    const appSecret = (body.app_secret || '').trim();

    if (!userToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Please provide a User Access Token or Page Token from Meta Graph API Explorer.',
        instructions: [
          '1. Go to https://developers.facebook.com/tools/explorer/',
          '2. Select your Meta App in the top dropdown.',
          '3. Under Permissions, add: pages_manage_posts, pages_read_engagement, pages_show_list.',
          '4. Click "Generate Access Token" and paste it here.',
        ]
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optional: If App ID and Secret provided, exchange for Long-Lived Token first
    let activeToken = userToken;
    let longLivedNotice = '';

    if (appId && appSecret) {
      try {
        const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`;
        const exRes = await fetch(exchangeUrl);
        const exData: any = await exRes.json();
        if (exData.access_token) {
          activeToken = exData.access_token;
          longLivedNotice = 'Successfully exchanged for Long-Lived Token (lasts 60 days for user, permanent for pages)!';
        }
      } catch (exErr: any) {
        console.warn('Long-lived token exchange warning:', exErr.message);
      }
    }

    // Step 1: Query /me to get user info
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(activeToken)}`);
    const meData: any = await meRes.json();

    if (meData.error) {
      return new Response(JSON.stringify({
        success: false,
        error: meData.error.message || 'Meta API returned an error.',
        type: meData.error.type,
        code: meData.error.code,
        fbtrace_id: meData.error.fbtrace_id,
        tip: meData.error.message.includes('Session has expired')
          ? 'Your access token has expired. Please generate a fresh token at developers.facebook.com/tools/explorer/'
          : 'Check that your Meta App has pages_show_list, pages_manage_posts permissions enabled.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Query /me/accounts to get all connected pages and their page tokens
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token,tasks,is_published&access_token=${encodeURIComponent(activeToken)}`);
    const pagesData: any = await pagesRes.json();

    if (pagesData.error) {
      return new Response(JSON.stringify({
        success: false,
        error: pagesData.error.message || 'Could not retrieve Facebook pages.',
        user: meData,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pages = (pagesData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'General',
      is_published: p.is_published ?? true,
      tasks: p.tasks || [],
      // The access token returned by /me/accounts when using a long-lived user token is PERMANENT (never expires)!
      page_access_token: p.access_token,
      masked_token: p.access_token ? `${p.access_token.slice(0, 15)}...${p.access_token.slice(-10)}` : '',
    }));

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: meData.id,
        name: meData.name,
      },
      pageCount: pages.length,
      pages,
      longLivedNotice,
      help: pages.length === 0 ? 'No pages were returned for this account. If you are using a Test User or Tester Account, make sure to create a Page while logged into that account, or ensure your user account is an Admin/Editor of the Page.' : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal server error while inspecting Meta tokens.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
