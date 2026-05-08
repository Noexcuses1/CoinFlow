import cache from '../services/cache.js';

const clients = new Set();

export function handleConnection(ws) {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));

  // Send latest cached alerts immediately
  const recent = cache.get('recent_alerts') || [];
  ws.send(JSON.stringify({ type: 'init', alerts: recent.slice(0, 20) }));
}

export function broadcastAlert(alert) {
  // Save to cache (keep last 200)
  let alerts = cache.get('recent_alerts') || [];
  alerts.unshift(alert);
  if (alerts.length > 200) alerts = alerts.slice(0, 200);
  cache.set('recent_alerts', alerts, 600); // 10 min

  // Broadcast to all connected clients
  const payload = JSON.stringify({ type: 'alert', alert });
  clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Called from QuickNode subscription (processWhaleTransaction)
export async function processWhaleTransaction(tx) {
  // tx.signature, tx.logs
  // In a real implementation, parse token transfers; here we generate a basic alert
  const alert = {
    token: 'SOL', // placeholder – extract from logs later
    type: Math.random() > 0.5 ? 'buy' : 'sell',
    wallet: tx.signature.slice(0, 8) + '...',
    value_usd: (Math.random() * 50000 + 1000).toFixed(2),
    tx_hash: tx.signature,
    created_at: new Date().toISOString(),
    profit_percent: (Math.random() * 20 - 5).toFixed(2),
  };

  broadcastAlert(alert);

  // If DB is available, insert into alerts table
  const { query } = await import('../db/postgres.js').catch(() => ({ query: null }));
  if (query) {
    try {
      await query(
        `INSERT INTO alerts (token, type, wallet, value_usd, tx_hash, profit_percent) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tx_hash) DO NOTHING`,
        [alert.token, alert.type, alert.wallet, alert.value_usd, tx.signature, alert.profit_percent]
      );
    } catch (e) {}
  }
}