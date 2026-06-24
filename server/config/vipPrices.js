const VIP_PRICES = {
  7:  { TRY: 99,  USD: 3,    EUR: 2.5 },
  30: { TRY: 249, USD: 8,    EUR: 7 },
  90: { TRY: 599, USD: 18,   EUR: 15 }
};

const CURRENCIES = {
  symbols: { TRY: '₺', USD: '$', EUR: '€' },
  locales: { TRY: 'tr-TR', USD: 'en-US', EUR: 'de-DE' }
};

const COUNTRY_TO_CURRENCY = {
  TR: 'TRY',
  // Eurozone
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR',
  SI: 'EUR', LT: 'EUR', LV: 'EUR', EE: 'EUR', CY: 'EUR', MT: 'EUR',
  LU: 'EUR', HR: 'EUR',
  // Default
  DEFAULT: 'USD'
};

module.exports = { VIP_PRICES, CURRENCIES, COUNTRY_TO_CURRENCY };
