/**
 * Memoize an async function for `ttlMs`, keyed by its JSON-stringified args.
 * Process-local: it exists so a single run (e.g. `--run`, which fires both
 * agents) does not hit the same read-only endpoint twice.
 */
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
