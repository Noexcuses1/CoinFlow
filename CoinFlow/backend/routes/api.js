import { Router } from 'express';
import { getTrendingTokens, getTokenOverview, getWalletPortfolio, getTokenSecurity } from '../services/birdeye.js';
import { getWalletBalances } from '../services/quicknode.js';
import { getSwapQuote, buildSwapTransaction, getTokens } from '../services/jupiterService.js';
import { getSwapQuote as getDexlabQuote } from '../services/dexlabService.js';
import cache from '../services/cache.js';

const router = Router();

// ---------- DASHBOARD DATA ----------

// Trending tokens (dashboard)
router.get('/trending', async (req, res) => {
  const { limit = 20 } = req.query;
  const data = await getTrendingTokens(parseInt(limit));
  if (data?.success === false) {
    return res.json({ success: false, data: [] });
  }
  res.json(data);
});

// Live whale alerts (WebSocket feed cache)
router.get('/alerts', async (req, res) => {
  const alerts = cache.get('recent_alerts') || [];
  res.json(alerts.slice(0, 50));
});

// ---------- TOKEN DATA ----------

// Token overview (trade page, wallet token info)
router.get('/token/:address', async (req, res) => {
  const data = await getTokenOverview(req.params.address);
  if (!data) return res.status(404).json({ error: 'Token not found' });
  res.json(data);
});

// Token security audit
router.get('/token/:address/security', async (req, res) => {
  const data = await getTokenSecurity(req.params.address);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ---------- WALLET ----------

// Wallet balances + holdings
router.get('/wallet/:address', async (req, res) => {
  const { address } = req.params;
  try {
    const [portfolio, rawBalances] = await Promise.allSettled([
      getWalletPortfolio(address),
      getWalletBalances(address),
    ]);

    res.json({
      address,
      portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
      solBalance: rawBalances.status === 'fulfilled' ? rawBalances.value.sol : 0,
      tokens: rawBalances.status === 'fulfilled' ? rawBalances.value.tokens : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// ---------- JUPITER SWAP (PRIMARY) ----------

// Get token list from Jupiter
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await getTokens();
    res.json({ success: true, count: tokens.length, tokens: tokens.slice(0, 500) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a swap quote (Jupiter)
router.post('/trade/quote', async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.body;

  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['inputMint', 'outputMint', 'amount'],
      example: {
        inputMint: 'So11111111111111111111111111111111111111112',   // SOL
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: '100000000',  // 0.1 SOL in lamports
        slippageBps: 50       // 0.5%
      }
    });
  }

  try {
    const quote = await getSwapQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps || 50,
    });
    res.json({ success: true, quote, aggregator: 'Jupiter' });
  } catch (err) {
    console.error('Jupiter quote error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Build swap transaction from quote
router.post('/trade/build', async (req, res) => {
  const { quoteResponse, wallet } = req.body;

  if (!quoteResponse || !wallet) {
    return res.status(400).json({ error: 'Missing quoteResponse or wallet address' });
  }

  try {
    const swapTx = await buildSwapTransaction({
      quoteResponse,
      userPublicKey: wallet,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    });
    res.json({
      success: true,
      swapTransaction: swapTx.swapTransaction,     // base64 serialised transaction
      lastValidBlockHeight: swapTx.lastValidBlockHeight,
      aggregator: 'Jupiter',
    });
  } catch (err) {
    console.error('Jupiter build error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- DEXLAB FALLBACK ----------

// Fallback quote from Dexlab
router.post('/trade/quote-fallback', async (req, res) => {
  const { fromTokenAddress, toTokenAddress, amount, wallet } = req.body;

  if (!fromTokenAddress || !toTokenAddress || !amount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const quote = await getDexlabQuote({
    fromTokenAddress,
    toTokenAddress,
    amount,
    userWalletAddress: wallet,
  });

  if (!quote) {
    return res.status(500).json({ success: false, error: 'Dexlab quote unavailable' });
  }

  res.json({ success: true, quote, aggregator: 'Dexlab' });
});

export default router;