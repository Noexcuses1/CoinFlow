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

  // ---------- Connect with logging ----------
  const connect = useCallback(() => {
    console.log("🔵 Connect button pressed. Already connected?", connected);
    if (connected) return;
    console.log("🔵 wallet object:", wallet);
    console.log("🔵 wallet?.adapter:", wallet?.adapter);
    console.log("🔵 wallet?.readyState:", wallet?.readyState);
    setVisible(true);
  }, [connected, wallet, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
  }, [adapterDisconnect]);

  useEffect(() => {
    console.log("🟢 connected changed:", connected, "publicKey:", publicKey?.toBase58());
    if (walletAddress && wallet) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress, wallet, connected, publicKey]);

  // Log when page becomes visible (return from wallet)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("👁️ visibility changed. State:", document.visibilityState, "connected:", connected);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connected]);

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

// ---------- Wallets with mobile config ----------
const appUrl = typeof window !== "undefined" ? window.location.origin : "https://coin-flow-eight.vercel.app";
console.log("🔧 appUrl for mobileConfig:", appUrl);

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
console.log("🔧 Phantom adapter created. mobileConfig:", phantomAdapter.mobileConfig);

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
console.log("🔧 Solflare adapter created. mobileConfig:", solflareAdapter.mobileConfig);

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