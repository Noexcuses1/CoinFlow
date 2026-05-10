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
import { VersionedTransaction } from "@solana/web3.js";


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

  // Custom "From" field
const [showCustomFrom, setShowCustomFrom] = useState(false);
const [customFrom, setCustomFrom] = useState("");

  // Jupiter token list (for resolving symbols)
  const [tokenList, setTokenList] = useState([]);

  const [searchParams] = useSearchParams();

  const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
  const JUPITER_API_KEY = "jup_35dd4af79efee1aafc75dd0013f72a800704ce4d9d1b243657d4f37f1899edc8";

const resolveSymbol = async (address) => {
  try {
    const res = await fetch(`${API_URL}/api/token/${address}`);
    const data = await res.json();
    return data?.symbol || null;
  } catch {
    return null;
  }
};

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


  const getTokenSymbol = (mint) => {
    if (!tokenList.length) return null;
    const t = tokenList.find((tok) => tok.address === mint);
    return t ? t.symbol : null;
  };

  useEffect(() => {
    if (showCustomTo && isValidMint(customTo)) {
      resolveSymbol(customTo).then((sym) => {
        setToToken({ symbol: sym || 'CUSTOM', mint: customTo });
      });
    }
  }, [customTo, showCustomTo]);


  const fetchQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        inputMint: fromToken.mint,
        outputMint: toToken.mint,
        amount: Math.floor(parseFloat(fromAmount) * 1e9).toString(),
        slippageBps: Math.floor(slippage * 100),
      });
      const res = await fetch(`${JUPITER_SWAP_API}/quote?${params}`, {
        headers: { "x-api-key": JUPITER_API_KEY },
      });
      if (!res.ok) throw new Error(`Quote failed: ${res.status}`);
      const data = await res.json();
      setQuote(data);
    } catch (err) {
      setError(err.message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };
  
  const executeSwap = async () => {
    if (!quote || !window.solana) return;
    setExecuting(true);
    try {
      const res = await fetch(`${JUPITER_SWAP_API}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": JUPITER_API_KEY,
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: window.solana.publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
        }),
      });
      if (!res.ok) throw new Error(`Swap build failed: ${res.status}`);
      const { swapTransaction } = await res.json();
  
      // Convert base64 → Uint8Array (no Buffer needed)
      const binaryString = atob(swapTransaction);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
  
      // Deserialize the transaction
      const transaction = VersionedTransaction.deserialize(bytes);
  
      // Sign and send
      const signed = await window.solana.signAndSendTransaction(transaction);
      setTxHash(signed.signature);
      alert(`Transaction sent! ${signed.signature}`);
    } catch (err) {
      alert(`Swap failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const swapTokens = () => {
    // Swap everything: token objects, custom addresses, visibility
    const tempFrom = fromToken;
    const tempTo = toToken;
    const tempCustomFrom = customFrom;
    const tempCustomTo = customTo;
    const tempShowFrom = showCustomFrom;
    const tempShowTo = showCustomTo;
  
    setFromToken(tempTo);
    setToToken(tempFrom);
    setCustomFrom(tempCustomTo);
    setCustomTo(tempCustomFrom);
    setShowCustomFrom(tempShowTo);
    setShowCustomTo(tempShowFrom);
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
        {/* FROM */}
        <div className={styles.inputRow}>
          <label>From</label>
          <div className={styles.tokenSelectWrapper}>
            <select
              value={showCustomFrom ? "custom" : fromToken.mint}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setShowCustomFrom(true);
                  setCustomFrom("");
                  setFromToken({ symbol: "CUSTOM", mint: "" });
                } else {
                  setShowCustomFrom(false);
                  const found = QUICK_TOKENS.find((t) => t.mint === val);
                  if (found) setFromToken(found);
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

            {showCustomFrom && (
              <div className={styles.customInputWrapper}>
                <input
                  type="text"
                  placeholder="Paste token address..."
                  value={customFrom}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCustomFrom(val);
                    if (val === "") {
                      setShowCustomFrom(false);
                      setFromToken(QUICK_TOKENS[0]);
                    }
                  }}
                  className={styles.customInput}
                />
                {isValidMint(customFrom) && (
                  <span className={styles.customSymbol}>
                    {fromToken.symbol !== "CUSTOM" ? fromToken.symbol : "✔"}
                  </span>
                )}
                <button
                  className={styles.clearCustom}
                  onClick={() => {
                    setShowCustomFrom(false);
                    setCustomFrom("");
                    setFromToken(QUICK_TOKENS[0]);
                  }}
                >
                  <FiX size={14} />
                </button>
              </div>
            )}
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
        <button className={styles.swapBtn} onClick={swapTokens} title="Reverse">
          <FiRepeat />
        </button>

        {/* TO */}
        <div className={styles.inputRow}>
          <label>To (estimated)</label>
          <div className={styles.tokenSelectWrapper}>
            <select
              value={showCustomTo ? "custom" : toToken.mint}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setShowCustomTo(true);
                  setCustomTo("");
                  setToToken({ symbol: "CUSTOM", mint: "" });
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
                    {toToken.symbol !== "CUSTOM" ? toToken.symbol : "✔"}
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

        <button
          className={`${styles.quoteBtn} ${loading ? styles.loadingBtn : ""}`}
          onClick={fetchQuote}
          disabled={
            loading ||
            !fromAmount ||
            !isValidMint(fromToken.mint) ||
            !isValidMint(toToken.mint)
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

        {quote && !loading && (
          <div className={styles.quoteInfo}>
            <div className={styles.quoteRow}>
              <span>Rate</span>
              <span>
                1 {fromToken.symbol} ≈{" "}
                {(parseInt(quote.outAmount) / 1e6).toFixed(6)}{" "}
                {toToken.symbol}
              </span>
            </div>
            <div className={styles.quoteRow}>
              <span>Price Impact</span>
              <span className={quote.priceImpactPct > 1 ? styles.highImpact : ""}>
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

            {walletAddress ? (
              <button
                className={`${styles.quoteBtn} ${executing ? styles.loadingBtn : ""}`}
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