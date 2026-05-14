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
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapterWalletName,
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
    wallet,
    connect: adapterConnect,
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

  // Detect platform
  const isAndroid = useMemo(
    () => /Android/i.test(navigator.userAgent),
    []
  );

  // ---------- Smart connect (fix from Issue #1086) ----------
  const connect = useCallback(async () => {
    if (connected) return;

    if (isAndroid && wallet?.adapter.name === SolanaMobileWalletAdapterWalletName) {
      // ★ Key fix: MWA is stuck as selected wallet, so call connect() directly
      try {
        await adapterConnect();
        return;
      } catch (err) {
        console.log("MWA direct connect failed, falling back to modal:", err.message);
      }
    }

    // Desktop or iOS: show the wallet selector modal
    setVisible(true);
  }, [connected, isAndroid, wallet, adapterConnect, setVisible]);

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

  // ---- Reconnect when returning from wallet app (Android only) ----
  useEffect(() => {
    if (!isAndroid || connected) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !connected) {
        adapterConnect().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isAndroid, connected, adapterConnect]);

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

// ---------- Wallet list (platform-aware) ----------
const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://coin-flow-eight.vercel.app";

const isAndroid =
  typeof window !== "undefined" && /Android/i.test(navigator.userAgent);

const wallets = useMemo(() => {
  if (isAndroid) {
    // Android: ONLY the Mobile Wallet Adapter (official docs pattern)
    return [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: "CoinFlow",
          uri: appUrl,
          icon: `${appUrl}/IMG_8128.jpg`,
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: "mainnet-beta",
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
    ];
  }
  // Desktop & iOS: standard wallet adapters
  return [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
    new LedgerWalletAdapter(),
  ];
}, [isAndroid, appUrl]);

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