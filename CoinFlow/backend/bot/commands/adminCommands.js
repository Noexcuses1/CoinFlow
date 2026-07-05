import { getCampaignStats, listUsersForBroadcast, setAirdropAmount } from '../../repositories/campaignUsersRepository.js';
import { createTask, listAllTasks, updateTaskReward } from '../../repositories/campaignTasksRepository.js';
import {
  approveCompletion,
  listPendingCompletions,
  rejectCompletion,
} from '../../repositories/campaignProofsRepository.js';
import { maybeAwardReferralForUser } from '../../services/campaignAntiAbuse.js';
import { buildApprovedUsersCsv } from '../../services/campaignCsvExport.js';
import { isDatabaseConfigured } from '../../db/postgres.js';
import { requireAdmin } from '../../utils/admins.js';
import { adminApprovalKeyboard, adminMenuInlineKeyboard } from '../keyboards.js';

export function registerAdminCommands(bot) {
  bot.command('admin', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return ctx.reply(
      [
        'CoinFlow campaign admin menu:',
        '/admin_stats',
        '/tasks',
        '/addtask',
        '/addtask title | url | reward',
        '/addxtask title | url | reward',
        '/setreward <taskId> <points>',
        '/chatid',
        '/approvals',
        '/approve <completionId>',
        '/reject <completionId>',
        '/setairdrop <telegramId> <amount>',
        '/export_csv',
        '/broadcast <message>',
      ].join('\n'),
      adminMenuInlineKeyboard()
    );
  });

  bot.action('admin_menu:stats', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return showAdminStats(ctx);
  });

  bot.action('admin_menu:tasks', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return showAdminTasks(ctx);
  });

  bot.action('admin_menu:approvals', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return showApprovals(ctx);
  });

  bot.action('admin_menu:export_csv', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return exportCsv(ctx);
  });

  bot.command('admin_stats', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return showAdminStats(ctx);
  });

  bot.command('tasks', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return showAdminTasks(ctx);
  });

  bot.command('chatid', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return ctx.reply(`Current chat ID: ${ctx.chat.id}\nChat type: ${ctx.chat.type}`);
  });

  bot.command(['addtask', 'addxtask'], async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const command = ctx.message.text.split(/\s+/)[0];
    const args = ctx.message.text.replace(command, '').trim();

    if (args.includes('|')) {
      const [title, url, rewardText] = args.split('|').map((part) => part.trim());
      if (!title || !url) {
        return ctx.reply('Usage: /addtask title | url | reward');
      }

      const task = await createTask({
        type: 'x_engagement',
        title,
        url,
        rewardPoints: Number(rewardText) || undefined,
        description: title,
        createdByAdminId: ctx.from.id,
      });
      return ctx.reply(`Task created: #${task.id} ${task.title} (${task.reward_points} CFW points)`);
    }

    ctx.session.awaiting = 'addtask_title';
    ctx.session.addTaskDraft = {};
    return ctx.reply('Send the task title. Example: Like and repost this X post');
  });

  bot.command('setreward', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const [, taskId, rewardPoints] = ctx.message.text.split(/\s+/);
    if (!taskId || !rewardPoints) return ctx.reply('Usage: /setreward <taskId> <points>');

    const task = await updateTaskReward(Number(taskId), Number(rewardPoints));
    if (!task) return ctx.reply('Task not found.');
    return ctx.reply(`Updated #${task.id} reward to ${task.reward_points} CFW points.`);
  });

  bot.command('approvals', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return showApprovals(ctx);
  });

  bot.command('approve', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const completionId = Number(ctx.message.text.split(/\s+/)[1]);
    if (!completionId) return ctx.reply('Usage: /approve <completionId>');
    return approveById(ctx, completionId);
  });

  bot.action(/^admin_approve:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return approveById(ctx, Number(ctx.match[1]));
  });

  bot.command('reject', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const completionId = Number(ctx.message.text.split(/\s+/)[1]);
    if (!completionId) return ctx.reply('Usage: /reject <completionId>');
    return rejectById(ctx, completionId);
  });

  bot.action(/^admin_reject:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return rejectById(ctx, Number(ctx.match[1]));
  });

  bot.command('setairdrop', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const [, telegramId, amount] = ctx.message.text.split(/\s+/);
    if (!telegramId || !amount) return ctx.reply('Usage: /setairdrop <telegramId> <amount>');

    const user = await setAirdropAmount(telegramId, amount);
    if (!user) return ctx.reply('User not found.');
    return ctx.reply(`Set airdrop amount for ${telegramId} to ${amount}. No transfer was executed.`);
  });

  bot.command('export_csv', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    return exportCsv(ctx);
  });

  bot.command('broadcast', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const message = ctx.message.text.replace('/broadcast', '').trim();
    if (!message) return ctx.reply('Usage: /broadcast <message>');

    const users = await listUsersForBroadcast();
    let sent = 0;
    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(user.telegram_id, message);
        sent += 1;
      } catch (error) {
        console.warn('Broadcast failed:', user.telegram_id, error.message);
      }
    }
    return ctx.reply(`Broadcast sent to ${sent} users.`);
  });

  bot.hears(/^(add\s+x?\s*task|new\s+task)\s+/i, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const parsed = parseNaturalXTask(ctx.message.text);
    if (!parsed) {
      return ctx.reply('I could not parse that task. Include an X post URL and optional "reward <number>".');
    }

    const task = await createTask({
      type: 'x_engagement',
      title: parsed.title,
      description: parsed.title,
      url: parsed.url,
      rewardPoints: parsed.rewardPoints,
      requiresProof: true,
      createdByAdminId: ctx.from.id,
    });

    return ctx.reply(
      [
        'Task created.',
        `ID: #${task.id}`,
        `Title: ${task.title}`,
        `URL: ${task.url}`,
        `Reward: ${task.reward_points} CFW points`,
      ].join('\n')
    );
  });
}

