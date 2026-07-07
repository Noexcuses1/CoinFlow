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

  console.log('Starting CoinFlow campaign bot...');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log(`TELEGRAM_BOT_TOKEN present: ${Boolean(token)}`);
  console.log(`TELEGRAM_BOT_USERNAME: ${process.env.TELEGRAM_BOT_USERNAME || 'missing'}`);

  if (!token) {
    console.log('Campaign bot disabled: TELEGRAM_BOT_TOKEN missing');
    return null;
  }

  const startupTimer = setTimeout(() => {
    console.warn('Campaign bot startup is taking longer than expected');
  }, 10000);

  if (typeof startupTimer.unref === 'function') {
    startupTimer.unref();
  }

  try {
    const campaignBot = new Telegraf(token);
    bot = campaignBot;

    let botInfo;
    try {
      botInfo = await campaignBot.telegram.getMe();
      console.log(`Telegram bot identity: @${botInfo.username}`);
    } catch (error) {
      console.error('Campaign bot token invalid or Telegram API unavailable');
      console.error(error.stack || error);
      bot = null;
      return null;
    }

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

    console.log('Deleting old Telegram webhook...');
    await campaignBot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('Old webhook deleted');

    await campaignBot.telegram.deleteMyCommands();
    await campaignBot.telegram.setMyCommands([
      { command: 'start', description: 'Start CoinFlow rewards campaign' },
      { command: 'admin', description: 'Admin menu' },
    ]);

    console.log('Launching Telegram polling...');
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
  } finally {
    clearTimeout(startupTimer);
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
