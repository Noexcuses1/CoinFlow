import { Connection, PublicKey } from '@solana/web3.js';
import WebSocket from 'ws';
import cache from './cache.js';

let connection = null;
let wsConnection = null;
let transactionCallback = null;

export function initQuickNode() {
  const rpcUrl = process.env.QUICKNODE_RPC_URL;
  if (!rpcUrl) {
    console.warn('⚠️ QUICKNODE_RPC_URL missing – real-time wallet data disabled.');
    return;
  }
  connection = new Connection(rpcUrl, 'confirmed');
  console.log('✅ QuickNode RPC initialized');
}

export function getConnection() {
  return connection;
}

// Subscribe to transactions mentioning a set of program IDs (orca, raydium, jupiter)
export function subscribeWhaleTransactions(callback) {
  if (!connection) {
    console.warn('QuickNode not available - whale monitoring disabled');
    return;
  }
  const wssUrl = process.env.QUICKNODE_WSS_URL;
  if (!wssUrl) return;

  wsConnection = new WebSocket(wssUrl);
  wsConnection.on('open', () => {
    console.log('🔌 QuickNode WebSocket connected');
    const subscribeMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
            'whirLbMiicVdio4qvUfM5KAg6Bt8UwpjzH4F8yP6jfo', // Orca
            'JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk',  // Jupiter
          ],
        },
        { commitment: 'confirmed' },
      ],
    };
    wsConnection.send(JSON.stringify(subscribeMsg));
  });

  wsConnection.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      const logs = parsed.params?.result?.value?.logs;
      const signature = parsed.params?.result?.value?.signature;
      if (!signature || !logs) return;
      // Filter for swap instructions (simplified)
      if (logs.some(log => log.includes('Swap') || log.includes('swap'))) {
        transactionCallback({ signature, logs });
        callback({ signature, logs });
      }
    } catch (e) {}
  });

  wsConnection.on('close', () => {
    console.log('QuickNode WS disconnected, retry in 10s');
    setTimeout(() => subscribeWhaleTransactions(callback), 10000);
  });

  wsConnection.on('error', (err) => {
    console.error('QuickNode WS error:', err.message);
  });
}

// Fetch SOL balance + token balances for a wallet
export async function getWalletBalances(walletAddress) {
  const cacheKey = `sol_balances_${walletAddress}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!connection) {
    return { sol: 0, tokens: [] };
  }

  try {
    const pubKey = new PublicKey(walletAddress);
    const solBalance = await connection.getBalance(pubKey);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const tokens = tokenAccounts.value.map((ta) => {
      const info = ta.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
      };
    });

    const result = {
      sol: solBalance / 1e9,
      tokens,
    };
    cache.set(cacheKey, result, 30);
    return result;
  } catch (err) {
    console.error('QuickNode balance fetch error:', err.message);
    return { sol: 0, tokens: [] };
  }
}