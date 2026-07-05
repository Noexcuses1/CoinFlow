const buckets = new Map();

export function rateLimit({ windowMs = 5000, max = 8 } = {}) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const bucket = buckets.get(userId) || [];
    const recent = bucket.filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    buckets.set(userId, recent);

    if (recent.length > max) {
      return ctx.reply('Please slow down and try again in a moment.');
    }

    return next();
  };
}
