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

  // ---------- Connect (smart) ----------
  const connect = useCallback(async () => {
    if (connected) return;
    // If a wallet is already selected, try to connect silently
    if (wallet) {
      try {
        await wallet.adapter.connect();
        return;                // success – no modal needed
      } catch {}
    }
    // Fallback: open the selector modal
    setVisible(true);
  }, [connected, wallet, setVisible]);

  // ---------- Disconnect ----------
  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_wallet_name");
  }, [adapterDisconnect]);

  // ---------- Persist address & wallet name ----------
  useEffect(() => {
    if (walletAddress && wallet) {
      localStorage.setItem("coinflow_wallet", walletAddress);
      localStorage.setItem("coinflow_wallet_name", wallet.adapter.name);
    } else {
      localStorage.removeItem("coinflow_wallet");
      localStorage.removeItem("coinflow_wallet_name");
    }
  }, [walletAddress, wallet]);

  // ---------- Reconnect after deep link (mobile fix) ----------
  useEffect(() => {
    const attemptReconnect = async () => {
      if (document.visibilityState !== "visible" || connected) return;

      const savedWalletName = localStorage.getItem("coinflow_wallet_name");
      if (!savedWalletName) return;

      // Find the adapter among the registered wallets that is installed
      const installedWallet = wallets.find(
        (w) =>
          w.adapter.name === savedWalletName &&
          w.readyState === "Installed"
      );

      if (installedWallet) {
        try {
          await installedWallet.adapter.connect();
        } catch (err) {
          console.log("Auto‑reconnect failed:", err.message);
        }
      }
    };

    document.addEventListener("visibilitychange", attemptReconnect);
    return () => document.removeEventListener("visibilitychange", attemptReconnect);
  }, [wallets, connected]);

  // ---------- Context value ----------
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

const endpoint = clusterApiUrl("mainnet-beta");

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