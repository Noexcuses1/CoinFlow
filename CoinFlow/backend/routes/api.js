import { Router } from 'express';
import { query } from '../db/postgres.js';

const router = Router();

// Demo alerts (when DB is empty or no real feed)
const DEMO_ALERTS = [
  { id: 1, token: 'BONK', type: 'buy', wallet: '0x71C...6F3E', value_usd: 32100.00, created_at: new Date().toISOString(), profit_percent: 12.4, tx_hash: 'demo1' },
  { id: 2, token: 'JTO', type: 'sell', wallet: '0x8F2A...1B7C', value_usd: 18750.00, created_at: new Date().toISOString(), profit_percent: -3.2, tx_hash: 'demo2' },
  { id: 3, token: 'WIF', type: 'buy', wallet: '0x3D4B...9A2E', value_usd: 54230.00, created_at: new Date().toISOString(), profit_percent: 27.8, tx_hash: 'demo3' },
  { id: 4, token: 'PYTH', type: 'buy', wallet: '0x14F...C82D', value_usd: 8900.00, created_at: new Date().toISOString(), profit_percent: 5.1, tx_hash: 'demo4' },
  { id: 5, token: 'RNDR', type: 'sell', wallet: '0x99A...F12B', value_usd: 22340.00, created_at: new Date().toISOString(), profit_percent: -1.8, tx_hash: 'demo5' },
];

// GET /api/alerts
router.get('/alerts', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100');
    if (rows.length > 0) {
      return res.json(rows);
    }
  } catch (e) {
    console.log('DB error, returning demo alerts');
  }
  // Return demo alerts as fallback
  res.json(DEMO_ALERTS);
});

// GET /api/token/:address
router.get('/token/:address', async (req, res) => {
  try {
    // If Birdeye service is configured, use it; else return mock
    const { getTokenOverview } = await import('../services/birdeye.js');
    const data = await getTokenOverview(req.params.address);
    return res.json(data);
  } catch (e) {
    // Fallback mock token data
    res.json({
      address: req.params.address,
      symbol: 'TOKEN',
      name: 'Unknown Token',
      price: 0.0235,
      price_change_24h: 5.67,
      volume_24h: 1200000,
      market_cap: 4500000,
    });
  }
});

// GET /api/wallet/:address
router.get('/wallet/:address', async (req, res) => {
  // Mock wallet data
  res.json({
    address: req.params.address,
    balance: '42.5 SOL',
    tokens: [
      { symbol: 'BONK', balance: '2,500,000', usdValue: '312.50' },
      { symbol: 'JTO', balance: '150', usdValue: '675.00' },
    ],
  });
});

// POST /api/trade
router.post('/trade', async (req, res) => {
  const { token, amount, side, wallet } = req.body;
  // Mock DFlow trade
  res.json({ success: true, txId: `mock_tx_${Date.now()}`, message: `${side} order placed for ${amount} ${token}` });
});

export default router;