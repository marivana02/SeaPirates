const LOCK_TTL_MS = 30000;
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

module.exports = { acquireAttackLock, releaseAttackLock };
