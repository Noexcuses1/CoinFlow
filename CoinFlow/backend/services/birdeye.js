import axios from 'axios';
import cache from './cache.js';

const BASE_URL = 'https://public-api.birdeye.so';
const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ BIRDEYE_API_KEY not set – using Jupiter fallback for trending data.');
}

const birdeye = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-KEY': API_KEY || '',
    'Content-Type': 'application/json',
  },
});

let lastRequestTime = 0;
const delayMs = 800;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequestTime + delayMs - now;
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();
}

function extractTokens(rawData) {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  if (rawData.data) {
    if (Array.isArray(rawData.data)) return rawData.data;
    if (rawData.data.tokens && Array.isArray(rawData.data.tokens)) return rawData.data.tokens;
    if (typeof rawData.data === 'object') {
      const values = Object.values(rawData.data);
      if (values.length && Array.isArray(values[0])) return values[0];
    }
  }
  const findArray = (obj) => {
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key];
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const nested = findArray(obj[key]);
        if (nested) return nested;
      }
    }
    return null;
  };
  return findArray(rawData) || [];
}

// Normalize token objects to consistent fields
function normalizeTokens(tokens) {
  return tokens.map(t => ({
    symbol: t.symbol || t.name || '???',
    name: t.name || t.symbol || t.address || 'Unknown',
    address: t.address || t.mint || t.token_address || '',
    price: parseFloat(t.price || 0),
    priceChange24hPercent: parseFloat(t.price_change_24h || t.priceChange24h || 0),
    volume24h: parseFloat(t.volume_24h || t.volume || 0),
  }));
}

// Jupiter fallback
async function jupiterTrending(limit = 20) {
  try {
    const { data } = await axios.get('https://token.jup.ag/strict');
    if (Array.isArray(data)) {
      return data.slice(0, limit).map(token => ({
        symbol: token.symbol || token.name,
        name: token.name || token.symbol,
        address: token.address,
        price: parseFloat(token.price || 0),
        priceChange24hPercent: parseFloat(token.price_change_24h || 0),
        volume24h: parseFloat(token.volume_24h || 0),
      }));
    }
  } catch (e) {}
  return [];
}

export async function getTrendingTokens(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return { success: true, data: cached };

  // Try Birdeye
  if (API_KEY) {
    try {
      await rateLimit();
      const response = await birdeye.get('/defi/token_trending', { params: { limit } });
      const rawTokens = extractTokens(response.data);
      if (rawTokens.length > 0) {
        const normalized = normalizeTokens(rawTokens);
        cache.set(cacheKey, normalized, 25);
        return { success: true, data: normalized };
      }
    } catch (err) {
      console.error('Birdeye trending failed:', err.message);
    }
  }

  // Fallback to Jupiter
  const jupTokens = await jupiterTrending(limit);
  cache.set(cacheKey, jupTokens, 60);
  return { success: true, data: jupTokens };
}

// Token overview (unchanged but using BASE_URL without /v1)
export async function getTokenOverview(address) {
  const cacheKey = `token_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const response = await birdeye.get('/defi/token_overview', {
      params: { address },
    });
    cache.set(cacheKey, response.data?.data || response.data, 20);
    return response.data?.data || response.data;
  } catch (err) {
    console.error('Birdeye token overview error:', err.message);
    return null;
  }
}

// Wallet portfolio (similar fix)
export async function getWalletPortfolio(walletAddress) {
  const cacheKey = `wallet_${walletAddress}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const response = await birdeye.get('/wallet/token_list', {
      params: { wallet: walletAddress },
    });
    cache.set(cacheKey, response.data?.data || response.data, 15);
    return response.data?.data || response.data;
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
    await rateLimit();
    const response = await birdeye.get('/defi/token_security', {
      params: { address },
    });
    cache.set(cacheKey, response.data?.data || {}, 60);
    return response.data?.data || {};
  } catch (err) {
    console.error('Birdeye security error:', err.message);
    return null;
  }
}