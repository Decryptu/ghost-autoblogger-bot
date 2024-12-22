require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const OpenAI = require('openai');
const { createApi } = require('unsplash-js');
const nodeFetch = require('node-fetch');
const config = require('./config');
const fs = require('node:fs').promises;
const path = require('node:path');
const GhostAdminAPI = require('@tryghost/admin-api');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Unsplash
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY,
  fetch: nodeFetch,
});

// Initialize Ghost Admin API
const ghost = new GhostAdminAPI({
    url: process.env.GHOST_API_URL,
    key: process.env.GHOST_ADMIN_API_KEY,
    version: 'v5.0'
});

// Keep track of processed articles
let processedArticles = new Set();

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
    
    if (!response.data.articles || response.data.articles.length === 0) {
      throw new Error('No articles found');
    }
    
    return response.data.articles;
  } catch (error) {
    console.error('Error fetching AI news:', error.message);
    return [];
  }
}

// Function to generate French article using OpenAI
async function generateFrenchArticle(article) {
  if (!article.title || !article.description) {
    console.error('Invalid article data');
    return null;
  }

  const prompt = `${config.ARTICLE_PROMPT} ${article.title}\n\n${article.description}\n\nImportant : Produire l'article en markdown brut sans aucun formatage supplémentaire ni blocs de code. Ne pas inclure de texte avant ou après le contenu de l'article.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: "system", content: "Vous êtes un journaliste professionnel spécialisé en intelligence artificielle et technologie, écrivant en français." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7, // Add some creativity but keep it professional
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating French article:', error.message);
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
      orientation: 'landscape', // Better for blog posts
    });

    if (!result.response?.results?.[0]?.urls?.regular) {
      throw new Error('No image found');
    }

    return result.response.results[0].urls.regular;
  } catch (error) {
    console.error('Error fetching Unsplash image:', error.message);
    // Return a default AI-related image URL as fallback
    return config.DEFAULT_IMAGE_URL;
  }
}

// Function to publish to Ghost
async function publishToGhost(title, content, imageUrl) {
    try {
        // Prepare the post data
        const postData = {
            title: title,
            // Convert markdown to HTML for Ghost
            html: content,  // Changed from markdown to html since Ghost expects HTML content
            feature_image: imageUrl,
            status: 'published',
            tags: [
                {
                    name: 'intelligence-artificielle'
                },
                {
                    name: 'technologie'
                },
                {
                    name: 'actualite'
                }
            ],
            authors: [{
                id: config.GHOST_AUTHOR_ID // Make sure to add this to your config.js
            }]
        };

        const post = await ghost.posts.add(postData);
        console.log(`Article published successfully to Ghost: ${post.url}`);
        return true;
    } catch (error) {
        console.error('Error publishing to Ghost:', error.message);
        console.error('Error details:', error);
        return false;
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
date: ${new Date().toISOString()}
tags: ['intelligence-artificielle', 'technologie', 'actualite']
---

${content}`;

  try {
    await fs.mkdir(path.join(__dirname, 'generated_articles'), { recursive: true });
    await fs.writeFile(filePath, fileContent);
    console.log(`Draft article saved successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error saving draft locally:', error.message);
    return false;
  }
}

// Main function to run the bot
async function runBot() {
  try {
    const articles = await fetchAINews();
    if (articles.length === 0) return;

    // Filter out already processed articles
    const newArticles = articles.filter(article => !processedArticles.has(article.title));
    if (newArticles.length === 0) {
      console.log('No new articles to process');
      return;
    }

    const article = newArticles[0]; // Choose the latest unprocessed article
    processedArticles.add(article.title);

    // Limit the size of processedArticles set
    if (processedArticles.size > 1000) {
      processedArticles = new Set([...processedArticles].slice(-500));
    }

    console.log(`Processing article: ${article.title}`);
    
    const frenchArticle = await generateFrenchArticle(article);
    if (!frenchArticle) return;

    const imageUrl = await getUnsplashImage(article.title.split(' ').slice(0, 3).join(' '));
    
    // Save locally first
    const saved = await saveContentLocally(article.title, frenchArticle, imageUrl);
    
    if (saved) {
      console.log('Article saved locally successfully');
      
      // Then publish to Ghost
      const published = await publishToGhost(article.title, frenchArticle, imageUrl);
      
      if (published) {
        console.log('Article processing and publishing completed successfully');
      } else {
        console.log('Article saved locally but failed to publish to Ghost');
      }
    }
  } catch (error) {
    console.error('Error in runBot:', error.message);
  }
}

// Add command line argument support for immediate testing
const args = process.argv.slice(2);
if (args.includes('--run')) {
  console.log('Running bot immediately (test mode)');
  runBot();
}

// Schedule the bot to run twice a day
cron.schedule(config.CRON_SCHEDULE, () => {
  console.log('Running AI News Bot (scheduled)');
  runBot();
});

console.log('AI News Bot is running. Scheduled for 7:00 AM and 7:00 PM every day.');
console.log('Use --run argument to test immediately: node bot.js --run');