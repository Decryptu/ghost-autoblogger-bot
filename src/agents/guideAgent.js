const { chatCompletion } = require('../services/openai');
const { getRandomAuthor, resolveTags, publishPost, fetchPostTitlesByTag } = require('../services/ghost');
const { searchImage } = require('../services/unsplash');
const { saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');

const GUIDE_TAGS = ['guide', 'intelligence-artificielle'];

const TOPIC_SYSTEM = `Tu es le rédacteur en chef de Pandia, un média tech français spécialisé en IA. Tu dois choisir UN sujet de guide pratique à écrire aujourd'hui.

Le guide doit être un contenu "froid" (evergreen) utile pour les lecteurs francophones intéressés par l'IA.

Catégories possibles :
- Comment acheter des actions d'entreprises IA (OpenAI, Anthropic, Google, NVIDIA, Meta, Microsoft, etc.)
- Comment utiliser des outils IA (ChatGPT, Claude, Midjourney, Stable Diffusion, Copilot, etc.)
- Guides pratiques IA (comment créer un chatbot, comment automatiser avec l'IA, etc.)
- Comprendre l'IA (qu'est-ce qu'un LLM, comment fonctionne GPT, etc.)
- IA et métiers (comment utiliser l'IA en marketing, en droit, en médecine, etc.)
- Comparatifs (ChatGPT vs Claude, meilleurs outils IA pour X, etc.)
- Tutoriels techniques (fine-tuning, RAG, prompt engineering, etc.)

Réponds UNIQUEMENT avec le titre du guide en français, rien d'autre. Le titre doit commencer par "Comment", "Guide", "Les meilleurs", "Comprendre", ou un format similaire orienté SEO.`;

const GUIDE_SYSTEM = `Tu es un rédacteur expert pour Pandia, un média tech français de référence sur l'IA. Tu écris des guides pratiques approfondis, clairs et utiles.

Règles strictes :
- Écrire en français impeccable, ton pédagogique et professionnel
- NE PAS inclure de titre H1 (géré séparément)
- Commencer par une introduction qui explique pourquoi ce guide est utile
- Structurer avec des H2 (##) et H3 (###) clairs et logiques
- Inclure des étapes numérotées quand c'est pertinent
- Utiliser le gras (**texte**) pour les points clés
- Minimum 1000 mots, idéalement 1500-2000
- Être factuel, précis et à jour
- Inclure des conseils pratiques et des mises en garde
- Terminer par une conclusion avec les points clés à retenir
- NE JAMAIS utiliser "nous", "je", "révolution"
- Format markdown brut sans blocs de code`;

const IMAGE_KEYWORDS_SYSTEM = `Tu génères des mots-clés de recherche pour trouver une image sur Unsplash. Réponds UNIQUEMENT avec 2-4 mots-clés en anglais séparés par des espaces. Pas de phrases, juste les mots-clés.`;

/**
 * Run the guide article pipeline.
 * Picks a unique topic, generates a guide, publishes to Ghost.
 */
async function runGuideAgent() {
  console.log('\n=== Guide Agent: Starting ===');

  // Fetch existing guide titles from Ghost to avoid duplicates
  const existingTitles = await fetchPostTitlesByTag('guide');
  console.log(`Found ${existingTitles.length} existing guides in Ghost`);

  // Build the dedup context for the AI
  let dedupContext = '';
  if (existingTitles.length > 0) {
    dedupContext = `\n\nATTENTION — Voici les ${existingTitles.length} guides déjà publiés. Tu DOIS choisir un sujet DIFFÉRENT de tous ceux-ci :\n${existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  }

  // Step 1: Pick a unique topic
  const topic = await chatCompletion(
    TOPIC_SYSTEM,
    `Choisis un sujet de guide pratique sur l'IA à publier aujourd'hui.${dedupContext}`,
    200,
    'low'
  );

  console.log(`Guide topic: ${topic}`);

  // Step 2: Generate guide content, image keywords in parallel
  const [guideContent, imageKeywords] = await Promise.all([
    chatCompletion(
      GUIDE_SYSTEM,
      `Écris un guide complet et détaillé sur le sujet suivant :\n\n"${topic}"\n\nLe guide doit être exhaustif, pratique et utile pour un lecteur francophone. Format markdown brut.`,
      8192,
      'low'
    ),
    chatCompletion(
      IMAGE_KEYWORDS_SYSTEM,
      `Guide about: ${topic}`,
      50,
      'none'
    ),
  ]);

  if (!guideContent) {
    console.error('Failed to generate guide');
    return;
  }

  // Step 3: Fetch image, resolve tags, pick author in parallel
  const [imageUrl, tags, author] = await Promise.all([
    searchImage(imageKeywords),
    resolveTags(GUIDE_TAGS),
    getRandomAuthor(),
  ]);

  // Save locally
  await saveLocally(topic, guideContent, imageUrl, GUIDE_TAGS);

  // Publish to Ghost
  const html = markdownToHtml(guideContent);
  await publishPost({
    title: topic,
    html,
    featureImage: imageUrl,
    tags,
    authorId: author.id,
  });

  console.log(`=== Guide Agent: Done (author: ${author.name}) ===\n`);
}

module.exports = { runGuideAgent };
