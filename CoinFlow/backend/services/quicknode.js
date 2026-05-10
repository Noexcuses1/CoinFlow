import { Connection, PublicKey } from '@solana/web3.js';
import WebSocket from 'ws';
import cache from './cache.js';

let connection = null;
let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

export function initQuickNode() {
  const rpcUrl = process.env.QUICKNODE_RPC_URL;
  if (!rpcUrl) {
    console.warn('⚠️ QUICKNODE_RPC_URL missing – real-time wallet data disabled.');
    return;
  }
  try {
    connection = new Connection(rpcUrl, 'confirmed');
    console.log('✅ QuickNode RPC initialized');
  } catch (err) {
    console.warn('⚠️ QuickNode RPC init error:', err.message);
  }
}

export function getConnection() {
  return connection;
}

export function subscribeWhaleTransactions(callback) {
  const wssUrl = process.env.QUICKNODE_WSS_URL;
  if (!wssUrl) {
    console.warn('No QuickNode WSS URL – skipping whale subscription.');
    return;
  }

  function connect() {
    try {
      wsConnection = new WebSocket(wssUrl);

      wsConnection.on('open', () => {
        console.log('🔌 QuickNode WebSocket connected');
        reconnectAttempts = 0; // reset on successful connection
        const subscribeMsg = {
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: [
            {
              mentions: [
                '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
                'whirLbMiicVdio4qvUfM5KAg6Bt8UwpjzH4F8yP6jfo', // Orca
                'JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk', // Jupiter
              ],
            },
            { commitment: 'confirmed' },
          ],
        };
        // Now it's safe to send
        if (wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify(subscribeMsg));
        }
      });

      wsConnection.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          const signature = parsed.params?.result?.value?.signature;
          const logs = parsed.params?.result?.value?.logs;
          if (signature && callback) {
            callback({ signature, logs });
          }
        } catch (e) {}
      });

      wsConnection.on('error', (err) => {
        console.warn('QuickNode WS error:', err.message);
      });

      wsConnection.on('close', () => {
        console.log('QuickNode WS disconnected');
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          console.log(`Retrying in ${reconnectAttempts * 5}s (attempt ${reconnectAttempts}/${MAX_RECONNECT})…`);
          setTimeout(connect, reconnectAttempts * 5000);
        } else {
          console.warn('Max reconnect attempts reached – giving up on QuickNode WebSocket.');
        }
      });
    } catch (err) {
      console.error('QuickNode WS init failed:', err.message);
    }
  }

  connect();
}

export async function getWalletBalances(walletAddress) {
  const cacheKey = `sol_balances_${walletAddress}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!connection) return { sol: 0, tokens: [] };

  try {
    const pubKey = new PublicKey(walletAddress);
    const solBalance = await connection.getBalance(pubKey);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const tokens = tokenAccounts.value.map((ta) => ({
      mint: ta.account.data.parsed.info.mint,
      amount: ta.account.data.parsed.info.tokenAmount.uiAmount,
      decimals: ta.account.data.parsed.info.tokenAmount.decimals,
    }));

    const result = { sol: solBalance / 1e9, tokens };
    cache.set(cacheKey, result, 30);
    return result;
  } catch (err) {
    console.error('QuickNode balance fetch error:', err.message);
    return { sol: 0, tokens: [] };
  }
}