# Supavisor Bot 🤖

A TypeScript Telegram bot that monitors [Polymarket](https://polymarket.com) prediction markets and pushes trading signals to your Telegram chat.

## Signals

| Signal                     | Trigger                            | What it means                                        |
| -------------------------- | ---------------------------------- | ---------------------------------------------------- |
| 📊 **Wide Spread**         | `(ask - bid) / ask > 5%`           | Thin liquidity — place limit orders at better prices |
| 📈 **Price Drift**         | Price moved `> 8%` since last scan | Fast momentum shift — worth investigating            |
| ⚡ **Complement Mismatch** | `YES + NO ≠ $1.00 ± 3¢`            | Pure binary pricing inefficiency                     |

All thresholds are configurable via `.env`.

---

## Quick Start

### 1. Prerequisites

- Node.js `>= 18`
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Your Telegram Chat ID (message [@userinfobot](https://t.me/userinfobot) to find yours)

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

Everything else has sensible defaults.

### 4. Run (development)

```bash
npm run dev
```

### 5. Run (production)

```bash
npm run build
npm start
```

---

## Commands

| Command   | Description                               |
| --------- | ----------------------------------------- |
| `/start`  | Introduction and signal descriptions      |
| `/scan`   | Trigger an immediate market scan          |
| `/status` | Bot status, last poll time, signal counts |
| `/help`   | List all commands                         |

---

## Configuration Reference

| Variable                | Default      | Description                          |
| ----------------------- | ------------ | ------------------------------------ |
| `TELEGRAM_BOT_TOKEN`    | **required** | From @BotFather                      |
| `TELEGRAM_CHAT_ID`      | **required** | Your personal or group chat ID       |
| `POLL_INTERVAL_MINUTES` | `5`          | How often to auto-scan               |
| `MIN_VOLUME_USD`        | `25000`      | Ignore markets below this 24h volume |
| `MARKETS_LIMIT`         | `50`         | Max markets to scan per cycle        |
| `SPREAD_THRESHOLD`      | `0.05`       | Wide spread threshold (5%)           |
| `DRIFT_THRESHOLD`       | `0.08`       | Price drift threshold (8%)           |
| `COMPLEMENT_THRESHOLD`  | `0.03`       | Complement mismatch threshold (3¢)   |

---

## Architecture

```
src/
├── index.ts              # Entry point — boots bot + cron scheduler
├── config.ts             # Env var loader with validation
├── types.ts              # Shared TypeScript types
├── polymarket/
│   ├── gamma.ts          # Gamma API client (market metadata)
│   └── clob.ts           # CLOB API client (order book / prices)
├── signals/
│   ├── detector.ts       # Signal engine (3 detectors + price cache)
│   └── formatter.ts      # Telegram message formatter
└── bot/
    └── commands.ts       # Bot command handlers + scan runner
```

**APIs used (both read-only, no auth required):**

- `https://gamma-api.polymarket.com` — market metadata, prices, volumes
- `https://clob.polymarket.com` — live order books for spread detection

---

## Finding Your Chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your numeric user ID — use that as `TELEGRAM_CHAT_ID`

For a **group/channel**, add the bot as admin, send a message, then check:

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

The chat ID for groups will be a negative number (e.g. `-1001234567890`).
