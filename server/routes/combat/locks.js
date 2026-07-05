const LOCK_TTL_MS = 8000;
const CLEANUP_INTERVAL_MS = 5000;
const attackLocks = new Map();

function acquireAttackLock(playerId) {
  const now = Date.now();
  const existing = attackLocks.get(playerId);
  if (existing && (now - existing.ts) < LOCK_TTL_MS) return false;
  const lockId = now + '-' + Math.random().toString(36).slice(2, 8);
  attackLocks.set(playerId, { ts: now, id: lockId });
  return lockId;
}

function releaseAttackLock(playerId, lockId) {
  const existing = attackLocks.get(playerId);
  if (existing && existing.id === lockId) {
    attackLocks.delete(playerId);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [pid, entry] of attackLocks) {
    if (now - entry.ts >= LOCK_TTL_MS) attackLocks.delete(pid);
  }
}, CLEANUP_INTERVAL_MS);

module.exports = { acquireAttackLock, releaseAttackLock };