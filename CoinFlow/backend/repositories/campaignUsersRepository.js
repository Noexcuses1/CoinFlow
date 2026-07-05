import crypto from 'node:crypto';
import { query } from '../db/postgres.js';
import { createReferralIfNeeded } from './campaignReferralsRepository.js';

export function normalizeXUsername(username) {
  return String(username || '').trim().replace(/^@+/, '').toLowerCase();
}

export async function findUserByTelegramId(telegramId) {
  const res = await query('SELECT * FROM campaign_users WHERE telegram_id = $1', [telegramId]);
  return res.rows[0] || null;
}

export async function findUserByReferralCode(referralCode) {
  const res = await query('SELECT * FROM campaign_users WHERE referral_code = $1', [referralCode]);
  return res.rows[0] || null;
}

export async function findUserByWallet(walletAddress) {
  const res = await query('SELECT * FROM campaign_users WHERE wallet_address = $1', [walletAddress]);
  return res.rows[0] || null;
}

export async function findUserByXUsername(xUsername) {
  const res = await query('SELECT * FROM campaign_users WHERE x_username = $1', [
    normalizeXUsername(xUsername),
  ]);
  return res.rows[0] || null;
}

export async function getOrCreateUser({ telegramId, telegramUsername, referralCode }) {
  const existing = await findUserByTelegramId(telegramId);
  if (existing) {
    return updateTelegramUsername(existing.id, telegramUsername);
  }

  const ownReferralCode = await generateUniqueReferralCode(telegramId);
  let referredBy = null;
  let referrer = null;

  if (referralCode) {
    referrer = await findUserByReferralCode(referralCode);
    if (referrer && String(referrer.telegram_id) !== String(telegramId)) {
      referredBy = referrer.id;
    } else {
      referrer = null;
    }
  }

  const res = await query(
    `
      INSERT INTO campaign_users (telegram_id, telegram_username, referral_code, referred_by_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [telegramId, telegramUsername || null, ownReferralCode, referredBy]
  );

  const user = res.rows[0] || null;
  if (user && referrer) {
    await createReferralIfNeeded(referrer.id, user.id);
  }

  return user;
}

export async function updateTelegramUsername(userId, telegramUsername) {
  const res = await query(
    `
      UPDATE campaign_users
      SET telegram_username = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, telegramUsername || null]
  );
  return res.rows[0] || null;
}

export async function updateWalletAddress(userId, walletAddress) {
  const res = await query(
    `
      UPDATE campaign_users
      SET wallet_address = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, walletAddress]
  );
  return res.rows[0] || null;
}

export async function updateXUsername(userId, xUsername) {
  const normalized = normalizeXUsername(xUsername);
  const res = await query(
    `
      UPDATE campaign_users
      SET x_username = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, normalized]
  );
  return res.rows[0] || null;
}

export async function addUserPoints(userId, points) {
  const res = await query(
    `
      UPDATE campaign_users
      SET points = points + $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, points]
  );
  return res.rows[0] || null;
}

export async function setAirdropAmount(telegramId, amount) {
  const res = await query(
    `
      UPDATE campaign_users
      SET airdrop_amount = $2, verification_status = 'approved', updated_at = NOW()
      WHERE telegram_id = $1
      RETURNING *
    `,
    [telegramId, amount]
  );
  return res.rows[0] || null;
}

export async function getLeaderboard(limit = 10) {
  const res = await query(
    `
      SELECT telegram_id, telegram_username, points, referrals_count
      FROM campaign_users
      ORDER BY points DESC, referrals_count DESC, created_at ASC
      LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

export async function getCampaignStats() {
  const res = await query(`
    SELECT
      COUNT(*)::int AS users_count,
      COUNT(*) FILTER (WHERE wallet_address IS NOT NULL)::int AS wallets_count,
      COUNT(*) FILTER (WHERE x_username IS NOT NULL)::int AS x_usernames_count,
      COALESCE(SUM(points), 0)::int AS total_points,
      COUNT(*) FILTER (WHERE verification_status = 'approved')::int AS approved_users_count
    FROM campaign_users
  `);
  return res.rows[0] || {};
}

export async function listUsersForBroadcast() {
  const res = await query('SELECT telegram_id FROM campaign_users ORDER BY created_at ASC');
  return res.rows;
}

export async function listApprovedUsersForExport() {
  const res = await query(`
    SELECT
      telegram_id,
      telegram_username,
      wallet_address,
      x_username,
      points,
      referrals_count,
      verification_status,
      airdrop_amount,
      created_at
    FROM campaign_users
    WHERE verification_status = 'approved'
    ORDER BY points DESC, created_at ASC
  `);
  return res.rows;
}

export async function flagSuspiciousUser(userId, flag) {
  await query(
    `
      UPDATE campaign_users
      SET suspicious_flags = suspicious_flags || $2::jsonb, updated_at = NOW()
      WHERE id = $1
    `,
    [userId, JSON.stringify([flag])]
  );
}

async function generateUniqueReferralCode(telegramId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `CFW${String(telegramId).slice(-5)}${suffix}`;
    const existing = await findUserByReferralCode(code);
    if (!existing) return code;
  }
  return `CFW${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}
