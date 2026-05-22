module.exports = {
  SHIPS: [
    { level: 0, name: 'Başlangıç', baseHp: 10000, cannonSlots: 15, plankSlots: 5, requiredElp: 0 },
    { level: 1, name: 'Elit I', baseHp: 25000, cannonSlots: 30, plankSlots: 10, requiredElp: 35000 },
    { level: 2, name: 'Elit II', baseHp: 36000, cannonSlots: 35, plankSlots: 12, requiredElp: 90000 },
    { level: 3, name: 'Elit III', baseHp: 48000, cannonSlots: 39, plankSlots: 14, requiredElp: 200000 },
    { level: 4, name: 'Elit IV', baseHp: 62000, cannonSlots: 43, plankSlots: 16, requiredElp: 380000 },
    { level: 5, name: 'Elit V', baseHp: 78000, cannonSlots: 46, plankSlots: 18, requiredElp: 650000 },
    { level: 6, name: 'Elit VI', baseHp: 96000, cannonSlots: 49, plankSlots: 20, requiredElp: 1050000 },
    { level: 7, name: 'Elit VII', baseHp: 116000, cannonSlots: 52, plankSlots: 21, requiredElp: 1600000 },
    { level: 8, name: 'Elit VIII', baseHp: 138000, cannonSlots: 55, plankSlots: 23, requiredElp: 2300000 },
    { level: 9, name: 'Elit IX', baseHp: 162000, cannonSlots: 57, plankSlots: 24, requiredElp: 3200000 },
    { level: 10, name: 'Elit X', baseHp: 190000, cannonSlots: 60, plankSlots: 25, requiredElp: 4500000 }
  ],
  
  CANNONS: {
    1: { damage: 120, reloadTime: 4000 },
    2: { damage: 185, reloadTime: 3000 },
    3: { damage: 260, reloadTime: 2000 }
  },
  
  AMMO: {
    1: { damage: 30, elp: 0 },
    2: { damage: 75, elp: 0.5 },
    3: { damage: 130, elp: 1.0 }
  },
  
  PLANKS: {
    'tahta': { hpBonus: 500 },
    'elit': { hpBonus: 1200 }
  },
  
  ITEMS: {
    'barut': { effect: 0.10 }, // +10% attack damage
    'zirh': { effect: 0.10 }  // -10% damage taken
  },
  
  NPCS: {
    1: {
      1: { name: 'Blackpearl', hp: 9000, damage: 180, gold: 280, xp: 40, pearl: 0 },
      2: { name: 'Rackham', hp: 22000, damage: 320, gold: 520, xp: 80, pearl: 0 },
      3: { name: 'Calicos Jack', hp: 50000, damage: 520, gold: 1100, xp: 160, pearl: 0 }
    },
    2: {
      1: { name: 'Wild 13', hp: 14000, damage: 280, gold: 380, xp: 65, pearl: 0 },
      2: { name: 'Red Korsar', hp: 35000, damage: 500, gold: 880, xp: 130, pearl: 0 },
      3: { name: 'Ratpack', hp: 78000, damage: 820, gold: 1800, xp: 260, pearl: 0 }
    },
    3: {
      1: { name: 'Sinclares Men', hp: 20000, damage: 420, gold: 580, xp: 100, pearl: 0 },
      2: { name: 'Tortuga Gang', hp: 50000, damage: 750, gold: 1350, xp: 200, pearl: 0 },
      3: { name: 'Los Renegados', hp: 115000, damage: 1220, gold: 2800, xp: 400, pearl: 0 }
    },
    4: {
      1: { name: 'Ratpack', hp: 28000, damage: 620, gold: 820, xp: 140, pearl: 0 },
      2: { name: 'Sinclares Men', hp: 68000, damage: 1100, gold: 1900, xp: 290, pearl: 0 },
      3: { name: 'Calocosmen', hp: 160000, damage: 1800, gold: 0, xp: 500, pearl: 75 }
    },
    5: {
      1: { name: 'Wild 13', hp: 38000, damage: 900, gold: 1150, xp: 195, pearl: 0 },
      2: { name: 'Los Renegados', hp: 92000, damage: 1600, gold: 2700, xp: 410, pearl: 0 },
      3: { name: 'Morgansbuccaneers', hp: 215000, damage: 2600, gold: 0, xp: 700, pearl: 115 }
    },
    6: {
      1: { name: 'Tortuga Gang', hp: 52000, damage: 1250, gold: 1600, xp: 270, pearl: 0 },
      2: { name: 'Calocosmen', hp: 125000, damage: 2200, gold: 3700, xp: 560, pearl: 0 },
      3: { name: 'Sinclares Men', hp: 290000, damage: 3600, gold: 0, xp: 980, pearl: 165 }
    },
    7: {
      1: { name: 'Morgansbuccaneers', hp: 72000, damage: 1700, gold: 2200, xp: 370, pearl: 0 },
      2: { name: 'Sinclares Men', hp: 175000, damage: 3000, gold: 5100, xp: 770, pearl: 0 },
      3: { name: 'Flyingdutchman', hp: 400000, damage: 4900, gold: 0, xp: 1350, pearl: 230 }
    },
    8: {
      1: { name: 'Kiliwallis', hp: 98000, damage: 2300, gold: 3000, xp: 510, pearl: 0 },
      2: { name: 'Flyingdutchman', hp: 238000, damage: 4000, gold: 6900, xp: 1040, pearl: 0 },
      3: { name: 'Kilimatu', hp: 550000, damage: 6500, gold: 0, xp: 1850, pearl: 320 }
    },
    9: {
      1: { name: 'Kokelua', hp: 130000, damage: 3000, gold: 4000, xp: 680, pearl: 0 },
      2: { name: 'Morgansbuccaneers', hp: 320000, damage: 5300, gold: 9300, xp: 1400, pearl: 0 },
      3: { name: 'Kiribati', hp: 740000, damage: 8600, gold: 0, xp: 2500, pearl: 430 }
    },
    10: {
      1: { name: 'Kilimatu', hp: 175000, damage: 3900, gold: 5400, xp: 920, pearl: 0 },
      2: { name: 'Kiribati', hp: 430000, damage: 6900, gold: 12500, xp: 1880, pearl: 0 },
      3: { name: 'Flyingdutchman', hp: 1000000, damage: 11200, gold: 0, xp: 3400, pearl: 580 }
    }
  },
  
  BOSSES: {
    1: { name: 'Admiral Jack', hp: 180000, damage: 680, pearl: 200, xp: 4500, requiredKills: 40 },
    2: { name: 'Admiral Ratpack', hp: 320000, damage: 1050, pearl: 380, xp: 8000, requiredKills: 45 },
    3: { name: 'Admiral Renegado', hp: 560000, damage: 1550, pearl: 650, xp: 13000, requiredKills: 50 },
    4: { name: 'Admiral Calico', hp: 950000, damage: 2300, pearl: 1100, xp: 20000, requiredKills: 55 },
    5: { name: 'Admiral Morgan', hp: 1600000, damage: 3300, pearl: 1850, xp: 30000, requiredKills: 60 },
    6: { name: 'Admiral Sinclare', hp: 2600000, damage: 4700, pearl: 2900, xp: 44000, requiredKills: 65 },
    7: { name: 'Admiral Dutchman', hp: 4200000, damage: 6500, pearl: 4300, xp: 62000, requiredKills: 70 },
    8: { name: 'Admiral Kilimatu', hp: 6500000, damage: 8500, pearl: 6200, xp: 85000, requiredKills: 75 },
    9: { name: 'Admiral Kiribati', hp: 9500000, damage: 11000, pearl: 8800, xp: 115000, requiredKills: 80 },
    10: { name: 'Admiral Dutchman', hp: 14000000, damage: 14500, pearl: 12500, xp: 155000, requiredKills: 90 }
  }
};
