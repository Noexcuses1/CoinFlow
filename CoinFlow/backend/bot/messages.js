export const welcomeMessage =
  'Welcome to CoinFlow 🌊 Complete tasks, invite friends, and become eligible for $CFW community rewards.';

export function profileMessage(user) {
  return [
    '✅ My Status',
    '',
    `CFW points: ${user.points || 0}`,
    `Wallet: ${user.wallet_address || 'Not submitted'}`,
    `X username: ${user.x_username ? `@${user.x_username}` : 'Not submitted'}`,
    `Referrals: ${user.referrals_count || 0}`,
    `Status: ${user.verification_status || 'pending'}`,
    '',
    'Admin approval is required before users are eligible for $CFW community rewards.',
  ].join('\n');
}

export function officialLinksMessage() {
  return [
    '📢 Official CoinFlow Links',
    '',
    `Terminal Group: ${process.env.COINFLOW_TERMINAL_URL || 'https://t.me/+jbl7jjnm3F00MzM0'}`,
    `Main Telegram Group: ${process.env.COINFLOW_GROUP_URL || 'https://t.me/+Q5Q41QftOyI3Nzc0'}`,
    `Announcement Channel: ${process.env.COINFLOW_CHANNEL_URL || 'https://t.me/+RJjtj-LrRus0NWJk'}`,
    `X: ${process.env.COINFLOW_X_URL || 'https://x.com/coinflownj6i?s=11'}`,
  ].join('\n');
}

export function pointsMessage(user) {
  return [
    '💰 My CFW Points',
    '',
    `You currently have ${user.points || 0} CFW points.`,
    '',
    'CFW points track campaign participation. They are not token transfers and do not guarantee rewards.',
  ].join('\n');
}
