import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiCopy, FiExternalLink } from 'react-icons/fi';
import styles from './Search.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Search() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('token') || '';
  const [input, setInput] = useState(initialQuery);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchToken = async (address) => {
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    setToken(null);
    try {
      const res = await fetch(`${API_URL}/api/token/${address.trim()}`);
      const data = await res.json();
      if (data && data.symbol) {
        setToken(data);
      } else {
        setError('Token not found or no liquidity on Solana.');
      }
    } catch (err) {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) fetchToken(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchToken(input);
  };

  const copyAddress = async () => {
    if (token?.address) {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className={styles.searchPage}>
      <h1>Token Search</h1>
      <form className={styles.searchForm} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Paste Solana token address..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" disabled={loading} className={styles.searchBtn}>
          {loading ? 'Searching...' : <FiSearch size={18} />}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {token && !loading && (
        <div className={`glass-panel ${styles.tokenCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.tokenName}>
              <span className={styles.symbol}>{token.symbol}</span>
              <span className={styles.name}>{token.name}</span>
            </div>
            <div className={styles.actions}>
              <button onClick={copyAddress} title="Copy mint address">
                {copied ? '✅' : <FiCopy size={16} />}
              </button>
              <a
                href={`https://solscan.io/token/${token.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiExternalLink size={16} />
              </a>
            </div>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span className={styles.label}>Price</span>
              <span className={styles.value}>
                ${token.price < 0.01 ? token.price.toFixed(8) : token.price.toFixed(4)}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>24h Change</span>
              <span className={`${styles.value} ${token.priceChange24hPercent >= 0 ? styles.positive : styles.negative}`}>
                {token.priceChange24hPercent.toFixed(2)}%
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>24h Volume</span>
              <span className={styles.value}>
                ${token.volume24h ? token.volume24h.toLocaleString() : '0'}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>Liquidity</span>
              <span className={styles.value}>
                ${token.liquidity ? token.liquidity.toLocaleString() : '—'}
              </span>
            </div>
          </div>
          {token.fdv && (
            <div className={styles.extras}>
              <span>FDV: ${token.fdv.toLocaleString()}</span>
              {token.pairCreatedAt && (
                <span>Created: {new Date(token.pairCreatedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
          <div className={styles.addressRow}>
            <span>{token.address}</span>
          </div>
        </div>
      )}
    </div>
  );
}