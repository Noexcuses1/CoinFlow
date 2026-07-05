let selfPingTimer = null;

export function startSelfPing() {
  const url = process.env.SELF_PING_URL;
  const intervalMinutes = Number(process.env.SELF_PING_INTERVAL_MINUTES || 10);

  if (!url) {
    console.log('Self-ping disabled: SELF_PING_URL missing');
    return null;
  }

  if (selfPingTimer) {
    console.log('Self-ping already running');
    return selfPingTimer;
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  console.log(`Self-ping enabled for ${url}`);

  selfPingTimer = setInterval(async () => {
    try {
      const res = await fetch(url);
      console.log(`Self-ping OK: ${res.status}`);
    } catch (error) {
      console.log(`Self-ping failed: ${error.message}`);
    }
  }, intervalMs);

  if (typeof selfPingTimer.unref === 'function') {
    selfPingTimer.unref();
  }

  return selfPingTimer;
}

export function stopSelfPing() {
  if (selfPingTimer) {
    clearInterval(selfPingTimer);
    selfPingTimer = null;
  }
}
