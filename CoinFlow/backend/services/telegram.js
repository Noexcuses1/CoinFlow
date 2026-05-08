import fetch from 'node-fetch';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendAlert(alert) {
  if (!process.env.TELEGRAM_CHAT_ID) return;
  const message = `🚨 ${alert.type.toUpperCase()} Alert\nToken: ${alert.token}\nWallet: ${alert.wallet}\nValue: $${alert.value_usd}\nProfit: ${alert.profit_percent}%\nTx: ${alert.tx_hash?.slice(0,10)}...`;
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Telegram send error', e);
  }
}