import axios from 'axios';
import cache from './cache.js';

let lastRequestTime = 0;
const MIN_DELAY_MS = 500;
let dexScreenerBackoffUntil = 0;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequestTime + MIN_DELAY_MS - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();
}

// ---------- Helper: pick the most liquid Solana pair ----------
function bestPair(pairs) {
  const solPairs = (pairs || []).filter((p) => p.chainId === 'solana');
  if (solPairs.length === 0) return pairs?.[0] || null;
  // sort by liquidity descending
  solPairs.sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  );
  return solPairs[0];
}

// ---------- Trending Tokens (DexScreener) ----------
export async function getTrendingTokens(limit = 20) {
  const cacheKey = `trending_ds_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    const now = Date.now();
    if (now < dexScreenerBackoffUntil) {
      return { success: false, data: [] };
    }

    await rateLimit();

    // 1. Get latest Solana token profiles
    const { data: profiles } = await axios.get(
      'https://api.dexscreener.com/token-profiles/latest/v1'
    );

    const solProfiles = (profiles || []).filter(
      (p) => p.chainId === 'solana'
    );

    if (solProfiles.length === 0) {
      console.warn('No Solana profiles from DexScreener');
      return { success: true, data: [] };
    }

    // Take top 50 and fetch pair data in parallel (batched)
    const batch = solProfiles.slice(0, 50);
    const tokenList = await Promise.all(
      batch.map(async (t) => {
        try {
          const { data } = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${t.tokenAddress}`
          );
          const pair = bestPair(data?.pairs);
          if (!pair) return null;

          return {
            symbol: pair.baseToken?.symbol || '???',
            name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown',
            address: t.tokenAddress,
            price: parseFloat(pair.priceUsd || 0),
            priceChange24hPercent: parseFloat(
              pair.priceChange?.h24 || 0
            ),
            volume24h: parseFloat(pair.volume?.h24 || 0),
            liquidity: parseFloat(pair.liquidity?.usd || 0),
          };
        } catch (err) {
          if (err.response?.status === 429) {
            setDexScreenerBackoff();
          }
          return null;
        }
      })
    );

    const filtered = tokenList.filter(Boolean); // remove nulls

    // Sort by volume descending
    filtered.sort((a, b) => b.volume24h - a.volume24h);

    cache.set(cacheKey, filtered, 60);
    return { success: true, data: filtered.slice(0, limit) };
  } catch (err) {
    if (err.response?.status === 429) {
      setDexScreenerBackoff();
    }
    console.error('DexScreener trending error:', err.message);
    return { success: false, data: [] };
  }
}

function setDexScreenerBackoff() {
  const configuredSeconds = Number.parseInt(process.env.DEXSCREENER_BACKOFF_SECONDS || '180', 10);
  const backoffSeconds = Number.isFinite(configuredSeconds) && configuredSeconds > 0
    ? configuredSeconds
    : 180;
  const nextBackoffUntil = Date.now() + backoffSeconds * 1000;

  if (nextBackoffUntil > dexScreenerBackoffUntil) {
    dexScreenerBackoffUntil = nextBackoffUntil;
    console.warn(`DexScreener rate limited, backing off for ${backoffSeconds}s`);
  }
}

// ---------- Token Overview ----------
export async function getTokenOverview(address) {
  const cacheKey = `token_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const { data } = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );
    const pair = bestPair(data?.pairs);
    if (!pair) return null;

    const token = {
      symbol: pair.baseToken?.symbol || pair.quoteToken?.symbol || '???',
      name: pair.baseToken?.name || pair.quoteToken?.name || 'Unknown',
      price: parseFloat(pair.priceUsd || 0),
      priceChange24hPercent: parseFloat(pair.priceChange?.h24 || 0),
      volume24h: parseFloat(pair.volume?.h24 || 0),
      liquidity: parseFloat(pair.liquidity?.usd || 0),
      fdv: parseFloat(pair.fdv || 0),
      marketCap: parseFloat(pair.marketCap || 0),
      pairCreatedAt: pair.pairCreatedAt,
      info: pair.info || null,
    };
    cache.set(cacheKey, token, 30);
    return token;
  } catch (err) {
    console.error('Token overview error:', err.message);
    return null;
  }
}

// ---------- Wallet Portfolio (uses DexScreener search + QuickNode) ----------
export async function getWalletPortfolio(walletAddress) {
  // DexScreener doesn't have a direct wallet endpoint.
  // We return an empty array here; routes/api.js will merge with
  // QuickNode balances.
  return [];
}

// ---------- Token Security (basic check via DexScreener) ----------
export async function getTokenSecurity(address) {
  const cacheKey = `security_${address}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    await rateLimit();
    const { data } = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );
    const pair = bestPair(data?.pairs);
    if (!pair) {
      return { score: 0, message: 'No liquidity or pairs found' };
    }

    const security = {
      score: Math.min(100, Math.floor(pair.txns?.h24?.buys / 100 || 0)),
      liquidityUSD: pair.liquidity?.usd || 0,
      pairCreatedAt: pair.pairCreatedAt,
      isNew: (Date.now() - pair.pairCreatedAt) < 86400000,
      marketCap: pair.marketCap || 0,
      fdv: pair.fdv || 0,
    };
    cache.set(cacheKey, security, 120);
    return security;
  } catch (err) {
    console.error('Token security error:', err.message);
    return { score: 0, message: err.message };
  }
}

// ---------- Trading Volume Report (16) ----------
export async function getTradingVolumeReport(limit = 20) {
  const cacheKey = `volume_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    const result = await getTrendingTokens(limit);
    if (result.success) {
      const withVolume = result.data.map((t) => ({
        ...t,
        dailyVolume: t.volume24h,
        timestamp: new Date().toISOString(),
      }));
      cache.set(cacheKey, withVolume, 60);
      return { success: true, data: withVolume };
    }
    return result;
  } catch (err) {
    console.error('Volume report error:', err.message);
    return { success: false, data: [] };
  }
}
