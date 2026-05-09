import axios from 'axios';
import cache from './cache.js';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ BIRDEYE_API_KEY not set – trending data will be empty.');
}

const birdeye = axios.create({
  baseURL: BIRDEYE_BASE,
  headers: { 'X-API-KEY': API_KEY || '', 'Content-Type': 'application/json' },
});

// CORRECT trending endpoint
export async function getTrendingTokens(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/trending/tokens', {
      params: { limit, offset: 0, sort: 'rank' },
    });
    cache.set(cacheKey, data, 30); // 30 sec TTL
    return data;
  } catch (err) {
    console.error('Birdeye trending error:', err.response?.status, err.message);
    return { success: false, data: [] }; // safe fallback
  }
}

export async function getTokenOverview(address) {
  const cacheKey = `token_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/token_overview', { params: { address } });
    cache.set(cacheKey, data, 20);
    return data;
  } catch (err) {
    console.error('Birdeye token overview error:', err.message);
    return null;
  }
}

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

export async function getTokenSecurity(address) {
  const cacheKey = `security_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await birdeye.get('/public/token_security', { params: { address } });
    cache.set(cacheKey, data, 60);
    return data;
  } catch (err) {
    console.error('Birdeye security error:', err.message);
    return null;
  }
}