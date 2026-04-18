import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnvFloat(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (!val) return defaultVal;
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid float for env var ${key}: "${val}"`);
  return parsed;
}

function optionalEnvInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (!val) return defaultVal;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for env var ${key}: "${val}"`);
  return parsed;
}

export const config = {
  mongodb: {
    uri: requireEnv("MONGODB_URI"),
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
  },
  // polling: {
  //   intervalMinutes: optionalEnvInt("POLL_INTERVAL_MINUTES", 5),
  // },
  markets: {
    minVolumeUsd: optionalEnvFloat("MIN_VOLUME_USD", 25000),
    limit: optionalEnvInt("MARKETS_LIMIT", 50),
  },
  thresholds: {
    spread: optionalEnvFloat("SPREAD_THRESHOLD", 0.05),
    drift: optionalEnvFloat("DRIFT_THRESHOLD", 0.08),
    complement: optionalEnvFloat("COMPLEMENT_THRESHOLD", 0.03),
  },
} as const;

export type Config = typeof config;
