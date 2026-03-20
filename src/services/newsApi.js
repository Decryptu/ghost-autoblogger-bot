const axios = require('axios');

const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'neural network', 'chatgpt', 'openai', 'anthropic', 'gemini', 'llm',
  'large language model', 'generative ai', 'gpt', 'claude', 'copilot',
  'transformer', 'diffusion model', 'computer vision', 'nlp',
];

/**
 * Fetch AI-related news articles from NewsAPI.
 */
async function fetchAINews() {
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: '(artificial intelligence OR AI OR machine learning OR LLM) AND (technology OR innovation OR startup)',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 15,
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    const articles = response.data.articles || [];
    console.log(`NewsAPI returned ${articles.length} articles`);

    const filtered = articles.filter(article => {
      if (!article.title || !article.description) return false;

      const content = `${article.title} ${article.description}`.toLowerCase();
      return AI_KEYWORDS.some(kw => content.includes(kw));
    });

    console.log(`Filtered to ${filtered.length} AI-related articles`);
    return filtered;
  } catch (error) {
    console.error('Error fetching news:', error.message);
    return [];
  }
}

module.exports = { fetchAINews };
