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

// ---------- Our custom context (same API as before) ----------
const WalletContext = createContext(null);

function AppWalletBridge({ children }) {
  const { connection } = useConnection();
  const {
    publicKey,
    connecting: adapterConnecting,
    connected,
    disconnect: adapterDisconnect,
    connect: adapterConnect,
    sendTransaction,
    wallet,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();    // <-- this opens the modal
  const [walletMessage, setWalletMessage] = useState("");
  const [mobileHelperOpen, setMobileHelperOpen] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const [manualConnecting, setManualConnecting] = useState(false);

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
    setWalletMessage("");
    setMobileHelperOpen(false);
    setConnectRequested(true);
    setVisible(true);
  }, [connected, setVisible]);

  const retryConnect = useCallback(async () => {
    const phantomProvider = window.solana?.isPhantom ? window.solana : null;
    if (!phantomProvider) {
      walletDebugLog("Mobile provider missing");
      setWalletMessage("Mobile wallet detected. To connect, open CoinFlow inside Phantom Browser.");
      setMobileHelperOpen(true);
      return;
    }

    try {
      walletDebugLog("Provider found");
      setManualConnecting(true);
      if (wallet) {
        await adapterConnect();
      } else {
        await phantomProvider.connect();
      }
      walletDebugLog("Connected wallet");
      setWalletMessage("");
      setMobileHelperOpen(false);
    } catch (error) {
      const message = normalizeWalletError(error);
      walletDebugLog("Wallet connect failed", message);
      setWalletMessage(message);
    } finally {
      setManualConnecting(false);
    }
  }, [adapterConnect, wallet]);

  const copyCoinFlowUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setWalletMessage("Now open Phantom → Browser → paste the CoinFlow URL.");
    } catch {
      setWalletMessage(`Copy this URL, then open Phantom → Browser and paste it: ${window.location.href}`);
    }
  }, []);

  useEffect(() => {
    if (!connectRequested || !wallet || connected || adapterConnecting) return;

    let cancelled = false;
    async function connectSelectedWallet() {
      const walletName = wallet.adapter.name;
      const isPhantom = walletName.toLowerCase().includes("phantom");
      const phantomProvider = window.solana?.isPhantom ? window.solana : null;

      try {
        walletDebugLog(`${walletName} selected`);

        if (isPhantom && isMobileBrowser() && !phantomProvider) {
          walletDebugLog("Mobile provider missing");
          setWalletMessage("Mobile wallet detected. To connect, open CoinFlow inside Phantom Browser.");
          setMobileHelperOpen(true);
          setConnectRequested(false);
          return;
        }

        if (isPhantom && !isMobileBrowser() && !phantomProvider) {
          walletDebugLog("Provider missing");
          setWalletMessage("Phantom extension not found. Install Phantom or open CoinFlow in a browser with Phantom enabled.");
          setMobileHelperOpen(false);
          setConnectRequested(false);
          return;
        }

        walletDebugLog("Connecting wallet", walletName);
        setManualConnecting(true);
        await adapterConnect();
        if (!cancelled) {
          walletDebugLog("Connected wallet");
          setWalletMessage("");
          setMobileHelperOpen(false);
          setConnectRequested(false);
        }
      } catch (error) {
        if (!cancelled) {
          const message = normalizeWalletError(error);
          walletDebugLog("Wallet connect failed", message);
          setWalletMessage(message);
          setConnectRequested(false);
        }
      } finally {
        if (!cancelled) {
          setManualConnecting(false);
        }
      }
    }

    connectSelectedWallet();
    return () => {
      cancelled = true;
    };
  }, [adapterConnect, adapterConnecting, connectRequested, connected, wallet]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    setWalletMessage("");
    setMobileHelperOpen(false);
    setConnectRequested(false);
    setManualConnecting(false);
  }, [adapterDisconnect]);

  useEffect(() => {
    localStorage.removeItem("coinflow_selected_wallet");
    sessionStorage.removeItem("coinflow_wallet_connect_pending");
    setConnectRequested(false);
    setManualConnecting(false);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!manualConnecting) return undefined;

    const timeout = window.setTimeout(() => {
      setManualConnecting(false);
      setConnectRequested(false);
      setWalletMessage("Wallet connection timed out. Please try again.");
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, [manualConnecting]);

  const value = useMemo(
    () => ({
      walletAddress,
      connecting: manualConnecting || (connectRequested && adapterConnecting),
      connect,
      disconnect,
      sendTransaction: sendTx,
      walletMessage,
      mobileHelperOpen,
      copyCoinFlowUrl,
      retryConnect,
    }),
    [
      walletAddress,
      adapterConnecting,
      connectRequested,
      manualConnecting,
      connect,
      disconnect,
      sendTx,
      walletMessage,
      mobileHelperOpen,
      copyCoinFlowUrl,
      retryConnect,
    ]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

function walletDebugLog(...args) {
  if (import.meta.env.DEV) {
    console.info("[CoinFlow wallet]", ...args);
  }
}

function normalizeWalletError(error) {
  const message = error?.message || "Wallet connection failed. Please try again.";
  if (/reject/i.test(message)) return "Wallet connection was rejected.";
  if (/not installed|not found|unavailable/i.test(message)) return "Wallet provider unavailable. Install the wallet or try its in-app browser.";
  return message;
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
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <AppWalletBridge>{children}</AppWalletBridge>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export const useWallet = () => useContext(WalletContext);
