import "dotenv/config";
import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config";
import { registerCommands, runScan } from "./bot/commands";
import http from "http";
import mongoose from "mongoose";
import { userService } from "./modules/user/user.service";

async function main() {
  const PORT = process.env.PORT || 3000;

  const app = http
    .createServer((_, res) => {
      res.writeHead(200);
      res.end("OK");
    })
    .listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  mongoose
    .connect(config.mongodb.uri)
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((error: any) => {
      console.log(error);
    });

  console.log("Supavisor Bot starting up...");
  console.log(`Min volume filter: $${config.markets.minVolumeUsd.toLocaleString()}`);
  console.log(`Markets per scan: ${config.markets.limit}`);
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
      console.log(`Bot connected as @${info.username}`);
    },
  });

  // Cron Poller

  // 1. Run the master cron every minute
  const cronExpression = "* * * * *";
  console.log(`Master Cron scheduled: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    const nowMinute = new Date().getMinutes();

    // 2. Fetch ALL active users from MongoDB
    const users = await userService.getActiveUsers();

    if (users.length === 0) return;

    console.log(`[${new Date().toISOString()}] Master tick. Active users: ${users.length}`);

    try {
      // 3. Scan the markets ONCE to save memory/API limits
      const message = await runScan();

      // 4. Loop through everyone
      for (const user of users) {
        // 5. Only send if it matches their specific interval
        if (nowMinute % user.pollInterval === 0) {
          try {
            await bot.api.sendMessage(user.chatId, message, {
              parse_mode: "Markdown",
              // Suppress link previews for cleaner messages
              link_preview_options: { is_disabled: true },
            });
          } catch (err) {
            console.error(`Failed to send to user ${user.chatId}`, err);
          }
        }
      }
      console.log(`[${new Date().toISOString()}] Scans dispatched to due users`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${new Date().toISOString()}] Scan error: ${msg}`);
    }
  });

  // Startup Scan
  // Run one scan immediately on startup so you don't wait for the first cron tick
  console.log("Running initial scan on startup...");
  setTimeout(async () => {
    try {
      const message = await runScan();
      const users = await userService.getActiveUsers();
      for (const user of users) {
        try {
          await bot.api.sendMessage(user.chatId, message, {
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: true },
          });
        } catch (err) {}
      }
      console.log("Initial scan complete");
    } catch (err) {
      console.error("Initial scan error:", err instanceof Error ? err.message : err);
    }
  }, 3_000); // Small delay to let the bot finish connecting
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
