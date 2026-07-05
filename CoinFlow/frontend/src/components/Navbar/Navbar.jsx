import { Link } from 'react-router-dom';
import styles from './Navbar.module.css';
import { useWallet } from '../../context/WalletContext';

export default function Navbar() {
  const { walletAddress, connecting, connect, disconnect, walletError, walletAction } = useWallet();

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <Link to="/dashboard" className={styles.logo}>
          <span className={styles.coin}>⬡</span>
          <span className={styles.brand}>CoinFlow</span>
        </Link>
      </div>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <div className={styles.status}>
          <span className={styles.liveDot}></span>
          Live
        </div>
        {walletAddress ? (
          <div className={styles.walletInfo}>
            <span className={styles.address}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button onClick={disconnect} className={styles.disconnectBtn}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className={styles.connectWrap}>
            <button onClick={connect} disabled={connecting} className={styles.connectBtn}>
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
            {walletError && <span className={styles.walletError}>{walletError}</span>}
            {walletAction && (
              <a
                className={styles.walletAction}
                href={walletAction.href}
                onClick={walletAction.onClick}
              >
                {walletAction.label}
              </a>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
