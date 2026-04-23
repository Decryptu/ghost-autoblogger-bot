const OpenAI = require('openai');
const config = require('../config');

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Chat completion (no web search). Use for writing, titles, image keywords, etc.
 */
async function chatCompletion(systemPrompt, userPrompt, {
  model = config.OPENAI_MODEL_MAIN,
  maxTokens = 4096,
  reasoningEffort = 'low',
} = {}) {
  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_completion_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
  });

  const content = response?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.error('OpenAI full response:', JSON.stringify(response, null, 2));
    throw new Error('Empty model output');
  }
  return content;
}

/**
 * Responses API call with web_search tool. Use to discover news or fact-check.
 */
async function webSearchCompletion(prompt, {
  model = config.OPENAI_MODEL_MINI,
  maxTokens = 8000,
  reasoningEffort = 'low',
} = {}) {
  const response = await getClient().responses.create({
    model,
    input: prompt,
    tools: [{ type: 'web_search' }],
    max_output_tokens: maxTokens,
    reasoning: { effort: reasoningEffort },
  });

  const text = (response.output_text || '').trim();
  if (!text) {
    console.error('OpenAI full response:', JSON.stringify(response, null, 2));
    throw new Error('Empty web-search model output');
  }
  return text;
}

module.exports = { chatCompletion, webSearchCompletion };
