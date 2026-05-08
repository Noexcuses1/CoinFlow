import styles from './SignalCard.module.css';

export default function SignalCard({ signal }) {
  const { token, type, wallet, value, timestamp, chain, profit } = signal || {};
  return (
    <div className={`glass-panel ${styles.card}`}>
      <div className={styles.header}>
        <span className={styles.token}>{token || 'SOL'}</span>
        <span className={`${styles.badge} ${type === 'buy' ? styles.buy : styles.sell}`}>
          {type?.toUpperCase() || 'BUY'}
        </span>
      </div>
      <div className={styles.details}>
        <div className={styles.row}>
          <span className={styles.label}>Wallet</span>
          <span className={styles.value}>{wallet || '0x71C...6F3E'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Value</span>
          <span className={styles.value}>{value || '$42,560'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Chain</span>
          <span className={styles.value}>{chain || 'Solana'}</span>
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.time}>{timestamp || '2 min ago'}</span>
        {profit && (
          <span className={`${styles.profit} ${profit >= 0 ? styles.positive : styles.negative}`}>
            {profit > 0 ? '+' : ''}{profit}%
          </span>
        )}
      </div>
    </div>
  );
}