import axios from 'axios';
import cache from './cache.js';

const BASE_URL = 'https://public-api.birdeye.so/v1';   // ★ v1 for public
const API_KEY = process.env.BIRDEYE_API_KEY;

if (!API_KEY) {
  console.warn('⚠️ BIRDEYE_API_KEY not set – using Jupiter fallback for trending data.');
} else {
  console.log(`🔑 Birdeye API key loaded (length: ${API_KEY.length})`);
}

const birdeye = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-KEY': API_KEY || '',
    'Content-Type': 'application/json',
  },
});

let lastRequestTime = 0;
const MIN_DELAY_MS = 800;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequestTime + MIN_DELAY_MS - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();
}

// ---------- Trending Tokens (public endpoint) ----------
export async function getTrendingTokens(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return { success: true, data: cached };

  if (API_KEY) {
    try {
      await rateLimit();
      // ★ Correct public endpoint: GET /v1/public/token/token_trending
      const { data } = await birdeye.get('/public/token/token_trending', {
        params: { sort_by: 'volume', offset: 0, limit },
      });
      console.log('Birdeye trending response (truncated):', JSON.stringify(data).slice(0, 300));

      let tokens = [];
      if (data?.data?.coins) tokens = data.data.coins;
      else if (data?.coins) tokens = data.coins;
      else if (Array.isArray(data?.data)) tokens = data.data;
      else if (Array.isArray(data)) tokens = data;

      if (tokens.length > 0) {
        const normalized = tokens.map((t) => ({
          symbol: t.symbol || t.name || '???',
          name: t.name || t.symbol || 'Unknown',
          address: t.address || t.mint || t.token_address || '',
          price: parseFloat(t.price || t.priceUsd || 0),
          priceChange24hPercent: parseFloat(
            t.priceChange24hPercent || t.price_change_24h || t.priceChange24h || 0
          ),
          volume24h: parseFloat(
            t.volume24h || t.volume_24h || t.volume || 0
          ),
        }));
        cache.set(cacheKey, normalized, 30);
        return { success: true, data: normalized };
      }
    } catch (err) {
      console.error('Birdeye trending failed:', err.response?.data || err.message);
    }
  }

  // Jupiter fallback
  console.warn('Falling back to Jupiter token list for trending.');
  const jupTokens = await jupiterFallback(limit);
  cache.set(cacheKey, jupTokens, 60);
  return { success: true, data: jupTokens };
}

// ---------- Token Overview ----------
export async function getTokenOverview(address) {
  const cacheKey = `token_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const { data } = await birdeye.get('/public/token/token_overview', {
      params: { address },
    });
    const tokenData = data?.data || data;
    cache.set(cacheKey, tokenData, 20);
    return tokenData;
  } catch (err) {
    console.error('Birdeye token overview error:', err.message);
    return null;
  }
}

// ---------- Wallet Portfolio (use Birdeye's wallet endpoint) ----------
export async function getWalletPortfolio(walletAddress) {
  const cacheKey = `wallet_${walletAddress}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const { data } = await birdeye.get('/public/wallet/token_list', {
      params: { wallet: walletAddress },
    });
    const items = data?.data?.items || data?.items || [];
    cache.set(cacheKey, items, 15);
    return items;
  } catch (err) {
    console.error('Birdeye wallet error:', err.message);
    return null;
  }
}

// ---------- Token Security ----------
export async function getTokenSecurity(address) {
  const cacheKey = `security_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const { data } = await birdeye.get('/public/token/token_security', {
      params: { address },
    });
    cache.set(cacheKey, data?.data || data, 60);
    return data?.data || data;
  } catch (err) {
    console.error('Birdeye security error:', err.message);
    return null;
  }
}

// ---------- Jupiter Fallback ----------
async function jupiterFallback(limit = 20) {
  try {
    const { data } = await axios.get('https://token.jup.ag/strict');
    if (Array.isArray(data)) {
      return data.slice(0, limit).map((token) => ({
        symbol: token.symbol || token.name || '???',
        name: token.name || token.symbol || '',
        address: token.address,
        price: 0,
        priceChange24hPercent: 0,
        volume24h: 0,
      }));
    }
  } catch (e) {}
  return [];
}