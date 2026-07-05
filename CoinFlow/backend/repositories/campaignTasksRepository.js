import { query } from '../db/postgres.js';

export async function listActiveTasks() {
  const res = await query(`
    SELECT *
    FROM campaign_tasks
    WHERE is_active = TRUE
    ORDER BY
      CASE type
        WHEN 'join_terminal_group' THEN 1
        WHEN 'join_telegram_group' THEN 2
        WHEN 'join_telegram_channel' THEN 3
        WHEN 'follow_x' THEN 4
        ELSE 10
      END,
      id ASC
  `);
  return res.rows;
}

export async function listAllTasks() {
  const res = await query('SELECT * FROM campaign_tasks ORDER BY is_active DESC, id ASC');
  return res.rows;
}

export async function findTaskById(taskId) {
  const res = await query('SELECT * FROM campaign_tasks WHERE id = $1', [taskId]);
  return res.rows[0] || null;
}

export async function createTask({
  type = 'x_engagement',
  title,
  description,
  url,
  chatId,
  rewardPoints,
  requiresProof = true,
  autoVerifyProvider = null,
  createdByAdminId,
}) {
  const defaultReward = parseInt(process.env.CAMPAIGN_DEFAULT_TASK_POINTS || '30', 10);
  const res = await query(
    `
      INSERT INTO campaign_tasks (
        type,
        title,
        description,
        url,
        chat_id,
        reward_points,
        requires_proof,
        auto_verify_provider,
        created_by_admin_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      type,
      title,
      description || null,
      url || null,
      chatId || null,
      Number.isFinite(Number(rewardPoints)) ? Number(rewardPoints) : defaultReward,
      requiresProof,
      autoVerifyProvider,
      createdByAdminId,
    ]
  );
  return res.rows[0] || null;
}

export async function updateTaskReward(taskId, rewardPoints) {
  const res = await query(
    `
      UPDATE campaign_tasks
      SET reward_points = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [taskId, rewardPoints]
  );
  return res.rows[0] || null;
}

export async function setTaskActive(taskId, isActive) {
  const res = await query(
    `
      UPDATE campaign_tasks
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [taskId, isActive]
  );
  return res.rows[0] || null;
}
