import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import styles from './Trade.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const QUICK_TOKENS = [
  { symbol: 'SOL', mint: SOL_MINT },
  { symbol: 'USDC', mint: USDC_MINT },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
];

export default function Trade() {
  const { walletAddress: connectedWallet, connect } = useWallet();

  const [inputToken, setInputToken] = useState(SOL_MINT);
  const [outputToken, setOutputToken] = useState(USDC_MINT);
  const [amount, setAmount] = useState('0.1');
  const [slippage, setSlippage] = useState(0.5);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convert human-readable amount to lamports (SOL) or base units
  const toRawAmount = (amount, token) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    if (token === SOL_MINT) return Math.floor(num * 1e9).toString();
    return Math.floor(num * 1e6).toString(); // Default 6 decimals
  };

  const fetchQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/trade/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: inputToken,
          outputMint: outputToken,
          amount: toRawAmount(amount, inputToken),
          slippageBps: Math.floor(slippage * 100),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
      } else {
        setError(data.error || 'Failed to fetch quote');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.trade}>
      <h1>Swap Terminal</h1>

      {/* Token selector */}
      <div className={styles.tokenRow}>
        <div className={styles.tokenSelect}>
          <label>From</label>
          <select value={inputToken} onChange={(e) => setInputToken(e.target.value)}>
            {QUICK_TOKENS.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>

        <button
          className={styles.swapBtn}
          onClick={() => {
            const temp = inputToken;
            setInputToken(outputToken);
            setOutputToken(temp);
            setQuote(null);
          }}
        >
          ⇅
        </button>

        <div className={styles.tokenSelect}>
          <label>To</label>
          <select value={outputToken} onChange={(e) => setOutputToken(e.target.value)}>
            {QUICK_TOKENS.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount */}
      <input
        type="number"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setQuote(null);
        }}
        placeholder="Amount"
        className={styles.amountInput}
      />

      {/* Slippage */}
      <div className={styles.slippageRow}>
        <label>Slippage: {slippage}%</label>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={slippage}
          onChange={(e) => setSlippage(parseFloat(e.target.value))}
        />
      </div>

      {/* Wallet connection */}
      {!connectedWallet && (
        <button onClick={connect} className={styles.connectBtn}>
          Connect Wallet to Trade
        </button>
      )}

      {/* Fetch quote button */}
      {connectedWallet && (
        <button onClick={fetchQuote} disabled={loading} className={styles.quoteBtn}>
          {loading ? 'Fetching Quote...' : 'Get Quote'}
        </button>
      )}

      {/* Error display */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Quote display */}
      {quote && (
        <div className={`glass-panel ${styles.quotePanel}`}>
          <h3>Quote (Jupiter Aggregator)</h3>
          <div className={styles.quoteRow}>
            <span>Input:</span>
            <span>{quote.inAmount ? (parseInt(quote.inAmount) / 1e9).toFixed(6) : '?'} SOL</span>
          </div>
          <div className={styles.quoteRow}>
            <span>Output:</span>
            <span>{quote.outAmount ? (parseInt(quote.outAmount) / 1e6).toFixed(6) : '?'} USDC</span>
          </div>
          <div className={styles.quoteRow}>
            <span>Price Impact:</span>
            <span>{quote.priceImpactPct || '0'}%</span>
          </div>
          <div className={styles.quoteRow}>
            <span>Route:</span>
            <span>{quote.routePlan?.map((r) => r.swapInfo?.label).join(' → ')}</span>
          </div>

          <button
            className={styles.executeBtn}
            onClick={async () => {
              const res = await fetch(`${API_URL}/api/trade/build`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  quoteResponse: quote,
                  wallet: connectedWallet,
                }),
              });
              const data = await res.json();
              if (data.success && window.solana) {
                // Sign and send transaction via wallet
                try {
                  const tx = data.swapTransaction;
                  const signed = await window.solana.signAndSendTransaction(
                    JSON.parse(Buffer.from(tx, 'base64').toString())
                  );
                  alert(`Transaction sent! ${signed.signature}`);
                } catch (err) {
                  alert(`Signing failed: ${err.message}`);
                }
              } else if (data.success) {
                alert(`Transaction built. Base64: ${data.swapTransaction.slice(0, 20)}...`);
              } else {
                alert(`Error: ${data.error}`);
              }
            }}
          >
            Execute Swap
          </button>
        </div>
      )}
    </div>
  );
}