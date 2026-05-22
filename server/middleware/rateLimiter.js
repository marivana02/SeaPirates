// Sunucu düzeyinde in-memory rate limiter ve brute-force koruma sistemi
const loginAttempts = new Map(); // IP -> { count, lockUntil }
const registerAttempts = new Map(); // IP -> { count, resetTime }

// Genel login rate limiter ve brute force koruması
const loginRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (loginAttempts.has(ip)) {
    const record = loginAttempts.get(ip);
    
    // Kilit süresi dolmuş mu kontrol et
    if (record.lockUntil && now < record.lockUntil) {
      const remainingMin = Math.ceil((record.lockUntil - now) / 60000);
      return res.status(429).json({
        error: `Çok fazla hatalı giriş denemesi yaptınız. Lütfen ${remainingMin} dakika sonra tekrar deneyin.`
      });
    }

    // Kilit süresi dolduysa kaydı sıfırla
    if (record.lockUntil && now >= record.lockUntil) {
      loginAttempts.delete(ip);
    }
  }

  next();
};

// Hatalı giriş durumunda sayacı artırıp IP kilitleme tetikleyici fonksiyon
const recordFailedLogin = (ip) => {
  const now = Date.now();
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, lockUntil: null, firstAttempt: now });
  } else {
    const record = loginAttempts.get(ip);
    
    // Eğer ilk denemeden 5 dakika geçmişse sayacı sıfırla
    if (now - record.firstAttempt > 300000) {
      record.count = 1;
      record.firstAttempt = now;
    } else {
      record.count += 1;
      if (record.count >= 5) {
        record.lockUntil = now + 900000; // 15 dakika kilit (900.000 ms)
      }
    }
    loginAttempts.set(ip, record);
  }
};

// Giriş başarılı olunca IP kaydını sıfırla
const recordSuccessfulLogin = (ip) => {
  loginAttempts.delete(ip);
};

// Kayıt olma rate limiter (IP başına saatte max 5 kayıt)
const registerRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const ONE_HOUR = 3600000;

  if (!registerAttempts.has(ip)) {
    registerAttempts.set(ip, { count: 1, resetTime: now + ONE_HOUR });
  } else {
    const record = registerAttempts.get(ip);
    if (now > record.resetTime) {
      // 1 saat dolduysa sıfırla
      registerAttempts.set(ip, { count: 1, resetTime: now + ONE_HOUR });
    } else {
      record.count += 1;
      if (record.count > 5) {
        const remainingMin = Math.ceil((record.resetTime - now) / 60000);
        return res.status(429).json({
          error: `Güvenlik nedeniyle saatte en fazla 5 hesap açabilirsiniz. Lütfen ${remainingMin} dakika sonra tekrar deneyin.`
        });
      }
      registerAttempts.set(ip, record);
    }
  }

  next();
};

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
  registerRateLimiter
};
