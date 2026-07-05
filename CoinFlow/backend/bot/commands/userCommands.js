import {
  findUserByTelegramId,
  getLeaderboard,
  getOrCreateUser,
} from '../../repositories/campaignUsersRepository.js';
import { isDatabaseConfigured } from '../../db/postgres.js';
import { listActiveTasks } from '../../repositories/campaignTasksRepository.js';
import { mainMenuKeyboard, tasksKeyboard } from '../keyboards.js';
import { officialLinksMessage, pointsMessage, profileMessage } from '../messages.js';

export function registerUserCommands(bot) {
  bot.start(async (ctx) => {
    await ctx.reply('Welcome to CoinFlow 🌊', mainMenuKeyboard());

    if (!isDatabaseConfigured()) {
      console.log('Campaign database disabled: DATABASE_URL missing');
      return;
    }

    const referralCode = ctx.message.text.split(/\s+/)[1];
    const user = await getOrCreateUser({
      telegramId: ctx.from.id,
      telegramUsername: ctx.from.username,
      referralCode,
    });

    if (!user) {
      return ctx.reply('Campaign database is not available right now. Please try again later.');
    }
  });

  bot.hears('📌 Tasks', showTasks);

  bot.hears('👥 Invite Friends', showInviteLink);
  bot.command('invite', showInviteLink);

  bot.hears('💰 My CFW Points', showPoints);
  bot.command('points', showPoints);

  bot.hears('🔗 Submit Wallet', askWallet);
  bot.command('wallet', askWallet);

  bot.hears('🐦 Submit X Username', askXUsername);
  bot.command('xusername', askXUsername);

  bot.hears('🏆 Leaderboard', showLeaderboard);
  bot.command('leaderboard', showLeaderboard);

  bot.hears('📢 Official Links', (ctx) => ctx.reply(officialLinksMessage()));
  bot.command('links', (ctx) => ctx.reply(officialLinksMessage()));

  bot.hears('✅ My Status', showStatus);
  bot.command('status', showStatus);
}

async function showTasks(ctx) {
  const tasks = await listActiveTasks();
  if (!tasks.length) return ctx.reply('No active tasks are available yet.');
  return ctx.reply('Choose a task to complete:', tasksKeyboard(tasks));
}

async function showInviteLink(ctx) {
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Please run /start first.');

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || ctx.botInfo?.username;
  if (!botUsername) return ctx.reply('Bot username is not configured yet.');

  return ctx.reply(
    [
      '👥 Invite Friends',
      '',
      `Your referral link: https://t.me/${botUsername}?start=${user.referral_code}`,
      '',
      'You earn 20 CFW points when a referred user submits a wallet, submits an X username, and completes at least one approved task.',
    ].join('\n')
  );
}

async function showPoints(ctx) {
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Please run /start first.');
  return ctx.reply(pointsMessage(user));
}

async function askWallet(ctx) {
  ctx.session.awaiting = 'wallet';
  return ctx.reply('Send your Solana wallet address. This is used only for campaign eligibility tracking.');
}

async function askXUsername(ctx) {
  ctx.session.awaiting = 'x_username';
  return ctx.reply('Send your X username without the @ symbol.');
}

async function showLeaderboard(ctx) {
  const leaders = await getLeaderboard(10);
  if (!leaders.length) return ctx.reply('No leaderboard entries yet.');

  const lines = leaders.map((user, index) => {
    const name = user.telegram_username ? `@${user.telegram_username}` : `User ${user.telegram_id}`;
    return `${index + 1}. ${name} - ${user.points} CFW points`;
  });

  return ctx.reply(['🏆 Leaderboard', '', ...lines].join('\n'));
}

async function showStatus(ctx) {
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) return ctx.reply('Please run /start first.');
  return ctx.reply(profileMessage(user));
}
