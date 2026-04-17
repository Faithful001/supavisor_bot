// Gamma API Types

export interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  volume: string;
  liquidity: string;
  openInterest: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  /** Optional array of events this market belongs to */
  events?: Array<{ slug: string; [key: string]: any }>;
  /** Comma-separated list of CLOB token IDs for each outcome */
  clobTokenIds?: string;
  /** Stringified JSON array of outcome names */
  outcomes?: string;
  /** Stringified JSON array of prices per outcome, in same order as outcomes */
  outcomePrices?: string;
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
  negativeRisk?: boolean;
}

// CLOB API Types

export interface PriceLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  hash: string;
  timestamp: string;
}

// Signal Types

export type SignalType = "WIDE_SPREAD" | "PRICE_DRIFT" | "COMPLEMENT_MISMATCH";

export interface MarketSignal {
  type: SignalType;
  marketId: string;
  question: string;
  slug: string;
  /** Slug of the parent event (needed for generating correct URLs) */
  eventSlug?: string;
  /** Human-readable detail about the signal */
  detail: string;
  /** Numeric value that triggered the signal (for display) */
  value: number;
  /** Threshold that was exceeded */
  threshold: number;
  detectedAt: Date;
}

// Price Cache

export interface CachedPrice {
  price: number;
  cachedAt: Date;
}
