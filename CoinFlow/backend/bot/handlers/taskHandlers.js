import { findTaskById } from '../../repositories/campaignTasksRepository.js';
import { findUserByTelegramId } from '../../repositories/campaignUsersRepository.js';
import {
  approveTaskForUser,
  findCompletionForUserTask,
} from '../../repositories/campaignProofsRepository.js';
import { maybeAwardReferralForUser } from '../../services/campaignAntiAbuse.js';
import { taskKeyboard } from '../keyboards.js';

export function registerTaskHandlers(bot) {
  bot.action(/^task:(\d+)$/, async (ctx) => {
    const taskId = Number(ctx.match[1]);
    const task = await findTaskById(taskId);
    await ctx.answerCbQuery();

    if (!task || !task.is_active) {
      return ctx.reply('This task is not available right now.');
    }

    return ctx.reply(
      [
        `📌 ${task.title}`,
        '',
        task.description || 'Complete this task and submit proof for admin review.',
        '',
        `Reward: ${task.reward_points} CFW points`,
        task.auto_verify_provider === 'telegram_chat_member'
          ? 'Use Verify Joined after joining. Points are awarded only if the bot can confirm your membership.'
          : 'Proof is required before approval.',
      ].join('\n'),
      taskKeyboard(task)
    );
  });

  bot.action(/^verify_join:(\d+)$/, async (ctx) => {
    const taskId = Number(ctx.match[1]);
    const task = await findTaskById(taskId);
    const user = await findUserByTelegramId(ctx.from.id);
    await ctx.answerCbQuery();

    if (!task || !task.is_active || !user) {
      return ctx.reply('Unable to verify this task right now.');
    }

    if (task.auto_verify_provider !== 'telegram_chat_member') {
      return ctx.reply('This task requires proof and admin approval.');
    }

    if (!task.chat_id) {
      return ctx.reply(
        'This Telegram task is missing its chat ID. Ask an admin to send /chatid inside the group/channel and add the correct chat ID to .env.'
      );
    }

    const verified = await verifyTelegramMembership(ctx, task.chat_id, ctx.from.id);
    if (!verified.ok) {
      return ctx.reply(verified.message);
    }

    const result = await approveTaskForUser({
      userId: user.id,
      taskId: task.id,
      reviewerId: ctx.botInfo?.id || null,
      proofText: `Verified Telegram membership in ${task.chat_id}`,
    });
    await maybeAwardReferralForUser(user.id);

    if (!result.awarded) {
      return ctx.reply('You are already approved for this task.');
    }

    return ctx.reply(`Verified. ${task.reward_points} CFW points added.`);
  });

  bot.action(/^task_done:(\d+)$/, async (ctx) => {
    const taskId = Number(ctx.match[1]);
    const task = await findTaskById(taskId);
    const user = await findUserByTelegramId(ctx.from.id);
    await ctx.answerCbQuery();

    if (!task || !task.is_active || !user) {
      return ctx.reply('Unable to submit this task right now.');
    }

    const existing = await findCompletionForUserTask(user.id, task.id);
    if (existing?.status === 'approved') {
      return ctx.reply('This task is already approved on your profile.');
    }

    if ((task.type === 'follow_x' || task.type === 'x_engagement') && !user.x_username) {
      return ctx.reply('Submit your X username first using 🐦 Submit X Username, then return to this task and submit proof.');
    }

    ctx.session.awaiting = 'proof';
    ctx.session.taskId = task.id;
    return ctx.reply(
      'Send proof for this task now. You can send text, a screenshot, or a file. Admin approval is required before CFW points are added.'
    );
  });
}

async function verifyTelegramMembership(ctx, chatId, userId) {
  try {
    const member = await ctx.telegram.getChatMember(chatId, userId);
    const validStatuses = ['member', 'administrator', 'creator'];
    if (validStatuses.includes(member.status)) {
      return { ok: true };
    }

    if (member.status === 'restricted' && member.is_member) {
      return { ok: true };
    }

    return {
      ok: false,
      message: 'I could not verify your membership yet. Join first, then tap Verify Joined again.',
    };
  } catch (error) {
    return {
      ok: false,
      message: `Telegram verification failed. Make sure the bot is in the group/channel and the chat ID is correct. Error: ${error.description || error.message}`,
    };
  }
}
