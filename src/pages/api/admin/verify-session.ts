import type { APIRoute } from 'astro';
import { getD1, getSiteSettings } from '../../../lib/runtime-db';
import { verifyAdminToken, generateAdminToken, getEnvSecret } from '../../../lib/auth';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token') || '';

    let token = '';
    const match = cookieHeader.match(/bonesceo_session=([^;]+)/);
    if (match) {
      token = match[1];
    } else if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getD1(locals);
    const settings = await getSiteSettings(db);
    const secretKey =
      getEnvSecret(locals, 'ADMIN_SECRET_KEY', 'admin_secret_key', 'SECRET_KEY') ||
      settings.admin_secret_key ||
      '9jaBeacon_bonesceo_secret_key_2026_super_secure';

    const verification = verifyAdminToken(token, secretKey);
    if (!verification.valid || !verification.email) {
      return new Response(JSON.stringify({ authenticated: false, error: 'Session expired or invalid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Refresh token and ensure cookie is set
    const refreshedToken = generateAdminToken(verification.email, secretKey);
    const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
    const secureFlag = isHttps ? '; Secure' : '';

    return new Response(
      JSON.stringify({
        authenticated: true,
        email: verification.email,
        token: refreshedToken,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `bonesceo_session=${refreshedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`,
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ authenticated: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
