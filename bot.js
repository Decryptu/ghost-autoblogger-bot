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

// File path for processed articles
const PROCESSED_ARTICLES_FILE = path.join(__dirname, 'processed_articles.json');

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

// Function to load processed articles from JSON file
async function loadProcessedArticles() {
    try {
        const exists = await fs.access(PROCESSED_ARTICLES_FILE).then(() => true).catch(() => false);
        if (!exists) {
            await fs.writeFile(PROCESSED_ARTICLES_FILE, JSON.stringify([]));
            return new Set();
        }
        const data = await fs.readFile(PROCESSED_ARTICLES_FILE, 'utf-8');
        return new Set(JSON.parse(data));
    } catch (error) {
        console.error('Error loading processed articles:', error.message);
        return new Set();
    }
}

// Function to save processed articles to JSON file
async function saveProcessedArticles(articles) {
    try {
        const articlesArray = [...articles];
        await fs.writeFile(PROCESSED_ARTICLES_FILE, JSON.stringify(articlesArray, null, 2));
    } catch (error) {
        console.error('Error saving processed articles:', error.message);
    }
}

// Initialize processed articles from file
let processedArticles = new Set();

// Function to fetch AI news
async function fetchAINews() {
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: '(artificial intelligence OR AI OR machine learning) AND (technology OR tech OR innovation)',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: process.env.NEWS_API_KEY,
      },
    });
    
    console.log(`Found ${response.data.articles?.length || 0} total articles`);

    if (!response.data.articles || response.data.articles.length === 0) {
      throw new Error('No articles found');
    }
    
    const filteredArticles = response.data.articles.filter(article => {
      if (!article.title || !article.description) {
        console.log(`Skipping article due to missing fields: ${article.title || 'Untitled'}`);
        return false;
      }

      const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'chatgpt', 'openai'];
      const content = `${article.title} ${article.description}`.toLowerCase();
      
      const isAIRelated = aiKeywords.some(keyword => content.includes(keyword));
      if (!isAIRelated) {
        console.log(`Skipping non-AI article: ${article.title}`);
      }
      return isAIRelated;
    });

    console.log(`Filtered down to ${filteredArticles.length} AI-related articles`);

    if (filteredArticles.length === 0) {
      throw new Error('No relevant AI articles found');
    }

    return filteredArticles;
  } catch (error) {
    console.error('Error fetching AI news:', error.message);
    return [];
  }
}

// Function to translate title
async function translateTitle(title) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: "system", content: "Vous êtes un rédacteur professionnel qui reformule les titres en français pour un journal tech focus sur l'IA en pensant toujours au SEO." },
        { role: "user", content: `Reformuler ce titre en français sans plagier tout en pensant au SEO pour la headline d'un média tech sur l'IA : "${title}". Donnez uniquement le nouveau titre, sans guillemets ni ponctuation supplémentaire.` }
      ],
      temperature: 0.3,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error translating title:', error.message);
    return title; // Fallback to original title
  }
}

