import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { initializeDatabase } from './db/postgres.js';
import { initQuickNode, connectQuickNodeWebSocket } from './services/quicknode.js';
import { handleConnection, processWhaleTransaction } from './websocket/feedHandler.js';
import apiRoutes from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const server = createServer(app);

// WebSocket for frontend feed
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => handleConnection(ws));

// Startup sequence
async function start() {
    await initializeDatabase();
    initQuickNode();
    try {
        connectQuickNodeWebSocket(processWhaleTransaction);
      } catch (err) {
        console.warn('⚠️ QuickNode WebSocket error:', err.message);
      }
  
    server.listen(PORT, () => {
      console.log(`🚀 CoinFlow backend running on http://localhost:${PORT}`);
    });
  }

start();