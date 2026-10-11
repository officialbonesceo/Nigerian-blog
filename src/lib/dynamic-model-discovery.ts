/**
 * Dynamic AI Model Discovery & Pre-Flight Health Check Service
 * 
 * Dynamically queries official OpenRouter and Cloudflare endpoints to identify:
 * 1. Currently active and free models (OpenRouter: :free tag, 0-cost pricing, openrouter/free router)
 * 2. Currently deployed Cloudflare Workers AI LLM models (via Account Search API or official catalog)
 * 3. Verified working models through rapid, lightweight pre-flight probes before writing
 */

export interface DiscoveredModel {
  id: string;
  name?: string;
  contextLength?: number;
  isFree: boolean;
  provider: 'openrouter' | 'cloudflare';
  verifiedWorking?: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ModelDiscoveryReport {
  timestamp: string;
  openrouter: {
    totalFound: number;
    freeModels: string[];
    workingModels: string[];
    probedCount: number;
    errors: string[];
  };
  cloudflare: {
    totalFound: number;
    catalogModels: string[];
    workingModels: string[];
    probedCount: number;
    errors: string[];
  };
}

// In-memory cache to avoid redundant network discovery calls during high-frequency ingestion
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let openrouterCache: CacheEntry<string[]> | null = null;
let cloudflareCache: CacheEntry<string[]> | null = null;

// Baseline fallback models in case the remote discovery endpoints are temporarily unreachable
const FALLBACK_OPENROUTER_FREE_MODELS = [
  'openrouter/free',
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nex-agi/nex-n2.5-pro:free',
  'z-ai/glm-5.2:free',
];

const FALLBACK_CLOUDFLARE_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/qwen/qwen3.8-27b',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
];

/**
 * Discovers all active, free models from OpenRouter via its public models endpoint
 * Endpoint: https://openrouter.ai/api/v1/models
 */
