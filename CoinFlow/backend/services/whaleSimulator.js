import { broadcastAlert } from '../websocket/feedHandler.js';
import { getTrendingTokens } from './birdeye.js';

let intervalId = null;

export function startWhaleSimulator(intervalMs = 12000) {
  if (intervalId) return; // already running

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
        address: token.address,          // ★ mint address
        type: side,
        wallet: '0x' + Math.random().toString(16).slice(2, 10) + '...',
        value_usd: value,
        tx_hash: '0x' + Math.random().toString(16).slice(2, 34),
        created_at: new Date().toISOString(),
        profit_percent: parseFloat(profit),
      };

      broadcastAlert(alert);
    } catch (err) {
      console.error('Whale simulator error:', err.message);
    }
  }, intervalMs);

  console.log(`🐋 Whale simulator started (every ${intervalMs / 1000}s)`);
}

export function stopWhaleSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}