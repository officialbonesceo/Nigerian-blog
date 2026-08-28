/**
 * Cloudflare D1 remote client.
 * D1 is the production source of truth. The local SQLite file is only an
 * ephemeral build/ingestion cache and must never be committed to Git.
 */

export interface D1QueryOptions {
  accountId?: string;
  apiToken?: string;
  databaseNameOrId?: string;
}

async function resolveDatabaseId(accountId: string, apiToken: string, databaseNameOrId: string): Promise<string> {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(databaseNameOrId)) return databaseNameOrId;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database?per_page=100`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || `Unable to list D1 databases (HTTP ${res.status})`);
  }

  const match = (data.result || []).find((database: any) =>
    database.name === databaseNameOrId || database.uuid === databaseNameOrId
  );
  if (!match?.uuid) {
    throw new Error(`D1 database "${databaseNameOrId}" was not found in this Cloudflare account.`);
  }
  return match.uuid;
}

export async function executeD1Query(
  sql: string,
  params: any[] = [],
  options: D1QueryOptions = {}
): Promise<{ success: boolean; result?: any; error?: string }> {
  const accountId = (options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = (options.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const configuredDatabase = (options.databaseNameOrId || process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || '').trim();

  if (!accountId || !apiToken || !configuredDatabase) {
    return { success: false, error: 'Missing Cloudflare D1 credentials/database identifier.' };
  }

  try {
    const databaseId = await resolveDatabaseId(accountId, apiToken, configuredDatabase);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json() as any;
    if (res.ok && data.success) {
      return { success: true, result: data.result };
    }

    const errMsg = data.errors?.[0]?.message || `HTTP ${res.status}`;
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