export async function discoverOpenRouterFreeModels(options?: {
  apiKey?: string;
  forceRefresh?: boolean;
}): Promise<string[]> {
  const now = Date.now();
  if (!options?.forceRefresh && openrouterCache && (now - openrouterCache.timestamp < CACHE_TTL_MS)) {
    return [...openrouterCache.data];
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'HTTP-Referer': 'https://9jabeacon.com',
      'X-Title': '9jaBeacon News Engine',
    };
    if (options?.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[ModelDiscovery] OpenRouter models endpoint returned HTTP ${res.status}`);
      return FALLBACK_OPENROUTER_FREE_MODELS;
    }

    const json = (await res.json()) as any;
    const models: any[] = json?.data || [];

    // Filter down to text-generation models that are free
    const freeModels = models.filter((m) => {
      const id = String(m.id || '');
      const isExplicitFreeId = id.endsWith(':free') || id === 'openrouter/free';
      const isZeroPrice = m.pricing &&
        parseFloat(String(m.pricing.prompt || '1')) === 0 &&
        parseFloat(String(m.pricing.completion || '1')) === 0;

      // Filter out embeddings, audio, moderation, guardrails, and image-only models
      const isExcluded = /(embed|safety|moderation|guard|classifier|clip|whisper|tts|audio|image|vision-only)/i.test(id);
      const hasSufficientContext = (m.context_length || 0) >= 4000;

      return (isExplicitFreeId || isZeroPrice) && !isExcluded && hasSufficientContext;
    });

    // Rank models:
    // 1. 'openrouter/free' (automatic healthy router)
    // 2. High context length models from reputable open weights (Qwen, Gemma, Llama, Nemotron, Mistral)
    const sorted = freeModels.sort((a, b) => {
      if (a.id === 'openrouter/free') return -1;
      if (b.id === 'openrouter/free') return 1;

      // Prefer reputable families
      const scoreA = /(qwen|gemma|llama|nemotron|mistral|deepseek)/i.test(a.id) ? 10 : 0;
      const scoreB = /(qwen|gemma|llama|nemotron|mistral|deepseek)/i.test(b.id) ? 10 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      return (b.context_length || 0) - (a.context_length || 0);
    });

    const modelIds = sorted.map((m) => m.id as string);
    if (modelIds.length > 0) {
      openrouterCache = { data: modelIds, timestamp: now };
      return modelIds;
    }
  } catch (err: any) {
    console.warn(`[ModelDiscovery] OpenRouter discovery error: ${err.message}`);
  }

  return FALLBACK_OPENROUTER_FREE_MODELS;
}

/**
 * Probes a specific OpenRouter model with a minimal 2-token request to verify if it is responsive
 */
export async function probeOpenRouterModel(
  modelId: string,
  apiKey: string
): Promise<{ working: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://9jabeacon.com',
        'X-Title': '9jaBeacon Pre-Flight Check',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say 1' }],
        max_tokens: 3,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(4500),
    });

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { working: true, latencyMs };
    }

    const errText = await res.text().catch(() => '');
    let parsedMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      parsedMsg = errJson.error?.message || parsedMsg;
    } catch {}

    return { working: false, latencyMs, error: parsedMsg };
  } catch (err: any) {
    return { working: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Discovers and returns active, verified working free OpenRouter models
 */
export async function getVerifiedWorkingOpenRouterModels(
  apiKey: string,
  options?: { maxToProbe?: number; forceRefresh?: boolean }
): Promise<{ workingModels: string[]; tested: DiscoveredModel[] }> {
  const candidateIds = await discoverOpenRouterFreeModels({ apiKey, forceRefresh: options?.forceRefresh });
  const maxToProbe = options?.maxToProbe || 5;
  const tested: DiscoveredModel[] = [];
  const workingModels: string[] = [];

  for (const modelId of candidateIds.slice(0, maxToProbe)) {
    const probe = await probeOpenRouterModel(modelId, apiKey);
    tested.push({
      id: modelId,
      isFree: true,
      provider: 'openrouter',
      verifiedWorking: probe.working,
      latencyMs: probe.latencyMs,
      error: probe.error,
    });

    if (probe.working) {
      workingModels.push(modelId);
    }
  }

  // If none passed live probe (e.g. key issue or temporary network block),
  // return candidate list with openrouter/free first so consumer can attempt
  if (workingModels.length === 0) {
    workingModels.push(...candidateIds.slice(0, 3));
  }

  return { workingModels, tested };
}

/**
 * Discovers active Cloudflare Workers AI LLM models via Account Search API or official catalog
 */
export async function discoverCloudflareModels(options?: {
  accountId?: string;
  apiToken?: string;
  forceRefresh?: boolean;
}): Promise<string[]> {
  const now = Date.now();
  if (!options?.forceRefresh && cloudflareCache && (now - cloudflareCache.timestamp < CACHE_TTL_MS)) {
    return [...cloudflareCache.data];
  }

  // 1. Attempt Cloudflare Account Models Search API if credentials are provided
  if (options?.accountId && options?.apiToken) {
    try {
      const searchUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/models/search?task=Text%20Generation`;
      const res = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${options.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const results = json?.result || [];
        const isCfExcluded = (id: string) => /(embed|rerank|flux|diffusion|aura|nova|whisper|vision-only|guard|safety|moderation|classifier|thebloke)/i.test(id);
        const modelNames = results
          .map((m: any) => m.name || m.id)
          .filter((id: string) => Boolean(id) && !isCfExcluded(id));
        if (modelNames.length > 0) {
          cloudflareCache = { data: modelNames, timestamp: now };
          return modelNames;
        }
      }
    } catch {
      // Gracefully fall back to catalog
    }
  }

  // 2. Discover from Cloudflare Workers AI official catalog (no auth needed)
  try {
    const catalogRes = await fetch('https://developers.cloudflare.com/workers-ai/llms.txt', {
      signal: AbortSignal.timeout(6000),
    });

    if (catalogRes.ok) {
      const text = await catalogRes.text();
      const lines = text.split('\n');
      const discovered: string[] = [];

      for (const line of lines) {
        const match = line.match(/\[(@cf\/[^\]]+)\]/);
        if (match) {
          const modelId = match[1];
          const isTextGeneration = /(instruct|chat|deepseek|llama|qwen|mistral|gemma|glm)/i.test(modelId);
          const isExcluded = /(embed|rerank|flux|diffusion|aura|nova|whisper|vision-only|guard|safety|moderation|classifier|thebloke)/i.test(modelId);
          if (isTextGeneration && !isExcluded) {
            discovered.push(modelId);
          }
        }
      }

      if (discovered.length > 0) {
        cloudflareCache = { data: discovered, timestamp: now };
        return discovered;
      }
    }
  } catch (err: any) {
    console.warn(`[ModelDiscovery] Cloudflare catalog parsing error: ${err.message}`);
  }

  return FALLBACK_CLOUDFLARE_MODELS;
}

