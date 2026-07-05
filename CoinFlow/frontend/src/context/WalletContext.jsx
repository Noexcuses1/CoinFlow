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
import MobileWalletModal from "../components/WalletConnect/MobileWalletModal";
import {
  getWalletDeepLink,
  getWalletInstallUrl,
  isMobileBrowser,
  mobileDebugLog,
} from "../utils/walletDeepLinks";

// ---------- Our custom context (same API as before) ----------
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
    wallets: availableWallets,
    select,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();    // <-- this opens the modal
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileMessage, setMobileMessage] = useState("");
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

    if (isMobileBrowser()) {
      setMobileMessage(
        "After approving in your wallet, return to this browser tab and CoinFlow will reconnect automatically."
      );
      setMobileModalOpen(true);
      return;
    }

    setVisible(true);
  }, [connected, setVisible]);

  const attemptReconnect = useCallback(async () => {
    if (connected || adapterConnecting || reconnectingRef.current) return;

    const pending = sessionStorage.getItem("coinflow_wallet_connect_pending");
    const selectedWallet = localStorage.getItem("coinflow_selected_wallet");
    if (!pending && !selectedWallet) return;

    reconnectingRef.current = true;
    mobileDebugLog("Reconnect attempted", { selectedWallet });

    try {
      const selectedAdapter = availableWallets.find((item) =>
        item.adapter.name.toLowerCase().includes(String(selectedWallet || "").toLowerCase())
      );

      if (selectedAdapter) {
        select(selectedAdapter.adapter.name);
        await selectedAdapter.adapter.connect();
        mobileDebugLog("Provider connected", selectedAdapter.adapter.name);
      } else if (window.solana?.isPhantom) {
        await window.solana.connect({ onlyIfTrusted: true });
        mobileDebugLog("Provider connected", "Phantom provider");
      } else {
        mobileDebugLog("Provider not found");
      }
    } catch (error) {
      mobileDebugLog("Reconnect failed", error.message);
    } finally {
      reconnectingRef.current = false;
      sessionStorage.removeItem("coinflow_wallet_connect_pending");
    }
  }, [adapterConnecting, availableWallets, connected, select]);

  const handleMobileWalletSelect = useCallback(
    async (walletName) => {
      const adapterWallet = availableWallets.find((item) =>
        item.adapter.name.toLowerCase().includes(walletName.toLowerCase())
      );

      mobileDebugLog("Mobile wallet selected", walletName);
      localStorage.setItem("coinflow_selected_wallet", walletName);
      sessionStorage.setItem("coinflow_wallet_connect_pending", "1");

      try {
        if (adapterWallet) {
          select(adapterWallet.adapter.name);
        }

        // Some mobile wallets open an in-app browser instead of returning to the original browser.
        // CoinFlow retries adapter/provider reconnect when the user returns manually.
        const deepLink = getWalletDeepLink(walletName);
        mobileDebugLog("Deep link opened", deepLink);
        setMobileMessage(
          "After approving in your wallet, return to this browser tab and CoinFlow will reconnect automatically."
        );
        window.location.href = deepLink;
      } catch (error) {
        setMobileMessage(error.message || "Wallet connection failed. Please try again.");
      }
    },
    [availableWallets, select]
  );

  const handleInstallWallet = useCallback((walletName) => {
    const installUrl = getWalletInstallUrl(walletName);
    mobileDebugLog("Provider not found", walletName);
    window.location.href = installUrl;
  }, []);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    localStorage.removeItem("coinflow_wallet");
    localStorage.removeItem("coinflow_selected_wallet");
    sessionStorage.removeItem("coinflow_wallet_connect_pending");
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
      mobileDebugLog("Returning from wallet");
      attemptReconnect();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        mobileDebugLog("Returning from wallet");
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
      mobileDebugLog("Provider connected");
      attemptReconnect();
    };
    const handleProviderDisconnect = () => {
      mobileDebugLog("Provider disconnected");
    };
    const handleAccountChanged = () => {
      mobileDebugLog("Provider accountChanged");
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
    }),
    [walletAddress, adapterConnecting, connect, disconnect, sendTx]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <MobileWalletModal
        open={mobileModalOpen}
        message={mobileMessage}
        onClose={() => setMobileModalOpen(false)}
        onSelectWallet={handleMobileWalletSelect}
        onInstallWallet={handleInstallWallet}
      />
    </WalletContext.Provider>
  );
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
