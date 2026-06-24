const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const authMiddleware = require('../middleware/auth');
const { VIP_PRICES, CURRENCIES, COUNTRY_TO_CURRENCY } = require('../config/vipPrices');

function detectCurrency(ip) {
  const geo = ip ? geoip.lookup(ip) : null;
  if (!geo || !geo.country) return COUNTRY_TO_CURRENCY.DEFAULT;
  return COUNTRY_TO_CURRENCY[geo.country] || COUNTRY_TO_CURRENCY.DEFAULT;
}

router.get('/prices', authMiddleware, (req, res) => {
  res.json({
    prices: VIP_PRICES,
    currencies: CURRENCIES
  });
});

router.get('/currency', authMiddleware, (req, res) => {
  const override = req.query.currency;
  const validCurrencies = Object.keys(CURRENCIES.symbols);

  if (override && validCurrencies.includes(override.toUpperCase())) {
    return res.json({ currency: override.toUpperCase(), source: 'manual' });
  }

  const ip = req.ip || req.connection?.remoteAddress || '';
  const ipClean = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1'
    ? null
    : ip.replace(/^::ffff:/, '');
  const currency = detectCurrency(ipClean);
  res.json({ currency, source: 'geo' });
});

module.exports = router;
module.exports.detectCurrency = detectCurrency;
