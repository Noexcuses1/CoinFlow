import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Check if already connected on mount
  useEffect(() => {
    const saved = localStorage.getItem('coinflow_wallet');
    if (saved) setWalletAddress(saved);
  }, []);

  const connect = useCallback(async () => {
    if (!window.solana) {
      alert('Solana wallet not found. Install Phantom or Solflare.');
      return;
    }
    setConnecting(true);
    try {
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      localStorage.setItem('coinflow_wallet', address);
    } catch (err) {
      console.error('Wallet connect error', err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (window.solana?.disconnect) window.solana.disconnect();
    setWalletAddress(null);
    localStorage.removeItem('coinflow_wallet');
  }, []);

  return (
    <WalletContext.Provider value={{ walletAddress, connecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);