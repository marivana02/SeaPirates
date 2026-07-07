const QUESTS = {
  // ═══════════════ LEVEL 1 — Map 1 (Blackpearl, Rackham, Calicos Jack) ═══════════════
  1: {
    id: 1,
    title: 'Acemi Tayfa',
    levelReq: 1,
    desc: 'Korsanlıkta ilk adım: Blackpearl gemilerini batır ve denizdeki pırıltıları topla.',
    objectives: [
      { type: 'kill', target: 'Blackpearl', amount: 5, label: 'Blackpearl gemisi batır' },
      { type: 'glitter', amount: 5, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 300, pearl: 8, xp: 100 }
  },
  2: {
    id: 2,
    title: 'Mühimmat Alışverişi',
    levelReq: 1,
    desc: 'Shop\'tan cephane satın al. Topların hiç susmasın!',
    objectives: [
      { type: 'buy', itemGroup: 'gulle', amount: 1, label: 'Shop\'tan cephane satın al' }
    ],
    rewards: { gold: 200, pearl: 5, xp: 80 }
  },
  3: {
    id: 3,
    title: 'Pırıltı Avcısı',
    levelReq: 1,
    desc: 'Denizde yüzen pırıltılardan 10 adet topla ve Rackham gemilerini batır.',
    objectives: [
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' },
      { type: 'kill', target: 'Rackham', amount: 3, label: 'Rackham gemisi batır' }
    ],
    rewards: { gold: 150, pearl: 3, xp: 50 }
  },

  // ═══════════════ LEVEL 2 — Map 2 (Wild 13, Red Korsar, Ratpack) ═══════════════
  4: {
    id: 4,
    title: 'Vahşi Sular',
    levelReq: 2,
    desc: 'Wild 13 gemilerini batır ve pırıltıları topla. Bu sularda kimse güvende değil!',
    objectives: [
      { type: 'kill', target: 'Wild 13', amount: 6, label: 'Wild 13 gemisi batır' },
      { type: 'glitter', amount: 8, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 500, pearl: 12, xp: 250 }
  },
  5: {
    id: 5,
    title: 'Cephane Takviyesi',
    levelReq: 2,
    desc: 'Shop\'tan daha fazla cephane satın al. Güçlü toplar güçlü cephane ister!',
    objectives: [
      { type: 'buy', itemGroup: 'gulle', amount: 1, label: 'Shop\'tan cephane satın al' }
    ],
    rewards: { gold: 400, pearl: 10, xp: 200 }
  },
  6: {
    id: 6,
    title: 'Derin Dalış',
    levelReq: 2,
    desc: 'Denizde yüzen 15 pırıltıyı topla ve Red Korsar gemilerine korku sal!',
    objectives: [
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' },
      { type: 'kill', target: 'Red Korsar', amount: 3, label: 'Red Korsar gemisi batır' }
    ],
    rewards: { gold: 300, pearl: 8, xp: 150 }
  },

  // ═══════════════ LEVEL 3 — Map 3 (Sinclares Men, Tortuga Gang, Los Renegados) ═══════════════
  7: {
    id: 7,
    title: 'Korsan Kovalayan',
    levelReq: 3,
    desc: 'Tortuga Gang gemilerini batır ve pırıltıları topla. Bu çeteye dersini ver!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 4, label: 'Tortuga Gang gemisi batır' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 700, pearl: 18, xp: 450 }
  },
  8: {
    id: 8,
    title: 'Renegado Tehdidi',
    levelReq: 3,
    desc: 'Los Renegados gemilerini avla. Bunlar Tortuga\'dan daha tehlikeli!',
    objectives: [
      { type: 'kill', target: 'Los Renegados', amount: 2, label: 'Los Renegados gemisi batır' }
    ],
    rewards: { gold: 800, pearl: 22, xp: 500 }
  },
  9: {
    id: 9,
    title: 'Amiral\'e Meydan Okuma',
    levelReq: 3,
    desc: 'Admiral Renegado\'ya toplam 200.000 hasar ver. Ona korkuyu sen öğret!',
    objectives: [
      { type: 'damage', target: 'Admiral Renegado', amount: 200000, label: 'Admiral Renegado\'ya hasar ver' }
    ],
    rewards: { gold: 500, pearl: 15, xp: 350 }
  },

  // ═══════════════ LEVEL 4 — Map 4 (Ratpack, Sinclares Men, Calocosmen) ═══════════════
  10: {
    id: 10,
    title: 'Ratpack İstilası',
    levelReq: 4,
    desc: 'Ratpack gemilerini batır ve pırıltıları topla. Fareler gemini ele geçirmesin!',
    objectives: [
      { type: 'kill', target: 'Ratpack', amount: 5, label: 'Ratpack gemisi batır' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1000, pearl: 30, xp: 800 }
  },
  11: {
    id: 11,
    title: 'Calocosmen Fatihi',
    levelReq: 4,
    desc: 'Calocosmen gemilerini batır. Bu devasa gemiler bile senin önünde duramaz!',
    objectives: [
      { type: 'kill', target: 'Calocosmen', amount: 2, label: 'Calocosmen gemisi batır' }
    ],
    rewards: { gold: 900, pearl: 25, xp: 700 }
  },
  12: {
    id: 12,
    title: 'Eski Düşmanlar',
    levelReq: 4,
    desc: 'Map 3\'e gidip Sinclares Men gemilerinden 5 tane batır. Eski hesapları kapat!',
    objectives: [
      { type: 'kill', target: 'Sinclares Men', amount: 5, label: 'Sinclares Men gemisi batır' }
    ],
    rewards: { gold: 750, pearl: 20, xp: 600 }
  },

  // ═══════════════ LEVEL 5 — Map 5 (Wild 13, Los Renegados, Morgansbuccaneers) ═══════════════
  13: {
    id: 13,
    title: 'Kızıl Korsan Tehdidi',
    levelReq: 5,
    desc: 'Wild 13 gemilerini batır ve pırıltılarını al. Kızıl dalga durdurulacak!',
    objectives: [
      { type: 'kill', target: 'Wild 13', amount: 5, label: 'Wild 13 gemisi batır' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1400, pearl: 45, xp: 1200 }
  },
  14: {
    id: 14,
    title: 'Morgan\'ın Adamları',
    levelReq: 5,
    desc: 'Morgansbuccaneers gemilerini batır. Bunlar en tehlikeli korsanlardan!',
    objectives: [
      { type: 'kill', target: 'Morgansbuccaneers', amount: 2, label: 'Morgansbuccaneers gemisi batır' }
    ],
    rewards: { gold: 1200, pearl: 38, xp: 1000 }
  },
  15: {
    id: 15,
    title: 'Amiral Morgan\'ın Gazabı',
    levelReq: 5,
    desc: 'Admiral Morgan\'a 750.000 hasar ver. Amirallerin en güçlüsüne kafa tut!',
    objectives: [
      { type: 'damage', target: 'Admiral Morgan', amount: 750000, label: 'Admiral Morgan\'a hasar ver' }
    ],
    rewards: { gold: 1300, pearl: 40, xp: 1100 }
  },

  // ═══════════════ LEVEL 6 — Map 6 (Tortuga Gang, Calocosmen, Sinclares Men) ═══════════════
  16: {
    id: 16,
    title: 'Tortuga Dönüşü',
    levelReq: 6,
    desc: 'Tortuga Gang gemilerini batır ve pırıltıları topla. Eski düşmanın hâlâ güçlü!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 5, label: 'Tortuga Gang gemisi batır' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1800, pearl: 60, xp: 2000 }
  },
  17: {
    id: 17,
    title: 'Hırçın Dalgalar',
    levelReq: 6,
    desc: 'Calocosmen gemilerinden 3 tane batır. Dalgalar kadar hırçınsın!',
    objectives: [
      { type: 'kill', target: 'Calocosmen', amount: 3, label: 'Calocosmen gemisi batır' }
    ],
    rewards: { gold: 2000, pearl: 65, xp: 2200 }
  },
  18: {
    id: 18,
    title: 'Eski Haritalara Yolculuk',
    levelReq: 6,
    desc: 'Map 5\'e gidip Los Renegados gemilerinden 3 tane batır. Geçmişi temizle!',
    objectives: [
      { type: 'kill', target: 'Los Renegados', amount: 3, label: 'Los Renegados gemisi batır' }
    ],
    rewards: { gold: 1500, pearl: 50, xp: 1800 }
  },

  // ═══════════════ LEVEL 7 — Map 7 (Morgansbuccaneers, Sinclares Men, Flyingdutchman) ═══════════════
  19: {
    id: 19,
    title: 'Amiralin Peşinde',
    levelReq: 7,
    desc: 'Morgansbuccaneers gemilerini batır ve pırıltıları topla. Amiral yakında!',
    objectives: [
      { type: 'kill', target: 'Morgansbuccaneers', amount: 5, label: 'Morgansbuccaneers gemisi batır' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2500, pearl: 90, xp: 3500 }
  },
  20: {
    id: 20,
    title: 'Hayalet Gemi Avı',
    levelReq: 7,
    desc: 'Flyingdutchman gemilerinden 2 tane batır. Hayaletler bile senden korkacak!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 2, label: 'Flyingdutchman gemisi batır' }
    ],
    rewards: { gold: 2200, pearl: 80, xp: 3000 }
  },
  21: {
    id: 21,
    title: 'Büyük Vuruş',
    levelReq: 7,
    desc: 'Admiral Dutchman\'a 1.500.000 hasar ver. Hayalet amirali devirme vakti!',
    objectives: [
      { type: 'damage', target: 'Admiral Dutchman', amount: 1500000, label: 'Admiral Dutchman\'a hasar ver' }
    ],
    rewards: { gold: 2400, pearl: 85, xp: 3200 }
  },

  // ═══════════════ LEVEL 8 — Map 8 (Kiliwallis, Flyingdutchman, Kilimatu) ═══════════════
  22: {
    id: 22,
    title: 'Kiliwallis Avı',
    levelReq: 8,
    desc: 'Kiliwallis gemilerini batır ve pırıltıları topla. Yeni sularda yeni düşmanlar!',
    objectives: [
      { type: 'kill', target: 'Kiliwallis', amount: 5, label: 'Kiliwallis gemisi batır' },
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 3000, pearl: 110, xp: 5000 }
  },
  23: {
    id: 23,
    title: 'Kilimatu Laneti',
    levelReq: 8,
    desc: 'Kilimatu gemilerinden 2 tane batır. Bu lanetli gemileri durdur!',
    objectives: [
      { type: 'kill', target: 'Kilimatu', amount: 2, label: 'Kilimatu gemisi batır' }
    ],
    rewards: { gold: 3200, pearl: 120, xp: 5200 }
  },
  24: {
    id: 24,
    title: 'Efsanevi Sulara Yolculuk',
    levelReq: 8,
    desc: 'Map 7\'ye gidip Sinclares Men gemilerinden 4 tane batır. Efsaneler seni bekliyor!',
    objectives: [
      { type: 'kill', target: 'Sinclares Men', amount: 4, label: 'Sinclares Men gemisi batır' }
    ],
    rewards: { gold: 2600, pearl: 95, xp: 4200 }
  },

  // ═══════════════ LEVEL 9 — Map 9 (Kokelua, Morgansbuccaneers, Kiribati) ═══════════════
  25: {
    id: 25,
    title: 'Kokelua Filosu',
    levelReq: 9,
    desc: 'Kokelua gemilerini batır ve pırıltıları topla. Karanlık suların efendisi!',
    objectives: [
      { type: 'kill', target: 'Kokelua', amount: 5, label: 'Kokelua gemisi batır' },
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 3800, pearl: 140, xp: 6500 }
  },
  26: {
    id: 26,
    title: 'Kiribati Fatihi',
    levelReq: 9,
    desc: 'Kiribati gemilerinden 2 tane batır. Bu dev gemiler sonunuz olacak!',
    objectives: [
      { type: 'kill', target: 'Kiribati', amount: 2, label: 'Kiribati gemisi batır' }
    ],
    rewards: { gold: 4000, pearl: 150, xp: 7000 }
  },
  27: {
    id: 27,
    title: 'Hayaletlerle Savaş',
    levelReq: 9,
    desc: 'Map 8\'e gidip Flyingdutchman gemilerinden 3 tane batır. Hayalet filo yok edilecek!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 3, label: 'Flyingdutchman gemisi batır' }
    ],
    rewards: { gold: 4200, pearl: 160, xp: 7500 }
  },

  // ═══════════════ LEVEL 10 — Map 10 (Kilimatu, Kiribati, Flyingdutchman) ═══════════════
  28: {
    id: 28,
    title: 'Kilimatu İmha',
    levelReq: 10,
    desc: 'Kilimatu gemilerini batır ve pırıltıları topla. Son savaşın habercisi!',
    objectives: [
      { type: 'kill', target: 'Kilimatu', amount: 5, label: 'Kilimatu gemisi batır' },
      { type: 'glitter', amount: 30, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 5000, pearl: 200, xp: 10000 }
  },
  29: {
    id: 29,
    title: 'Kiribati Direnci',
    levelReq: 10,
    desc: 'Kiribati gemilerinden 3 tane batır. En zorlu düşmanların başı!',
    objectives: [
      { type: 'kill', target: 'Kiribati', amount: 3, label: 'Kiribati gemisi batır' }
    ],
    rewards: { gold: 6000, pearl: 250, xp: 12000 }
  },
  30: {
    id: 30,
    title: 'Efsanevi Flyingdutchman',
    levelReq: 10,
    desc: 'Flyingdutchman gemilerinden 5 tane batır. Efsane tamamlanıyor, son vuruşu yap!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 5, label: 'Flyingdutchman gemisi batır' }
    ],
    rewards: { gold: 7000, pearl: 300, xp: 15000 }
  },

  // ═══════════════ BONUS GÖREVLER (30dk süreli) ═══════════════
  101: {
    id: 101, title: 'Zaman Baskını I', levelReq: 1,
    desc: 'Kaptan! 30 dakikan var. Blackpearl filosunu yok et ve pırıltıları topla!',
    objectives: [
      { type: 'kill', target: 'Blackpearl', amount: 8, label: 'Blackpearl gemisi batır' },
      { type: 'damage', amount: 10000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 600, pearl: 15, xp: 200 }, timeLimit: 30
  },
  102: {
    id: 102, title: 'Fırtına Öncesi II', levelReq: 2,
    desc: '30 dakika içinde Wild 13 çetesini dağıt ve Red Korsar\'a korku sal!',
    objectives: [
      { type: 'kill', target: 'Wild 13', amount: 8, label: 'Wild 13 gemisi batır' },
      { type: 'kill', target: 'Red Korsar', amount: 3, label: 'Red Korsar gemisi batır' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1000, pearl: 25, xp: 500 }, timeLimit: 30
  },
  103: {
    id: 103, title: 'Korsan Fırtınası III', levelReq: 3,
    desc: '30 dakika içinde Tortuga ve Sinclares çetelerini yok et!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 4, label: 'Tortuga Gang gemisi batır' },
      { type: 'kill', target: 'Sinclares Men', amount: 4, label: 'Sinclares Men gemisi batır' },
      { type: 'damage', amount: 80000, label: 'Düşmana hasar ver' }
    ],
    rewards: { gold: 1500, pearl: 40, xp: 900 }, timeLimit: 30
  },
  104: {
    id: 104, title: 'Cehennem Dalgası IV', levelReq: 4,
    desc: '30 dakika içinde Ratpack ve Calocosmen filosuna son ver!',
    objectives: [
      { type: 'kill', target: 'Ratpack', amount: 4, label: 'Ratpack gemisi batır' },
      { type: 'kill', target: 'Calocosmen', amount: 2, label: 'Calocosmen gemisi batır' },
      { type: 'glitter', amount: 25, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2000, pearl: 60, xp: 1600 }, timeLimit: 30
  },
  105: {
    id: 105, title: 'Kızıl Tayfun V', levelReq: 5,
    desc: '30 dakika içinde Wild 13 ve Morgans filosunu dağıt!',
    objectives: [
      { type: 'kill', target: 'Wild 13', amount: 5, label: 'Wild 13 gemisi batır' },
      { type: 'damage', amount: 300000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2800, pearl: 90, xp: 2400 }, timeLimit: 30
  },
  106: {
    id: 106, title: 'Derin Karanlık VI', levelReq: 6,
    desc: '30 dakika içinde Tortuga ve Sinclares\'e korku sal!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 5, label: 'Tortuga Gang gemisi batır' },
      { type: 'kill', target: 'Sinclares Men', amount: 3, label: 'Sinclares Men gemisi batır' },
      { type: 'damage', amount: 500000, label: 'Düşmana hasar ver' }
    ],
    rewards: { gold: 3600, pearl: 120, xp: 4000 }, timeLimit: 30
  },
  107: {
    id: 107, title: 'Amiralin Gazabı VII', levelReq: 7,
    desc: '30 dakika içinde Morgan filosunu temizle ve Admiral Dutchman\'a hasar ver!',
    objectives: [
      { type: 'kill', target: 'Morgansbuccaneers', amount: 5, label: 'Morgansbuccaneers gemisi batır' },
      { type: 'damage', target: 'Admiral Dutchman', amount: 500000, label: 'Admiral Dutchman\'a hasar ver' },
      { type: 'glitter', amount: 40, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 5000, pearl: 180, xp: 6500 }, timeLimit: 30
  },
  108: {
    id: 108, title: 'Mahşerin Dört Atılısı VIII', levelReq: 8,
    desc: '30 dakika içinde Kiliwallis ve Kilimatu filosunu durdur!',
    objectives: [
      { type: 'kill', target: 'Kiliwallis', amount: 5, label: 'Kiliwallis gemisi batır' },
      { type: 'kill', target: 'Kilimatu', amount: 2, label: 'Kilimatu gemisi batır' },
      { type: 'damage', amount: 1200000, label: 'Düşmana hasar ver' }
    ],
    rewards: { gold: 6500, pearl: 250, xp: 10000 }, timeLimit: 30
  },
  109: {
    id: 109, title: 'Hayalet Fırtına IX', levelReq: 9,
    desc: '30 dakika içinde Kokelua ve Kiribati filosunu yok et!',
    objectives: [
      { type: 'kill', target: 'Kokelua', amount: 5, label: 'Kokelua gemisi batır' },
      { type: 'kill', target: 'Kiribati', amount: 2, label: 'Kiribati gemisi batır' },
      { type: 'glitter', amount: 60, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 8000, pearl: 300, xp: 14000 }, timeLimit: 30
  },
  110: {
    id: 110, title: 'Kıyamet Saati X', levelReq: 10,
    desc: '30 dakika içinde Kilimatu ve Flyingdutchman\'a son vuruşu yap!',
    objectives: [
      { type: 'kill', target: 'Kilimatu', amount: 5, label: 'Kilimatu gemisi batır' },
      { type: 'kill', target: 'Flyingdutchman', amount: 3, label: 'Flyingdutchman gemisi batır' },
      { type: 'damage', amount: 2000000, label: 'Düşmana hasar ver' }
    ],
    rewards: { gold: 12000, pearl: 500, xp: 25000 }, timeLimit: 30
  }
};

module.exports = QUESTS;
