const { createApi } = require('unsplash-js');
const config = require('../config');

let unsplash = null;

function getClient() {
  if (!unsplash) {
    unsplash = createApi({
      accessKey: process.env.UNSPLASH_ACCESS_KEY,
      fetch: globalThis.fetch,
    });
  }
  return unsplash;
}

/**
 * Search Unsplash for an image using AI-generated keywords.
 * Falls back through multiple strategies before using the default image.
 */
async function searchImage(keywords) {
  const client = getClient();

  // Strategy 1: Use the provided keywords directly
  const strategies = [
    { query: keywords, perPage: 20 },
    { query: 'artificial intelligence technology', perPage: 30 },
    { query: 'futuristic technology digital', perPage: 30 },
  ];

  for (const strategy of strategies) {
    try {
      const result = await client.search.getPhotos({
        query: strategy.query,
        perPage: strategy.perPage,
        orientation: 'landscape',
      });

      const photos = result.response?.results;
      if (photos && photos.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(photos.length, 15));
        const url = photos[randomIndex]?.urls?.regular;
        if (url) {
          console.log(`Unsplash image found with query: "${strategy.query}"`);
          return url;
        }
      }
    } catch (error) {
      console.warn(`Unsplash search failed for "${strategy.query}":`, error.message);
    }
  }

  console.warn('All Unsplash strategies failed, using default image');
  return config.DEFAULT_IMAGE_URL;
}

module.exports = { searchImage };
