const LOCK_TTL_MS = 8000;
const CLEANUP_INTERVAL_MS = 5000;
const attackLocks = new Map();

function acquireAttackLock(playerId) {
  const now = Date.now();
  const existing = attackLocks.get(playerId);
  if (existing && (now - existing) < LOCK_TTL_MS) return false;
  attackLocks.set(playerId, now);
  return true;
}

function releaseAttackLock(playerId) {
  attackLocks.delete(playerId);
}

// Otomatik temizlik — süresi dolmuş lock'ları periyodik olarak sil
setInterval(() => {
  const now = Date.now();
  for (const [pid, ts] of attackLocks) {
    if (now - ts >= LOCK_TTL_MS) attackLocks.delete(pid);
  }
}, CLEANUP_INTERVAL_MS);

module.exports = { acquireAttackLock, releaseAttackLock };
