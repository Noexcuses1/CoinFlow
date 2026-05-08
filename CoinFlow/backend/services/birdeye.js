import axios from 'axios';
import cache from './cache.js';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ BIRDEYE_API_KEY not set – token data will be limited.');
}

const birdeye = axios.create({
  baseURL: BIRDEYE_BASE,
  headers: { 'X-API-KEY': API_KEY || '', 'Content-Type': 'application/json' },
});

// Get trending tokens (default: sort by volume, 20 results)
export async function getTrendingTokens(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/getTrendingTokens', {
      params: { sort_type: 'volume', limit },
    });
    cache.set(cacheKey, data, 25); // 25 sec TTL
    return data;
  } catch (err) {
    console.error('Birdeye trending error:', err.message);
    return { success: false, data: [] };
  }
}

// Token price / overview
export async function getTokenOverview(address) {
  const cacheKey = `token_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/token_overview', {
      params: { address },
    });
    cache.set(cacheKey, data, 20);
    return data;
  } catch (err) {
    console.error('Birdeye token overview error:', err.message);
    return null;
  }
}

// Wallet token holdings (using Birdeye's wallet endpoint – limited)
export async function getWalletPortfolio(walletAddress) {
  const cacheKey = `wallet_${walletAddress}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/wallet/token_list', {
      params: { wallet: walletAddress },
    });
    cache.set(cacheKey, data, 15);
    return data;
  } catch (err) {
    console.error('Birdeye wallet error:', err.message);
    return null;
  }
}

// Token security info
export async function getTokenSecurity(address) {
  const cacheKey = `security_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/token_security', {
      params: { address },
    });
    cache.set(cacheKey, data, 60); // security data rarely changes
    return data;
  } catch (err) {
    console.error('Birdeye security error:', err.message);
    return null;
  }
}