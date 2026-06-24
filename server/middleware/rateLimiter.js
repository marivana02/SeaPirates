// Server-wide in-memory rate limiter and brute-force protection
const loginAttempts = new Map(); // IP -> { count, lockUntil }
const registerAttempts = new Map(); // IP -> { count, resetTime }

const MAX_LOGIN_ENTRIES = 10000;
const MAX_REGISTER_ENTRIES = 5000;
const MAX_API_ENTRIES = 10000;

// General login rate limiter and brute force protection
const loginRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (loginAttempts.has(ip)) {
    const record = loginAttempts.get(ip);
    
    // Check if lock duration has expired
    if (record.lockUntil && now < record.lockUntil) {
      const remainingMin = Math.ceil((record.lockUntil - now) / 60000);
      return res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${remainingMin} minutes.`
      });
    }

    // Lock expired, reset the record
    if (record.lockUntil && now >= record.lockUntil) {
      loginAttempts.delete(ip);
    }
  }

  next();
};

// Trigger IP lock on failed login attempts
const recordFailedLogin = (ip) => {
  const now = Date.now();
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, lockUntil: null, firstAttempt: now });
  } else {
    const record = loginAttempts.get(ip);
    
    // Reset counter if 5 minutes have passed since first attempt
    if (now - record.firstAttempt > 300000) {
      record.count = 1;
      record.firstAttempt = now;
    } else {
      record.count += 1;
      if (record.count >= 5) {
        record.lockUntil = now + 900000; // 15 minute lock (900.000 ms)
      }
    }
    loginAttempts.set(ip, record);
  }
};

// Clear IP record on successful login
const recordSuccessfulLogin = (ip) => {
  loginAttempts.delete(ip);
};

// Registration rate limiter (max 5 accounts per hour per IP)
const registerRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const ONE_HOUR = 3600000;

  if (!registerAttempts.has(ip)) {
    registerAttempts.set(ip, { count: 1, resetTime: now + ONE_HOUR });
  } else {
    const record = registerAttempts.get(ip);
    if (now > record.resetTime) {
      // Reset if 1 hour has passed
      registerAttempts.set(ip, { count: 1, resetTime: now + ONE_HOUR });
    } else {
      record.count += 1;
      if (record.count > 5) {
        const remainingMin = Math.ceil((record.resetTime - now) / 60000);
        return res.status(429).json({
          error: `Security limit: max 5 accounts per hour. Please try again in ${remainingMin} minutes.`
        });
      }
      registerAttempts.set(ip, record);
    }
  }

  next();
};

// ── General API Rate Limiter ──
// Limits requests per IP per sliding window for non-auth endpoints
const apiCalls = new Map();

function createApiRateLimiter(maxRequests, windowMs, name = 'api') {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const key = `${name}:${ip}`;

    if (!apiCalls.has(key)) {
      apiCalls.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = apiCalls.get(key);
    if (now > record.resetTime) {
      apiCalls.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      const remainingSec = Math.ceil((record.resetTime - now) / 1000);
      return res.status(429).json({
        error: `Rate limit exceeded. Try again in ${remainingSec} seconds.`
      });
    }

    next();
  };
}

// Pre-configured limiters
const standardRateLimiter = createApiRateLimiter(300, 60000, 'standard'); // 300 req/min (test için yükseltildi)
const strictRateLimiter = createApiRateLimiter(20, 60000, 'strict');      // 20 req/min

// Periodic cleanup: every 15 min, remove old records
setInterval(() => {
  const now = Date.now();
  const THIRTY_MIN = 1800000;

  for (const [ip, record] of loginAttempts) {
    if (now - (record.firstAttempt || 0) > THIRTY_MIN) {
      loginAttempts.delete(ip);
    }
  }

  for (const [ip, record] of registerAttempts) {
    if (record.resetTime && record.resetTime + THIRTY_MIN < now) {
      registerAttempts.delete(ip);
    }
  }

  for (const [key, record] of apiCalls) {
    if (now > record.resetTime + THIRTY_MIN) {
      apiCalls.delete(key);
    }
  }

  // Enforce max size limits
  if (loginAttempts.size > MAX_LOGIN_ENTRIES) {
    const toDelete = [...loginAttempts.keys()].slice(0, loginAttempts.size - MAX_LOGIN_ENTRIES);
    for (const ip of toDelete) loginAttempts.delete(ip);
  }
  if (registerAttempts.size > MAX_REGISTER_ENTRIES) {
    const toDelete = [...registerAttempts.keys()].slice(0, registerAttempts.size - MAX_REGISTER_ENTRIES);
    for (const ip of toDelete) registerAttempts.delete(ip);
  }
  if (apiCalls.size > MAX_API_ENTRIES) {
    const toDelete = [...apiCalls.keys()].slice(0, apiCalls.size - MAX_API_ENTRIES);
    for (const key of toDelete) apiCalls.delete(key);
  }
}, 900000);

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
  registerRateLimiter,
  createApiRateLimiter,
  standardRateLimiter,
  strictRateLimiter
};
