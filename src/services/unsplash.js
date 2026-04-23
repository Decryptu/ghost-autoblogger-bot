const { createApi } = require('unsplash-js');
const config = require('../config');
const { chatCompletion } = require('./openai');

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
 * Search Unsplash for photos and return up to `perPage` candidates.
 * Falls through multiple fallback queries before giving up.
 */
async function searchCandidates(keywords, { perPage = 15, fallbacks = ['artificial intelligence', 'technology'] } = {}) {
  const client = getClient();
  const queries = [keywords, ...fallbacks];

  for (const query of queries) {
    if (!query) continue;
    try {
      const result = await client.search.getPhotos({
        query,
        perPage,
        orientation: 'landscape',
      });
      const photos = result.response?.results || [];
      if (photos.length > 0) {
        console.log(`Unsplash returned ${photos.length} photos for "${query}"`);
        return photos;
      }
    } catch (error) {
      console.warn(`Unsplash search failed for "${query}":`, error.message);
    }
  }
  return [];
}

/**
 * Legacy simple search — returns a random photo URL. Used by guides.
 */
async function searchImage(keywords) {
  const photos = await searchCandidates(keywords);
  if (photos.length === 0) {
    console.warn('No Unsplash photos found, using default image');
    return config.DEFAULT_IMAGE_URL;
  }
  const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 10))];
  return pick?.urls?.regular || config.DEFAULT_IMAGE_URL;
}

/**
 * Discover-style search: find candidates then ask the model to pick the most
 * scroll-stopping image (human faces, emotion, concrete scene) for the given title.
 */
async function searchAndPickImageForDiscover(keywords, title) {
  const photos = await searchCandidates(keywords, { perPage: 20 });
  if (photos.length === 0) {
    console.warn('No Unsplash photos found, using default image');
    return config.DEFAULT_IMAGE_URL;
  }

  const descriptions = photos
    .map((p, i) => `[${i}] ${p.description || p.alt_description || 'no description'}`)
    .join('\n');

  const prompt = `Tu choisis une image pour un article Google Discover. Le titre est : "${title}".

Sur Discover, l'image doit ARRÊTER LE SCROLL sur mobile :
- Privilégier visage humain avec émotion, scène concrète, atmosphère forte.
- Éviter les visuels abstraits, stock génériques, "illustration de concept".
- Pertinence directe avec le titre.

Images candidates (numéro + description) :
${descriptions}

Réponds UNIQUEMENT par le numéro de l'image choisie. Juste le chiffre, rien d'autre.`;

  try {
    const answer = await chatCompletion(
      'Tu sélectionnes une image percutante pour Google Discover. Tu réponds uniquement par un chiffre.',
      prompt,
      { model: config.OPENAI_MODEL_MINI, maxTokens: 10, reasoningEffort: 'none' },
    );
    const idx = Number.parseInt(answer.match(/\d+/)?.[0] ?? '', 10);
    const selected = Number.isFinite(idx) && idx >= 0 && idx < photos.length ? photos[idx] : photos[0];
    return selected?.urls?.regular || config.DEFAULT_IMAGE_URL;
  } catch (error) {
    console.warn('AI image selection failed, falling back to first photo:', error.message);
    return photos[0]?.urls?.regular || config.DEFAULT_IMAGE_URL;
  }
}

module.exports = { searchImage, searchAndPickImageForDiscover };
