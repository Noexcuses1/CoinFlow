import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiActivity, FiArrowUp, FiArrowDown, FiCopy, FiCheck, FiShoppingCart } from 'react-icons/fi';
import styles from './Alerts.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = API_URL ? API_URL.replace(/^https?:/, protocol) : `${protocol}//localhost:4000`;
    const wsUrl = `${base}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          setAlerts(msg.alerts || []);
        } else if (msg.type === 'alert') {
          setAlerts((prev) => [msg.alert, ...prev.slice(0, 99)]);
        }
      } catch (e) {}
    };

    ws.onerror = () => {
      fetch(`${API_URL}/api/alerts`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setAlerts(data.slice(0, 50));
        })
        .catch(() => {});
    };

    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, []);

  return (
    <div className={styles.alerts}>
      <div className={styles.header}>
        <h1>Live Whale Alerts</h1>
        <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`} />
        <span className={styles.statusText}>{connected ? 'Live' : 'Reconnecting...'}</span>
      </div>

      <div className={styles.feed}>
        {alerts.length === 0 && (
          <p className={styles.empty}>Waiting for the first whale move…</p>
        )}

        {alerts.map((alert, i) => (
          <AlertCard key={tokenAddress || i} alert={alert} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}

function AlertCard({ alert, navigate }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (tokenAddress) {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleBuy = () => {
    // Use mint address, not symbol
    const tokenAddress = alert.address || alert.token;  // fallback
    navigate(`/trade?token=${tokenAddress}&side=buy`);
  };

  return (
    <div className={`glass-panel ${styles.alertCard}`}>
      <div className={styles.cardTop}>
        <div className={styles.tokenInfo}>
          <span
            className={styles.tokenSymbol}
            onClick={copyAddress}
            title="Click to copy TX hash"
          >
            {alert.token}
          </span>
          <button onClick={copyAddress} className={styles.copyBtn}>
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
          </button>
          <span className={`${styles.badge} ${alert.type === 'buy' ? styles.buy : styles.sell}`}>
            {alert.type === 'buy' ? <FiArrowUp /> : <FiArrowDown />}
            {alert.type.toUpperCase()}
          </span>
        </div>
        <div className={styles.value}>
          ${Number(alert.value_usd).toLocaleString()}
        </div>
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.wallet}>{alert.wallet}</span>
        <span className={styles.time}>
          {new Date(alert.created_at).toLocaleTimeString()}
        </span>
        {alert.profit_percent && (
          <span className={`${styles.profit} ${alert.profit_percent >= 0 ? styles.positive : styles.negative}`}>
            {alert.profit_percent > 0 ? '+' : ''}{alert.profit_percent}%
          </span>
        )}
        <button onClick={handleBuy} className={styles.buyBtn} title="Swap SOL to this token">
          Buy
        </button>
      </div>
    </div>
  );
}