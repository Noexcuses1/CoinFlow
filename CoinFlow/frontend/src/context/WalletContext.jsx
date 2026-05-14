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
  SolflareWalletAdapter,
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
    select,
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

  // ---------- Smart Connect (mobile deep‑link aware) ----------
  const connect = useCallback(async () => {
    if (connected) return;

    // On mobile: force native wallet app via deep‑link
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isMobile) {
      // Try to open the wallet app directly
      const adapter = wallet?.adapter || null;
      if (adapter) {
        try {
          await adapter.connect();
          return;
        } catch {
          // fallback to modal
        }
      }
      // If no wallet selected, open modal to let user pick
      setVisible(true);
      return;
    }

    // Desktop: just open modal
    setVisible(true);
  }, [connected, wallet, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_wallet_name");
  }, [adapterDisconnect]);

  // Persist address & wallet name
  useEffect(() => {
    if (walletAddress && wallet) {
      localStorage.setItem("coinflow_wallet", walletAddress);
      localStorage.setItem("coinflow_wallet_name", wallet.adapter.name);
    } else {
      localStorage.removeItem("coinflow_wallet");
      localStorage.removeItem("coinflow_wallet_name");
    }
  }, [walletAddress, wallet]);

  // ---- Reconnect on page load (for mobile wallet callback) ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCallback =
      params.has("phantom_encryption_public_key") ||
      params.has("auth_token") ||
      params.has("wallet_redirect");

    if (!isCallback || connected) return;

    // Give wallet adapters a moment to detect injected scripts
    const timer = setTimeout(async () => {
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
          console.log("Callback reconnect failed:", err.message);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [wallets, connected]);

  // ---- Reconnect when app becomes visible again (mobile return) ----
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

// ---------- All supported wallets ----------
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
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