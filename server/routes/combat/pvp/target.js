const { BOT_BASE_HP, BOT_HP_PER_LEVEL, BOT_BASE_DAMAGE, BOT_BASE_CANNONS, BOT_CANNONS_PER_LEVEL, BOT_SHIP_LVL_DIVISOR } = require('../constants');

async function initPvPTarget(pool, pData) {
  const targetId = pData.pvp_target_id;

  if (targetId === -1) {
    const botLvl = Math.max(1, pData.level);
    const botMaxHp = BOT_BASE_HP + (botLvl * BOT_HP_PER_LEVEL);
    const botEquipped = BOT_BASE_CANNONS + (botLvl * BOT_CANNONS_PER_LEVEL);
    const botDmg = botEquipped * BOT_BASE_DAMAGE;
    const botShipLvl = Math.min(10, Math.floor(botLvl / BOT_SHIP_LVL_DIVISOR));

    const imgPath = botShipLvl > 0 ? `assets/ships/elitship/elit${botShipLvl}/images/1.png` : `assets/ships/elitship/default/1.png`;
    const imgPathDamaged = botShipLvl > 0 ? `assets/ships/elitship/elit${botShipLvl}/images/9.png` : `assets/ships/elitship/default/9.png`;

    return {
      name: 'Kaptan Barbarossa [BOT]',
      hp: botMaxHp,
      damage: botDmg,
      gold: 0, xp: 0, pearl: 0,
      isPvP: true,
      fullImg: imgPath,
      damagedImg: imgPathDamaged
    };
  }

  const tRes = await pool.query(
    'SELECT id, username, display_name, max_hp, ship_level, active_design, visual_ship_level FROM players WHERE id = $1',
    [targetId]
  );
  if (tRes.rows.length === 0) {
    return null;
  }

  const t = tRes.rows[0];
  const tCannons = await pool.query(
    `SELECT SUM(pc.equipped) as total, SUM(pc.equipped * c.damage) as total_dmg
     FROM player_cannons pc
     JOIN cannons c ON pc.cannon_type = c.id
     WHERE pc.player_id = $1`,
    [t.id]
  );
  const tEquipped = parseInt(tCannons.rows[0]?.total) || 5;
  const tDmg = parseInt(tCannons.rows[0]?.total_dmg) || tEquipped * 185;

  const tShipLvl = parseInt(t.ship_level || 0);
  const tVisualLvl = t.visual_ship_level != null ? parseInt(t.visual_ship_level) : null;
  const tDisplayLvl = tVisualLvl != null ? tVisualLvl : tShipLvl;
  const designFolder = t.active_design === 'kristal_queen' ? 'kristalquen' : t.active_design;
  const imgPath = t.active_design
    ? `assets/items/shop/${designFolder}/1.png`
    : tDisplayLvl > 0 ? `assets/ships/elitship/elit${tDisplayLvl}/images/1.png` : `assets/ships/elitship/default/1.png`;
  const imgPathDamaged = t.active_design
    ? `assets/items/shop/${designFolder}/9.png`
    : tDisplayLvl > 0 ? `assets/ships/elitship/elit${tDisplayLvl}/images/9.png` : `assets/ships/elitship/default/9.png`;

  return {
    name: t.display_name || t.username,
    hp: parseInt(t.max_hp),
    damage: tDmg,
    gold: 0, xp: 0, pearl: 0,
    isPvP: true,
    fullImg: imgPath,
    damagedImg: imgPathDamaged
  };
}

module.exports = { initPvPTarget };
