import axios from 'axios';
import cache from './cache.js';
import { execSync } from 'child_process';

// Force IPv4 for all outbound calls (Railway workaround)
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const JUPITER_MAIN = 'https://quote-api.jup.ag/v6';
const JUPITER_LITE = 'https://lite-api.jup.ag/swap/v1';

export async function getSwapQuote({ inputMint, outputMint, amount, slippageBps = 50 }) {
  if (!inputMint || !outputMint || !amount) throw new Error('Missing parameters');
  const cacheKey = `jup_quote_${inputMint}_${outputMint}_${amount}_${slippageBps}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Helper to try an endpoint
  const tryQuote = async (baseURL) => {
    const { data } = await axios.get(`${baseURL}/quote`, {
      params: { inputMint, outputMint, amount, slippageBps },
      timeout: 8000,   // 8 seconds
    });
    return data;
  };

  try {
    const data = await tryQuote(JUPITER_MAIN);
    cache.set(cacheKey, data, 5);
    return data;
  } catch (err) {
    console.warn('Primary Jupiter API failed, trying lite endpoint');
    try {
      const data = await tryQuote(JUPITER_LITE);
      cache.set(cacheKey, data, 5);
      return data;
    } catch (fallbackErr) {
      console.error('Jupiter quote error (both endpoints):', fallbackErr.message);
      throw new Error('Could not fetch quote – try again later');
    }
  }
}

export async function buildSwapTransaction({
  quoteResponse,
  userPublicKey,
  wrapAndUnwrapSol = true,
  prioritizationFeeLamports = 'auto',
  dynamicComputeUnitLimit = true,
  dynamicSlippage = true,
}) {
  if (!quoteResponse || !userPublicKey) throw new Error('Missing parameters');
  try {
    const { data } = await axios.post(
      `${JUPITER_MAIN}/swap`,
      {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol,
        prioritizationFeeLamports,
        dynamicComputeUnitLimit,
        dynamicSlippage,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return data;
  } catch (err) {
    console.error('Jupiter swap build error:', err.response?.data || err.message);
    throw new Error('Transaction build failed');
  }
}

export async function getTokens() {
  const cacheKey = 'jup_tokens';
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const { data } = await axios.get('https://token.jup.ag/strict', { timeout: 5000 });
    cache.set(cacheKey, data, 300);
    return data;
  } catch (err) {
    console.error('Jupiter token list error:', err.message);
    return [];
  }
}