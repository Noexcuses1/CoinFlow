import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Catch‑all for root
app.get('/', (req, res) => res.send('CoinFlow backend alive'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal server running on http://0.0.0.0:${PORT}`);
});

// Error catchers
process.on('uncaughtException', (err) => console.error('💥 Uncaught exception:', err));
process.on('unhandledRejection', (reason) => console.error('💥 Unhandled rejection:', reason));