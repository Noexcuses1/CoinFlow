import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import styles from './Wallet.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Wallet() {
  const { address: paramAddress } = useParams();
  const { walletAddress, connect } = useWallet();
  const navigate = useNavigate();

  // Use connected wallet if paramAddress is "demo" or missing
  const effectiveAddress =
    paramAddress && paramAddress !== 'demo' ? paramAddress : walletAddress;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/wallet/${effectiveAddress}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [effectiveAddress]);

  // Redirect connected wallet to their own address URL
  useEffect(() => {
    if (walletAddress && (!paramAddress || paramAddress === 'demo')) {
      navigate(`/wallet/${walletAddress}`, { replace: true });
    }
  }, [walletAddress, paramAddress, navigate]);

  if (!walletAddress) {
    return (
      <div className={styles.wallet}>
        <h1>Wallet</h1>
        <p>Connect your wallet to view your portfolio.</p>
        <button onClick={connect} className="glass-panel">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) return <p>Loading wallet...</p>;
  if (!data) return <p>Wallet data unavailable</p>;

  const solBalance = data.solBalance ?? 0;
  const tokens = data.portfolio?.data?.items || data.tokens || [];

  return (
    <div className={styles.wallet}>
      <h1>Wallet</h1>
      <p className={styles.address}>{effectiveAddress}</p>
      <h2>SOL Balance: {solBalance} SOL</h2>
      <h3>Tokens</h3>
      {tokens.length > 0 ? (
        <ul className={styles.tokenList}>
          {tokens.map((item, i) => (
            <li key={i} className="glass-panel" style={{ padding: '8px', marginBottom: '6px' }}>
              <strong>{item.symbol || item.mint?.slice(0, 8)}</strong>{' '}
              {item.uiAmount || item.amount} {item.symbol ? '' : '(raw)'}
              {item.valueUsd && ` – $${item.valueUsd.toFixed(2)}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No tokens found.</p>
      )}
    </div>
  );
}