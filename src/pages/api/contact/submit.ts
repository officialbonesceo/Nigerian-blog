import type { APIRoute } from 'astro';
import { getD1, createAdvertInquiry } from '../../../lib/runtime-db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const data = (await request.json().catch(() => ({}))) as Record<string, any>;
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    const subject = String(data.subject || 'advertising').trim();
    const company = String(data.company || '').trim();
    const budget = String(data.budget || '').trim();
    const targetUrl = String(data.target_url || '').trim();
    const message = String(data.message || '').trim();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name, email, and message are required fields.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic email format check
    if (!email.includes('@') || !email.includes('.')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Please provide a valid email address.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d1 = getD1(locals);
    const result = await createAdvertInquiry(d1, {
      name,
      email,
      subject,
      company: company || null,
      budget: budget || null,
      target_url: targetUrl || null,
      message,
      promoted_headline: company ? `${company} - Official Partner Deal` : `${name}'s Sponsored Opportunity`,
      promoted_teaser: message.slice(0, 150),
      promoted_link: targetUrl || null
    });

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Failed to register inquiry in database.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      id: result.id,
      message: 'Thank you! Your advertising inquiry has been submitted and registered with the 9jaBeacon admin desk.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('API /api/contact/submit error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Internal server error processing inquiry.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
