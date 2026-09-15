/**
 * Bing Webmaster API & IndexNow Client for Automated URL Submission
 *
 * Supports:
 * 1. Bing Webmaster API: POST https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey={API_KEY}
 * 2. Bing Webmaster Batch API: POST https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey={API_KEY}
 * 3. IndexNow API (Bing / Yandex / Seznam shared protocol): POST https://api.indexnow.org/indexnow
 */

export interface BingSubmissionConfig {
  apiKey?: string;
  siteUrl?: string;
  autoSubmitEnabled?: boolean;
  indexNowKey?: string;
}

export interface BingSubmissionResult {
  success: boolean;
  statusCode?: number;
  message: string;
  urlCount: number;
  endpoint: string;
  error?: string;
  timestamp: string;
}

/**
 * Submit single URL to Bing Webmaster API
 */
export async function submitUrlToBing(
  urlToSubmit: string,
  config: BingSubmissionConfig
): Promise<BingSubmissionResult> {
  const apiKey = (config.apiKey || '').trim();
  const siteUrl = (config.siteUrl || 'https://9jabeacon.name.ng').replace(/\/+$/, '');

  if (!apiKey) {
    return {
      success: false,
      message: 'Bing API key is not configured in Admin Settings.',
      urlCount: 0,
      endpoint: 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl',
      error: 'MISSING_API_KEY',
      timestamp: new Date().toISOString(),
    };
  }

  const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        siteUrl,
        url: urlToSubmit,
      }),
    });

    const statusCode = response.status;
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {}

    // HTTP 200 means accepted and queued for indexing
    if (response.ok) {
      return {
        success: true,
        statusCode,
        message: `Successfully submitted URL to Bing: ${urlToSubmit}`,
        urlCount: 1,
        endpoint: 'SubmitUrl',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      statusCode,
      message: `Bing API responded with status ${statusCode}: ${responseText.slice(0, 300)}`,
      urlCount: 0,
      endpoint: 'SubmitUrl',
      error: responseText,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network or runtime error submitting to Bing: ${err.message}`,
      urlCount: 0,
      endpoint: 'SubmitUrl',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Submit a batch of URLs to Bing Webmaster Batch API
 */
export async function submitUrlBatchToBing(
  urlList: string[],
  config: BingSubmissionConfig
): Promise<BingSubmissionResult> {
  const apiKey = (config.apiKey || '').trim();
  const siteUrl = (config.siteUrl || 'https://9jabeacon.name.ng').replace(/\/+$/, '');
  const filteredUrls = Array.from(new Set(urlList.filter((u) => u && typeof u === 'string'))).slice(0, 500);

  if (filteredUrls.length === 0) {
    return {
      success: false,
      message: 'No valid URLs provided to submit.',
      urlCount: 0,
      endpoint: 'SubmitUrlBatch',
      error: 'EMPTY_URL_LIST',
      timestamp: new Date().toISOString(),
    };
  }

  if (!apiKey) {
    return {
      success: false,
      message: 'Bing API key is not configured in Admin Settings.',
      urlCount: 0,
      endpoint: 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch',
      error: 'MISSING_API_KEY',
      timestamp: new Date().toISOString(),
    };
  }

  const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        siteUrl,
        urlList: filteredUrls,
      }),
    });

    const statusCode = response.status;
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {}

    if (response.ok) {
      return {
        success: true,
        statusCode,
        message: `Successfully submitted ${filteredUrls.length} URLs to Bing Batch endpoint.`,
        urlCount: filteredUrls.length,
        endpoint: 'SubmitUrlBatch',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      statusCode,
      message: `Bing Batch API returned status ${statusCode}: ${responseText.slice(0, 300)}`,
      urlCount: 0,
      endpoint: 'SubmitUrlBatch',
      error: responseText,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network failure connecting to Bing Batch API: ${err.message}`,
      urlCount: 0,
      endpoint: 'SubmitUrlBatch',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Submit via IndexNow (Microsoft Bing & partners real-time indexing protocol)
 */
export async function submitToIndexNow(
  urlList: string[],
  config: { host: string; key: string; keyLocation?: string }
): Promise<BingSubmissionResult> {
  const host = config.host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const key = (config.key || '').trim();
  const validUrls = Array.from(new Set(urlList.filter(Boolean))).slice(0, 500);

  if (!key) {
    return {
      success: false,
      message: 'IndexNow Key is missing.',
      urlCount: 0,
      endpoint: 'https://api.indexnow.org/indexnow',
      error: 'MISSING_INDEXNOW_KEY',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const body: Record<string, any> = {
      host,
      key,
      urlList: validUrls,
    };
    if (config.keyLocation) {
      body.keyLocation = config.keyLocation;
    }

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    const statusCode = res.status;
    let text = '';
    try {
      text = await res.text();
    } catch {}

    // IndexNow returns 200 (OK) or 202 (Accepted)
    if (res.ok || statusCode === 200 || statusCode === 202) {
      return {
        success: true,
        statusCode,
        message: `Dispatched ${validUrls.length} URL(s) to IndexNow engine.`,
        urlCount: validUrls.length,
        endpoint: 'IndexNow',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      statusCode,
      message: `IndexNow API status ${statusCode}: ${text.slice(0, 250)}`,
      urlCount: 0,
      endpoint: 'IndexNow',
      error: text,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `IndexNow request error: ${err.message}`,
      urlCount: 0,
      endpoint: 'IndexNow',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}
