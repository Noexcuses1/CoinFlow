import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCopy, FiExternalLink, FiCheck } from 'react-icons/fi';
import { useWallet } from '../context/WalletContext';
import styles from './Wallet.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Wallet() {
  const { address: paramAddress } = useParams();
  const { walletAddress, connect } = useWallet();
  const navigate = useNavigate();

  const effectiveAddress =
    paramAddress && paramAddress !== 'demo' ? paramAddress : walletAddress;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (walletAddress && (!paramAddress || paramAddress === 'demo')) {
      navigate(`/wallet/${walletAddress}`, { replace: true });
    }
  }, [walletAddress, paramAddress, navigate]);

  const copyAddress = async () => {
    if (effectiveAddress) {
      await navigator.clipboard.writeText(effectiveAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // ---- CONNECT WALLET STATE ----
  if (!walletAddress) {
    return (
      <div className={styles.wallet}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👛</div>
          <h1>Wallet</h1>
          <p>Connect your Solana wallet to view your portfolio, tokens, and recent activity.</p>
          <button onClick={connect} className={styles.connectBtn}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className={styles.wallet}>
        <div className={styles.header}>
          <h1>Wallet</h1>
          <div className={`${styles.addressBadge} ${styles.skeleton}`} />
        </div>
        <div className={`${styles.balanceCard} ${styles.skeleton}`} />
        <div className={styles.tokenList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${styles.tokenRow} ${styles.skeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  // ---- ERROR / NO DATA STATE ----
  if (!data) {
    return (
      <div className={styles.wallet}>
        <h1>Wallet</h1>
        <p className={styles.error}>Unable to load wallet data. The Solana network may be congested.</p>
      </div>
    );
  }

  const solBalance = data.solBalance ?? 0;
  const tokens = data.portfolio || data.tokens || [];

  return (
    <div className={styles.wallet}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Wallet</h1>
        <div className={styles.addressBadge} onClick={copyAddress} title="Click to copy">
          <span className={styles.addressText}>
            {effectiveAddress.slice(0, 6)}...{effectiveAddress.slice(-4)}
          </span>
          <button className={styles.copyBtn}>
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
          </button>
          <a
            href={`https://solscan.io/account/${effectiveAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.explorerLink}
            onClick={(e) => e.stopPropagation()}
          >
            <FiExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* SOL Balance Card */}
      <div className={styles.balanceCard}>
        <span className={styles.muted}>Total SOL Balance</span>
        <h2>{solBalance.toFixed(4)} SOL</h2>
        <span className={styles.muted}>
          ≈ ${(solBalance * 140).toFixed(2)} USD
        </span>
      </div>

      {/* Token Holdings */}
      <h3>Token Holdings</h3>
      {tokens.length > 0 ? (
        <div className={styles.tokenList}>
          {tokens.map((item, i) => (
            <div key={i} className={styles.tokenRow}>
              <div className={styles.tokenInfo}>
                <div className={styles.tokenSymbol}>
                  {item.symbol || item.mint?.slice(0, 8) || '???'}
                </div>
                <div className={styles.tokenMint}>
                  {item.address || item.mint
                    ? `${(item.address || item.mint).slice(0, 6)}...${(
                        item.address || item.mint
                      ).slice(-4)}`
                    : ''}
                </div>
              </div>
              <div className={styles.tokenBalance}>
                <div className={styles.tokenAmount}>
                  {(item.uiAmount || item.amount || 0).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </div>
                {item.valueUsd && (
                  <div className={styles.tokenUsd}>${item.valueUsd.toFixed(2)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>No token holdings found. Buy some tokens to get started.</p>
      )}
    </div>
  );
}