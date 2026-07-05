import { Telegraf } from 'telegraf';
import { registerAdminCommands } from './commands/adminCommands.js';
import { registerUserCommands } from './commands/userCommands.js';
import { registerProofHandlers } from './handlers/proofHandlers.js';
import { registerTaskHandlers } from './handlers/taskHandlers.js';
import { rateLimit } from './rateLimit.js';
import { campaignSession } from './session.js';

let bot = null;

export async function startCampaignBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('Campaign bot disabled: TELEGRAM_BOT_TOKEN missing');
    return null;
  }

  bot = new Telegraf(token);
  bot.use(campaignSession());
  bot.use(rateLimit());

  bot.command('chatid', (ctx) => {
    return ctx.reply(`Current chat ID: ${ctx.chat.id}`);
  });

  registerAdminCommands(bot);
  registerUserCommands(bot);
  registerTaskHandlers(bot);
  registerProofHandlers(bot);

  bot.action(/^copy_ca:(.+)$/, async (ctx) => {
    const address = ctx.match[1];
    await ctx.answerCbQuery();
    return ctx.reply(`Contract address:\n<code>${escapeHtml(address)}</code>`, {
      parse_mode: 'HTML',
    });
  });

  bot.catch((error, ctx) => {
    console.error('Campaign bot error:', error);
    return ctx.reply('Something went wrong. Please try again later.').catch(() => {});
  });

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Start CoinFlow rewards campaign' },
    { command: 'points', description: 'View your CFW points' },
    { command: 'invite', description: 'Get your referral link' },
    { command: 'wallet', description: 'Submit your Solana wallet' },
    { command: 'xusername', description: 'Submit your X username' },
    { command: 'leaderboard', description: 'View leaderboard' },
    { command: 'status', description: 'View your campaign status' },
    { command: 'admin', description: 'Admin menu' },
  ]);

  await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  await bot.launch();
  console.log('✅ CoinFlow campaign bot started');
  return bot;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function stopCampaignBot(signal) {
  if (bot) {
    bot.stop(signal);
    bot = null;
  }
}
