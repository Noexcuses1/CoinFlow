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
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// ---------- Our custom context (same API as before) ----------
const WalletContext = createContext(null);

function AppWalletBridge({ children }) {
  const {
    publicKey,
    connecting: adapterConnecting,
    connected,
    disconnect: adapterDisconnect,
    select,
    wallet,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();    // <-- this opens the modal

  const walletAddress = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey]
  );

  // Connect → open wallet selector modal
  const connect = useCallback(() => {
    // If already connected, do nothing
    if (connected) return;
    // If no wallet selected yet, open the modal for user to pick
    if (!wallet) {
      setVisible(true);
      return;
    }
    // If a wallet is already selected but not connected, the modal will handle it
    setVisible(true);
    // Alternatively, we could call wallet.adapter.connect() directly,
    // but the modal provides the consistent UI.
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

  const value = useMemo(
    () => ({
      walletAddress,
      connecting: adapterConnecting,
      connect,
      disconnect,
    }),
    [walletAddress, adapterConnecting, connect, disconnect]
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
  new SolflareWalletAdapter(),
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