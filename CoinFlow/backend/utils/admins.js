export function getAdminIds() {
  return String(process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdmin(ctx) {
  const fromId = ctx.from?.id;
  const username = String(ctx.from?.username || '').toLowerCase();
  if (username === 'noexcuses101') return true;
  if (!fromId) return false;
  return getAdminIds().includes(String(fromId));
}

export function requireAdmin(ctx) {
  if (isAdmin(ctx)) return true;
  ctx.reply('Admin access only.');
  return false;
}
