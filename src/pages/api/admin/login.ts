import type { APIRoute } from 'astro';
import { getD1, getSiteSettings } from '../../../lib/runtime-db';
import { generateAdminToken, isAuthorizedAdmin, getEnvSecret } from '../../../lib/auth';

interface LoginBody {
  email?: string;
  password?: string;
  auth_type?: 'credentials' | 'google' | 'oauth';
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as LoginBody;

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const isOAuth = body.auth_type === 'google' || body.auth_type === 'oauth';

    const check = await isAuthorizedAdmin(db, email, password, isOAuth, locals);

    if (!check.authorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: check.reason || 'Invalid administrator login credentials.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const settings = await getSiteSettings(db);
    const secretKey =
      getEnvSecret(locals, 'ADMIN_SECRET_KEY', 'admin_secret_key', 'SECRET_KEY') ||
      settings.admin_secret_key ||
      '9jaBeacon_bonesceo_secret_key_2026_super_secure';

    const token = generateAdminToken(check.email, secretKey);

    const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
    const secureFlag = isHttps ? '; Secure' : '';
    // SameSite=Lax with root path
    const cookieHeader = `bonesceo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`;

    return new Response(
      JSON.stringify({
        success: true,
        token,
        email: check.email,
        redirectUrl: `/bonesceo/admin?token=${encodeURIComponent(token)}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Authentication error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
