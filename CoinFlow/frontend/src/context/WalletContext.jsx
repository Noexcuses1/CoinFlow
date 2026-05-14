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
import {
  PhantomWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// ---------- Custom context ----------
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
    wallets,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();

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

  // Connect → open modal
  const connect = useCallback(() => {
    if (connected) return;
    setVisible(true);
  }, [connected, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_wallet_name");
  }, [adapterDisconnect]);

  // Persist address and wallet name
  useEffect(() => {
    if (walletAddress && wallet) {
      localStorage.setItem("coinflow_wallet", walletAddress);
      localStorage.setItem("coinflow_wallet_name", wallet.adapter.name);
    } else {
      localStorage.removeItem("coinflow_wallet");
      localStorage.removeItem("coinflow_wallet_name");
    }
  }, [walletAddress, wallet]);

  // ---- Mobile deep‑link return handler (no extra package needed) ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Phantom mobile callback params
    const phantomKey = params.get("phantom_encryption_public_key");
    const phantomNonce = params.get("nonce");
    // Solflare / generic mobile wallet adapter params
    const solflareAuthToken = params.get("auth_token");
    const solflareCluster = params.get("cluster");

    const isCallback =
      (phantomKey && phantomNonce) || solflareAuthToken;

    if (!isCallback || connected) return;

    // Try to reconnect using the selected wallet (or any installed wallet)
    const attemptReconnect = async () => {
      const savedName = localStorage.getItem("coinflow_wallet_name");
      const candidate = wallets.find(
        (w) =>
          (savedName ? w.adapter.name === savedName : true) &&
          w.readyState === "Installed"
      );
      if (candidate) {
        try {
          await candidate.adapter.connect();
        } catch (err) {
          console.log("Reconnect from callback failed:", err.message);
        }
      }
    };

    attemptReconnect();
  }, [wallets, connected]);

  // Visibility change reconnection (fallback for when user returns manually)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || connected) return;
      const savedName = localStorage.getItem("coinflow_wallet_name");
      const installed = wallets.find(
        (w) =>
          w.adapter.name === savedName &&
          w.readyState === "Installed"
      );
      if (installed) {
        try {
          await installed.adapter.connect();
        } catch (err) {
          console.log("Visibility reconnect failed:", err.message);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [wallets, connected]);

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

const endpoint = process.env.QUICKNODE_RPC_URL || clusterApiUrl("mainnet-beta");

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