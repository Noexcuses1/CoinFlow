import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { useWallet } from '../../context/WalletContext';

export default function Navbar({ onMenuToggle }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { walletAddress, connecting, connect, disconnect } = useWallet();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/trade?token=${search.trim()}`);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle}>☰</button>
        <Link to="/dashboard" className={styles.logo}>
          <span className={styles.coin}>⬡</span>
          <span className={styles.brand}>CoinFlow</span>
        </Link>
      </div>
      <form className={styles.center} onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search token / wallet address..."
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className={styles.right}>
        <div className={styles.status}>
          <span className={styles.liveDot}></span>
          Live
        </div>
        {walletAddress ? (
          <div className={styles.walletInfo}>
            <span className={styles.address}>{walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</span>
            <button onClick={disconnect} className={styles.disconnectBtn}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} className={styles.connectBtn}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
}