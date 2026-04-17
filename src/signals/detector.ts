import type { GammaMarket, MarketSignal, CachedPrice } from "../types";
import { fetchOrderBook, computeSpreadPct, computeMidPrice } from "../polymarket/clob";
import { config } from "../config";

// In-memory price cache: tokenId → last known mid-price
const priceCache = new Map<string, CachedPrice>();

// Helpers

/**
 * Parse Gamma's outcomePrices field (JSON string array like '["0.72","0.28"]')
 * Returns empty array on parse failure.
 */
function parseOutcomePrices(raw?: string): number[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((v) => parseFloat(String(v))).filter((v) => !isNaN(v));
  } catch {
    return [];
  }
}

/**
 * Parse Gamma's clobTokenIds field (JSON string array or comma-separated).
 * Returns the first token ID (YES side) for binary markets.
 */
function parseClobTokenIds(raw?: string): string[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // fall through — try comma-separated
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Signal Detectors

/**
 * SIGNAL 1: Wide Spread
 * Flags markets where the bid/ask spread is unusually wide.
 * Large spreads = thin liquidity = potential limit order opportunity.
 */
async function detectWideSpread(market: GammaMarket): Promise<MarketSignal | null> {
  const tokenIds = parseClobTokenIds(market.clobTokenIds);
  if (tokenIds.length === 0) return null;

  // Check YES side token
  const tokenId = tokenIds[0];
  const book = await fetchOrderBook(tokenId);
  if (!book) return null;

  const spreadPct = computeSpreadPct(book);
  if (spreadPct === null) return null;

  if (spreadPct > config.thresholds.spread) {
    const topBid = parseFloat(book.bids[0]?.price ?? "0");
    const topAsk = parseFloat(book.asks[0]?.price ?? "0");

    return {
      type: "WIDE_SPREAD",
      marketId: market.id,
      question: market.question,
      slug: market.slug,
      eventSlug: market.events?.[0]?.slug,
      detail: `Bid $${topBid.toFixed(3)} / Ask $${topAsk.toFixed(3)} - spread ${(spreadPct * 100).toFixed(1)}%`,
      value: spreadPct,
      threshold: config.thresholds.spread,
      detectedAt: new Date(),
    };
  }

  return null;
}

/**
 * SIGNAL 2: Price Drift
 * Flags markets where the mid-price moved more than the threshold
 * since the last poll cycle. Indicates fast-moving market sentiment.
 */
async function detectPriceDrift(market: GammaMarket): Promise<MarketSignal | null> {
  const tokenIds = parseClobTokenIds(market.clobTokenIds);
  if (tokenIds.length === 0) return null;

  const tokenId = tokenIds[0];
  const book = await fetchOrderBook(tokenId);
  if (!book) return null;

  const currentMid = computeMidPrice(book);
  if (currentMid === null) return null;

  const cached = priceCache.get(tokenId);

  // Always update cache
  priceCache.set(tokenId, { price: currentMid, cachedAt: new Date() });

  // Need a prior price to compute drift
  if (!cached) return null;

  const delta = Math.abs(currentMid - cached.price) / cached.price;

  if (delta > config.thresholds.drift) {
    const direction = currentMid > cached.price ? "📈 UP" : "📉 DOWN";
    const minutesAgo = Math.round((Date.now() - cached.cachedAt.getTime()) / 60_000);

    return {
      type: "PRICE_DRIFT",
      marketId: market.id,
      question: market.question,
      slug: market.slug,
      eventSlug: market.events?.[0]?.slug,
      detail: `${direction} ${(delta * 100).toFixed(1)}% in ~${minutesAgo}min — $${cached.price.toFixed(3)} → $${currentMid.toFixed(3)}`,
      value: delta,
      threshold: config.thresholds.drift,
      detectedAt: new Date(),
    };
  }

  return null;
}

/**
 * SIGNAL 3: Complement Mismatch
 * On binary YES/NO markets, YES price + NO price should equal ~$1.00.
 * Significant deviation implies pricing inefficiency between the two sides.
 */
function detectComplementMismatch(market: GammaMarket): MarketSignal | null {
  const prices = parseOutcomePrices(market.outcomePrices);

  // Need exactly 2 outcomes (YES + NO)
  if (prices.length !== 2) return null;

  const [yesPrice, noPrice] = prices;
  const sum = yesPrice + noPrice;
  const deviation = Math.abs(sum - 1.0);

  if (deviation > config.thresholds.complement) {
    return {
      type: "COMPLEMENT_MISMATCH",
      marketId: market.id,
      question: market.question,
      slug: market.slug,
      eventSlug: market.events?.[0]?.slug,
      detail: `YES $${yesPrice.toFixed(3)} + NO $${noPrice.toFixed(3)} = $${sum.toFixed(3)} (off by ${(deviation * 100).toFixed(1)}¢)`,
      value: deviation,
      threshold: config.thresholds.complement,
      detectedAt: new Date(),
    };
  }

  return null;
}

// Main Scanner

// // In-memory cache to ensure only new signals are returned
// const reportedSignalsCache = new Set<string>();

/**
 * Run all signal detectors across a list of markets.
 * Returns all triggered signals.
 */
export async function scanMarkets(markets: GammaMarket[]): Promise<MarketSignal[]> {
  const signals: MarketSignal[] = [];

  for (const market of markets) {
    // Run complement check (sync, no API call needed)
    const complementSignal = detectComplementMismatch(market);
    if (complementSignal) signals.push(complementSignal);

    // Run async detectors with a small sequential pause to avoid hammering CLOB
    const [spreadSignal, driftSignal] = await Promise.all([
      detectWideSpread(market),
      detectPriceDrift(market),
    ]);

    if (spreadSignal) signals.push(spreadSignal);
    if (driftSignal) signals.push(driftSignal);
  }

  // // Filter out previously seen signals
  // const newSignals: MarketSignal[] = [];
  // for (const sig of currentBatch) {
  //   const hash =
  //     sig.type === "PRICE_DRIFT"
  //       ? `${sig.type}:${sig.marketId}:${sig.detail}`
  //       : `${sig.type}:${sig.marketId}`;
  //
  //   if (!reportedSignalsCache.has(hash)) {
  //     reportedSignalsCache.add(hash);
  //     newSignals.push(sig);
  //   }
  // }
  //
  // return newSignals;

  return signals;
}

/** Expose current cache size for status reporting */
export function getCacheSize(): number {
  return priceCache.size;
}

/** Clear the price cache (useful for testing) */
export function clearCache(): void {
  priceCache.clear();
}
