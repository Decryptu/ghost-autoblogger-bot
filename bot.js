require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const OpenAI = require('openai');
const { createApi } = require('unsplash-js');
const nodeFetch = require('node-fetch');
const config = require('./config');
const fs = require('node:fs').promises;
const path = require('node:path');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Unsplash
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY,
  fetch: nodeFetch,
});

// Function to fetch AI news
async function fetchAINews() {
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'artificial intelligence',
        language: 'en',
        sortBy: 'publishedAt',
        apiKey: process.env.NEWS_API_KEY,
      },
    });
    return response.data.articles;
  } catch (error) {
    console.error('Error fetching AI news:', error);
    return [];
  }
}

// Function to generate French article using OpenAI
async function generateFrenchArticle(article) {
  const prompt = `${config.ARTICLE_PROMPT} ${article.title}\n\n${article.description}\n\nImportant: Output the article as raw markdown without any additional formatting or code blocks. Do not include any text before or after the article content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are a professional AI and technology journalist writing in French." },
        { role: "user", content: prompt }
      ],
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating French article:', error);
    return null;
  }
}

// Function to get an image from Unsplash
async function getUnsplashImage(keyword) {
  try {
    const result = await unsplash.search.getPhotos({
      query: keyword,
      page: 1,
      perPage: 1,
    });
    return result.response.results[0].urls.regular;
  } catch (error) {
    console.error('Error fetching Unsplash image:', error);
    return null;
  }
}

// Function to save content locally
async function saveContentLocally(title, content, imageUrl) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${timestamp}-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
  const filePath = path.join(__dirname, 'generated_articles', fileName);

  const fileContent = `---
title: ${title}
feature_image: ${imageUrl}
status: draft
---

${content}`;

  try {
    await fs.mkdir(path.join(__dirname, 'generated_articles'), { recursive: true });
    await fs.writeFile(filePath, fileContent);
    console.log(`Draft article saved successfully: ${filePath}`);
  } catch (error) {
    console.error('Error saving draft locally:', error);
  }
}

// Main function to run the bot
async function runBot() {
  const articles = await fetchAINews();
  if (articles.length === 0) return;

  const article = articles[0]; // Choose the latest article
  const frenchArticle = await generateFrenchArticle(article);
  if (!frenchArticle) return;

  const imageUrl = await getUnsplashImage(article.title.split(' ').slice(0, 3).join(' '));
  await saveContentLocally(article.title, frenchArticle, imageUrl);
}

// Run the bot immediately when the script is executed
runBot();

// Schedule the bot to run twice a day
cron.schedule(config.CRON_SCHEDULE, () => {
  console.log('Running AI News Bot');
  runBot();
});

console.log('AI News Bot is running. Scheduled for 7:00 AM and 7:00 PM every day.');
console.log('The bot will also run immediately for testing purposes.');