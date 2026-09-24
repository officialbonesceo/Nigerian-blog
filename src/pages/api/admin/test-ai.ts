import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../lib/runtime-db';
import { synthesizeNewsArticle, type AiCredentialsConfig } from '../../../lib/ai-engine';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as {
      tier?: 'all' | 'cloudflare' | 'openrouter' | 'local' | 'pollinations';
      local_ai_endpoint?: string;
      local_ai_model?: string;
      openrouter_api_key?: string;
      cloudflare_account_id?: string;
      cloudflare_api_token?: string;
    };

    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const aiConfig: AiCredentialsConfig = {
      geminiApiKey: process.env.GEMINI_API_KEY || settingsMap.gemini_api_key,
      cloudflareAccountId: body.cloudflare_account_id || settingsMap.cloudflare_account_id,
      cloudflareApiToken: body.cloudflare_api_token || settingsMap.cloudflare_api_token,
      openrouterApiKey: body.openrouter_api_key || settingsMap.openrouter_api_key,
      openrouterModel: settingsMap.openrouter_model || 'openrouter/free',
      localAiEndpoint: body.local_ai_endpoint || settingsMap.local_ai_endpoint || '',
      localAiModel: body.local_ai_model || settingsMap.local_ai_model || 'qwen2.5:3b',
      localAiApiKey: settingsMap.local_ai_api_key || 'ollama',
      pollinationsApiKey: settingsMap.pollinations_api_key,
    };

    const testLead = {
      title: 'Central Bank of Nigeria Announces New Digital Foreign Exchange Guidelines For Banks',
      sourceName: 'BusinessDay Nigeria',
      originalUrl: 'https://businessday.ng/test-fx-guidelines',
      description: 'The Central Bank of Nigeria has unveiled refreshed foreign exchange trading guidelines aimed at enhancing liquidity, boosting market transparency and supporting the Naira value in Lagos.',
      content: 'The Central Bank of Nigeria (CBN) has released a new regulatory directive for commercial lenders in Abuja and Lagos. Financial analysts note the policy is set to influence import credits and corporate treasury allocations nationwide.',
      categoryDefault: 'cat_money_hustle',
    };

    const startTime = Date.now();
    const result = await synthesizeNewsArticle(testLead, aiConfig);
    const durationMs = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: result.success,
      provider: result.provider,
      modelUsed: result.modelUsed,
      durationMs,
      headline: result.title,
      category: result.categoryId,
      traceLogs: result.traceLogs || [],
      error: result.error,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
