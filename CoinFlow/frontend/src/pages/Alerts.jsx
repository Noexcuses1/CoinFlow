import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import styles from './Alerts.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = API_URL ? API_URL.replace(/^https?:/, protocol) : window.location.origin;
    const ws = new WebSocket(`${base}/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') setAlerts(msg.alerts || []);
        else if (msg.type === 'alert') setAlerts(prev => [msg.alert, ...prev.slice(0, 99)]);
      } catch (e) {}
    };
    return () => ws.close();
  }, []);

  return (
    <div className={styles.alerts}>
      <h1>Live Whale Alerts</h1>
      {alerts.length === 0 && <p>Waiting for alerts...</p>}
      <div className={styles.list}>
        {alerts.map((a, i) => (
          <div key={i} className={styles.alertRow}>
            <span className={a.type === 'buy' ? styles.buyIcon : styles.sellIcon}>
              {a.type === 'buy' ? <FiArrowUp /> : <FiArrowDown />}
            </span>
            <div className={styles.alertInfo}>
              <strong>{a.token}</strong> {a.type.toUpperCase()} — ${Number(a.value_usd).toLocaleString()}
              <div className={styles.muted}>{a.wallet} · {new Date(a.created_at).toLocaleTimeString()}</div>
            </div>
            {a.profit_percent && (
              <span className={a.profit_percent >= 0 ? styles.positive : styles.negative}>
                {a.profit_percent > 0 ? '+' : ''}{a.profit_percent}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}