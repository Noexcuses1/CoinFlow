import { Markup } from 'telegraf';

export function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📌 Tasks', '👥 Invite Friends'],
    ['💰 My CFW Points', '🔗 Submit Wallet'],
    ['🐦 Submit X Username', '🏆 Leaderboard'],
    ['📢 Official Links', '✅ My Status'],
  ]).resize();
}

export function taskKeyboard(task) {
  const buttons = [];
  if (task.url) {
    buttons.push([Markup.button.url(task.auto_verify_provider ? 'Join' : 'Open task link', task.url)]);
  }

  if (task.auto_verify_provider === 'telegram_chat_member') {
    buttons.push([Markup.button.callback('Verify Joined', `verify_join:${task.id}`)]);
    return Markup.inlineKeyboard(buttons);
  }

  buttons.push([Markup.button.callback('I completed this task', `task_done:${task.id}`)]);
  return Markup.inlineKeyboard(buttons);
}

export function tasksKeyboard(tasks) {
  return Markup.inlineKeyboard(
    tasks.map((task) => [
      Markup.button.callback(`${task.title} (${task.reward_points} CFW points)`, `task:${task.id}`),
    ])
  );
}

export function adminApprovalKeyboard(completionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Approve', `admin_approve:${completionId}`),
      Markup.button.callback('Reject', `admin_reject:${completionId}`),
    ],
  ]);
}
