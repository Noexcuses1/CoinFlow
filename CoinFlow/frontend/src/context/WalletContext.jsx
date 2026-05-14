import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
useConnection,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, TorusWalletAdapter, LedgerWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// ---------- Our custom context (same API as before) ----------
const WalletContext = createContext(null);

function AppWalletBridge({ children }) {
  const { connection } = useConnection();
  const {
    publicKey,
    connecting: adapterConnecting,
    connected,
    disconnect: adapterDisconnect,
    sendTransaction,
    wallet,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();    // <-- this opens the modal

  const walletAddress = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey]
  );
  const sendTx = useCallback(
    async (transaction) => {
      return await sendTransaction(transaction, connection);
    },
    [sendTransaction, connection]
  );
  // Connect → try silent reconnect first, then open modal
  const connect = useCallback(async () => {
    if (connected) return;
    if (wallet) {
      // Already selected – try to connect directly (fixes mobile return)
      try {
        await wallet.adapter.connect();
        return;                     // success – modal not needed
      } catch {}
    }
    setVisible(true);              // fallback: open the modal
  }, [connected, wallet, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
  }, [adapterDisconnect]);

  // Persist address for auto‑reconnect hint
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress]);
    // Reconnect when the user comes back from the wallet app (mobile deep link fix)
    useEffect(() => {
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible' && wallet && !connected) {
          try {
            await wallet.adapter.connect();
          } catch (err) {
            console.log('Auto‑reconnect failed – user may need to tap Connect again.', err.message);
          }
        }
      };
  
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [wallet, connected]);

  const value = useMemo(
    () => ({
      walletAddress,
      connecting: adapterConnecting,
      connect,
      disconnect,
      sendTransaction: sendTx,
    }),
    [walletAddress, adapterConnecting, connect, disconnect, sendTx]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// ---------- Wallet list ----------
const wallets = [
  new PhantomWalletAdapter(),
  new TorusWalletAdapter(),
  new LedgerWalletAdapter(),
];

// Use mainnet-beta – replace with your RPC if needed
const endpoint = clusterApiUrl("mainnet-beta");

// ---------- Top‑level provider ----------
export function WalletProvider({ children }) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppWalletBridge>{children}</AppWalletBridge>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export const useWallet = () => useContext(WalletContext);