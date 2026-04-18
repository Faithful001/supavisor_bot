import type { MarketSignal, SignalType } from "../types";

// ── Emoji & Label Maps ────────────────────────────────────────────────────────

const SIGNAL_EMOJI: Record<SignalType, string> = {
  WIDE_SPREAD: "📊",
  PRICE_DRIFT: "📈",
  COMPLEMENT_MISMATCH: "⚡",
};

const SIGNAL_LABEL: Record<SignalType, string> = {
  WIDE_SPREAD: "Wide Spread",
  PRICE_DRIFT: "Price Drift",
  COMPLEMENT_MISMATCH: "Complement Mismatch",
};

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Format a single signal into a Telegram Markdown v1 block.
 */
export function formatSignal(signal: MarketSignal): string {
  const emoji = SIGNAL_EMOJI[signal.type];
  const label = SIGNAL_LABEL[signal.type];
  const urlSlug = signal.eventSlug || signal.slug;
  const url = `https://polymarket.com/event/${urlSlug}`;
  const time = signal.detectedAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return [
    `${emoji} *${label}*`,
    `📌 ${escapeMarkdown(signal.question)}`,
    `📋 ${escapeMarkdown(signal.detail)}`,
    `🔗 [View on Polymarket](${url})`,
    `🕐 ${time} UTC`,
  ].join("\n");
}

/**
 * Format a batch of signals into a full Telegram message.
 * Handles the empty-signals case gracefully.
 */
export function formatSignalBatch(signals: MarketSignal[], scannedCount: number): string {
  const timestamp = new Date().toUTCString();

  if (signals.length === 0) {
    return [
      `🤖 *Supavisor Bot Scan Complete*`,
      ``,
      `✅ No new signals detected across ${scannedCount} markets`,
      `🕐 ${timestamp}`,
    ].join("\n");
  }

  const header = [
    `🤖 *Supavisor Bot - ${signals.length} Signal${signals.length === 1 ? "" : "s"} Detected*`,
    `📦 Scanned: ${scannedCount} markets | ${timestamp}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");

  const body = signals.map(formatSignal).join("\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n");

  return `${header}\n\n${body}`;
}

/**
 * Format a brief status report.
 */
export function formatStatus(opts: {
  lastPollAt: Date | null;
  lastSignalCount: number;
  totalScans: number;
  cacheSize: number;
  pollIntervalMinutes: number;
}): string {
  const { lastPollAt, lastSignalCount, totalScans, cacheSize, pollIntervalMinutes } = opts;

  const lastPoll = lastPollAt
    ? lastPollAt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : "Not yet run";

  return [
    `🤖 *Supavisor Bot Status*`,
    ``,
    `⏱ Poll interval: every ${pollIntervalMinutes} min`,
    `🕐 Last scan: ${lastPoll}`,
    `🔔 Last signal count: ${lastSignalCount}`,
    `🔄 Total scans: ${totalScans}`,
    `💾 Price cache entries: ${cacheSize}`,
  ].join("\n");
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Escape special Markdown characters for Telegram's MarkdownV1 parse mode.
 */
function escapeMarkdown(text: string): string {
  // In Markdown v1, only *, _, [, ` need escaping
  return text.replace(/([*_`[])/g, "\\$1");
}
