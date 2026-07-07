import { broadcastAlert } from '../websocket/feedHandler.js';
import { getTrendingTokens } from './birdeye.js';
import { getTerminalChatId, sendAlert } from './telegram.js';

let intervalId = null;
const recentTokenAlerts = new Map();

export function startWhaleSimulator(intervalMs = getWhaleSimulatorIntervalMs()) {
  if (intervalId) return intervalId; // already running

  const intervalSeconds = Math.round(intervalMs / 1000);
  const chatId = getTerminalChatId();
  console.log(`TELEGRAM_CHAT_ID present: ${Boolean(process.env.TELEGRAM_CHAT_ID)}`);
  console.log(`QUICKNODE_RPC_URL present: ${Boolean(process.env.QUICKNODE_RPC_URL)}`);
  console.log(`BIRDEYE_API_KEY present: ${Boolean(process.env.BIRDEYE_API_KEY)}`);
  console.log('Starting whale simulator...');

  if (!chatId) {
    console.log('Whale terminal disabled: TELEGRAM_CHAT_ID missing');
  }

  intervalId = setInterval(async () => {
    try {
      // Get real trending tokens from DexScreener
      const result = await getTrendingTokens(10);
      if (!result.success || !result.data.length) return;

      // Pick a random token
      const token = pickAlertableToken(result.data);
      if (!token) return;

      // Generate a random whale move
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const value = Math.floor(Math.random() * 100000 + 1000);
      const profit = (Math.random() * 30 - 10).toFixed(2);

      const alert = {
        token: token.symbol,
        symbol: token.symbol,
        name: token.name,
        address: token.address,          // ★ mint address
        type: side,
        wallet: '0x' + Math.random().toString(16).slice(2, 10) + '...',
        value_usd: value,
        tx_hash: '0x' + Math.random().toString(16).slice(2, 34),
        created_at: new Date().toISOString(),
        profit_percent: parseFloat(profit),
      };

      broadcastAlert(alert);
      const sent = await sendAlert(alert);
      if (sent) {
        console.log(`🐋 Terminal alert sent to ${getTerminalChatId()}`);
      }
      
    } catch (err) {
      console.error('Whale simulator error:', err.stack || err.message || err);
    }
  }, intervalMs);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  console.log(`🐋 Whale simulator started every ${intervalSeconds}s`);
  return intervalId;
}

export function stopWhaleSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function isWhaleSimulatorEnabled() {
  return Boolean(intervalId);
}

function getWhaleSimulatorIntervalMs() {
  const configuredSeconds = Number.parseInt(process.env.WHALE_SIMULATOR_INTERVAL_SECONDS || '60', 10);
  const intervalSeconds = Number.isFinite(configuredSeconds) && configuredSeconds > 0
    ? configuredSeconds
    : 60;
  return intervalSeconds * 1000;
}

function getDedupeWindowMs() {
  const configuredMinutes = Number.parseInt(process.env.WHALE_ALERT_DEDUPE_MINUTES || '10', 10);
  const dedupeMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : 10;
  return dedupeMinutes * 60 * 1000;
}

function pickAlertableToken(tokens) {
  const dedupeWindowMs = getDedupeWindowMs();
  const now = Date.now();

  for (const [address, sentAt] of recentTokenAlerts.entries()) {
    if (now - sentAt > dedupeWindowMs) {
      recentTokenAlerts.delete(address);
    }
  }

  const candidates = tokens.filter((token) => {
    const key = getTokenDedupeKey(token);
    return key && !recentTokenAlerts.has(key);
  });

  if (candidates.length === 0) {
    return null;
  }

  const token = candidates[Math.floor(Math.random() * candidates.length)];
  recentTokenAlerts.set(getTokenDedupeKey(token), now);
  return token;
}

function getTokenDedupeKey(token) {
  return token?.address || token?.symbol || null;
}
