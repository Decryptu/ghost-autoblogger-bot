const { createApi } = require('unsplash-js');
const { DEFAULT_IMAGE_URL } = require('../config');
const { completeJson } = require('./openai');
const { requireEnv } = require('../utils/env');

let unsplash;

function getClient() {
  if (!unsplash) {
    unsplash = createApi({
      accessKey: requireEnv('UNSPLASH_ACCESS_KEY'),
      fetch: globalThis.fetch,
    });
  }
  return unsplash;
}

async function searchCandidates(keywords, { perPage = 15 } = {}) {
  const client = getClient();
  const queries = [keywords, 'artificial intelligence', 'technology'].filter(Boolean);

  for (const query of queries) {
    try {
      const result = await client.search.getPhotos({ query, perPage, orientation: 'landscape' });
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

async function searchImage(keywords) {
  const photos = await searchCandidates(keywords);
  if (photos.length === 0) {
    console.warn('No Unsplash photos found, using default image');
    return DEFAULT_IMAGE_URL;
  }
  const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 10))];
  return pick?.urls?.regular || DEFAULT_IMAGE_URL;
}

const PICK_SYSTEM = `Tu choisis l'image d'illustration d'un article Google Discover.

Sur Discover, l'image doit ARRÊTER LE SCROLL sur mobile :
- Privilégier visage humain avec émotion, scène concrète, atmosphère forte.
- Éviter les visuels abstraits, stock génériques, "illustration de concept".
- Pertinence directe avec le titre de l'article.

On te donne le titre et une liste d'images candidates (numéro + description). Tu renvoies le numéro de celle que tu choisis.`;

const PICK_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer', description: "Numéro de l'image choisie" },
  },
  required: ['index'],
  additionalProperties: false,
};

async function searchAndPickImageForDiscover(keywords, title) {
  const photos = await searchCandidates(keywords, { perPage: 20 });
  if (photos.length === 0) {
    console.warn('No Unsplash photos found, using default image');
    return DEFAULT_IMAGE_URL;
  }

  const descriptions = photos
    .map((p, i) => `[${i}] ${p.description || p.alt_description || 'no description'}`)
    .join('\n');

  try {
    const { index } = await completeJson('imagePick', {
      instructions: PICK_SYSTEM,
      schema: PICK_SCHEMA,
      input: `Titre : "${title}"\n\nImages candidates :\n${descriptions}`,
    });
    const selected =
      Number.isInteger(index) && index >= 0 && index < photos.length ? photos[index] : photos[0];
    return selected?.urls?.regular || DEFAULT_IMAGE_URL;
  } catch (error) {
    console.warn('AI image selection failed, falling back to first photo:', error.message);
    return photos[0]?.urls?.regular || DEFAULT_IMAGE_URL;
  }
}

module.exports = { searchImage, searchAndPickImageForDiscover };
