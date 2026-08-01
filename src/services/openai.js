const { OpenAI } = require('openai');
const { MODEL, TASKS } = require('../config');
const { extractJson } = require('../utils/json');
const { requireEnv } = require('../utils/env');

/** @type {OpenAI | undefined} */
let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  }
  return client;
}

/**
 * Log cached input as a share of input on every call. Prefix drift shows up
 * here long before it shows up on a bill.
 */
function logUsage(task, usage) {
  if (!usage) return;
  const input = usage.input_tokens || 0;
  const cached = usage.input_tokens_details?.cached_tokens || 0;
  const output = usage.output_tokens || 0;
  const share = input > 0 ? Math.round((cached / input) * 100) : 0;
  console.log(`[openai:${task}] in=${input} cached=${cached} (${share}%) out=${output}`);
}

/**
 * Run a task profile from config.
 *
 * `instructions` must hold the stable, per-task prompt and `input` the volatile
 * payload — prompt caching matches a prefix, so a single changed byte near the
 * front discards everything after it. No prompt cache key is set: it scopes the
 * cache to a private namespace that starts empty, which lowers the hit rate.
 */
async function run(task, { instructions, input, schema }) {
  const profile = TASKS[task];
  if (!profile) throw new Error(`Unknown OpenAI task profile: ${task}`);

  const response = await getClient().responses.create({
    model: MODEL,
    instructions,
    input,
    max_output_tokens: profile.maxTokens,
    reasoning: { effort: profile.effort },
    store: false,
    ...(profile.search ? { tools: [{ type: 'web_search' }] } : {}),
    // Structured outputs and the hosted search tool are mutually exclusive:
    // search-backed calls ask for JSON in the prompt and recover it by scanning.
    ...(schema && !profile.search
      ? { text: { format: { type: 'json_schema', name: task, strict: true, schema } } }
      : {}),
  });
  logUsage(task, response.usage);

  const text = (response.output_text || '').trim();
  if (!text) {
    const reason = response.incomplete_details?.reason || response.status || 'unknown';
    throw new Error(`Empty model output for task "${task}" (${reason})`);
  }
  return text;
}

/** Run a task and return its text output. */
function complete(task, options) {
  return run(task, options);
}

/**
 * Run a task and return parsed JSON. Pass a `schema` for strict structured
 * output (works at every effort level, including `none`); search-backed tasks
 * fall back to tolerant extraction.
 */
async function completeJson(task, options) {
  const text = await run(task, options);
  const parsed = extractJson(text);
  if (parsed === null) {
    throw new Error(`Could not parse JSON for task "${task}": ${text.slice(0, 200)}`);
  }
  return parsed;
}

module.exports = { complete, completeJson };
