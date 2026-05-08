import { useState } from "react";
import styles from "./Trade.module.css";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Trade() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!tokenAddress.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/token/${tokenAddress}`);
      const data = await res.json();
      setTokenInfo(data);
    } catch (e) {
      alert("Unable to load token info");
    } finally {
      setLoading(false);
    }
  };

  const handleTrade = async (side) => {
    await fetch(`${API_URL}/api/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenAddress,
        amount: 1,
        side,
        wallet: "0xYourWallet",
      }),
    });
    alert(`${side} order placed (simulated)`);
  };

  return (
    <div className={styles.trade}>
      <h1>Trade Terminal</h1>
      <div className={styles.searchBox}>
        <input
          placeholder="Token address (e.g. So111...)"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Loading..." : "Load Token"}
        </button>
      </div>
      <div className={`glass-panel ${styles.chart}`}>
        <div className={styles.chartHeader}>
          <span>📈 Price Chart</span>
          <span className={styles.chartMuted}>SOL/USD</span>
        </div>
        <div className={styles.chartBody}>
          <div className={styles.chartPlaceholder}>
            <span className={styles.chartLine} />
            <span className={styles.chartLineShort} />
            <span className={styles.chartLine} />
            <span className={styles.chartLineShort} />
            <span className={styles.chartLine} />
          </div>
          <span className={styles.chartLabel}>Live chart coming soon</span>
        </div>
      </div>
      {tokenInfo && (
        <div
          className="glass-panel"
          style={{ padding: "16px", marginTop: "16px" }}
        >
          <h2>
            {tokenInfo.symbol} - {tokenInfo.name}
          </h2>
          <p>Price: ${tokenInfo.price}</p>
          <p>24h Change: {tokenInfo.price_change_24h}%</p>
          <div style={{ marginTop: "12px", display: "flex", gap: "12px" }}>
            <button className="glass-panel" onClick={() => handleTrade("buy")}>
              Buy
            </button>
            <button className="glass-panel" onClick={() => handleTrade("sell")}>
              Sell
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
