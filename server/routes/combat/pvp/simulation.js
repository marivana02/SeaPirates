const { getPvPRank } = require('../../../helpers/pvpRank');
const { getPlayerMainRankById } = require('../../../helpers/rank');
const { getOpponentReloadMs } = require('../../../helpers/combatRoute');
const { BOT_BASE_CANNONS, BOT_CANNONS_PER_LEVEL, PVP_AMMO_CHECK_LIMIT, BOT_AMMO_DAMAGE, PVP_NPC_BASE_DAMAGE, BARUT_MULTIPLIER, BOT_CANNON_TYPES, BOT_AMMO_TYPES } = require('../constants');
const { calculateOpponentDamage } = require('./damage');

function generateBotLoadout(playerLevel) {
  const totalCannons = BOT_BASE_CANNONS + (playerLevel * BOT_CANNONS_PER_LEVEL);
  const primaryType = BOT_CANNON_TYPES[Math.floor(Math.random() * BOT_CANNON_TYPES.length)];
  const secondaryType = BOT_CANNON_TYPES[Math.floor(Math.random() * BOT_CANNON_TYPES.length)];
  const primaryCount = Math.ceil(totalCannons * (0.6 + Math.random() * 0.3));
  const secondaryCount = totalCannons - primaryCount;

  const totalDamage = (primaryCount * primaryType.damage) + (secondaryCount * secondaryType.damage);
  const weightedReload = Math.round(
    ((primaryCount * primaryType.reloadMs) + (secondaryCount * secondaryType.reloadMs)) / totalCannons
  );

  const ammoRoll = Math.random();
  const ammoType = ammoRoll < 0.3 ? BOT_AMMO_TYPES[0] : ammoRoll < 0.6 ? BOT_AMMO_TYPES[1] : BOT_AMMO_TYPES[2];
  const useBarut = Math.random() < 0.7;
  const useZirh = Math.random() < 0.5;

  return {
    totalCannons,
    totalDamage,
    weightedReload,
    ammoType,
    useBarut,
    useZirh
  };
}

// Stores bot loadouts keyed by playerId (cleared when fight ends)
const botLoadouts = new Map();

function getBotLoadout(playerId, playerLevel) {
  if (!botLoadouts.has(playerId)) {
    botLoadouts.set(playerId, generateBotLoadout(playerLevel));
  }
  return botLoadouts.get(playerId);
}

function clearBotLoadout(playerId) {
  botLoadouts.delete(playerId);
}

async function simulatePvPOpponent(pool, opponentId, playerLevel, currentEvent, playerId) {
  let npcUseBarut = false;
  let npcUseZirh = false;
  let npcAmmoId = 1;
  let npcCannons = 10;
  let npcElpGained = 0;
  let npcDamage = 0;
  let npcReloadMs = 3000;

  if (opponentId === -1) {
    const loadout = getBotLoadout(playerId, playerLevel);
    npcUseBarut = loadout.useBarut;
    npcUseZirh = loadout.useZirh;
    npcAmmoId = loadout.ammoType.id;
    npcCannons = loadout.totalCannons;
    npcReloadMs = loadout.weightedReload;
    npcDamage = loadout.totalDamage + (loadout.totalCannons * loadout.ammoType.damageBonus);
    if (npcUseBarut) {
      npcDamage = Math.floor(npcDamage * BARUT_MULTIPLIER);
    }
    if (loadout.ammoType.givesElp) {
      npcElpGained = loadout.totalCannons;
    }
    if (currentEvent && currentEvent.type === 'damage' && npcAmmoId === 3) {
      npcDamage = Math.floor(npcDamage * currentEvent.mult);
    }
  } else {
    try {
      const oppData = await calculateOpponentDamage(pool, opponentId);
      npcCannons = oppData.cannons;
      npcAmmoId = oppData.ammoId;
      npcUseBarut = oppData.useBarut;
      npcUseZirh = oppData.useZirh;
      npcDamage = oppData.damage;
      npcElpGained = oppData.gainedElp;

      if (currentEvent && currentEvent.type === 'damage' && npcAmmoId === 3) {
        npcDamage = Math.floor(npcDamage * currentEvent.mult);
      }
    } catch (e) {
      console.error("PvP rakip kaynak kullanımı simülasyonu hatası:", e);
      npcDamage = npcCannons * PVP_NPC_BASE_DAMAGE;
    }
  }

  return { npcUseBarut, npcUseZirh, npcAmmoId, npcCannons, npcElpGained, npcDamage, npcReloadMs, opponentId };
}

async function resolvePvPOpponentInfo(pool, targetId, playerLevel, playerId) {
  let pvpOpponentId = null;
  let pvpOpponentRankBadge = null;
  let pvpOpponentRankName = null;
  let pvpOpponentMainRankBadge = null;
  let pvpOpponentMainRankName = null;
  let opponentReloadMs = null;

  if (targetId === -1) {
    pvpOpponentId = 'BOT';
    const botLvl = Math.max(1, playerLevel);
    const botRank = getPvPRank(botLvl * 50);
    pvpOpponentRankBadge = botRank.badge;
    pvpOpponentRankName = botRank.name;
    pvpOpponentMainRankBadge = 13;
    pvpOpponentMainRankName = 'Kara Adamı';
    const loadout = getBotLoadout(playerId, playerLevel);
    opponentReloadMs = loadout.weightedReload;
  } else if (targetId !== null) {
    const opponentRes = await pool.query('SELECT pvp_points FROM players WHERE id = $1', [targetId]);
    if (opponentRes.rows.length > 0) {
      const opponentRank = getPvPRank(opponentRes.rows[0].pvp_points);
      pvpOpponentId = targetId;
      pvpOpponentRankBadge = opponentRank.badge;
      pvpOpponentRankName = opponentRank.name;
      const mainRank = await getPlayerMainRankById(pool, targetId);
      pvpOpponentMainRankBadge = mainRank.badge;
      pvpOpponentMainRankName = mainRank.name;
      opponentReloadMs = await getOpponentReloadMs(pool, targetId);
    }
  }

  return { pvpOpponentId, pvpOpponentRankBadge, pvpOpponentRankName, pvpOpponentMainRankBadge, pvpOpponentMainRankName, opponentReloadMs };
}

module.exports = { simulatePvPOpponent, resolvePvPOpponentInfo, clearBotLoadout };
