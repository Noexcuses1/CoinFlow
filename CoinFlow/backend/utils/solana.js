import { PublicKey } from '@solana/web3.js';

export function isValidSolanaAddress(address) {
  try {
    const publicKey = new PublicKey(String(address || '').trim());
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch {
    return false;
  }
}
