import type { APIRoute } from 'astro';
import { getD1, getSiteSettings } from '../../../lib/runtime-db';
import crypto from 'node:crypto';

interface LoginBody {
  email?: string;
  password?: string;
}

function token(email: string, secret: string) {
  const expiry = Date.now() + 604800000;
  const data = `${email}:${expiry}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(`${data}:${sig}`).toString('base64');
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as LoginBody;
    const email = String(b.email || '').trim().toLowerCase();
    const s = await getSiteSettings(getD1(locals));
    const admin = String(s.admin_email || 'officialbonesceo@gmail.com').trim().toLowerCase();
    const password = String(s.admin_password || 'Admin@9jaBeacon2025!');
    if (email !== admin) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized administrator email address.' }), {
        status: 401,
      });
    }
    if (String(b.password || '') !== password) {
      return new Response(JSON.stringify({ success: false, error: 'Incorrect administrator password.' }), {
        status: 401,
      });
    }
    const t = token(email, String(s.admin_secret_key || crypto.randomUUID()));
    return new Response(JSON.stringify({ success: true, token: t, email, redirectUrl: '/bonesceo/admin' }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `bonesceo_session=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
};
