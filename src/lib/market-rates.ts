/**
 * 9jaBeacon Daily Currency & Market Rates Engine
 *
 * Multi-source live FX:
 * 1. open.er-api.com (no key)
 * 2. api.exchangerate-api.com (no key)
 * 3. fawazahmed0 currency-api via jsDelivr CDN (no key, includes USDT)
 *
 * Official = median of successful interbank feeds.
 * Parallel = official + street premium (BDC/Aboki-style spread).
 * USDT = live from fawazahmed0 when available.
 */

export interface CurrencyRateItem {
  id: string;
  pair: string;
  name: string;
  symbol: string;
  flag: string;
  officialBuy: number;
  officialSell: number;
  parallelBuy?: number;
  parallelSell?: number;
  change24h: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  searchVolumeRank: number;
  notes: string;
}

export interface MarketRatesResponse {
  timestamp: string;
  timestampFormatted: string;
  source: string;
  updateFrequency: string;
  rates: CurrencyRateItem[];
}

/** Fallback only when every live feed fails (kept near current market). */
export const DEFAULT_MARKET_RATES: CurrencyRateItem[] = [
  {
    id: 'usd',
    pair: 'USD / NGN',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    officialBuy: 1325,
    officialSell: 1332,
    parallelBuy: 1405,
    parallelSell: 1425,
    change24h: -0.15,
    unit: '₦/USD',
    trend: 'down',
    searchVolumeRank: 1,
    notes: 'Official interbank / NAFEM-style wire & BDC street index',
  },
  {
    id: 'gbp',
    pair: 'GBP / NGN',
    name: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    officialBuy: 1750,
    officialSell: 1765,
    parallelBuy: 1850,
    parallelSell: 1880,
    change24h: 0.1,
    unit: '₦/GBP',
    trend: 'up',
    searchVolumeRank: 2,
    notes: 'UK education, visa & commercial transfers',
  },
  {
    id: 'eur',
    pair: 'EUR / NGN',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    officialBuy: 1480,
    officialSell: 1495,
    parallelBuy: 1565,
    parallelSell: 1590,
    change24h: -0.1,
    unit: '₦/EUR',
    trend: 'down',
    searchVolumeRank: 3,
    notes: 'Schengen settlement & European trade',
  },
  {
    id: 'cad',
    pair: 'CAD / NGN',
    name: 'Canadian Dollar',
    symbol: 'C$',
    flag: '🇨🇦',
    officialBuy: 925,
    officialSell: 940,
    parallelBuy: 990,
    parallelSell: 1010,
    change24h: 0.2,
    unit: '₦/CAD',
    trend: 'up',
    searchVolumeRank: 4,
    notes: 'Immigration & study transfers',
  },
  {
    id: 'usdt',
    pair: 'USDT / NGN',
    name: 'Tether (P2P Dollar)',
    symbol: '₮',
    flag: '🌐',
    officialBuy: 1400,
    officialSell: 1415,
    parallelBuy: 1405,
    parallelSell: 1425,
    change24h: 0.05,
    unit: '₦/USDT',
    trend: 'stable',
    searchVolumeRank: 5,
    notes: 'P2P digital remittance benchmark',
  },
  {
    id: 'fuel',
    pair: 'PMS / LITRE',
    name: 'Premium Motor Spirit (Petrol)',
    symbol: '⛽',
    flag: '🇳🇬',
    officialBuy: 998,
    officialSell: 1030,
    change24h: 0,
    unit: '₦/Litre',
    trend: 'stable',
    searchVolumeRank: 6,
    notes: 'Average retail pump (Lagos/Abuja)',
  },
  {
    id: 'gold',
    pair: 'GOLD (24K) / GRAM',
    name: 'Fine Gold (24K)',
    symbol: '🪙',
    flag: '✨',
    officialBuy: 128500,
    officialSell: 131200,
    change24h: 0.5,
    unit: '₦/Gram',
    trend: 'up',
    searchVolumeRank: 7,
    notes: 'Physical bullion benchmark',
  },
];

