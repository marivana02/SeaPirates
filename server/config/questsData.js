const QUESTS = {
  // ═══════════════ LEVEL 1 — Map 1 (Blackpearl) ═══════════════
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
    title: 'Top Ateşi',
    levelReq: 1,
    desc: 'Blackpearl gemilerine toplamda 5.000 hasar vererek nişancılığını konuştur.',
    objectives: [
      { type: 'damage', target: 'Blackpearl', amount: 5000, label: 'Blackpearl\'e hasar ver' }
    ],
    rewards: { gold: 200, pearl: 5, xp: 80 }
  },
  3: {
    id: 3,
    title: 'Pırıltı Avcısı',
    levelReq: 1,
    desc: 'Denizde yüzen pırıltılardan 10 adet topla ve 3 Blackpearl gemisini daha batır.',
    objectives: [
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' },
      { type: 'kill', target: 'Blackpearl', amount: 3, label: 'Blackpearl gemisi batır' }
    ],
    rewards: { gold: 150, pearl: 3, xp: 50 }
  },

  // ═══════════════ LEVEL 2 — Map 2 (Wild 13) ═══════════════
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
    title: 'Hasar Tufanı',
    levelReq: 2,
    desc: 'Wild 13 çetesine 15.000 hasar ver ve denizlerin hakimi olacağını göster.',
    objectives: [
      { type: 'damage', target: 'Wild 13', amount: 15000, label: 'Wild 13\'e hasar ver' }
    ],
    rewards: { gold: 400, pearl: 10, xp: 200 }
  },
  6: {
    id: 6,
    title: 'Derin Dalış',
    levelReq: 2,
    desc: 'Denizde yüzen 15 pırıltıyı topla ve 5.000 hasar daha ver. Korsan hazinen büyüyor!',
    objectives: [
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' },
      { type: 'damage', amount: 5000, label: 'Herhangi düşmana hasar ver' }
    ],
    rewards: { gold: 300, pearl: 8, xp: 150 }
  },

  // ═══════════════ LEVEL 3 — Maps 3-4 (Wild 13, Tortuga Gang) ═══════════════
  7: {
    id: 7,
    title: 'Korsan Kovalayan',
    levelReq: 3,
    desc: 'Tortuga Gang ve Wild 13 çetelerini avla. İkisini birbirine düşman et!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 4, label: 'Tortuga Gang gemisi batır' },
      { type: 'kill', target: 'Wild 13', amount: 4, label: 'Wild 13 gemisi batır' }
    ],
    rewards: { gold: 700, pearl: 18, xp: 450 }
  },
  8: {
    id: 8,
    title: 'Ateş Hattı',
    levelReq: 3,
    desc: 'Tortuga Gang çetesine 30.000 hasar ver. Onlara korkuyu önce sen öğret!',
    objectives: [
      { type: 'damage', target: 'Tortuga Gang', amount: 30000, label: 'Tortuga Gang\'e hasar ver' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 800, pearl: 22, xp: 500 }
  },
  9: {
    id: 9,
    title: 'Pırıltı Hırsızı',
    levelReq: 3,
    desc: '20 pırıltı topla ve 3 Tortuga gemisini batır. Sen durdurulamazsın!',
    objectives: [
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' },
      { type: 'kill', target: 'Tortuga Gang', amount: 3, label: 'Tortuga Gang gemisi batır' }
    ],
    rewards: { gold: 500, pearl: 15, xp: 350 }
  },

  // ═══════════════ LEVEL 4 — Map 4 (Tortuga Gang) ═══════════════
  10: {
    id: 10,
    title: 'Tortuga Üstü',
    levelReq: 4,
    desc: 'Tortuga Gang gemilerinden 8 tane batır ve 10 pırıltı topla. Korsan adasını temizle!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 8, label: 'Tortuga Gang gemisi batır' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1000, pearl: 30, xp: 800 }
  },
  11: {
    id: 11,
    title: 'Korkunç Hasar',
    levelReq: 4,
    desc: 'Toplamda 75.000 hasar ver. Düşmanlar adını korkuyla ansın!',
    objectives: [
      { type: 'damage', amount: 75000, label: 'Herhangi düşmana hasar ver' }
    ],
    rewards: { gold: 900, pearl: 25, xp: 700 }
  },
  12: {
    id: 12,
    title: 'Denizlerin Sırrı',
    levelReq: 4,
    desc: '25 pırıltı topla ve Tortuga çetesine 30.000 hasar daha ver!',
    objectives: [
      { type: 'glitter', amount: 25, label: 'Pırıltı topla' },
      { type: 'damage', target: 'Tortuga Gang', amount: 30000, label: 'Tortuga Gang\'e hasar ver' }
    ],
    rewards: { gold: 750, pearl: 20, xp: 600 }
  },

  // ═══════════════ LEVEL 5 — Map 5 (Red Korsar) ═══════════════
  13: {
    id: 13,
    title: 'Kızıl Korsan Tehdidi',
    levelReq: 5,
    desc: 'Red Korsar gemilerini batır ve pırıltılarını al. Kızıl dalga durdurulacak!',
    objectives: [
      { type: 'kill', target: 'Red Korsar', amount: 8, label: 'Red Korsar gemisi batır' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1400, pearl: 45, xp: 1200 }
  },
  14: {
    id: 14,
    title: 'Ateş Gücü',
    levelReq: 5,
    desc: 'Red Korsar\'a 80.000 ve diğer düşmanlara 70.000 hasar ver. Toplam ateş gücünü göster!',
    objectives: [
      { type: 'damage', target: 'Red Korsar', amount: 80000, label: 'Red Korsar\'a hasar ver' },
      { type: 'damage', amount: 70000, label: 'Diğer düşmanlara hasar ver' }
    ],
    rewards: { gold: 1200, pearl: 38, xp: 1000 }
  },
  15: {
    id: 15,
    title: 'Kızıl Hazine',
    levelReq: 5,
    desc: 'Red Korsar filosuna 100.000 hasar ver ve 15 pırıltı ele geçir!',
    objectives: [
      { type: 'damage', target: 'Red Korsar', amount: 100000, label: 'Red Korsar\'a hasar ver' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1300, pearl: 40, xp: 1100 }
  },

  // ═══════════════ LEVEL 6 — Map 6 (Morgansbuccaneers) ═══════════════
  16: {
    id: 16,
    title: 'Morgan Korkusu',
    levelReq: 6,
    desc: 'Morgansbuccaneers gemilerinden 6 adet batır. Morgan\'a mesaj gönder!',
    objectives: [
      { type: 'kill', target: 'Morgansbuccaneers', amount: 6, label: 'Morgansbuccaneers gemisi batır' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1800, pearl: 60, xp: 2000 }
  },
  17: {
    id: 17,
    title: 'Hırçın Dalgalar',
    levelReq: 6,
    desc: 'Düşmanlara 250.000 hasar ver ve 15 pırıltı topla. Denizler senin!',
    objectives: [
      { type: 'damage', amount: 250000, label: 'Herhangi düşmana hasar ver' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2000, pearl: 65, xp: 2200 }
  },
  18: {
    id: 18,
    title: 'Parıltı Fırtınası',
    levelReq: 6,
    desc: '35 pırıltı topla ve Morgan adamlarına 100.000 hasar ver!',
    objectives: [
      { type: 'glitter', amount: 35, label: 'Pırıltı topla' },
      { type: 'damage', target: 'Morgansbuccaneers', amount: 100000, label: 'Morgansbuccaneers\'a hasar ver' }
    ],
    rewards: { gold: 1500, pearl: 50, xp: 1800 }
  },

  // ═══════════════ LEVEL 7 — Map 7-8 (Morgansbuccaneers, Admiral Jack) ═══════════════
  19: {
    id: 19,
    title: 'Amiralin Peşinde',
    levelReq: 7,
    desc: 'Amiral Jack\'e 100.000 hasar ver ve etrafındaki 4 Morgan korsanını temizle!',
    objectives: [
      { type: 'damage', target: 'Admiral Jack', amount: 100000, label: 'Amiral Jack\'e hasar ver (Boss!)' },
      { type: 'kill', target: 'Morgansbuccaneers', amount: 4, label: 'Morgansbuccaneers gemisi batır' }
    ],
    rewards: { gold: 2500, pearl: 90, xp: 3500 }
  },
  20: {
    id: 20,
    title: 'Kuşatma',
    levelReq: 7,
    desc: 'Morgan korsanlarına 200.000 hasar ver ve 15 pırıltı topla. Amiraline yardım edemeyecekler!',
    objectives: [
      { type: 'damage', target: 'Morgansbuccaneers', amount: 200000, label: 'Morgansbuccaneers\'a hasar ver' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2200, pearl: 80, xp: 3000 }
  },
  21: {
    id: 21,
    title: 'Büyük Vuruş',
    levelReq: 7,
    desc: 'Toplamda 400.000 hasar ver ve 3 Morgan gemisini batır. Savaş öncesi ısınma!',
    objectives: [
      { type: 'damage', amount: 400000, label: 'Herhangi düşmana hasar ver' },
      { type: 'kill', target: 'Morgansbuccaneers', amount: 3, label: 'Morgansbuccaneers gemisi batır' }
    ],
    rewards: { gold: 2400, pearl: 85, xp: 3200 }
  },

  // ═══════════════ LEVEL 8 — Map 8 (Morgansbuccaneers, Flyingdutchman) ═══════════════
  22: {
    id: 22,
    title: 'Hayalet Gemi Avı',
    levelReq: 8,
    desc: 'Flyingdutchman gemilerinden 4 tane ve Morgan korsanlarından 4 tane batır. Hayaletlere korku sal!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 4, label: 'Flyingdutchman gemisi batır' },
      { type: 'kill', target: 'Morgansbuccaneers', amount: 4, label: 'Morgansbuccaneers gemisi batır' }
    ],
    rewards: { gold: 3000, pearl: 110, xp: 5000 }
  },
  23: {
    id: 23,
    title: 'Hollandalı Laneti',
    levelReq: 8,
    desc: 'Flyingdutchman gemilerine 300.000 hasar ver ve 15 pırıltı topla. Laneti kır!',
    objectives: [
      { type: 'damage', target: 'Flyingdutchman', amount: 300000, label: 'Flyingdutchman\'a hasar ver' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 3200, pearl: 120, xp: 5200 }
  },
  24: {
    id: 24,
    title: 'Deniz Hazinesi',
    levelReq: 8,
    desc: '45 pırıltı topla ve 3 hayalet gemiyi batır. Zengin olma vakti!',
    objectives: [
      { type: 'glitter', amount: 45, label: 'Pırıltı topla' },
      { type: 'kill', target: 'Flyingdutchman', amount: 3, label: 'Flyingdutchman gemisi batır' }
    ],
    rewards: { gold: 2600, pearl: 95, xp: 4200 }
  },

  // ═══════════════ LEVEL 9 — Map 9 (Flyingdutchman) ═══════════════
  25: {
    id: 25,
    title: 'Hayalet Filosu',
    levelReq: 9,
    desc: 'Flyingdutchman gemilerinden 3 adet batır ve 20 pırıltı topla. Hayaletler son bulacak!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 3, label: 'Flyingdutchman gemisi batır' },
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 3800, pearl: 140, xp: 6500 }
  },
  26: {
    id: 26,
    title: 'Efsanevi Yıkım',
    levelReq: 9,
    desc: 'Düşmanlara toplamda 800.000 hasar ver. Efsane olma yolunda emin adımlar!',
    objectives: [
      { type: 'damage', amount: 800000, label: 'Herhangi düşmana hasar ver' }
    ],
    rewards: { gold: 4000, pearl: 150, xp: 7000 }
  },
  27: {
    id: 27,
    title: 'Karanlık Fırtına',
    levelReq: 9,
    desc: 'Flyingdutchman gemilerine 500.000 hasar ver ve 30 pırıltı topla. Karanlık fırtınayı durdur!',
    objectives: [
      { type: 'damage', target: 'Flyingdutchman', amount: 500000, label: 'Flyingdutchman\'a hasar ver' },
      { type: 'glitter', amount: 30, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 4200, pearl: 160, xp: 7500 }
  },

  // ═══════════════ LEVEL 10 — Map 10 (Flyingdutchman) ═══════════════
  28: {
    id: 28,
    title: 'Flyingdutchman Fatihi',
    levelReq: 10,
    desc: 'Flyingdutchman gemilerinden 5 adet batır ve 40 pırıltı topla. Son savaşın habercisi!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 5, label: 'Flyingdutchman gemisi batır' },
      { type: 'glitter', amount: 40, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 5000, pearl: 200, xp: 10000 }
  },
  29: {
    id: 29,
    title: 'Kıyamet Günü',
    levelReq: 10,
    desc: 'Toplamda 3.000.000 hasar ver ve 3 Flyingdutchman gemisini daha batır. Kıyamet kapıda!',
    objectives: [
      { type: 'damage', amount: 3000000, label: 'Herhangi düşmana hasar ver' },
      { type: 'kill', target: 'Flyingdutchman', amount: 3, label: 'Flyingdutchman gemisi batır' }
    ],
    rewards: { gold: 6000, pearl: 250, xp: 12000 }
  },
  30: {
    id: 30,
    title: 'Sonsuz Okyanus',
    levelReq: 10,
    desc: '80 pırıltı topla ve Flyingdutchman filosuna 2.000.000 hasar ver. Efsane tamamlanıyor!',
    objectives: [
      { type: 'glitter', amount: 80, label: 'Pırıltı topla' },
      { type: 'damage', target: 'Flyingdutchman', amount: 2000000, label: 'Flyingdutchman\'a hasar ver' }
    ],
    rewards: { gold: 7000, pearl: 300, xp: 15000 }
  },

  // ═══════════════ BONUS GÖREVLER (30dk süreli) ═══════════════
  101: {
    id: 101, title: 'Zaman Baskını I', levelReq: 1,
    desc: 'Kaptan! 30 dakikan var. Blackpearl filosunu yok et!',
    objectives: [
      { type: 'kill', target: 'Blackpearl', amount: 8, label: 'Blackpearl gemisi batır' },
      { type: 'damage', amount: 10000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 10, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 600, pearl: 15, xp: 200 }, timeLimit: 30
  },
  102: {
    id: 102, title: 'Fırtına Öncesi II', levelReq: 2,
    desc: '30 dakika içinde Wild 13 çetesini dağıt!',
    objectives: [
      { type: 'kill', target: 'Wild 13', amount: 10, label: 'Wild 13 gemisi batır' },
      { type: 'damage', amount: 30000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 15, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 1000, pearl: 25, xp: 500 }, timeLimit: 30
  },
  103: {
    id: 103, title: 'Korsan Fırtınası III', levelReq: 3,
    desc: '30 dakika içinde Tortuga ve Wild 13 çetelerini yok et!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 6, label: 'Tortuga Gang gemisi batır' },
      { type: 'kill', target: 'Wild 13', amount: 6, label: 'Wild 13 gemisi batır' },
      { type: 'damage', amount: 80000, label: 'Düşmana hasar ver' }
    ],
    rewards: { gold: 1500, pearl: 40, xp: 900 }, timeLimit: 30
  },
  104: {
    id: 104, title: 'Cehennem Dalgası IV', levelReq: 4,
    desc: '30 dakika içinde Tortuga çetesine son ver!',
    objectives: [
      { type: 'kill', target: 'Tortuga Gang', amount: 15, label: 'Tortuga Gang gemisi batır' },
      { type: 'damage', amount: 150000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 25, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2000, pearl: 60, xp: 1600 }, timeLimit: 30
  },
  105: {
    id: 105, title: 'Kızıl Tayfun V', levelReq: 5,
    desc: '30 dakika içinde Red Korsar filosunu dağıt!',
    objectives: [
      { type: 'kill', target: 'Red Korsar', amount: 12, label: 'Red Korsar gemisi batır' },
      { type: 'damage', amount: 300000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 20, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 2800, pearl: 90, xp: 2400 }, timeLimit: 30
  },
  106: {
    id: 106, title: 'Derin Karanlık VI', levelReq: 6,
    desc: '30 dakika içinde Morgan\'a korku sal!',
    objectives: [
      { type: 'kill', target: 'Morgansbuccaneers', amount: 10, label: 'Morgansbuccaneers gemisi batır' },
      { type: 'damage', amount: 500000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 30, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 3600, pearl: 120, xp: 4000 }, timeLimit: 30
  },
  107: {
    id: 107, title: 'Amiralin Gazabı VII', levelReq: 7,
    desc: '30 dakika içinde Amiral Jack\'e 200.000 hasar ver ve korsanlarını temizle!',
    objectives: [
      { type: 'damage', target: 'Admiral Jack', amount: 200000, label: 'Amiral Jack\'e hasar ver' },
      { type: 'kill', target: 'Morgansbuccaneers', amount: 8, label: 'Morgansbuccaneers gemisi batır' },
      { type: 'glitter', amount: 40, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 5000, pearl: 180, xp: 6500 }, timeLimit: 30
  },
  108: {
    id: 108, title: 'Mahşerin Dört Atılısı VIII', levelReq: 8,
    desc: '30 dakika içinde hayalet filoyu durdur!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 6, label: 'Flyingdutchman gemisi batır' },
      { type: 'damage', amount: 1200000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 50, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 6500, pearl: 250, xp: 10000 }, timeLimit: 30
  },
  109: {
    id: 109, title: 'Hayalet Fırtına IX', levelReq: 9,
    desc: '30 dakika içinde Flyingdutchman filosunu yok et!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 6, label: 'Flyingdutchman gemisi batır' },
      { type: 'damage', amount: 2000000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 60, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 8000, pearl: 300, xp: 14000 }, timeLimit: 30
  },
  110: {
    id: 110, title: 'Kıyamet Saati X', levelReq: 10,
    desc: '30 dakika içinde Flyingdutchman\'a son vuruşu yap!',
    objectives: [
      { type: 'kill', target: 'Flyingdutchman', amount: 8, label: 'Flyingdutchman gemisi batır' },
      { type: 'damage', amount: 3000000, label: 'Düşmana hasar ver' },
      { type: 'glitter', amount: 100, label: 'Pırıltı topla' }
    ],
    rewards: { gold: 12000, pearl: 500, xp: 25000 }, timeLimit: 30
  }
};

module.exports = QUESTS;
