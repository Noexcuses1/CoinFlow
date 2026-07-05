import styles from './MobileWalletModal.module.css';

const WALLET_OPTIONS = ['Phantom', 'Solflare', 'Backpack'];

export default function MobileWalletModal({
  open,
  message,
  onClose,
  onSelectWallet,
  onInstallWallet,
}) {
  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>Connect Wallet</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.walletList}>
          {WALLET_OPTIONS.map((walletName) => (
            <div className={styles.walletRow} key={walletName}>
              <button type="button" className={styles.walletBtn} onClick={() => onSelectWallet(walletName)}>
                {walletName}
              </button>
              <button type="button" className={styles.installBtn} onClick={() => onInstallWallet(walletName)}>
                Install
              </button>
            </div>
          ))}
        </div>

        <p className={styles.message}>
          {message || 'After approving in your wallet, return to this browser tab and CoinFlow will reconnect automatically.'}
        </p>
      </div>
    </div>
  );
}
