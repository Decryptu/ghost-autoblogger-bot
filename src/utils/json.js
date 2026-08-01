/**
 * Tolerant JSON recovery for model output.
 *
 * Web-search calls cannot use structured outputs (JSON mode and the hosted
 * search tool are mutually exclusive), so their JSON has to be scanned out of
 * free text. Scanning must start at whichever opening bracket appears FIRST:
 * looking for `[` before `{` would silently pull the inner array out of
 * `{"items": [...]}` and return the wrong shape without erroring.
 */

/** Strip a leading/trailing markdown code fence, if any. */
function stripFence(text) {
  const trimmed = (text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

/**
 * Parse the first balanced JSON value (object or array) found in `text`.
 * Returns null when nothing parseable is present.
 */
function extractJson(text) {
  const source = stripFence(text);

  const objectAt = source.indexOf('{');
  const arrayAt = source.indexOf('[');
  const candidates = [objectAt, arrayAt].filter(i => i !== -1);
  if (candidates.length === 0) return null;

  const start = Math.min(...candidates);
  const open = source[start];
  const close = open === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Parse `text` as a JSON array. Accepts a bare array, or an object wrapping a
 * single array property (a shape models fall into on their own).
 */
function extractJsonArray(text) {
  const parsed = extractJson(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const wrapped = Object.values(parsed).find(v => Array.isArray(v));
    if (wrapped) return wrapped;
  }
  return [];
}

module.exports = { extractJson, extractJsonArray };
