import { query } from '../db/postgres.js';
import { flagSuspiciousUser } from '../repositories/campaignUsersRepository.js';
import { hasApprovedTask } from '../repositories/campaignProofsRepository.js';
import {
  awardReferral,
  findPendingReferralForReferredUser,
  getPendingReferralCount,
} from '../repositories/campaignReferralsRepository.js';

export async function maybeAwardReferralForUser(userId) {
  const userRes = await query('SELECT * FROM campaign_users WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user || !user.wallet_address || !user.x_username) return null;

  const completedApprovedTask = await hasApprovedTask(userId);
  if (!completedApprovedTask) return null;

  await query(
    `
      UPDATE campaign_users
      SET verification_status = 'approved', updated_at = NOW()
      WHERE id = $1 AND verification_status != 'approved'
    `,
    [userId]
  );

  const referral = await findPendingReferralForReferredUser(userId);
  if (!referral) return null;

  const awarded = await awardReferral(referral.id);
  if (!awarded) return null;

  await query(
    `
      UPDATE campaign_users
      SET
        points = points + $2,
        referrals_count = referrals_count + 1,
        updated_at = NOW()
      WHERE id = $1
    `,
    [referral.referrer_user_id, referral.reward_points]
  );

  await flagSuspiciousReferralActivity(referral.referrer_user_id);
  return awarded;
}

export async function flagSuspiciousReferralActivity(referrerUserId) {
  const pendingCount = await getPendingReferralCount(referrerUserId);
  if (pendingCount >= 25) {
    await flagSuspiciousUser(referrerUserId, {
      type: 'high_pending_referrals',
      pendingCount,
      flaggedAt: new Date().toISOString(),
    });
  }
}

export function isSelfReferral(referrer, telegramId) {
  return referrer && String(referrer.telegram_id) === String(telegramId);
}
