import axios from 'axios';
import type { OrderBook } from '../types';

const CLOB_BASE = 'https://clob.polymarket.com';

const client = axios.create({
  baseURL: CLOB_BASE,
  timeout: 10_000,
  headers: { 'Accept': 'application/json' },
});

/**
 * Fetch the live order book for a CLOB token ID (outcome).
 * Returns null on any network/API error so callers can skip gracefully.
 */
export async function fetchOrderBook(tokenId: string): Promise<OrderBook | null> {
  try {
    const response = await client.get<OrderBook>('/book', {
      params: { token_id: tokenId },
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Compute the mid-price from an order book.
 * Returns null if the book has no bids or asks.
 */
export function computeMidPrice(book: OrderBook): number | null {
  const topBid = book.bids[0];
  const topAsk = book.asks[0];

  if (!topBid || !topAsk) return null;

  const bid = parseFloat(topBid.price);
  const ask = parseFloat(topAsk.price);

  if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) return null;

  return (bid + ask) / 2;
}

/**
 * Compute bid/ask spread percentage: (ask - bid) / ask
 * Returns null if the book is empty or prices are invalid.
 */
export function computeSpreadPct(book: OrderBook): number | null {
  const topBid = book.bids[0];
  const topAsk = book.asks[0];

  if (!topBid || !topAsk) return null;

  const bid = parseFloat(topBid.price);
  const ask = parseFloat(topAsk.price);

  if (isNaN(bid) || isNaN(ask) || ask <= 0 || bid >= ask) return null;

  return (ask - bid) / ask;
}

/**
 * Fetch a simple mid-price for a token ID.
 * Convenience wrapper over fetchOrderBook + computeMidPrice.
 */
export async function fetchMidPrice(tokenId: string): Promise<number | null> {
  const book = await fetchOrderBook(tokenId);
  if (!book) return null;
  return computeMidPrice(book);
}
