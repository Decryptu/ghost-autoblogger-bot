const { OpenAI } = require('openai');
const { TASKS } = require('../config');
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

function logUsage(task, usage) {
  if (!usage) return;
  const input = usage.input_tokens || 0;
  const cached = usage.input_tokens_details?.cached_tokens || 0;
  const output = usage.output_tokens || 0;
  const share = input > 0 ? Math.round((cached / input) * 100) : 0;
  console.log(`[openai:${task}] in=${input} cached=${cached} (${share}%) out=${output}`);
}

// Keep `instructions` stable and put volatile content in `input`: caching matches a prefix.
// No prompt_cache_key: it scopes the cache to an empty namespace and lowers the hit rate.
async function run(task, { instructions, input, schema }) {
  const profile = TASKS[task];
  if (!profile) throw new Error(`Unknown OpenAI task profile: ${task}`);

  const response = await getClient().responses.create({
    model: profile.model,
    instructions,
    input,
    max_output_tokens: profile.maxTokens,
    reasoning: { effort: profile.effort },
    store: false,
    ...(profile.search ? { tools: [{ type: 'web_search' }] } : {}),
    // Structured outputs and the hosted search tool are mutually exclusive.
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

function complete(task, options) {
  return run(task, options);
}

async function completeJson(task, options) {
  const text = await run(task, options);
  const parsed = extractJson(text);
  if (parsed === null) {
    throw new Error(`Could not parse JSON for task "${task}": ${text.slice(0, 200)}`);
  }
  return parsed;
}

module.exports = { complete, completeJson };
