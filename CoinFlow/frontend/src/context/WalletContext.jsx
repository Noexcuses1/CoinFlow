import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
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
  } = useSolanaWallet();
  const { setVisible } = useWalletModal();

  const [mobileConnecting, setMobileConnecting] = useState(false);

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

  // Save deep‑link info before leaving page
  const mobileDeepLink = useCallback(() => {
    const appUrl = window.location.origin;
    const redirectUri = encodeURIComponent(`${appUrl}?wallet_connected=true`);
    localStorage.setItem("coinflow_pending_connect", "true");
    // Phantom universal link (opens app or fallback to store)
    window.location.href = `https://phantom.app/ul/v1/connect?app_url=${redirectUri}&dapp=${encodeURIComponent(
      appUrl
    )}`;
  }, []);

  // ---------- Connect ----------
  const connect = useCallback(() => {
    if (connected) return;
    if (isMobile) {
      setMobileConnecting(true);
      mobileDeepLink();
    } else {
      setVisible(true);
    }
  }, [connected, isMobile, mobileDeepLink, setVisible]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_pending_connect");
  }, [adapterDisconnect]);

  // Persist address
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress]);

  // ---- Handle return from mobile wallet ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isConnected = params.get("wallet_connected") === "true";
    const pending = localStorage.getItem("coinflow_pending_connect") === "true";

    if (isConnected && pending && isMobile && !connected) {
      // The wallet redirected back — now try to connect via the adapter
      localStorage.removeItem("coinflow_pending_connect");
      setMobileConnecting(false);
      // Give the wallet adapter a moment to detect the injected script
      setTimeout(() => {
        if (!connected) {
          // Fallback: ask user to approve again via the modal
          setVisible(true);
        }
      }, 500);
    }
  }, [isMobile, connected, setVisible]);

  const value = useMemo(
    () => ({
      walletAddress,
      connecting: adapterConnecting || mobileConnecting,
      connect,
      disconnect,
      sendTransaction: sendTx,
    }),
    [
      walletAddress,
      adapterConnecting,
      mobileConnecting,
      connect,
      disconnect,
      sendTx,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// ---------- Wallet list (desktop only) ----------
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
