import { useState, useEffect } from 'react';
import styles from './Alerts.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'init') {
        setAlerts(msg.alerts || []);
      } else if (msg.type === 'alert') {
        setAlerts(prev => [msg.alert, ...prev.slice(0, 99)]);
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div className={styles.alerts}>
      <h1>Live Alerts</h1>
      <div className={styles.list}>
        {alerts.length === 0 && <p>Waiting for alerts...</p>}
        {alerts.map((a, i) => (
          <div key={i} className="glass-panel" style={{ padding: '8px', marginBottom: '8px' }}>
            <strong>{a.token}</strong> - {a.type.toUpperCase()} ${Number(a.value_usd).toLocaleString()} by {a.wallet}
          </div>
        ))}
      </div>
    </div>
  );
}