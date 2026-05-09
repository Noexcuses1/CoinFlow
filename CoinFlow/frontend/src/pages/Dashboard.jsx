import { useState, useEffect, useCallback } from 'react';
import SignalCard from '../components/SignalCard/SignalCard';
import styles from './Dashboard.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';
const REFRESH_INTERVAL = 25000; // 25s

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
      } else if (json?.data?.data?.coins) {   // some APIs wrap twice
        tokens = json.data.data.coins;
      } else if (Array.isArray(json?.data)) {
        tokens = json.data;
      } else if (json?.data && Array.isArray(json.data.coins)) {
        tokens = json.data.coins;
      }
  
      if (!Array.isArray(tokens)) {
        console.warn('Trending tokens: unexpected format', json);
        tokens = [];
      }
  
      setTrending(tokens.slice(0, 20));
    } catch (err) {
      console.error('Failed to load trending tokens', err);
      setTrending([]);   // ensure it stays an empty array
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = API_URL ? API_URL.replace(/^https?:/, protocol) : window.location.origin;
    const wsUrl = `${base}/ws`;
  
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          setAlerts(msg.alerts || []);
          setLoading(false);    // mark loading done when init arrives
        } else if (msg.type === 'alert') {
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
    whales: new Set(alerts.map(a => a.wallet)).size,
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Smart Money Stream</h1>
        <div className={styles.stats}>
          <span className={styles.stat}><strong>{stats.today}</strong> alerts</span>
          <span className={styles.stat}><strong>{stats.whales}</strong> whales</span>
        </div>
      </div>

      {loading && <div className={styles.loader}>Loading live data...</div>}

      {/* Trending tokens section */}
      <section>
        <h2 className={styles.sectionTitle}>🔥 Trending Tokens</h2>
        <div className={styles.trendingGrid}>
          {trending.map((coin, i) => (
            <TrendingCard key={i} coin={coin} />
          ))}
        </div>
      </section>

      {/* Whale alert feed */}
      <section>
        <h2 className={styles.sectionTitle}>🐋 Whale Moves</h2>
        <div className={styles.grid}>
          {alerts.length === 0 && !loading && <p>Waiting for whale activity...</p>}
          {alerts.map((alert, i) => (
            <SignalCard key={alert.tx_hash || i} signal={{
              token: alert.token,
              type: alert.type,
              wallet: alert.wallet,
              value: `$${parseFloat(alert.value_usd).toLocaleString()}`,
              timestamp: new Date(alert.created_at).toLocaleTimeString(),
              profit: parseFloat(alert.profit_percent),
            }} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Simple trending card component
function TrendingCard({ coin }) {
  const price = coin?.price || coin?.priceUsd || 0;
  const change = coin?.priceChange24hPercent || 0;
  const volume = coin?.volume24h || coin?.volume || 0;
  return (
    <div className={`glass-panel ${styles.trendingCard}`}>
      <div className={styles.trendingHeader}>
        <span>{coin?.symbol || '???'}</span>
        <span className={change >= 0 ? styles.positive : styles.negative}>{change.toFixed(2)}%</span>
      </div>
      <div>${price.toFixed(4)}</div>
      <div className={styles.volume}>Vol: ${Math.round(volume).toLocaleString()}</div>
    </div>
  );
}