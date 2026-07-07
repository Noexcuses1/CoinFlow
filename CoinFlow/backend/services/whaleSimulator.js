import { broadcastAlert } from '../websocket/feedHandler.js';
import { getTrendingTokens } from './birdeye.js';
import { getTerminalChatId, sendAlert } from './telegram.js';

let intervalId = null;

export function startWhaleSimulator(intervalMs = 12000) {
  if (intervalId) return intervalId; // already running

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
      const token = result.data[Math.floor(Math.random() * result.data.length)];

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

  console.log('🐋 Whale simulator started');
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
