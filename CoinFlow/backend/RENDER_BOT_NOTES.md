# Render Bot Notes

CoinFlow runs the Telegram rewards bot in polling mode with `bot.launch()`.

On Render Free, services can still spin down after inactivity. Render Free can still sleep if no inbound traffic reaches it.

For reliable 24/7 Telegram bot operation, use a paid Render instance or an external uptime monitor pinging `/api/health` every 10 minutes. Examples: UptimeRobot or cron-job.org.

Optional testing variables:

```env
SELF_PING_URL=https://coinflow-xkak.onrender.com/api/health
SELF_PING_INTERVAL_MINUTES=10
```

Self-ping failures are logged but do not crash the backend.
