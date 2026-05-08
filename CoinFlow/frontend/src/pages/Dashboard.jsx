import { useState, useEffect } from 'react';
import SignalCard from '../components/SignalCard/SignalCard';
import styles from './Dashboard.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({ today: 0, whales: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/alerts`)
      .then(res => res.json())
      .then(data => {
        const alerts = Array.isArray(data) ? data : [];
        setSignals(alerts.slice(0, 20));
        setStats({
          today: alerts.length,
          whales: new Set(alerts.map(s => s.wallet)).size,
        });
      })
      .catch(() => {
        // If backend is completely down, show local fallback (optional)
      })
      .finally(() => setLoading(false));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
        setSignals(prev => [alert, ...prev.slice(0, 19)]);
        setStats(prev => ({
          today: prev.today + 1,
          whales: new Set([alert, ...signals].map(s => s.wallet)).size,
        }));
      } catch (e) {}
    };
    ws.onerror = () => console.log('WebSocket not available');
    return () => ws.close();
  }, []);

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Smart Money Stream</h1>
        <div className={styles.stats}>
          <span className={styles.stat}><strong>{stats.today}</strong> signals today</span>
          <span className={styles.stat}><strong>{stats.whales}</strong> whales active</span>
        </div>
      </div>
      {loading ? (
        <p>Loading signals...</p>
      ) : signals.length === 0 ? (
        <p>No signals yet. Waiting for whale activity...</p>
      ) : (
        <div className={styles.grid}>
          {signals.map((s, i) => (
            <SignalCard key={s.id || s.tx_hash || i} signal={{
              token: s.token,
              type: s.type,
              wallet: s.wallet,
              value: `$${parseFloat(s.value_usd).toLocaleString()}`,
              timestamp: new Date(s.created_at).toLocaleTimeString(),
              profit: parseFloat(s.profit_percent),
            }} />
          ))}
        </div>
      )}
    </div>
  );
}