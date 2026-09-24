function memo(fn, ttlMs) {
  const entries = new Map();

  return async (...args) => {
    const key = JSON.stringify(args);
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await fn(...args);
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}

module.exports = { memo };
