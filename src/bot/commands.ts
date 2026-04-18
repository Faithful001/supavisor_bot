import type { Bot } from "grammy";
import { fetchActiveMarkets } from "../polymarket/gamma";
import { scanMarkets, getCacheSize } from "../signals/detector";
import { formatSignalBatch, formatStatus } from "../signals/formatter";
import { config } from "../config";
import { User } from "../modules/user/user.schema";
import { userService } from "../modules/user/user.service";

// Shared State

export interface BotState {
  lastPollAt: Date | null;
  lastSignalCount: number;
  totalScans: number;
}

const state: BotState = {
  lastPollAt: null,
  lastSignalCount: 0,
  totalScans: 0,
};

// Command Registration

export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx) => {
    await userService.saveUser(ctx.chat?.id.toString() || "");
    await ctx.reply(
      [
        `🤖 *Supavisor Bot* - Polymarket Signal Monitor`,
        ``,
        `I scan active Polymarket prediction markets every *5 minutes* by default and alert you to:`,
        ``,
        `📊 *Wide Spread* - Thin liquidity / limit order opportunity`,
        `📈 *Price Drift* - Fast-moving market sentiment`,
        `⚡ *Complement Mismatch* - YES + NO pricing inefficiency`,
        ``,
        `*Commands:*`,
        `/scan - Run an immediate market scan`,
        `/status - Show bot status and last run info`,
        `/pause - Pause notifications`,
        `/unpause - Resume notifications`,
        `/setinterval <minutes> - Set poll interval`,
        `/help - Show this message`,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  bot.command("pause", async (ctx) => {
    await userService.pauseUser(ctx.chat?.id.toString() || "");
    await ctx.reply("Notifications paused");
  });

  bot.command("unpause", async (ctx) => {
    await userService.unpauseUser(ctx.chat?.id.toString() || "");
    await ctx.reply("Notifications resumed");
  });

  bot.command("setinterval", async (ctx) => {
    const args = ctx.message?.text?.split(" ");
    if (args?.length !== 2) {
      await ctx.reply("Usage: /setinterval <minutes>");
      return;
    }
    const interval = parseInt(args[1]);
    const isNumber = args[1].match(/^[0-9]+$/);
    if (isNaN(interval) || !isNumber || interval < 1) {
      await ctx.reply("Invalid interval. Must be a positive number.");
      return;
    }
    await userService.setPollInterval(ctx.chat?.id.toString() || "", interval);
    await ctx.reply(`Poll interval set to ${interval} minutes`);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        `*Supavisor Bot Commands*`,
        ``,
        `/start - Introduction and signal descriptions`,
        `/scan - Trigger an immediate market scan`,
        `/status - Bot status, last poll time, signal counts`,
        `/pause - Pause notifications`,
        `/unpause - Resume notifications`,
        `/setinterval <minutes> - Set poll interval`,
        `/help - This help message`,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  bot.command("status", async (ctx) => {
    const user = await userService.getUser(ctx.chat?.id.toString() || "");
    const message = formatStatus({
      lastPollAt: state.lastPollAt,
      lastSignalCount: state.lastSignalCount,
      totalScans: state.totalScans,
      cacheSize: getCacheSize(),
      pollIntervalMinutes: user?.pollInterval || 5,
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
  });

  bot.command("scan", async (ctx) => {
    const loadingMsg = await ctx.reply("🔍 Scanning Polymarket... please wait");

    try {
      const result = await runScan();

      try {
        await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch {}

      // Split into chunks if over Telegram's 4096-char limit
      const chunks = splitMessage(result);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Scan failed: ${message}`);
    }
  });

  // Fallback for unknown commands
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      const command = ctx.message.text.split(" ")[0];
      await ctx.reply(
        `*Unknown command:* \`${command}\`\n\n` +
          `I didn't recognize that. Type /help to see what I can do.`,
        { parse_mode: "Markdown" }
      );
    }
  });
}

// Scan Runner

/**
 * Fetch markets, run detectors, format results, update state.
 * Returns the formatted message string.
 */
export async function runScan(): Promise<string> {
  const markets = await fetchActiveMarkets({
    limit: config.markets.limit,
    minVolumeUsd: config.markets.minVolumeUsd,
  });

  const signals = await scanMarkets(markets);

  state.lastPollAt = new Date();
  state.lastSignalCount = signals.length;
  state.totalScans += 1;

  return formatSignalBatch(signals, markets.length);
}

// Utilities

/**
 * Split a long message into Telegram-safe chunks (≤4096 chars each).
 * Splits on double-newline boundaries where possible.
 */
function splitMessage(text: string, maxLen = 4_000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cutAt = remaining.lastIndexOf("\n\n", maxLen);
    if (cutAt === -1) cutAt = maxLen;

    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);

  return chunks;
}
