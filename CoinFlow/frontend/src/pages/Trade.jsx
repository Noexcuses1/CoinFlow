import { useState, useEffect } from "react";
import {
  FiRepeat,
  FiAlertCircle,
  FiLoader,
  FiX,
  FiCheck,
  FiExternalLink,
} from "react-icons/fi";
import { useWallet } from "../context/WalletContext";
import styles from "./Trade.module.css";
import { useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "";

const QUICK_TOKENS = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
];

const isValidMint = (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

export default function Trade() {
  const { walletAddress } = useWallet();

  // "From" is always a known token (no custom)
  const [fromToken, setFromToken] = useState(QUICK_TOKENS[0]);
  const [fromAmount, setFromAmount] = useState("");

  // "To" can be known or custom
  const [toToken, setToToken] = useState(QUICK_TOKENS[1]);
  const [customTo, setCustomTo] = useState("");
  const [showCustomTo, setShowCustomTo] = useState(false);

  const [slippage, setSlippage] = useState(0.5);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Swap execution states
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState("");

  // Jupiter token list (for resolving symbols)
  const [tokenList, setTokenList] = useState([]);

  const [searchParams] = useSearchParams();

  // When the page loads from an alert, pre‑fill the token
  useEffect(() => {
    const tokenAddress = searchParams.get("token");
    const side = searchParams.get("side");
    if (tokenAddress && side === "buy") {
      // Set as output token (we want to buy this token)
      setShowCustomTo(true);
      setCustomTo(tokenAddress);
      // The symbol will be resolved automatically by the getTokenSymbol logic already in Trade.jsx
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("https://token.jup.ag/strict")
      .then((res) => res.json())
      .then((data) => setTokenList(data))
      .catch(() => {});
  }, []);

  const getTokenSymbol = (mint) => {
    if (!tokenList.length) return null;
    const t = tokenList.find((tok) => tok.address === mint);
    return t ? t.symbol : null;
  };

  // Update toToken symbol when customTo changes
  useEffect(() => {
    if (showCustomTo && isValidMint(customTo)) {
      if (tokenList.length > 0) {
        const symbol = getTokenSymbol(customTo) || "CUSTOM";
        setToToken({ symbol, mint: customTo });
      } else {
        setToToken({ symbol: "CUSTOM", mint: customTo });
      }
    } else if (!showCustomTo) {
      // do nothing, keep selected known token
    }
  }, [customTo, showCustomTo, tokenList]);

  const fetchQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/trade/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: fromToken.mint,
          outputMint: toToken.mint,
          amount: Math.floor(parseFloat(fromAmount) * 1e9).toString(),
          slippageBps: Math.floor(slippage * 100),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
      } else {
        setError(data.error || "Quote failed");
        setQuote(null);
      }
    } catch (err) {
      setError("Network error");
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !walletAddress || !window.solana) {
      setError("Please connect a wallet to execute the swap.");
      return;
    }

    setExecuting(true);
    setError(null);
    try {
      // Build the swap transaction from the backend
      const buildRes = await fetch(`${API_URL}/api/trade/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          wallet: walletAddress,
        }),
      });
      const buildData = await buildRes.json();
      if (!buildData.success) {
        setError(buildData.error || "Failed to build swap transaction.");
        return;
      }

      // Decode the base64 transaction
      const swapTxBuf = Buffer.from(buildData.swapTransaction, "base64");
      // Send for signing via Phantom/Solflare
      const signedTx = await window.solana.signAndSendTransaction(
        JSON.parse(swapTxBuf.toString())
      );
      setTxHash(signedTx.signature);
    } catch (err) {
      setError(err.message || "Transaction failed");
    } finally {
      setExecuting(false);
    }
  };

  const swapTokens = () => {
    if (showCustomTo) return; // can't swap custom token into From
    const tempFrom = fromToken;
    setFromToken(toToken);
    setToToken(tempFrom);
    setShowCustomTo(false);
    setCustomTo("");
    setQuote(null);
    setError(null);
  };

  // Clear quote when inputs change
  useEffect(() => {
    setQuote(null);
    setError(null);
  }, [fromAmount, fromToken.mint, toToken.mint]);

  return (
    <div className={styles.trade}>
      <h1>Swap Terminal</h1>

      <div className={styles.swapCard}>
        {/* FROM (always known token) */}
        <div className={styles.inputRow}>
          <label>From</label>
          <div className={styles.tokenSelectWrapper}>
            <select
              value={fromToken.mint}
              onChange={(e) => {
                const found = QUICK_TOKENS.find(
                  (t) => t.mint === e.target.value
                );
                if (found) setFromToken(found);
              }}
              className={styles.select}
            >
              {QUICK_TOKENS.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className={styles.amountInput}
            />
          </div>
        </div>

        {/* SWAP BUTTON */}
        <button
          className={styles.swapBtn}
          onClick={swapTokens}
          title="Reverse tokens"
        >
          <FiRepeat />
        </button>

        {/* TO (known or custom) */}
        <div className={styles.inputRow}>
          <label>To (estimated)</label>
          <div className={styles.tokenSelectWrapper}>
            <select
              value={showCustomTo ? "custom" : toToken.mint}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setShowCustomTo(true);
                  setToToken({ symbol: "CUSTOM", mint: "" });
                  setCustomTo("");
                } else {
                  setShowCustomTo(false);
                  const found = QUICK_TOKENS.find((t) => t.mint === val);
                  if (found) setToToken(found);
                }
              }}
              className={styles.select}
            >
              {QUICK_TOKENS.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol}
                </option>
              ))}
              <option value="custom">Other (paste CA)</option>
            </select>

            {showCustomTo && (
              <div className={styles.customInputWrapper}>
                <input
                  type="text"
                  placeholder="Paste token address..."
                  value={customTo}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCustomTo(val);
                    if (val === "") {
                      setShowCustomTo(false);
                      setToToken(QUICK_TOKENS[1]);
                    }
                  }}
                  className={styles.customInput}
                />
                {isValidMint(customTo) && (
                  <span className={styles.customSymbol}>
                    {getTokenSymbol(customTo) || "✔"}
                  </span>
                )}
                <button
                  className={styles.clearCustom}
                  onClick={() => {
                    setShowCustomTo(false);
                    setCustomTo("");
                    setToToken(QUICK_TOKENS[1]);
                  }}
                >
                  <FiX size={14} />
                </button>
              </div>
            )}

            {!showCustomTo && (
              <div className={styles.estimated}>
                {quote
                  ? `≈ ${(parseInt(quote.outAmount) / 1e6).toFixed(6)}`
                  : "—"}
              </div>
            )}
          </div>
          {showCustomTo && (
            <div className={styles.estimatedSmall}>
              {quote ? `≈ ${(parseInt(quote.outAmount) / 1e6).toFixed(6)}` : ""}
            </div>
          )}
        </div>

        {/* SLIPPAGE */}
        <div className={styles.slippageRow}>
          <span>Slippage: {slippage}%</span>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            className={styles.slider}
          />
        </div>

        {error && (
          <div className={styles.error}>
            <FiAlertCircle /> {error}
          </div>
        )}

        {/* QUOTE BUTTON */}
        <button
          className={`${styles.quoteBtn} ${loading ? styles.loadingBtn : ""}`}
          onClick={fetchQuote}
          disabled={
            loading ||
            !fromAmount ||
            !isValidMint(fromToken.mint) ||
            (showCustomTo && !isValidMint(customTo)) ||
            (!showCustomTo && !isValidMint(toToken.mint))
          }
        >
          {loading ? (
            <span className={styles.loadingContent}>
              <FiLoader className={styles.spinner} /> Fetching best price...
            </span>
          ) : (
            "Get Quote"
          )}
        </button>

        {/* QUOTE DETAILS */}
        {quote && !loading && (
          <div className={styles.quoteInfo}>
            <div className={styles.quoteRow}>
              <span>Rate</span>
              <span>
                1 {fromToken.symbol} ≈{" "}
                {(parseInt(quote.outAmount) / 1e6).toFixed(6)}{" "}
                {showCustomTo && getTokenSymbol(customTo)
                  ? getTokenSymbol(customTo)
                  : toToken.symbol}
              </span>
            </div>
            <div className={styles.quoteRow}>
              <span>Price Impact</span>
              <span
                className={quote.priceImpactPct > 1 ? styles.highImpact : ""}
              >
                {quote.priceImpactPct || "0"}%
              </span>
            </div>
            <div className={styles.quoteRow}>
              <span>Route</span>
              <span className={styles.route}>
                {quote.routePlan?.map((r) => r.swapInfo?.label).join(" → ") ||
                  "Jupiter"}
              </span>
            </div>

            {/* EXECUTE SWAP BUTTON */}
            {walletAddress ? (
              <button
                className={`${styles.quoteBtn} ${
                  executing ? styles.loadingBtn : ""
                }`}
                onClick={executeSwap}
                disabled={executing}
              >
                {executing ? (
                  <span className={styles.loadingContent}>
                    <FiLoader className={styles.spinner} /> Executing Swap...
                  </span>
                ) : (
                  "Execute Swap"
                )}
              </button>
            ) : (
              <div className={styles.connectWarning}>
                Connect your wallet to execute the swap.
              </div>
            )}

            {txHash && (
              <div className={styles.txSuccess}>
                <FiCheck /> Swap successful!{" "}
                <a
                  href={`https://solscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Solscan <FiExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
