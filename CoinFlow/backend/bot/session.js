import { session } from 'telegraf';

export function campaignSession() {
  return session({
    defaultSession: () => ({
      awaiting: null,
      taskId: null,
      addTaskDraft: null,
    }),
  });
}

export function clearSession(ctx) {
  ctx.session.awaiting = null;
  ctx.session.taskId = null;
  ctx.session.addTaskDraft = null;
}
