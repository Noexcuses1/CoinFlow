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
import { startWhaleSimulator } from "./services/whaleSimulator.js";
import {
  handleConnection,
} from "./websocket/feedHandler.js";
import { startSelfPing, stopSelfPing } from "./services/selfPing.js";
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CoinFlow backend running on port ${PORT}`);
  startSelfPing();
  startDatabaseServices();
  startCampaignBotService();
  startQuickNodeService();
  startWhaleSimulatorService();
});

async function startDatabaseServices() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Database initialization failed:', error.stack || error);
  }

  try {
    await initializeCampaignSchema();
  } catch (error) {
    console.error('Campaign schema initialization failed:', error.stack || error);
  }
}

async function startCampaignBotService() {
  try {
    await startCampaignBot();
  } catch (error) {
    console.error('Campaign bot failed to start:', error.stack || error);
  }
}

function startQuickNodeService() {
  try {
    initQuickNode();   // keep RPC for wallet balances
  } catch (error) {
    console.error('QuickNode initialization failed:', error.stack || error);
  }
}

function startWhaleSimulatorService() {
  try {
    startWhaleSimulator();
  } catch (error) {
    console.error('Whale simulator startup failed:', error.stack || error);
  }
}

process.once('SIGINT', () => {
  stopSelfPing();
  stopCampaignBot('SIGINT');
});
process.once('SIGTERM', () => {
  stopSelfPing();
  stopCampaignBot('SIGTERM');
});
