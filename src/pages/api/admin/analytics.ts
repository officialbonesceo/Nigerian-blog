/**
 * Admin analytics — Cloudflare GraphQL only.
 * Zero D1 SQL reads/writes. Uses Zone Analytics + adaptive country groups.
 */
import type { APIRoute } from 'astro';

const ZONE_ID = (import.meta.env.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || '58c456d568397b758c080a05446e4939').trim();
const ACCOUNT_ID = (import.meta.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const TOKEN = (
  import.meta.env.CLOUDFLARE_API_TOKEN ||
  process.env.CLOUDFLARE_API_TOKEN ||
  import.meta.env.CLOUDFLARE_D1_API_TOKEN ||
  process.env.CLOUDFLARE_D1_API_TOKEN ||
  ''
).trim();

async function cfGraphQL(query: string) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message || `GraphQL HTTP ${res.status}`);
  }
  return json.data;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    if (!TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CLOUDFLARE_API_TOKEN missing — needs Zone Analytics Read + Account Analytics Read',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7', 10) || 7, 1), 30);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceDay = sinceDate.toISOString().slice(0, 10);
    const untilDay = new Date().toISOString().slice(0, 10);
    const sinceIso = sinceDate.toISOString();

    const query = `{
      viewer {
        zones(filter: { zoneTag: "${ZONE_ID}" }) {
          series: httpRequests1dGroups(
            limit: ${days + 1},
            filter: { date_geq: "${sinceDay}", date_leq: "${untilDay}" },
            orderBy: [date_DESC]
          ) {
            dimensions { date }
            sum { requests pageViews bytes threats }
            uniq { uniques }
          }
          countries: httpRequestsAdaptiveGroups(
            limit: 20,
            filter: { datetime_geq: "${sinceIso}" },
            orderBy: [sum_requests_DESC]
          ) {
            dimensions { clientCountryName }
            sum { requests }
          }
          paths: httpRequestsAdaptiveGroups(
            limit: 15,
            filter: { datetime_geq: "${sinceIso}" },
            orderBy: [sum_requests_DESC]
          ) {
            dimensions { clientRequestPath }
            sum { requests }
          }
        }
      }
    }`;

    const data = await cfGraphQL(query);
    const zone = data?.viewer?.zones?.[0] || {};
    const series = (zone.series || []).map((row: any) => ({
      date: row.dimensions?.date,
      requests: row.sum?.requests || 0,
      pageViews: row.sum?.pageViews || 0,
      bytes: row.sum?.bytes || 0,
      threats: row.sum?.threats || 0,
      uniques: row.uniq?.uniques || 0,
    }));

    const countries = (zone.countries || [])
      .filter((r: any) => r.dimensions?.clientCountryName)
      .map((r: any) => ({
        country: r.dimensions.clientCountryName,
        requests: r.sum?.requests || 0,
      }));

    const topPaths = (zone.paths || [])
      .filter((r: any) => r.dimensions?.clientRequestPath)
      .map((r: any) => ({
        path: r.dimensions.clientRequestPath,
        requests: r.sum?.requests || 0,
      }));

    const totals = series.reduce(
      (acc: any, d: any) => {
        acc.requests += d.requests;
        acc.pageViews += d.pageViews;
        acc.bytes += d.bytes;
        acc.threats += d.threats;
        acc.uniques += d.uniques;
        return acc;
      },
      { requests: 0, pageViews: 0, bytes: 0, threats: 0, uniques: 0 }
    );

    // Busiest region = top country by requests
    const busyRegion = countries[0] || null;

    return new Response(
      JSON.stringify({
        success: true,
        source: 'cloudflare-graphql',
        zero_d1: true,
        zone_id: ZONE_ID,
        account_id: ACCOUNT_ID || null,
        range_days: days,
        totals,
        busy_region: busyRegion,
        countries,
        top_paths: topPaths,
        series,
        dashboard: {
          zone_analytics: `https://dash.cloudflare.com/${ACCOUNT_ID || 'account'}/9jabeacon.name.ng/analytics`,
          web_analytics: `https://dash.cloudflare.com/${ACCOUNT_ID || 'account'}/web-analytics`,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=120',
        },
      }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message || String(e), zero_d1: true }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
