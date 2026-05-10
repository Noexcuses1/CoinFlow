import { useState, useEffect, useCallback } from "react";
import { FiCopy, FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import styles from "./Dashboard.module.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const REFRESH_INTERVAL = 30000; // 30s

// Utility to copy text and briefly show a checkmark
const copyToClipboard = async (text, callback) => {
  try {
    await navigator.clipboard.writeText(text);
    callback(true);
    setTimeout(() => callback(false), 1500);
  } catch {
    callback(false);
  }
};

export default function Dashboard() {
  const [trending, setTrending] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/trending?limit=20`);
      const json = await res.json();

      // Extract an array from all possible Birdeye response shapes
      let tokens = [];
      if (Array.isArray(json)) {
        tokens = json;
      } else if (json?.data?.coins) {
        tokens = json.data.coins;
      } else if (json?.data?.data?.coins) {
        // some APIs wrap twice
        tokens = json.data.data.coins;
      } else if (Array.isArray(json?.data)) {
        tokens = json.data;
      } else if (json?.data && Array.isArray(json.data.coins)) {
        tokens = json.data.coins;
      }

      if (!Array.isArray(tokens)) {
        console.warn("Trending tokens: unexpected format", json);
        tokens = [];
      }

      setTrending(tokens.slice(0, 20));
    } catch (err) {
      console.error("Failed to load trending tokens", err);
      setTrending([]); // ensure it stays an empty array
    }
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    fetchTrending();
    const interval = setInterval(fetchTrending, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  // WebSocket for real-time whale alerts
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsBase;
    if (API_URL) {
      wsBase = API_URL.replace(/^https?:/, protocol);
    } else {
      // In development, point to backend directly
      wsBase = `${protocol}//localhost:4000`;
    }
    const wsUrl = `${wsBase}/ws`;

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "init") {
          setAlerts(msg.alerts || []);
          setLoading(false); // mark loading done when init arrives
        } else if (msg.type === "alert") {
          setAlerts((prev) => [msg.alert, ...prev.slice(0, 49)]);
        }
      } catch (e) {}
    };

    ws.onerror = () => {
      // fallback: fetch alerts via HTTP
      fetch(`${API_URL}/api/alerts`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAlerts(data.slice(0, 20));
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    ws.onclose = () => setLoading(false);

    return () => ws.close();
  }, []);

  const stats = {
    today: alerts.length,
    whales: new Set(alerts.map((a) => a.wallet)).size,
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Smart Money Stream</h1>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <strong>{stats.today}</strong> alerts
          </span>
          <span className={styles.stat}>
            <strong>{stats.whales}</strong> whales
          </span>
        </div>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>🔥 Trending Tokens</h2>
        <div className={styles.trendingGrid}>
          {trending.map((coin, i) => (
            <TrendingCard key={coin?.address || i} coin={coin} index={i} />
          ))}
        </div>
      </section>

      {/* Whale alerts grid (if any) */}
      {alerts.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>🐋 Whale Moves</h2>
          <div className={styles.alertGrid}>
            {alerts.slice(0, 12).map((alert, i) => (
              <div
                key={alert.tx_hash || i}
                className={`glass-panel ${styles.alertCard}`}
              >
                <div className={styles.alertHeader}>
                  <span className={styles.alertToken}>{alert.token}</span>
                  <span
                    className={`${styles.alertType} ${
                      alert.type === "buy" ? styles.buy : styles.sell
                    }`}
                  >
                    {alert.type.toUpperCase()}
                  </span>
                </div>
                <div className={styles.alertValue}>
                  ${Number(alert.value_usd).toLocaleString()}
                </div>
                <div className={styles.alertWallet}>{alert.wallet}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TrendingCard({ coin, index }) {
  const [copied, setCopied] = useState(false);

  const address = coin?.address; // Unique mint address
  const symbol = coin?.symbol || "???";
  const name = coin?.name || symbol;
  const price = parseFloat(coin?.price || coin?.priceUsd || 0);
  const change = parseFloat(coin?.priceChange24hPercent || 0);
  const volume = parseFloat(coin?.volume24h || coin?.volume || 0);

  // Format volume
  const formatVolume = (vol) => {
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const handleCopy = () => {
    if (address) copyToClipboard(address, setCopied);
  };

  return (
    <div
      className={`glass-panel ${styles.trendingCard}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={handleCopy}
      title={address ? "Click to copy mint address" : ""}
    >
      <div className={styles.trendingHeader}>
        <div className={styles.coinMain}>
          <span className={styles.symbol}>{symbol}</span>
          {name && name !== symbol && (
            <span className={styles.name}>{name}</span>
          )}
        </div>
        <button
          className={styles.copyBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? "✅" : <FiCopy size={14} />}
        </button>
      </div>
      <div className={styles.priceRow}>
        <span className={styles.price}>
          {price > 0
            ? `$${price < 0.01 ? price.toFixed(6) : price.toFixed(2)}`
            : "—"}
        </span>
        <span
          className={`${styles.change} ${
            change >= 0 ? styles.positive : styles.negative
          }`}
        >
          {change >= 0 ? (
            <FiTrendingUp size={14} />
          ) : (
            <FiTrendingDown size={14} />
          )}
          {change.toFixed(2)}%
        </span>
      </div>
      <div className={styles.volume}>
        Vol: {volume > 0 ? formatVolume(volume) : "—"}
      </div>
      {address && (
        <div className={styles.address}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      )}
    </div>
  );
}