// Function to generate French article using OpenAI
async function generateFrenchArticle(article) {
  if (!article.title || !article.description) {
    console.error('Invalid article data');
    return null;
  }

  const prompt = `${config.ARTICLE_PROMPT} ${article.title}\n\n${article.description}\n\nImportant : Produire l'article en markdown brut sans aucun formatage supplémentaire ni blocs de code, mais tu peux ajouter du gras, italique et citation. Ne pas inclure de texte avant ou après le contenu de l'article.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: "system", content: "Vous êtes un journaliste professionnel spécialisé en intelligence artificielle et technologie, écrivant en français." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
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
    // Define possible colors for additional randomness
    const colors = ['', 'blue', 'green', 'purple', 'red', 'orange'];
    
    // Randomly select search parameters
    const orderBy = Math.random() < 0.5 ? 'latest' : 'relevant';
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomPage = Math.floor(Math.random() * 3) + 1; // Get a random page between 1-3
    
    // Alternative keywords to mix into the search
    const alternativeKeywords = [
      'future', 'digital', 'computer', 'robot', 'network', 'data',
      'circuit', 'cyber', 'innovation', 'smart'
    ];
    
    // Add 1-2 random alternative keywords to the search
    const numExtraKeywords = Math.floor(Math.random() * 2) + 1;
    const selectedKeywords = [];
    for (let i = 0; i < numExtraKeywords; i++) {
      const randomIndex = Math.floor(Math.random() * alternativeKeywords.length);
      selectedKeywords.push(alternativeKeywords[randomIndex]);
    }
    
    // Build the search query
    const searchQuery = [
      ...keyword.split(' ').slice(0, 2), // Take first two words from original keyword
      ...selectedKeywords,
      'technology'
    ].join(' ');

    // First attempt with random parameters
    const result = await unsplash.search.getPhotos({
      query: searchQuery,
      page: randomPage,
      perPage: 15,
      orderBy: orderBy,
      orientation: 'landscape',
      color: randomColor || undefined
    });

    if (!result.response?.results || result.response.results.length === 0) {
      throw new Error('No images found with first attempt');
    }

    // Get multiple random indices to try
    const indices = Array.from({length: result.response.results.length}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Try each random index until we find a valid image
    for (const index of indices) {
      const image = result.response.results[index];
      if (image?.urls?.regular) {
        return image.urls.regular;
      }
    }

    // If no image found with first attempt, try a fallback search
    const fallbackResult = await unsplash.search.getPhotos({
      query: 'technology artificial intelligence',
      page: 1,
      perPage: 30,
      orientation: 'landscape'
    });

    if (!fallbackResult.response?.results?.[0]?.urls?.regular) {
      throw new Error('No valid images found');
    }

    const randomFallbackIndex = Math.floor(Math.random() * 
      Math.min(fallbackResult.response.results.length, 10));
    return fallbackResult.response.results[randomFallbackIndex].urls.regular;

  } catch (error) {
    console.error('Error fetching Unsplash image:', error.message);
    return config.DEFAULT_IMAGE_URL;
  }
}

// Function to publish to Ghost
async function publishToGhost(title, content, imageUrl) {
  try {
      console.log('Publishing to Ghost with data:', {
          title,
          contentLength: content?.length,
          imageUrl
      });

      // First, get existing tags
      const existingTags = await ghost.tags.browse();
      
      // Find the IDs of our required tags
      const tagIds = [];
      const tagNames = ['actualite', 'technologie', 'intelligence-artificielle'];
      
      for (const tagName of tagNames) {
          const existingTag = existingTags.find(tag => tag.name === tagName || tag.slug === tagName);
          if (existingTag) {
              tagIds.push({id: existingTag.id});
          } else {
              // Only create new tag if it doesn't exist
              tagIds.push({name: tagName});
          }
      }

      // Convert markdown content to HTML
      const htmlContent = content
          .split('\n')
          .map(line => {
              const trimmedLine = line.trim();
              if (trimmedLine === '') return '';
              
              // Handle headers (h2-h6 only, no h1)
              if (trimmedLine.startsWith('#')) {
                  const level = trimmedLine.match(/^#+/)[0].length;
                  if (level === 1) return ''; // Skip h1 headers
                  const text = trimmedLine.replace(/^#+\s/, '');
                  // Remove any ** from headers as they're already bold
                  const cleanText = text.replace(/\*\*/g, '');
                  return `<h${level}>${cleanText}</h${level}>`;
              }

              // Handle italic (both * and _)
              let processedLine = trimmedLine.replace(
                  /([*_])(?:(?!\1)[^*_])*\1/g,
                  match => `<em>${match.slice(1, -1)}</em>`
              );

              // Handle bold
              processedLine = processedLine.replace(
                  /\*\*(?:(?!\*\*).)*\*\*/g,
                  match => `<strong>${match.slice(2, -2)}</strong>`
              );

              // Wrap in paragraph if not empty
              return trimmedLine ? `<p>${processedLine}</p>` : '';
          })
          .filter(Boolean)
          .join('\n');

      const post = await ghost.posts.add(
          {
              title,
              html: htmlContent,
              feature_image: imageUrl,
              status: 'published',
              tags: tagIds
          },
          { source: 'html' }
      );

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
    // Load processed articles from file
    processedArticles = await loadProcessedArticles();
    
    const articles = await fetchAINews();
    if (articles.length === 0) return;

    const newArticles = articles.filter(article => !processedArticles.has(article.title));
    if (newArticles.length === 0) {
      console.log('No new articles to process');
      return;
    }

    const article = newArticles[0];
    processedArticles.add(article.title);

    // Maintain size limit and save to file
    if (processedArticles.size > 1000) {
      processedArticles = new Set([...processedArticles].slice(-500));
    }
    await saveProcessedArticles(processedArticles);

    console.log(`Processing article: ${article.title}`);
    
    // First generate the content
    const frenchArticle = await generateFrenchArticle(article);
    if (!frenchArticle) return;

    // Then translate the title
    const frenchTitle = await translateTitle(article.title);
    
    const imageUrl = await getUnsplashImage(article.title.split(' ').slice(0, 3).join(' '));
    
    // Save locally first
    const saved = await saveContentLocally(frenchTitle, frenchArticle, imageUrl);
    
    if (saved) {
      console.log('Article saved locally successfully');
      
      // Then publish to Ghost
      const published = await publishToGhost(frenchTitle, frenchArticle, imageUrl);
      
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