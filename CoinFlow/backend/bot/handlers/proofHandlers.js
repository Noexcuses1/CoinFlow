import { createTask } from '../../repositories/campaignTasksRepository.js';
import {
  findUserByTelegramId,
  findUserByWallet,
  findUserByXUsername,
  normalizeXUsername,
  updateWalletAddress,
  updateXUsername,
} from '../../repositories/campaignUsersRepository.js';
import { submitTaskProof } from '../../repositories/campaignProofsRepository.js';
import { maybeAwardReferralForUser } from '../../services/campaignAntiAbuse.js';
import { isAdmin } from '../../utils/admins.js';
import { isValidSolanaAddress } from '../../utils/solana.js';
import { clearSession } from '../session.js';

export function registerProofHandlers(bot) {
  bot.on(['photo', 'document'], async (ctx, next) => {
    if (ctx.session?.awaiting !== 'proof') return next();
    return saveProof(ctx, getFileId(ctx));
  });

  bot.on('text', async (ctx, next) => {
    const awaiting = ctx.session?.awaiting;
    if (!awaiting) return next();
    if (ctx.message.text.startsWith('/')) return next();

    if (awaiting === 'wallet') return saveWallet(ctx);
    if (awaiting === 'x_username') return saveXUsername(ctx);
    if (awaiting === 'proof') return saveProof(ctx, null, ctx.message.text);
    if (awaiting?.startsWith('addtask_')) return continueAddTask(ctx);

    return next();
  });
}

async function saveWallet(ctx) {
  const walletAddress = ctx.message.text.trim();
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Please run /start first.');

  if (!isValidSolanaAddress(walletAddress)) {
    return ctx.reply('That does not look like a valid Solana wallet address. Please send a valid wallet address.');
  }

  const existing = await findUserByWallet(walletAddress);
  if (existing && existing.id !== user.id) {
    return ctx.reply('This wallet is already used by another campaign profile.');
  }

  await updateWalletAddress(user.id, walletAddress);
  await maybeAwardReferralForUser(user.id);
  clearSession(ctx);
  return ctx.reply('Wallet saved. You can now complete tasks to earn CFW points.');
}

async function saveXUsername(ctx) {
  const xUsername = normalizeXUsername(ctx.message.text);
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Please run /start first.');

  if (!/^[a-zA-Z0-9_]{1,15}$/.test(xUsername)) {
    return ctx.reply('Send a valid X username without spaces. Example: coinflow');
  }

  const existing = await findUserByXUsername(xUsername);
  if (existing && existing.id !== user.id) {
    return ctx.reply('This X username is already used by another campaign profile.');
  }

  await updateXUsername(user.id, xUsername);
  await maybeAwardReferralForUser(user.id);
  clearSession(ctx);
  return ctx.reply(`X username saved as @${xUsername}.`);
}

async function saveProof(ctx, proofFileId, proofText = null) {
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user || !ctx.session.taskId) return ctx.reply('Please choose a task first.');

  await submitTaskProof({
    userId: user.id,
    taskId: ctx.session.taskId,
    proofText,
    proofFileId,
  });

  clearSession(ctx);
  return ctx.reply('Proof submitted. It is pending admin review. CFW points are added only after approval.');
}

async function continueAddTask(ctx) {
  if (!isAdmin(ctx)) {
    clearSession(ctx);
    return ctx.reply('Admin access only.');
  }

  const text = ctx.message.text.trim();
  ctx.session.addTaskDraft = ctx.session.addTaskDraft || {};

  if (ctx.session.awaiting === 'addtask_title') {
    ctx.session.addTaskDraft.title = text;
    ctx.session.awaiting = 'addtask_url';
    return ctx.reply('Send the task URL.');
  }

  if (ctx.session.awaiting === 'addtask_url') {
    ctx.session.addTaskDraft.url = text;
    ctx.session.awaiting = 'addtask_reward';
    return ctx.reply('Send the reward in CFW points, or send 30 for the default.');
  }

  if (ctx.session.awaiting === 'addtask_reward') {
    const reward = Number(text);
    if (!Number.isFinite(reward) || reward < 0) {
      return ctx.reply('Send a valid reward number.');
    }
    ctx.session.addTaskDraft.rewardPoints = reward;
    ctx.session.awaiting = 'addtask_description';
    return ctx.reply('Send a short description for the task.');
  }

  if (ctx.session.awaiting === 'addtask_description') {
    const task = await createTask({
      type: 'x_engagement',
      title: ctx.session.addTaskDraft.title,
      url: ctx.session.addTaskDraft.url,
      rewardPoints: ctx.session.addTaskDraft.rewardPoints,
      description: text,
      createdByAdminId: ctx.from.id,
    });
    clearSession(ctx);
    return ctx.reply(`Task created: #${task.id} ${task.title} (${task.reward_points} CFW points)`);
  }
}

function getFileId(ctx) {
  if (ctx.message.photo?.length) {
    return ctx.message.photo[ctx.message.photo.length - 1].file_id;
  }
  return ctx.message.document?.file_id || null;
}
