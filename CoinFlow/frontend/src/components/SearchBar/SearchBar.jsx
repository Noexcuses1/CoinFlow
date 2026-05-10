import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';

// Hard‑coded fallback list (always available, no network needed)
const FALLBACK_TOKENS = [
  { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
  { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'WIF', name: 'dogwifhat', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'RNDR', name: 'Render Token', address: 'rndr5HHzP5zFt7Dd7jc3nJHLzB7jBW3xLd2m5g1q1bA' },
  { symbol: 'PYTH', name: 'Pyth Network', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  { symbol: 'JTO', name: 'Jito', address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL' },
  { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
];

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [tokens, setTokens] = useState(FALLBACK_TOKENS);
  const [filtered, setFiltered] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  // Load Jupiter full token list and merge with fallback
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://token.jup.ag/strict');
        const data = await res.json();
        if (Array.isArray(data)) {
          const merged = [...FALLBACK_TOKENS];
          for (const t of data) {
            if (!merged.find((m) => m.address === t.address)) {
              merged.push({
                symbol: t.symbol || t.name,
                name: t.name || t.symbol,
                address: t.address,
              });
            }
          }
          setTokens(merged);
        }
      } catch (e) {
        // Use fallback list silently
      }
    })();
  }, []);

  // Filter tokens based on query
  useEffect(() => {
    if (query.trim().length < 2) {
      setFiltered([]);
      setShowDropdown(false);
      return;
    }
    const q = query.toLowerCase().trim();
    const results = tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.includes(q)
    ).slice(0, 10);
    setFiltered(results);
    setShowDropdown(results.length > 0);
  }, [query, tokens]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (filtered.length > 0) {
      navigate(`/trade?token=${filtered[0].address}`);
    } else if (query.trim()) {
      navigate(`/trade?token=${query.trim()}`);
    }
    setQuery('');
    setShowDropdown(false);
  };

  const handleSelect = (token) => {
    navigate(`/trade?token=${token.address}`);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className={`glass-panel ${styles.searchBar}`} ref={wrapperRef}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          placeholder="Search tokens..."
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (filtered.length > 0) setShowDropdown(true);
          }}
        />
        <button type="submit" className={styles.button}>
          Search
        </button>
      </form>

      {showDropdown && (
        <div className={styles.dropdown}>
          {filtered.map((token) => (
            <div
              key={token.address}
              className={styles.dropdownItem}
              onClick={() => handleSelect(token)}
            >
              <div className={styles.dropdownSymbol}>
                {token.symbol}
                <span className={styles.dropdownName}>{token.name}</span>
              </div>
              <span className={styles.dropdownAddress}>
                {token.address.slice(0, 6)}...{token.address.slice(-4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}