import axios from 'axios';
import cache from './cache.js';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_LITE_API = 'https://lite-api.jup.ag/swap/v1'; 

// GET quote for a swap
export async function getSwapQuote({ inputMint, outputMint, amount, slippageBps = 50 }) {
  if (!inputMint || !outputMint || !amount) throw new Error('Missing parameters');
  const cacheKey = `jup_quote_${inputMint}_${outputMint}_${amount}_${slippageBps}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${JUPITER_QUOTE_API}/quote`, {
      params: { inputMint, outputMint, amount, slippageBps },
    });
    cache.set(cacheKey, data, 5);
    return data;
  } catch (err) {
    console.warn('Primary Jupiter API failed, trying fallback lite-api...');
    try {
      const { data } = await axios.get(`${JUPITER_LITE_API}/quote`, {
        params: { inputMint, outputMint, amount, slippageBps },
      });
      cache.set(cacheKey, data, 5);
      return data;
    } catch (fallbackErr) {
      console.error('Both Jupiter endpoints failed:', fallbackErr.message);
      throw fallbackErr;
    }
  }
}
// Build swap transaction
export async function buildSwapTransaction({
  quoteResponse,
  userPublicKey,
  wrapAndUnwrapSol = true,
  prioritizationFeeLamports = 'auto',
  dynamicComputeUnitLimit = true,
  dynamicSlippage = true,
}) {
  if (!quoteResponse || !userPublicKey) {
    throw new Error('Missing required parameters: quoteResponse, userPublicKey');
  }

  try {
    const { data } = await axios.post(
      `${JUPITER_QUOTE_API}/swap`,
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
      }
    );

    return data;
  } catch (err) {
    console.error('Jupiter swap build error:', err.response?.data || err.message);
    throw err;
  }
}

// Get swap instructions (for composing custom transactions)
export async function getSwapInstructions({
  quoteResponse,
  userPublicKey,
  wrapAndUnwrapSol = true,
}) {
  try {
    const { data } = await axios.post(
      `${JUPITER_QUOTE_API}/swap-instructions`,
      {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return data;
  } catch (err) {
    console.error('Jupiter instructions error:', err.response?.data || err.message);
    throw err;
  }
}

// Get token list with prices
export async function getTokens() {
  const cacheKey = 'jup_tokens';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // Jupiter strict token list (verified tokens only)
    const { data } = await axios.get('https://token.jup.ag/strict');
    cache.set(cacheKey, data, 300); // 5 minutes
    return data;
  } catch (err) {
    console.error('Jupiter token list error:', err.message);
    return [];
  }
}

// Get price for a token (using Jupiter's price API)
export async function getTokenPrice(tokenMint, vsToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
  const cacheKey = `jup_price_${tokenMint}_${vsToken}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${JUPITER_QUOTE_API}/price`, {
      params: {
        ids: tokenMint,
        vsToken,
      },
    });
    cache.set(cacheKey, data, 15);
    return data;
  } catch (err) {
    console.error('Jupiter price error:', err.message);
    return null;
  }
}