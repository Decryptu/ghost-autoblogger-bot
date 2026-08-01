/**
 * Read a required environment variable, failing loudly and early instead of
 * letting an SDK fail later with an opaque auth error.
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

module.exports = { requireEnv };