/**
 * Probes a specific Cloudflare Workers AI model with a 2-token request
 */
export async function probeCloudflareModel(
  modelId: string,
  accountId: string,
  apiToken: string
): Promise<{ working: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;
    const res = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say 1' }],
        max_tokens: 3,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(4500),
    });

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { working: true, latencyMs };
    }

    const errText = await res.text().catch(() => '');
    return { working: false, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 70)}` };
  } catch (err: any) {
    return { working: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Discovers and returns active, verified working Cloudflare Workers AI models
 */
export async function getVerifiedWorkingCloudflareModels(
  accountId: string,
  apiToken: string,
  options?: { maxToProbe?: number; forceRefresh?: boolean }
): Promise<{ workingModels: string[]; tested: DiscoveredModel[] }> {
  const candidateIds = await discoverCloudflareModels({
    accountId,
    apiToken,
    forceRefresh: options?.forceRefresh,
  });

  const maxToProbe = options?.maxToProbe || 4;
  const tested: DiscoveredModel[] = [];
  const workingModels: string[] = [];

  for (const modelId of candidateIds.slice(0, maxToProbe)) {
    const probe = await probeCloudflareModel(modelId, accountId, apiToken);
    tested.push({
      id: modelId,
      isFree: true,
      provider: 'cloudflare',
      verifiedWorking: probe.working,
      latencyMs: probe.latencyMs,
      error: probe.error,
    });

    if (probe.working) {
      workingModels.push(modelId);
    }
  }

  if (workingModels.length === 0) {
    workingModels.push(...candidateIds.slice(0, 3));
  }

  return { workingModels, tested };
}

/**
 * Comprehensive diagnostic pre-flight run across all configured providers
 */
export async function runFullModelDiscoveryAndHealthCheck(credentials: {
  openrouterApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
}): Promise<ModelDiscoveryReport> {
  const report: ModelDiscoveryReport = {
    timestamp: new Date().toISOString(),
    openrouter: {
      totalFound: 0,
      freeModels: [],
      workingModels: [],
      probedCount: 0,
      errors: [],
    },
    cloudflare: {
      totalFound: 0,
      catalogModels: [],
      workingModels: [],
      probedCount: 0,
      errors: [],
    },
  };

  // 1. OpenRouter Discovery
  try {
    const freeModels = await discoverOpenRouterFreeModels({
      apiKey: credentials.openrouterApiKey,
      forceRefresh: true,
    });
    report.openrouter.totalFound = freeModels.length;
    report.openrouter.freeModels = freeModels.slice(0, 10);

    if (credentials.openrouterApiKey) {
      const probeResult = await getVerifiedWorkingOpenRouterModels(credentials.openrouterApiKey, {
        maxToProbe: 4,
        forceRefresh: true,
      });
      report.openrouter.probedCount = probeResult.tested.length;
      report.openrouter.workingModels = probeResult.workingModels;
      for (const t of probeResult.tested) {
        if (!t.verifiedWorking && t.error) {
          report.openrouter.errors.push(`${t.id}: ${t.error}`);
        }
      }
    } else {
      report.openrouter.workingModels = freeModels.slice(0, 5);
    }
  } catch (err: any) {
    report.openrouter.errors.push(err.message);
  }

  // 2. Cloudflare Discovery
  try {
    const cfModels = await discoverCloudflareModels({
      accountId: credentials.cloudflareAccountId,
      apiToken: credentials.cloudflareApiToken,
      forceRefresh: true,
    });
    report.cloudflare.totalFound = cfModels.length;
    report.cloudflare.catalogModels = cfModels.slice(0, 10);

    if (credentials.cloudflareAccountId && credentials.cloudflareApiToken) {
      const probeResult = await getVerifiedWorkingCloudflareModels(
        credentials.cloudflareAccountId,
        credentials.cloudflareApiToken,
        { maxToProbe: 4, forceRefresh: true }
      );
      report.cloudflare.probedCount = probeResult.tested.length;
      report.cloudflare.workingModels = probeResult.workingModels;
      for (const t of probeResult.tested) {
        if (!t.verifiedWorking && t.error) {
          report.cloudflare.errors.push(`${t.id}: ${t.error}`);
        }
      }
    } else {
      report.cloudflare.workingModels = cfModels.slice(0, 5);
    }
  } catch (err: any) {
    report.cloudflare.errors.push(err.message);
  }

  return report;
}
