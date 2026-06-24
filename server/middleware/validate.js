const response = require('../helpers/response');

const VALIDATORS = {
  username(v) {
    return typeof v === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(v);
  },
  password(v) {
    return typeof v === 'string' && v.length >= 8 && v.length <= 100;
  },
  email(v) {
    return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  },
  id(v) {
    return Number.isInteger(Number(v)) && Number(v) > 0;
  },
  positiveInt(v) {
    return Number.isInteger(Number(v)) && Number(v) >= 0;
  },
  boolean(v) {
    return v === true || v === false || v === 'true' || v === 'false';
  },
  string(v, maxLen = 255) {
    return typeof v === 'string' && v.length <= maxLen;
  },
  inRange(v, min, max) {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max;
  },
  array(v) {
    return Array.isArray(v);
  },
  object(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }
};

function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, validations] of Object.entries(rules)) {
      if (!Array.isArray(validations)) continue;

      const value = field.includes('.')
        ? field.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), req.body)
        : req.body[field];

      for (const v of validations) {
        if (typeof v === 'function') {
          const result = v(value, req.body);
          if (result !== true) {
            errors.push(result || `${field} is invalid`);
            break;
          }
        }
      }
    }

    if (errors.length > 0) {
      return response.badRequest(res, errors.join('; '));
    }

    next();
  };
}

module.exports = { validate, VALIDATORS };
