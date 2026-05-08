import { Connection } from '@solana/web3.js';
import WebSocket from 'ws';

let connection = null;
let wsConnection = null;

export function initQuickNode() {
  const rpcUrl = process.env.QUICKNODE_RPC_URL;
  if (!rpcUrl || !rpcUrl.startsWith('http')) {
    console.warn('⚠️ QUICKNODE_RPC_URL not set or invalid – QuickNode disabled.');
    return;
  }
  try {
    connection = new Connection(rpcUrl, {
      wsEndpoint: process.env.QUICKNODE_WSS_URL,
      commitment: 'confirmed',
    });
    console.log('✅ QuickNode RPC connected');
  } catch (error) {
    console.warn('⚠️ QuickNode init error:', error.message);
  }
}

export function connectQuickNodeWebSocket(onTransaction) {
  const wssUrl = process.env.QUICKNODE_WSS_URL;
  if (!wssUrl) {
    console.warn('No QuickNode WSS URL – whale monitoring disabled');
    return;  // <-- returns undefined, BUT we'll handle it in server.js
  }
  try {
    wsConnection = new WebSocket(wssUrl);

    wsConnection.on('open', () => {
      console.log('QuickNode WebSocket connected');
      const subscribeMsg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'logsSubscribe',
        params: [
          { mentions: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'] },
          { commitment: 'confirmed' }
        ]
      };
      wsConnection.send(JSON.stringify(subscribeMsg));
    });

    wsConnection.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.params?.result?.value?.err) return;
        const signature = parsed.params?.result?.value?.signature;
        if (signature) {
          onTransaction({ signature, logs: parsed.params.result.value.logs });
        }
      } catch (e) { }
    });

    wsConnection.on('close', () => {
      console.log('QuickNode WS closed, reconnecting in 5s...');
      setTimeout(() => connectQuickNodeWebSocket(onTransaction), 5000);
    });

    wsConnection.on('error', (err) => {
      console.warn('QuickNode WS error:', err.message);
    });
  } catch (err) {
    console.warn('QuickNode WS init failed:', err.message);
  }
}

export function getConnection() {
  return connection;
}