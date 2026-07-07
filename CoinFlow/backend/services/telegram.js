import fetch from 'node-fetch';

let warnedMissingChatId = false;
let warnedMissingBotToken = false;

export function getTerminalChatId() {
  return process.env.TELEGRAM_CHAT_ID || process.env.COINFLOW_TERMINAL_CHAT_ID || null;
}

export async function sendAlert(alert) {
  const chatId = getTerminalChatId();
  if (!chatId) {
    if (!warnedMissingChatId) {
      console.log('Whale terminal disabled: TELEGRAM_CHAT_ID missing');
      warnedMissingChatId = true;
    }
    return false;
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    if (!warnedMissingBotToken) {
      console.log('Whale terminal disabled: TELEGRAM_BOT_TOKEN missing');
      warnedMissingBotToken = true;
    }
    return false;
  }

  const message = buildAlertMessage(alert);
  const replyMarkup = buildAlertReplyMarkup(alert, true);

  try {
    const result = await postTelegramMessage(chatId, message, replyMarkup);
    if (!result.ok && alert.address) {
      const fallbackResult = await postTelegramMessage(chatId, message, buildAlertReplyMarkup(alert, false));
      return Boolean(fallbackResult.ok);
    }
    return Boolean(result.ok);
  } catch (e) {
    console.error('Telegram send error:', e.stack || e.message || e);
    return false;
  }
}

export async function sendTerminalTestMessage() {
  const chatId = getTerminalChatId();
  if (!chatId) {
    return {
      success: false,
      error: 'TELEGRAM_CHAT_ID missing',
    };
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN missing',
    };
  }

  try {
    const result = await postTelegramMessage(chatId, 'CoinFlow terminal test alert ✅');
    return {
      success: Boolean(result.ok),
      status: result.ok ? 'sent' : 'telegram_error',
      error: result.ok ? undefined : result.description || 'Telegram API error',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Telegram send failed',
    };
  }
}

function buildAlertMessage(alert) {
  const symbol = alert.token || alert.symbol || 'Unknown';
  const name = alert.name && alert.name !== symbol ? ` (${alert.name})` : '';
  const lines = [
    `🚨 ${escapeHtml(String(alert.type || 'whale').toUpperCase())} Alert`,
    `Token: ${escapeHtml(symbol)}${escapeHtml(name)}`,
  ];

  if (alert.address) {
    lines.push(`CA: <code>${escapeHtml(alert.address)}</code>`);
  }

  lines.push(
    `Wallet: ${escapeHtml(alert.wallet || 'Unknown')}`,
    `Value: $${Number(alert.value_usd || 0).toLocaleString()}`,
    `Profit: ${escapeHtml(String(alert.profit_percent ?? '0'))}%`
  );

  if (alert.tx_hash) {
    lines.push(`Tx: ${escapeHtml(String(alert.tx_hash).slice(0, 12))}...`);
  }

  return lines.join('\n');
}

function buildAlertReplyMarkup(alert, useCopyText) {
  if (!alert.address) return undefined;

  const copyButton = useCopyText
    ? { text: 'Copy CA', copy_text: { text: alert.address } }
    : { text: 'Copy CA', callback_data: `copy_ca:${alert.address}` };

  return {
    inline_keyboard: [
      [
        copyButton,
        { text: 'Dexscreener', url: `https://dexscreener.com/solana/${alert.address}` },
        { text: 'Birdeye', url: `https://birdeye.so/token/${alert.address}?chain=solana` },
      ],
    ],
  };
}

async function postTelegramMessage(chatId, message, replyMarkup) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
