const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod|Mobile/i;

export function isMobileBrowser() {
  return MOBILE_USER_AGENT.test(navigator.userAgent || '');
}

export function getReturnUrl() {
  return window.location.href;
}

export function getWalletDeepLink(walletName, returnUrl = getReturnUrl()) {
  const encodedReturnUrl = encodeURIComponent(returnUrl);
  const encodedOrigin = encodeURIComponent(window.location.origin);
  const normalized = String(walletName || '').toLowerCase();

  if (normalized.includes('phantom')) {
    return `https://phantom.app/ul/browse/${encodedReturnUrl}?ref=${encodedOrigin}`;
  }

  if (normalized.includes('solflare')) {
    return `https://solflare.com/ul/v1/browse/${encodedReturnUrl}?ref=${encodedOrigin}`;
  }

  if (normalized.includes('backpack')) {
    return `https://backpack.app/ul/browse/${encodedReturnUrl}`;
  }

  return returnUrl;
}

export function getWalletInstallUrl(walletName) {
  const normalized = String(walletName || '').toLowerCase();
  if (normalized.includes('phantom')) return 'https://phantom.app/download';
  if (normalized.includes('solflare')) return 'https://solflare.com/download';
  if (normalized.includes('backpack')) return 'https://backpack.app/download';
  return 'https://solana.com/ecosystem/explore?categories=wallet';
}

export function mobileDebugLog(...args) {
  if (import.meta.env.DEV) {
    console.info('[CoinFlow wallet]', ...args);
  }
}
