import { isDatabaseConfigured, query } from './postgres.js';

export async function initializeCampaignSchema() {
  if (!isDatabaseConfigured()) {
    console.log('Campaign schema skipped: DATABASE_URL missing');
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS campaign_users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      telegram_username VARCHAR(255),
      referral_code VARCHAR(32) UNIQUE NOT NULL,
      referred_by_user_id INTEGER,
      referrals_count INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      wallet_address VARCHAR(64) UNIQUE,
      x_username VARCHAR(255) UNIQUE,
      verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      airdrop_amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
      suspicious_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_tasks (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      url TEXT,
      chat_id TEXT,
      reward_points INTEGER NOT NULL DEFAULT 30,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      requires_proof BOOLEAN NOT NULL DEFAULT TRUE,
      auto_verify_provider VARCHAR(50),
      created_by_admin_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_task_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES campaign_users(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES campaign_tasks(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      proof_text TEXT,
      proof_file_id TEXT,
      reviewed_by_admin_id BIGINT,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, task_id)
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_referrals (
      id SERIAL PRIMARY KEY,
      referrer_user_id INTEGER NOT NULL REFERENCES campaign_users(id) ON DELETE CASCADE,
      referred_user_id INTEGER UNIQUE NOT NULL REFERENCES campaign_users(id) ON DELETE CASCADE,
      reward_points INTEGER NOT NULL DEFAULT 20,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      awarded_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE campaign_users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER`,
    `ALTER TABLE campaign_tasks ADD COLUMN IF NOT EXISTS chat_id TEXT`,
    `ALTER TABLE campaign_tasks ADD COLUMN IF NOT EXISTS auto_verify_provider VARCHAR(50)`,
    `ALTER TABLE campaign_task_completions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`,
    `ALTER TABLE campaign_referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`,
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'campaign_users'
          AND column_name = 'referred_by'
      ) THEN
        EXECUTE '
          UPDATE campaign_users u
          SET referred_by_user_id = referrer.id
          FROM campaign_users referrer
          WHERE u.referred_by_user_id IS NULL
            AND referrer.telegram_id = u.referred_by
        ';
      END IF;
    END $$`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_users_telegram_id ON campaign_users(telegram_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_users_referral_code ON campaign_users(referral_code)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_task_completions_status ON campaign_task_completions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_referrals_status ON campaign_referrals(status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_tasks_type_unique ON campaign_tasks(type)`,
  ];

  for (const statement of statements) {
    await query(statement);
  }

  await seedFixedCampaignTasks();
}

async function seedFixedCampaignTasks() {
  const configuredReward = Number.parseInt(process.env.CAMPAIGN_DEFAULT_TASK_POINTS || '30', 10);
  const defaultReward = Number.isFinite(configuredReward) ? configuredReward : 30;
  const tasks = [
    {
      type: 'join_terminal_group',
      title: 'Join CoinFlow Terminal group',
      description: 'Join the CoinFlow Terminal / whale simulator group and verify your membership.',
      url: process.env.COINFLOW_TERMINAL_URL || 'https://t.me/+jbl7jjnm3F00MzM0',
      chatId: process.env.COINFLOW_TERMINAL_CHAT_ID || null,
      requiresProof: false,
      autoVerifyProvider: 'telegram_chat_member',
    },
    {
      type: 'join_telegram_group',
      title: 'Join CoinFlow main Telegram group',
      description: 'Join the official CoinFlow main Telegram group and verify your membership.',
      url: process.env.COINFLOW_GROUP_URL || 'https://t.me/+Q5Q41QftOyI3Nzc0',
      chatId: process.env.COINFLOW_GROUP_CHAT_ID || null,
      requiresProof: false,
      autoVerifyProvider: 'telegram_chat_member',
    },
    {
      type: 'join_telegram_channel',
      title: 'Join CoinFlow Telegram channel',
      description: 'Join the official CoinFlow announcement channel and verify your membership.',
      url: process.env.COINFLOW_CHANNEL_URL || 'https://t.me/+RJjtj-LrRus0NWJk',
      chatId: process.env.COINFLOW_CHANNEL_CHAT_ID || null,
      requiresProof: false,
      autoVerifyProvider: 'telegram_chat_member',
    },
    {
      type: 'follow_x',
      title: 'Follow CoinFlow on X',
      description: 'Follow CoinFlow on X, then submit your X username and proof for admin review.',
      url: process.env.COINFLOW_X_URL || 'https://x.com/coinflownj6i?s=11',
      chatId: null,
      requiresProof: true,
      autoVerifyProvider: null,
    },
  ];

  let failedTaskCount = 0;

  for (const task of tasks) {
    const result = await query(
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
          is_active
        )
        VALUES (
          $1::varchar,
          $2::varchar,
          $3::text,
          $4::text,
          $5::text,
          $6::integer,
          $7::boolean,
          $8::varchar,
          TRUE
        )
        ON CONFLICT (type)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          chat_id = EXCLUDED.chat_id,
          reward_points = EXCLUDED.reward_points,
          requires_proof = EXCLUDED.requires_proof,
          auto_verify_provider = EXCLUDED.auto_verify_provider,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [
        task.type,
        task.title,
        task.description,
        task.url,
        task.chatId,
        defaultReward,
        task.requiresProof,
        task.autoVerifyProvider,
      ]
    );

    if (result.rowCount === 0) {
      failedTaskCount += 1;
      console.error(`Campaign fixed task failed to seed: ${task.type}`);
    }
  }

  if (failedTaskCount === 0) {
    console.log('✅ Campaign fixed tasks seeded');
  }
}
