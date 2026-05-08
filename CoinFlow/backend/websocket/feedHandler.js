import { query } from '../db/postgres.js';

const clients = new Set();

export function handleConnection(ws) {
  clients.add(ws);
  console.log('Feed client connected. Total:', clients.size);
  ws.on('close', () => {
    clients.delete(ws);
  });
}

// Broadcast alert to all dashboard clients
export function broadcastAlert(alert) {
  const message = JSON.stringify(alert);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(message);
  });
}

// Save alert to DB and notify Telegram
export async function processWhaleTransaction(tx) {
  // In real implementation, parse token transfers. Here we generate a realistic mock using tx signature.
  const mockAlert = {
    token: ['SOL', 'BONK', 'JUP', 'WIF'][Math.floor(Math.random()*4)],
    type: Math.random() > 0.5 ? 'buy' : 'sell',
    wallet: `0x${tx.signature.slice(0,6)}...${tx.signature.slice(-4)}`,
    value_usd: (Math.random() * 100000 + 5000).toFixed(2),
    tx_hash: tx.signature,
    profit_percent: (Math.random() * 30 - 5).toFixed(2),
    timestamp: new Date().toISOString()
  };
  // Save to DB
  await query(
    `INSERT INTO alerts (token, type, wallet, value_usd, tx_hash, profit_percent) 
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tx_hash) DO NOTHING`,
    [mockAlert.token, mockAlert.type, mockAlert.wallet, mockAlert.value_usd, tx.signature, mockAlert.profit_percent]
  );
  // Broadcast & Telegram
  broadcastAlert(mockAlert);
  const { sendAlert } = await import('../services/telegram.js');
  sendAlert(mockAlert);
}