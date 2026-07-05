import { Markup } from 'telegraf';

export function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📌 Tasks', '👥 Invite Friends'],
    ['💰 My CFW Points', '🔗 Submit Wallet'],
    ['🐦 Submit X Username', '🏆 Leaderboard'],
    ['📢 Official Links', '✅ My Status'],
  ]).resize();
}

export function mainMenuInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📌 Tasks', 'menu:tasks'),
      Markup.button.callback('👥 Invite Friends', 'menu:invite'),
    ],
    [
      Markup.button.callback('💰 My CFW Points', 'menu:points'),
      Markup.button.callback('🔗 Submit Wallet', 'menu:wallet'),
    ],
    [
      Markup.button.callback('🐦 Submit X Username', 'menu:x_username'),
      Markup.button.callback('🏆 Leaderboard', 'menu:leaderboard'),
    ],
    [
      Markup.button.callback('📢 Official Links', 'menu:links'),
      Markup.button.callback('✅ My Status', 'menu:status'),
    ],
  ]);
}

export function adminMenuInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Stats', 'admin_menu:stats'),
      Markup.button.callback('Tasks', 'admin_menu:tasks'),
    ],
    [
      Markup.button.callback('Approvals', 'admin_menu:approvals'),
      Markup.button.callback('Export CSV', 'admin_menu:export_csv'),
    ],
  ]);
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
