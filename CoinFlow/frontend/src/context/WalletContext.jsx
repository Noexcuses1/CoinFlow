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

  const connect = useCallback(() => {
    if (connected) return;
    setVisible(true);
  }, [connected, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
  }, [adapterDisconnect]);

  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress]);

  // ---- Reconnect when returning from wallet app (deep link) ----
  useEffect(() => {
    if (connected) return;
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (!isMobile) return;

    // Wait a moment for wallet scripts to inject
    const timer = setTimeout(() => {
      const installed = wallets.find(
        (w) => w.readyState === "Installed"
      );
      if (installed) {
        try {
          installed.adapter.connect().catch(() => {});
        } catch {}
      }
    }, 600);
    return () => clearTimeout(timer);
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

// ---------- Wallet adapters with mobile deep‑link config ----------
const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://coin-flow-eight.vercel.app";

const phantomAdapter = new PhantomWalletAdapter({
  mobileConfig: {
    appIdentity: {
      name: "CoinFlow",
      uri: appUrl,
      icon: `${appUrl}/IMG_8128.jpg`,
    },
    cluster: "mainnet-beta",
    redirectUri: appUrl,
  },
});

const solflareAdapter = new SolflareWalletAdapter({
  mobileConfig: {
    appIdentity: {
      name: "CoinFlow",
      uri: appUrl,
      icon: `${appUrl}/IMG_8128.jpg`,
    },
    cluster: "mainnet-beta",
    redirectUri: appUrl,
  },
});

const wallets = [
  phantomAdapter,
  solflareAdapter,
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