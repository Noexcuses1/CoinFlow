import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first'); 
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { initializeDatabase } from "./db/postgres.js";
import { initializeCampaignSchema } from "./db/campaignSchema.js";
import { startCampaignBot, stopCampaignBot } from "./bot/index.js";
import {
  initQuickNode,
} from "./services/quicknode.js";
import {
  handleConnection,
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
  await initializeCampaignSchema();
  try {
    await startCampaignBot();
  } catch (error) {
    console.error('Campaign bot failed to start:', error.message);
  }
  initQuickNode();   // keep RPC for wallet balances

  // Use whale simulator for real‑time alerts (QuickNode WSS is disabled)
  console.log('🐋 Starting whale alert simulator (real-time, DexScreener-based)');
  const { startWhaleSimulator } = await import('./services/whaleSimulator.js');
  startWhaleSimulator();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CoinFlow backend running on http://localhost:${PORT}`);
  });
}

start();

process.once('SIGINT', () => stopCampaignBot('SIGINT'));
process.once('SIGTERM', () => stopCampaignBot('SIGTERM'));
