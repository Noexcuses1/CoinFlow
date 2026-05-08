import axios from 'axios';
import cache from './cache.js';

const DEXLAB_OPEN_API = 'https://open-api.dexlab.space';
const DEXLAB_PRO_API = 'https://pro-api.dexlab.space';
const API_KEY = process.env.DEXLAB_API_KEY || null;

const baseURL = API_KEY ? DEXLAB_PRO_API : DEXLAB_OPEN_API;

export async function getSwapQuote({
  fromTokenAddress,
  toTokenAddress,
  amount,
  userWalletAddress,
  slippageBps = 500, // 5% default (Dexlab uses bps differently)
  referrerFeeBps = 0,
}) {
  const cacheKey = `dexlab_${fromTokenAddress}_${toTokenAddress}_${amount}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.post(
      `${baseURL}/dex/swap`,
      {
        userWalletAddress,
        amount,
        fromTokenAddress,
        toTokenAddress,
        slippageBps,
        ...(API_KEY && { referrerFeeBps }),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY && { 'X-API-Key': API_KEY }),
        },
      }
    );
    cache.set(cacheKey, data, 10);
    return data;
  } catch (err) {
    console.error('Dexlab quote error:', err.response?.data || err.message);
    return null;
  }
}