import axios from 'axios';
import type { GammaMarket } from '../types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

const client = axios.create({
  baseURL: GAMMA_BASE,
  timeout: 10_000,
  headers: { 'Accept': 'application/json' },
});

export interface FetchMarketsOptions {
  limit?: number;
  minVolumeUsd?: number;
  activeOnly?: boolean;
}

/**
 * Fetch active, open markets from the Polymarket Gamma API.
 * Returns markets sorted by 24h volume descending.
 */
export async function fetchActiveMarkets(options: FetchMarketsOptions = {}): Promise<GammaMarket[]> {
  const {
    limit = 50,
    minVolumeUsd = 0,
    activeOnly = true,
  } = options;

  const params: Record<string, string | number | boolean> = {
    limit,
    active: activeOnly,
    closed: false,
    archived: false,
    order: 'volume',
    ascending: false,
  };

  const response = await client.get<GammaMarket[]>('/markets', { params });
  let markets = response.data;

  // Filter by minimum volume
  if (minVolumeUsd > 0) {
    markets = markets.filter((m) => {
      const vol = parseFloat(m.volume ?? '0');
      return vol >= minVolumeUsd;
    });
  }

  return markets;
}

/**
 * Fetch a single market by its Polymarket slug.
 */
export async function fetchMarketBySlug(slug: string): Promise<GammaMarket | null> {
  try {
    const response = await client.get<GammaMarket[]>('/markets', {
      params: { slug },
    });
    return response.data[0] ?? null;
  } catch {
    return null;
  }
}
