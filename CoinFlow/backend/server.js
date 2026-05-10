import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first'); 
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { initializeDatabase } from "./db/postgres.js";
import {
  initQuickNode,
  subscribeWhaleTransactions,
} from "./services/quicknode.js";
import {
  handleConnection,
  processWhaleTransaction,
} from "./websocket/feedHandler.js";
import apiRoutes from "./routes/api.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use("/api", apiRoutes);

const server = createServer(app);

// WebSocket for frontend feed
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", handleConnection);

async function start() {
  await initializeDatabase();
  initQuickNode();

  // Start listening to whale transactions (or use simulator if unavailable)
  try {
    if (process.env.QUICKNODE_WSS_URL) {
      subscribeWhaleTransactions(processWhaleTransaction);
    } else {
      const { startWhaleSimulator } = await import('./services/whaleSimulator.js');
      startWhaleSimulator();
    }
  } catch (err) {
    console.error('Whale feed failed to start:', err.message);
    // fallback to simulator if anything goes wrong
    const { startWhaleSimulator } = await import('./services/whaleSimulator.js');
    startWhaleSimulator();
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CoinFlow backend running on http://localhost:${PORT}`);
  });
}

start();
