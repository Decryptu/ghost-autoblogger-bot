const config = require('../config');

/**
 * Call GPT-5.1 via raw fetch (compatible with reasoning_effort, no temperature).
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens - max_completion_tokens
 * @param {string} reasoningEffort - "none", "low", "medium", "high"
 * @returns {Promise<string>} model output text
 */
async function chatCompletion(systemPrompt, userPrompt, maxTokens = 4096, reasoningEffort = 'low') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      reasoning_effort: reasoningEffort,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content?.trim()) {
    console.error('OpenAI full response:', JSON.stringify(data, null, 2));
    throw new Error('Empty model output');
  }

  return content.trim();
}

module.exports = { chatCompletion };
