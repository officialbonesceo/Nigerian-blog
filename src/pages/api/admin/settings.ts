import type { APIRoute } from 'astro';
import { getD1, updateAutomationSetting, updateSiteSetting, getSiteSettings } from '../../../lib/runtime-db';
import { verifyAdminToken, getEnvSecret } from '../../../lib/auth';

interface SettingsBody {
  type?: 'automation' | 'site';
  settings?: Record<string, unknown>;
}

function extractToken(request: Request): string {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/bonesceo_session=([^;]+)/);
  if (m) return m[1];
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

async function assertAdmin(request: Request, locals: any): Promise<boolean> {
  const token = extractToken(request);
  if (!token) return false;
  const db = getD1(locals);
  const siteSettings = await getSiteSettings(db);
  const secretKey =
    getEnvSecret(locals, 'ADMIN_SECRET_KEY', 'admin_secret_key', 'SECRET_KEY') ||
    siteSettings.admin_secret_key ||
    '9jaBeacon_bonesceo_secret_key_2026_super_secure';
  return verifyAdminToken(token, secretKey).valid;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!(await assertAdmin(request, locals))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const b = (await request.json().catch(() => ({}))) as SettingsBody;
    if (!b.settings || typeof b.settings !== 'object') {
      return new Response(JSON.stringify({ error: 'Settings object is required' }), { status: 400 });
    }
    // Never allow password/secret keys from this generic endpoint
    const blocked = ['admin_password', 'admin_secret_key', 'SECRET_KEY', 'api_key'];
    const db = getD1(locals);
    if (b.type === 'automation') {
      for (const [k, v] of Object.entries(b.settings)) {
        if (blocked.includes(k)) continue;
        await updateAutomationSetting(db, k, String(v ?? ''));
      }
    } else {
      for (const [k, v] of Object.entries(b.settings)) {
        if (blocked.includes(k)) continue;
        await updateSiteSetting(db, k, String(v ?? ''));
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
