import React from 'react';
// ---- lightweight on‑screen logger ----
(function () {
  const el = document.getElementById('debug-console');
  if (!el) return;
  el.style.display = 'block';
  const oldLog = console.log;
  console.log = function (...args) {
    oldLog(...args);
    el.textContent += args.join(' ') + '\n';
    el.scrollTop = el.scrollHeight;
  };
})();
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import './styles/variables.css';
import './styles/global.css';
import "@solana/wallet-adapter-react-ui/styles.css";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);