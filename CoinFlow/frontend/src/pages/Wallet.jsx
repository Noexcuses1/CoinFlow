import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { FiCopy, FiExternalLink } from 'react-icons/fi';
import styles from './Wallet.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Wallet() {
  const { address } = useParams();
  const { walletAddress, connect } = useWallet();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/wallet/${address || walletAddress}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [walletAddress, address]);

  if (!walletAddress) {
    return (
      <div className={styles.wallet}>
        <h1>Wallet</h1>
        <p>Connect your wallet to view your portfolio.</p>
        <button className="glass-panel" onClick={connect}>
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.wallet}>Loading wallet...</div>;
  }

  if (!data) {
    return <div className={styles.wallet}>Failed to load wallet data.</div>;
  }

  return (
    <div className={styles.wallet}>
      <header className={styles.header}>
        <h1>Portfolio</h1>
        <div className={styles.addressBadge}>
          <span>
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </span>
          <FiCopy
            style={{ cursor: 'pointer' }}
            onClick={() => navigator.clipboard.writeText(walletAddress)}
          />
          <a
            href={`https://solscan.io/account/${walletAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            <FiExternalLink />
          </a>
        </div>
      </header>

      <div className={styles.balanceCard}>
        <h2>{data.solBalance?.toFixed(4)} SOL</h2>
        <p className={styles.muted}>Total balance</p>
      </div>

      <h3>Tokens</h3>
      {data.portfolio?.data?.items?.length > 0 ? (
        <div className={styles.tokenList}>
          {data.portfolio.data.items.map((item, i) => (
            <div key={i} className={styles.tokenRow}>
              <div>
                <strong>{item.symbol}</strong>
                <div className={styles.muted}>{item.uiAmount}</div>
              </div>
              <div>${item.valueUsd?.toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p>No token holdings found.</p>
      )}
    </div>
  );
}