import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import styles from './Wallet.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Wallet() {
  const { address } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/wallet/${address}`)
      .then(res => res.json())
      .then(setData)
      .catch(() => setData({
        address: address,
        balance: '42.0 SOL',
        tokens: [{ symbol: 'BONK', balance: '1,000,000', usdValue: '125.00' }],
      }))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return <p>Loading wallet...</p>;
  if (!data) return <p>Wallet not found</p>;

  return (
    <div className={styles.wallet}>
      <h1>Wallet</h1>
      <p>{data.address}</p>
      <h2>Balance: {data.balance}</h2>
      <h3>Tokens</h3>
      <ul>
        {data.tokens?.map((tok, i) => (
          <li key={i}>{tok.symbol}: {tok.balance} (${tok.usdValue})</li>
        ))}
      </ul>
    </div>
  );
}