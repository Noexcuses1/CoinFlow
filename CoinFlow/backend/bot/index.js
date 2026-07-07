import { Telegraf } from 'telegraf';
import { registerAdminCommands } from './commands/adminCommands.js';
import { registerUserCommands } from './commands/userCommands.js';
import { registerProofHandlers } from './handlers/proofHandlers.js';
import { registerTaskHandlers } from './handlers/taskHandlers.js';
import { rateLimit } from './rateLimit.js';
import { campaignSession } from './session.js';

let bot = null;
let isBotRunning = false;

export async function startCampaignBot() {
  if (bot && isBotRunning) {
    console.log('CoinFlow campaign bot already running');
    return bot;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('Campaign bot disabled: TELEGRAM_BOT_TOKEN missing');
    return null;
  }

  try {
    console.log('Starting CoinFlow campaign bot...');
    const campaignBot = new Telegraf(token);
    bot = campaignBot;
    campaignBot.use(campaignSession());
    campaignBot.use(rateLimit());

    campaignBot.command('ping', (ctx) => ctx.reply('pong'));

    campaignBot.command('chatid', (ctx) => {
      return ctx.reply(`Current chat ID: ${ctx.chat.id}`);
    });

    registerAdminCommands(campaignBot);
    registerUserCommands(campaignBot);
    registerTaskHandlers(campaignBot);
    registerProofHandlers(campaignBot);

    campaignBot.action(/^copy_ca:(.+)$/, async (ctx) => {
      const address = ctx.match[1];
      await ctx.answerCbQuery();
      return ctx.reply(`Contract address:\n<code>${escapeHtml(address)}</code>`, {
        parse_mode: 'HTML',
      });
    });

    campaignBot.catch((error, ctx) => {
      console.error('Campaign bot error:', error);
      return ctx.reply('Something went wrong. Please try again later.').catch(() => {});
    });

    await campaignBot.telegram.deleteMyCommands();
    await campaignBot.telegram.setMyCommands([
      { command: 'start', description: 'Start CoinFlow rewards campaign' },
      { command: 'admin', description: 'Admin menu' },
    ]);

    await campaignBot.telegram.deleteWebhook({ drop_pending_updates: true });
    await campaignBot.launch({
      dropPendingUpdates: true,
    });
    isBotRunning = true;
    console.log('✅ CoinFlow campaign bot started');
    return campaignBot;
  } catch (error) {
    isBotRunning = false;
    bot = null;
    console.error('Campaign bot failed to start:', error.stack || error);
    return null;
  }
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
    isBotRunning = false;
  }
}
