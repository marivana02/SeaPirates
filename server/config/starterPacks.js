const STARTER_PACKS = {
  basic: {
    id: 'basic',
    name: 'Başlangıç Paketi',
    price: { TRY: 100, USD: 3, EUR: 2.5 },
    items: {
      gold: 10000,
      pearl: 1000,
      ammo: { 2: 5000 },
      items: { barut: 1000, zirh: 1000 },
      cannons: { 1: 5 }
    }
  },
  medium: {
    id: 'medium',
    name: 'Korsan Destek Paketi',
    price: { TRY: 300, USD: 9, EUR: 8 },
    items: {
      gold: 30000,
      pearl: 3500,
      ammo: { 2: 10000, 3: 2000 },
      items: { barut: 2500, zirh: 2500 },
      cannons: { 1: 10, 2: 5 }
    }
  },
  premium: {
    id: 'premium',
    name: 'Kaptan Paketi',
    price: { TRY: 600, USD: 18, EUR: 16 },
    items: {
      gold: 75000,
      pearl: 7000,
      ammo: { 2: 20000, 3: 5000 },
      items: { barut: 5000, zirh: 5000 },
      cannons: { 1: 15, 2: 8, 3: 4 }
    },
    design: 'seahawk'
  }
};

module.exports = { STARTER_PACKS };
