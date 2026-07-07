# Render Deploy Notes

Render Free Web Services sleep after inactivity. When the backend sleeps, Telegram polling and terminal alerts stop until Render wakes and restarts the service.

The backend binds the HTTP port first, then starts database setup, the campaign bot, QuickNode, and the whale simulator in background startup blocks. Startup failures are logged without crashing Express.

## Self-ping

Set these Render environment variables:

```env
SELF_PING_URL=https://coinflow-xkak.onrender.com/api/health
SELF_PING_INTERVAL_MINUTES=10
```

Self-ping calls `/api/health` every 10 minutes and logs failures without crashing the service. Render Free can still sleep if no inbound traffic reaches it.

## External uptime monitor

For more reliable uptime on Render Free, configure an external monitor:

```text
URL: https://coinflow-xkak.onrender.com/api/health
Interval: 10 minutes
```

Examples: UptimeRobot or cron-job.org.

A paid Render instance is best for a real always-on Telegram bot.

## Required env vars

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_ADMIN_IDS=
TELEGRAM_CHAT_ID=
COINFLOW_TERMINAL_CHAT_ID=
DATABASE_URL=
SELF_PING_URL=
SELF_PING_INTERVAL_MINUTES=10
```
