import { query } from '../db/postgres.js';
import { addUserPoints } from './campaignUsersRepository.js';

export async function findCompletionById(completionId) {
  const res = await query(
    `
      SELECT
        c.*,
        u.telegram_id,
        u.telegram_username,
        u.wallet_address,
        u.x_username,
        t.title,
        t.reward_points
      FROM campaign_task_completions c
      JOIN campaign_users u ON u.id = c.user_id
      JOIN campaign_tasks t ON t.id = c.task_id
      WHERE c.id = $1
    `,
    [completionId]
  );
  return res.rows[0] || null;
}

export async function findCompletionForUserTask(userId, taskId) {
  const res = await query(
    'SELECT * FROM campaign_task_completions WHERE user_id = $1 AND task_id = $2',
    [userId, taskId]
  );
  return res.rows[0] || null;
}

export async function submitTaskProof({ userId, taskId, proofText, proofFileId }) {
  const res = await query(
    `
      INSERT INTO campaign_task_completions (user_id, task_id, proof_text, proof_file_id, status)
      VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (user_id, task_id)
      DO UPDATE SET
        proof_text = EXCLUDED.proof_text,
        proof_file_id = EXCLUDED.proof_file_id,
        status = 'pending',
        reviewed_by_admin_id = NULL,
        reviewed_at = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [userId, taskId, proofText || null, proofFileId || null]
  );
  return res.rows[0] || null;
}

export async function listPendingCompletions(limit = 10) {
  const res = await query(
    `
      SELECT
        c.id,
        c.status,
        c.proof_text,
        c.proof_file_id,
        c.created_at,
        u.telegram_id,
        u.telegram_username,
        t.title,
        t.reward_points
      FROM campaign_task_completions c
      JOIN campaign_users u ON u.id = c.user_id
      JOIN campaign_tasks t ON t.id = c.task_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC
      LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

export async function approveCompletion(completionId, adminTelegramId) {
  const completion = await findCompletionById(completionId);
  if (!completion || completion.status === 'approved') return completion;

  const res = await query(
    `
      UPDATE campaign_task_completions
      SET status = 'approved', reviewed_by_admin_id = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status != 'approved'
      RETURNING *
    `,
    [completionId, adminTelegramId]
  );

  if (!res.rows[0]) return null;

  await addUserPoints(completion.user_id, completion.reward_points);
  return findCompletionById(completionId);
}

export async function rejectCompletion(completionId, adminTelegramId) {
  const res = await query(
    `
      UPDATE campaign_task_completions
      SET status = 'rejected', reviewed_by_admin_id = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [completionId, adminTelegramId]
  );
  return res.rows[0] || null;
}

export async function approveTaskForUser({ userId, taskId, reviewerId = null, proofText = null }) {
  const existing = await findCompletionForUserTask(userId, taskId);
  if (existing?.status === 'approved') {
    return { completion: existing, awarded: false };
  }

  const taskRes = await query('SELECT reward_points FROM campaign_tasks WHERE id = $1', [taskId]);
  const task = taskRes.rows[0];
  if (!task) return { completion: null, awarded: false };

  const res = await query(
    `
      INSERT INTO campaign_task_completions (
        user_id,
        task_id,
        status,
        proof_text,
        reviewed_by_admin_id,
        reviewed_at,
        updated_at
      )
      VALUES ($1, $2, 'approved', $3, $4, NOW(), NOW())
      ON CONFLICT (user_id, task_id)
      DO UPDATE SET
        status = 'approved',
        proof_text = COALESCE(EXCLUDED.proof_text, campaign_task_completions.proof_text),
        reviewed_by_admin_id = EXCLUDED.reviewed_by_admin_id,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE campaign_task_completions.status != 'approved'
      RETURNING *
    `,
    [userId, taskId, proofText, reviewerId]
  );

  if (!res.rows[0]) {
    return { completion: existing, awarded: false };
  }

  await addUserPoints(userId, task.reward_points);
  return { completion: res.rows[0], awarded: true };
}

export async function hasApprovedTask(userId) {
  const res = await query(
    `
      SELECT 1
      FROM campaign_task_completions
      WHERE user_id = $1 AND status = 'approved'
      LIMIT 1
    `,
    [userId]
  );
  return res.rows.length > 0;
}
