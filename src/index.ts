import "dotenv/config";
import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config";
import { registerCommands, runScan } from "./bot/commands";
import http from 'http';


// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200);
  res.end('OK');
}).listen(PORT, () => {
  console.log(`Health check listening on port ${PORT}`);
});
  
  console.log("🤖 Supavisor Bot starting up...");
  console.log(`📊 Poll interval: every ${config.polling.intervalMinutes} minute(s)`);
  console.log(`💵 Min volume filter: $${config.markets.minVolumeUsd.toLocaleString()}`);
  console.log(`📦 Markets per scan: ${config.markets.limit}`);
  console.log("");

  // Telegram Bot
  const bot = new Bot(config.telegram.botToken);

  // Register all slash commands
  registerCommands(bot);

  // Global error handler
  bot.catch((err) => {
    console.error("[Bot Error]", err.message);
  });

  // Start the bot (long-polling)
  bot.start({
    onStart: (info) => {
      console.log(`✅ Bot connected as @${info.username}`);
    },
  });

  // Cron Poller
  const cronExpression = `*/${config.polling.intervalMinutes} * * * *`;

  console.log(`⏱ Cron scheduled: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled market scan...`);

    try {
      const message = await runScan();

      // Push results to the configured chat
      await bot.api.sendMessage(config.telegram.chatId, message, {
        parse_mode: "Markdown",
        // Suppress link previews for cleaner messages
        link_preview_options: { is_disabled: true },
      });

      console.log(`[${new Date().toISOString()}] Scan complete — message sent`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${new Date().toISOString()}] Scan error: ${msg}`);

      // Notify chat of failure (best-effort)
      try {
        await bot.api.sendMessage(
          config.telegram.chatId,
          `❌ *Supavisor Bot Scan Error*\n\`${msg}\``,
          { parse_mode: "Markdown" }
        );
      } catch {
        // Ignore secondary failure
      }
    }
  });

  // Startup Scan
  // Run one scan immediately on startup so you don't wait for the first cron tick
  console.log("🚀 Running initial scan on startup...");
  setTimeout(async () => {
    try {
      const message = await runScan();
      await bot.api.sendMessage(config.telegram.chatId, message, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
      console.log("✅ Initial scan complete");
    } catch (err) {
      console.error("Initial scan error:", err instanceof Error ? err.message : err);
    }
  }, 3_000); // Small delay to let the bot finish connecting
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
