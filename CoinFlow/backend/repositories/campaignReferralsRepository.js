import { query } from '../db/postgres.js';

export async function createReferralIfNeeded(referrerUserId, referredUserId) {
  if (!referrerUserId || !referredUserId || Number(referrerUserId) === Number(referredUserId)) {
    return null;
  }

  const reward = parseInt(process.env.CAMPAIGN_REFERRAL_REWARD_POINTS || '20', 10);
  const res = await query(
    `
      INSERT INTO campaign_referrals (referrer_user_id, referred_user_id, reward_points)
      VALUES ($1, $2, $3)
      ON CONFLICT (referred_user_id) DO NOTHING
      RETURNING *
    `,
    [referrerUserId, referredUserId, reward]
  );
  return res.rows[0] || null;
}

export async function findPendingReferralForReferredUser(referredUserId) {
  const res = await query(
    `
      SELECT *
      FROM campaign_referrals
      WHERE referred_user_id = $1 AND status = 'pending'
    `,
    [referredUserId]
  );
  return res.rows[0] || null;
}

export async function awardReferral(referralId) {
  const res = await query(
    `
      UPDATE campaign_referrals
      SET status = 'awarded', awarded_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `,
    [referralId]
  );
  return res.rows[0] || null;
}

export async function getPendingReferralCount(referrerUserId) {
  const res = await query(
    `
      SELECT COUNT(*)::int AS pending_count
      FROM campaign_referrals
      WHERE referrer_user_id = $1 AND status = 'pending'
    `,
    [referrerUserId]
  );
  return res.rows[0]?.pending_count || 0;
}
