import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
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
    fetch(`${API_URL}/api/wallet/${address}`)
      .then(res => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [address, walletAddress]);

  if (!walletAddress) {
    return (
      <div className={styles.wallet}>
        <h1>Wallet</h1>
        <p>Connect your wallet to view portfolio.</p>
        <button onClick={connect} className="glass-panel">Connect Wallet</button>
      </div>
    );
  }

  if (loading) return <p>Loading wallet...</p>;
  if (!data) return <p>Wallet data unavailable</p>;

  return (
    <div className={styles.wallet}>
      <h1>Wallet</h1>
      <p>{data.address}</p>
      <h2>SOL Balance: {data.solBalance} SOL</h2>
      <h3>Tokens</h3>
      {data.portfolio?.data?.items ? (
        <ul>
          {data.portfolio.data.items.map((item, i) => (
            <li key={i}>
              {item.symbol}: {item.uiAmount} (${item.valueUsd?.toFixed(2)})
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          {data.tokens?.map((tok, i) => (
            <li key={i}>{tok.mint.slice(0,8)}...: {tok.amount}</li>
          ))}
        </ul>
      )}
    </div>
  );
}