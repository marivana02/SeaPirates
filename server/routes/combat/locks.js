const attackLocks = new Set();

function acquireAttackLock(playerId) {
  if (attackLocks.has(playerId)) return false;
  attackLocks.add(playerId);
  return true;
}

function releaseAttackLock(playerId) {
  attackLocks.delete(playerId);
}

module.exports = { acquireAttackLock, releaseAttackLock };
