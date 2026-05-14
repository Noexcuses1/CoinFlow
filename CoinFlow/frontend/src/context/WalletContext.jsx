import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useRef,
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
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";
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
    connect: adapterConnect,
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

  // Detect mobile
  const isMobile = useMemo(
    () =>
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia("(display-mode: standalone)").matches,
    []
  );

  // ---------- Connect ----------
  const connect = useCallback(() => {
    if (connected) return;
    setVisible(true);
  }, [connected, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
  }, [adapterDisconnect]);

  // Persist address
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress]);

  // ---- Reconnect when returning from wallet app ----
  const initialLoad = useRef(true);
  useEffect(() => {
    if (!isMobile || !initialLoad.current) return;
    initialLoad.current = false;

    // Check if we came back from a wallet redirect
    const params = new URLSearchParams(window.location.search);
    const isCallback =
      params.has("phantom_encryption_public_key") ||
      params.has("auth_token") ||
      params.has("wallet_redirect");

    if (isCallback && !connected) {
      const timer = setTimeout(() => {
        adapterConnect().catch(() => {});
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isMobile, connected, adapterConnect]);

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
const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://coin-flow-eight.vercel.app";

const mobileWalletAdapter = new SolanaMobileWalletAdapter({
  addressSelector: createDefaultAddressSelector(),
  appIdentity: {
    name: "CoinFlow",
    uri: appUrl,
    icon: `${appUrl}/IMG_8128.jpg`,
  },
  authorizationResultCache: createDefaultAuthorizationResultCache(),
  cluster: "mainnet-beta",
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
});

const wallets = [mobileWalletAdapter, new PhantomWalletAdapter()];

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