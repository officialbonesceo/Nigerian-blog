import type { APIRoute } from 'astro';
import {
  getD1,
  getAdvertInquiries,
  updateAdvertInquiry,
  deleteAdvertInquiry,
  getCustomAds,
  createCustomAd,
  toggleCustomAd,
  deleteCustomAd,
  addAutomationLog
} from '../../../lib/runtime-db';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const d1 = getD1(locals);
    const [inquiries, ads] = await Promise.all([
      getAdvertInquiries(d1),
      getCustomAds(d1)
    ]);

    return new Response(JSON.stringify({
      success: true,
      inquiries,
      ads
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || 'Failed to load inquiries'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const d1 = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const action = String(body.action || '').trim();

    if (action === 'one_click_advertise') {
      const inquiryId = String(body.inquiry_id || '').trim();
      const title = String(body.title || '').trim();
      const teaser = String(body.teaser || '').trim();
      const targetUrl = String(body.target_url || '').trim();
      const format = String(body.format || 'spotlight').trim();

      if (!targetUrl || !title) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Title and target website URL are required to launch a sponsor ad.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await createCustomAd(d1, {
        inquiry_id: inquiryId || null,
        title,
        teaser,
        target_url: targetUrl,
        format
      });

      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error || 'Failed to launch custom ad'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await addAutomationLog(
        d1,
        'ONE_CLICK_AD_LAUNCHED',
        null,
        `Launched live sponsored spotlight ad: "${title}" -> ${targetUrl}`,
        'info'
      ).catch(() => {});

      return new Response(JSON.stringify({
        success: true,
        adId: result.id,
        message: 'Sponsored campaign is now LIVE across 9jaBeacon!'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_status') {
      const id = String(body.id || '').trim();
      const status = body.status as any;
      if (!id || !status) {
        return new Response(JSON.stringify({ success: false, error: 'ID and status required' }), { status: 400 });
      }

      const ok = await updateAdvertInquiry(d1, id, { status });
      return new Response(JSON.stringify({ success: ok }), { status: ok ? 200 : 500 });
    }

    if (action === 'toggle_ad') {
      const id = String(body.id || '').trim();
      const isActive = Boolean(body.is_active);
      const ok = await toggleCustomAd(d1, id, isActive);
      return new Response(JSON.stringify({ success: ok }), { status: ok ? 200 : 500 });
    }

    if (action === 'delete_ad') {
      const id = String(body.id || '').trim();
      const ok = await deleteCustomAd(d1, id);
      return new Response(JSON.stringify({ success: ok }), { status: ok ? 200 : 500 });
    }

    if (action === 'delete_inquiry') {
      const id = String(body.id || '').trim();
      const ok = await deleteAdvertInquiry(d1, id);
      return new Response(JSON.stringify({ success: ok }), { status: ok ? 200 : 500 });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action specified' }), { status: 400 });
  } catch (err: any) {
    console.error('API /api/admin/advert-inquiries POST error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || 'Server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
