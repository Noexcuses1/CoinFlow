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

  // ---------- Smart Connect ----------
  const connect = useCallback(async () => {
    if (connected) return;
    // If we have a previously saved wallet name, try to select & connect it silently
    const savedWalletName = localStorage.getItem("coinflow_wallet_name");
    if (savedWalletName && !wallet) {
      // Find the adapter among the configured wallets
      const found = wallets.find(
        (w) => w.adapter.name === savedWalletName
      );
      if (found) {
        select(found.adapter.name);
        try {
          // Small delay for adapter to initialise
          await new Promise((r) => setTimeout(r, 300));
          await found.adapter.connect();
          return;
        } catch (e) {
          // silent fail – fall through to modal
        }
      }
    }
    // If still not connected, open the modal
    setVisible(true);
  }, [connected, wallet, wallets, select, setVisible]);

  // ---------- Disconnect ----------
  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_wallet_name");
  }, [adapterDisconnect]);

  // ---------- Persist wallet info ----------
  useEffect(() => {
    if (walletAddress && wallet) {
      localStorage.setItem("coinflow_wallet", walletAddress);
      localStorage.setItem("coinflow_wallet_name", wallet.adapter.name);
    } else {
      localStorage.removeItem("coinflow_wallet");
      localStorage.removeItem("coinflow_wallet_name");
    }
  }, [walletAddress, wallet]);

  // ---------- Deep‑link reconnection ----------
  useEffect(() => {
    const attemptReconnect = async () => {
      if (connected || document.visibilityState !== "visible") return;
      const savedWalletName = localStorage.getItem("coinflow_wallet_name");
      if (!savedWalletName) return;

      // Find the installed adapter
      const installedWallet = wallets.find(
        (w) =>
          w.adapter.name === savedWalletName &&
          w.readyState === "Installed"
      );
      if (!installedWallet) return;

      // Select it to re‑initialise the adapter
      select(installedWallet.adapter.name);
      // Give the adapter a moment
      await new Promise((r) => setTimeout(r, 500));
      try {
        await installedWallet.adapter.connect();
      } catch (err) {
        console.log("Auto‑reconnect failed, tap Connect again if needed.");
      }
    };

    document.addEventListener("visibilitychange", attemptReconnect);
    // Also try once when component mounts (page reload after deep link)
    attemptReconnect();

    return () => document.removeEventListener("visibilitychange", attemptReconnect);
  }, [wallets, connected, select]);

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