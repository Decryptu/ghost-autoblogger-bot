function stripFence(text) {
  const trimmed = (text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

function extractJson(text) {
  const source = stripFence(text);

  const objectAt = source.indexOf('{');
  const arrayAt = source.indexOf('[');
  const candidates = [objectAt, arrayAt].filter(i => i !== -1);
  if (candidates.length === 0) return null;

  // Earliest bracket wins, or `{"items": [...]}` would yield the inner array.
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
