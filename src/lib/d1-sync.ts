/**
 * Cloudflare D1 Remote Sync Client
 * Allows GitHub Actions and local scripts to write directly to the Cloudflare D1 database (naijablog)
 * without triggering Cloudflare Pages build rebuilds!
 */

export interface D1QueryOptions {
  accountId?: string;
  apiToken?: string;
  databaseNameOrId?: string;
}

export async function executeD1Query(
  sql: string,
  params: any[] = [],
  options: D1QueryOptions = {}
): Promise<{ success: boolean; result?: any; error?: string }> {
  const accountId = (options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = (options.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const database = (options.databaseNameOrId || process.env.CLOUDFLARE_D1_DATABASE || 'naijablog').trim();

  if (!accountId || !apiToken) {
    return { success: false, error: 'Missing Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN)' };
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${database}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json() as any;
    if (res.ok && data.success) {
      return { success: true, result: data.result };
    } else {
      const errMsg = data.errors?.[0]?.message || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
