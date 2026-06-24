const cache = new Map();
const pending = new Map();

const DEFAULT_TTL = 30000;
const MAX_CACHE_SIZE = 5000;

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key);
  }
  if (cache.size > MAX_CACHE_SIZE) {
    const toDelete = cache.size - MAX_CACHE_SIZE;
    const keys = [...cache.keys()].slice(0, toDelete);
    for (const key of keys) cache.delete(key);
  }
}, 300000).unref();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data, ttl = DEFAULT_TTL) {
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

function del(key) {
  cache.delete(key);
}

function clear() {
  cache.clear();
}

function delByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

async function query(pool, sql, params = [], ttl = DEFAULT_TTL) {
  const cacheKey = `${sql}|${JSON.stringify(params)}`;

  const cached = get(cacheKey);
  if (cached !== null) return cached;

  if (pending.has(cacheKey)) {
    return pending.get(cacheKey);
  }

  const promise = pool.query(sql, params).then(result => {
    set(cacheKey, result, ttl);
    pending.delete(cacheKey);
    return result;
  }).catch(err => {
    pending.delete(cacheKey);
    throw err;
  });

  pending.set(cacheKey, promise);
  return promise;
}

function getStats() {
  return { size: cache.size, pending: pending.size };
}

module.exports = { get, set, del, clear, delByPrefix, query, getStats };