function requireCampaignDatabase(ctx) {
  if (isDatabaseConfigured()) return true;
  ctx.reply('Campaign database is not configured yet.');
  return false;
}

async function showAdminStats(ctx) {
  if (!requireCampaignDatabase(ctx)) return;
  const stats = await getCampaignStats();
  return ctx.reply(
    [
      '📊 Campaign Stats',
      `Users: ${stats.users_count || 0}`,
      `Wallets submitted: ${stats.wallets_count || 0}`,
      `X usernames submitted: ${stats.x_usernames_count || 0}`,
      `Total CFW points: ${stats.total_points || 0}`,
      `Approved users: ${stats.approved_users_count || 0}`,
    ].join('\n')
  );
}

async function showAdminTasks(ctx) {
  if (!requireCampaignDatabase(ctx)) return;
  const tasks = await listAllTasks();
  if (!tasks.length) return ctx.reply('No tasks found.');
  return ctx.reply(
    tasks
      .map((task) => `#${task.id} ${task.is_active ? 'active' : 'inactive'} - ${task.title} (${task.reward_points} CFW points)`)
      .join('\n')
  );
}

async function showApprovals(ctx) {
  if (!requireCampaignDatabase(ctx)) return;
  const approvals = await listPendingCompletions(10);
  if (!approvals.length) return ctx.reply('No pending approvals.');

  for (const item of approvals) {
    const name = item.telegram_username ? `@${item.telegram_username}` : item.telegram_id;
    await ctx.reply(
      [
        `Approval #${item.id}`,
        `User: ${name}`,
        `Task: ${item.title}`,
        `Reward: ${item.reward_points} CFW points`,
        `Proof: ${item.proof_text || item.proof_file_id || 'No text proof'}`,
      ].join('\n'),
      adminApprovalKeyboard(item.id)
    );
  }
}

async function exportCsv(ctx) {
  if (!requireCampaignDatabase(ctx)) return;
  const csv = await buildApprovedUsersCsv();
  return ctx.replyWithDocument({
    source: Buffer.from(csv),
    filename: 'coinflow-approved-users.csv',
  });
}

async function approveById(ctx, completionId) {
  const completion = await approveCompletion(completionId, ctx.from.id);
  if (!completion) return ctx.reply('Completion not found or could not be approved.');

  await maybeAwardReferralForUser(completion.user_id);
  return ctx.reply(`Approved completion #${completionId}. Added ${completion.reward_points} CFW points.`);
}

async function rejectById(ctx, completionId) {
  const completion = await rejectCompletion(completionId, ctx.from.id);
  if (!completion) return ctx.reply('Completion not found.');
  return ctx.reply(`Rejected completion #${completionId}. No CFW points were added.`);
}

function parseNaturalXTask(text) {
  const urlMatch = text.match(/https?:\/\/(?:x\.com|twitter\.com)\/\S+/i);
  if (!urlMatch) return null;

  const rewardMatch = text.match(/\breward\s+(\d+)\b/i);
  const rewardPoints = rewardMatch ? Number(rewardMatch[1]) : undefined;
  const commandPrefix = /^(add\s+x?\s*task|new\s+task)\s+/i;
  let title = text.replace(commandPrefix, '').replace(urlMatch[0], '').replace(/\breward\s+\d+\b/i, '').trim();
  title = title || 'CoinFlow X engagement task';

  return {
    title,
    url: urlMatch[0],
    rewardPoints,
  };
}