function median(nums: number[]): number | undefined {
  const clean = nums.filter((n) => typeof n === 'number' && isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function fetchJson(url: string, timeoutMs = 4000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': '9jaBeacon-Rates/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Live multi-source FX verification. Client strip polls /api/market-rates every 45s.
 */
export async function getVerifiedMarketRates(): Promise<MarketRatesResponse> {
  let liveRates = DEFAULT_MARKET_RATES.map((r) => ({ ...r }));
  const sourceTags: string[] = [];

  const ngnSamples: number[] = [];
  let gbpPerUsd: number | undefined;
  let eurPerUsd: number | undefined;
  let cadPerUsd: number | undefined;
  let usdtNgn: number | undefined;

  // Parallel fetches for speed
  const [erApi, exchangerateApi, fawazUsd, fawazUsdt] = await Promise.all([
    fetchJson('https://open.er-api.com/v6/latest/USD'),
    fetchJson('https://api.exchangerate-api.com/v4/latest/USD'),
    fetchJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'),
    fetchJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usdt.json'),
  ]);

  if (erApi?.rates?.NGN && erApi.rates.NGN > 500) {
    ngnSamples.push(Number(erApi.rates.NGN));
    sourceTags.push('open.er-api');
    if (erApi.rates.GBP) gbpPerUsd = Number(erApi.rates.GBP);
    if (erApi.rates.EUR) eurPerUsd = Number(erApi.rates.EUR);
    if (erApi.rates.CAD) cadPerUsd = Number(erApi.rates.CAD);
  }

  if (exchangerateApi?.rates?.NGN && exchangerateApi.rates.NGN > 500) {
    ngnSamples.push(Number(exchangerateApi.rates.NGN));
    sourceTags.push('exchangerate-api');
    if (!gbpPerUsd && exchangerateApi.rates.GBP) gbpPerUsd = Number(exchangerateApi.rates.GBP);
    if (!eurPerUsd && exchangerateApi.rates.EUR) eurPerUsd = Number(exchangerateApi.rates.EUR);
    if (!cadPerUsd && exchangerateApi.rates.CAD) cadPerUsd = Number(exchangerateApi.rates.CAD);
  }

  const fawazNgn = fawazUsd?.usd?.ngn;
  if (typeof fawazNgn === 'number' && fawazNgn > 500) {
    ngnSamples.push(fawazNgn);
    sourceTags.push('fawazahmed0');
    if (!gbpPerUsd && fawazUsd.usd.gbp) gbpPerUsd = Number(fawazUsd.usd.gbp);
    if (!eurPerUsd && fawazUsd.usd.eur) eurPerUsd = Number(fawazUsd.usd.eur);
    if (!cadPerUsd && fawazUsd.usd.cad) cadPerUsd = Number(fawazUsd.usd.cad);
  }

  const fUsdtNgn = fawazUsdt?.usdt?.ngn;
  if (typeof fUsdtNgn === 'number' && fUsdtNgn > 500) {
    usdtNgn = fUsdtNgn;
    if (!sourceTags.includes('fawazahmed0')) sourceTags.push('fawazahmed0');
  }

  const ngnRate = median(ngnSamples);

  // Street/BDC parallel typically trades at a premium over interbank wire
  const PARALLEL_BUY_PREMIUM = 75;
  const PARALLEL_SELL_PREMIUM = 95;

  if (typeof ngnRate === 'number' && ngnRate > 500) {
    const roundedNgn = round1(ngnRate);

    liveRates = liveRates.map((item) => {
      if (item.id === 'usd') {
        return {
          ...item,
          officialBuy: Math.round(roundedNgn - 4),
          officialSell: Math.round(roundedNgn + 2),
          parallelBuy: Math.round(roundedNgn + PARALLEL_BUY_PREMIUM),
          parallelSell: Math.round(roundedNgn + PARALLEL_SELL_PREMIUM),
        };
      }
      if (item.id === 'gbp' && gbpPerUsd && gbpPerUsd > 0) {
        const calculated = round1(ngnRate / gbpPerUsd);
        return {
          ...item,
          officialBuy: Math.round(calculated - 8),
          officialSell: Math.round(calculated + 5),
          parallelBuy: Math.round(calculated + PARALLEL_BUY_PREMIUM),
          parallelSell: Math.round(calculated + PARALLEL_SELL_PREMIUM + 10),
        };
      }
      if (item.id === 'eur' && eurPerUsd && eurPerUsd > 0) {
        const calculated = round1(ngnRate / eurPerUsd);
        return {
          ...item,
          officialBuy: Math.round(calculated - 6),
          officialSell: Math.round(calculated + 4),
          parallelBuy: Math.round(calculated + PARALLEL_BUY_PREMIUM - 5),
          parallelSell: Math.round(calculated + PARALLEL_SELL_PREMIUM),
        };
      }
      if (item.id === 'cad' && cadPerUsd && cadPerUsd > 0) {
        const calculated = round1(ngnRate / cadPerUsd);
        return {
          ...item,
          officialBuy: Math.round(calculated - 5),
          officialSell: Math.round(calculated + 4),
          parallelBuy: Math.round(calculated + PARALLEL_BUY_PREMIUM - 10),
          parallelSell: Math.round(calculated + PARALLEL_SELL_PREMIUM - 5),
        };
      }
      if (item.id === 'usdt') {
        const base = typeof usdtNgn === 'number' ? usdtNgn : roundedNgn + PARALLEL_BUY_PREMIUM;
        return {
          ...item,
          officialBuy: Math.round(base - 5),
          officialSell: Math.round(base + 5),
          parallelBuy: Math.round(base),
          parallelSell: Math.round(base + 12),
        };
      }
      return item;
    });
  } else if (typeof usdtNgn === 'number') {
    // Partial: only USDT live
    liveRates = liveRates.map((item) =>
      item.id === 'usdt'
        ? {
            ...item,
            officialBuy: Math.round(usdtNgn - 5),
            officialSell: Math.round(usdtNgn + 5),
            parallelBuy: Math.round(usdtNgn),
            parallelSell: Math.round(usdtNgn + 12),
          }
        : item
    );
  }

  const now = new Date();
  const timeFormatted =
    now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }) + ' WAT';

  const liveSource =
    sourceTags.length > 0
      ? `Live multi-source FX (${sourceTags.join(' + ')}) · parallel = interbank + BDC premium`
      : 'Cached benchmark (live FX feeds unreachable)';

  return {
    timestamp: now.toISOString(),
    timestampFormatted: `${now.toISOString().split('T')[0]} at ${timeFormatted}`,
    source: liveSource,
    updateFrequency: 'Client refresh every 45s · server multi-source median',
    rates: liveRates,
  };
}
