import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
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
    wallets: availableWallets,
    select,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();    // <-- this opens the modal
  const [walletMessage, setWalletMessage] = useState("");
  const [mobileHelperOpen, setMobileHelperOpen] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const reconnectingRef = useRef(false);

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
    sessionStorage.setItem("coinflow_wallet_connect_pending", "1");
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
      await phantomProvider.connect();
      walletDebugLog("Connected wallet");
      setWalletMessage("");
      setMobileHelperOpen(false);
      setConnectRequested(true);
    } catch (error) {
      const message = normalizeWalletError(error);
      walletDebugLog("Wallet connect failed", message);
      setWalletMessage(message);
    }
  }, []);

  const openPhantomBrowser = useCallback(() => {
    walletDebugLog("Opening Phantom browser/deeplink");
    window.location.href = getPhantomBrowserUrl();
  }, []);

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
        localStorage.setItem("coinflow_selected_wallet", walletName);

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

        if (isPhantom && phantomProvider) {
          walletDebugLog(isMobileBrowser() ? "Provider found" : "Desktop provider found");
          await phantomProvider.connect();
        }

        walletDebugLog("Connecting wallet", walletName);
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
      }
    }

    connectSelectedWallet();
    return () => {
      cancelled = true;
    };
  }, [adapterConnect, adapterConnecting, connectRequested, connected, wallet]);

  const attemptReconnect = useCallback(async () => {
    if (connected || adapterConnecting || reconnectingRef.current) return;

    const pending = sessionStorage.getItem("coinflow_wallet_connect_pending");
    const selectedWallet = localStorage.getItem("coinflow_selected_wallet");
    if (!pending && !selectedWallet) return;

    reconnectingRef.current = true;
    walletDebugLog("Trying trusted reconnect", { selectedWallet });

    try {
      const selectedAdapter = availableWallets.find((item) =>
        item.adapter.name.toLowerCase().includes(String(selectedWallet || "").toLowerCase())
      );

      if (selectedAdapter) {
        select(selectedAdapter.adapter.name);
        await adapterConnect();
        walletDebugLog("Connected wallet", selectedAdapter.adapter.name);
      } else if (window.solana?.isPhantom) {
        walletDebugLog("Desktop provider found");
        await window.solana.connect({ onlyIfTrusted: true });
        walletDebugLog("Connected wallet", "Phantom provider");
      } else {
        walletDebugLog(isMobileBrowser() ? "Mobile provider missing" : "Provider missing");
      }
    } catch (error) {
      walletDebugLog("Wallet connect failed", error.message);
    } finally {
      reconnectingRef.current = false;
      sessionStorage.removeItem("coinflow_wallet_connect_pending");
    }
  }, [adapterConnect, adapterConnecting, availableWallets, connected, select]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_selected_wallet");
    sessionStorage.removeItem("coinflow_wallet_connect_pending");
    setWalletMessage("");
    setMobileHelperOpen(false);
  }, [adapterDisconnect]);

  // Persist address for auto‑reconnect hint
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("coinflow_wallet", walletAddress);
      if (wallet?.adapter?.name) {
        localStorage.setItem("coinflow_selected_wallet", wallet.adapter.name);
      }
      sessionStorage.removeItem("coinflow_wallet_connect_pending");
    } else {
      localStorage.removeItem("coinflow_wallet");
    }
  }, [walletAddress, wallet]);

  useEffect(() => {
    attemptReconnect();
  }, [attemptReconnect]);

  useEffect(() => {
    const handleFocus = () => {
      walletDebugLog("Returning from wallet");
      attemptReconnect();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        walletDebugLog("Returning from wallet");
        attemptReconnect();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attemptReconnect]);

  useEffect(() => {
    const provider = window.solana;
    if (!provider?.on) return undefined;

    const handleProviderConnect = () => {
      walletDebugLog("Connected wallet");
      attemptReconnect();
    };
    const handleProviderDisconnect = () => {
      walletDebugLog("Provider disconnected");
    };
    const handleAccountChanged = () => {
      walletDebugLog("Provider accountChanged");
      attemptReconnect();
    };

    provider.on("connect", handleProviderConnect);
    provider.on("disconnect", handleProviderDisconnect);
    provider.on("accountChanged", handleAccountChanged);

    return () => {
      provider.off?.("connect", handleProviderConnect);
      provider.off?.("disconnect", handleProviderDisconnect);
      provider.off?.("accountChanged", handleAccountChanged);
    };
  }, [attemptReconnect]);

  const value = useMemo(
    () => ({
      walletAddress,
      connecting: adapterConnecting,
      connect,
      disconnect,
      sendTransaction: sendTx,
      walletMessage,
      mobileHelperOpen,
      openPhantomBrowser,
      copyCoinFlowUrl,
      retryConnect,
    }),
    [
      walletAddress,
      adapterConnecting,
      connect,
      disconnect,
      sendTx,
      walletMessage,
      mobileHelperOpen,
      openPhantomBrowser,
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

function getPhantomBrowserUrl() {
  return `phantom://browse/${encodeURIComponent(window.location.href)}`;
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
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppWalletBridge>{children}</AppWalletBridge>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export const useWallet = () => useContext(WalletContext);
