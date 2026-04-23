const { chatCompletion } = require('../services/openai');
const { getRandomAuthor, resolveTags, publishPost, fetchPostTitlesByTag } = require('../services/ghost');
const { searchImage } = require('../services/unsplash');
const { saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');
const config = require('../config');

const GUIDE_TAGS = ['guide', 'intelligence-artificielle'];

// SEO-first — cold traffic from Google Search with explicit intent.
const TOPIC_SYSTEM = `Tu es rédacteur en chef SEO de Pandia, média tech français sur l'IA. Tu choisis UN sujet de guide pratique à publier aujourd'hui.

Les guides sont du contenu FROID (evergreen), conçus pour capter du trafic Google Search sur des requêtes à forte intention. Ce n'est PAS pour Discover, pas pour les réseaux sociaux.

CATÉGORIES POSSIBLES :
- Comment acheter des actions d'entreprises IA (OpenAI, Anthropic, Google, NVIDIA, Meta, Microsoft, etc.)
- Comment utiliser un outil IA (ChatGPT, Claude, Midjourney, Stable Diffusion, Copilot, etc.)
- Guides pratiques (créer un chatbot, automatiser avec l'IA, etc.)
- Comprendre l'IA (LLM, transformers, RAG, fine-tuning, etc.)
- IA et métiers (marketing, droit, santé, éducation, etc.)
- Comparatifs ("ChatGPT vs Claude", "meilleurs outils IA pour X")
- Tutoriels techniques (fine-tuning, RAG, prompt engineering, etc.)

RÈGLES DE TITRE SEO :
- Commence par le mot-clé d'intention ("Comment", "Guide", "Les meilleurs", "Comprendre", "X vs Y").
- 50-65 caractères idéalement.
- Exprime clairement la requête qu'un internaute tape sur Google.
- Pas d'émotion / pas de hook Discover — c'est un titre de recherche froide.
- Spécifique, pas générique : "Comment utiliser ChatGPT pour rédiger un CV en 2026" plutôt que "Guide ChatGPT".
- Pas de guillemets, pas de préfixes de rubrique.

Réponds UNIQUEMENT avec le titre du guide en français, rien d'autre.`;

const GUIDE_SYSTEM = `Tu es rédacteur SEO expert pour Pandia, média tech français sur l'IA. Tu écris des guides pratiques approfondis, clairs, utiles, optimisés pour le référencement Google Search.

Règles strictes :
- Français impeccable, ton pédagogique et professionnel.
- NE PAS inclure de titre H1 (géré séparément).
- Introduction qui place les mots-clés principaux dans les 2 premières phrases et annonce ce que le lecteur va apprendre.
- Structure avec H2 (##) et H3 (###) qui couvrent les intentions de recherche secondaires ("Qu'est-ce que", "Pourquoi", "Comment", "Combien", "Quand").
- Étapes numérotées quand c'est pertinent (listes ordonnées).
- Gras (**texte**) pour les points clés.
- Minimum 1000 mots, idéalement 1500-2000.
- Factuel, précis, à jour, vérifiable. Chiffres et dates quand possible.
- Conseils pratiques concrets + mises en garde honnêtes.
- Conclusion avec récapitulatif des points clés à retenir.
- NE JAMAIS utiliser "nous", "je", "révolution".
- Format markdown brut, aucun bloc de code.`;

const IMAGE_KEYWORDS_SYSTEM = `Tu génères 2-4 mots-clés en anglais pour chercher une image d'illustration propre et professionnelle sur Unsplash. L'image accompagne un guide pratique : elle doit être claire, soignée, pertinente — pas émotionnelle ou sensationnelle.

Réponds UNIQUEMENT avec les mots-clés séparés par des espaces.`;

/**
 * Run the guide article pipeline.
 * Picks a unique SEO-driven topic, generates an evergreen guide, publishes to Ghost.
 */
async function runGuideAgent() {
  console.log('\n=== Guide Agent: Starting ===');

  const existingTitles = await fetchPostTitlesByTag('guide');
  console.log(`Found ${existingTitles.length} existing guides in Ghost`);

  let dedupContext = '';
  if (existingTitles.length > 0) {
    dedupContext = `\n\nATTENTION — Voici les ${existingTitles.length} guides déjà publiés. Choisis un sujet DIFFÉRENT de tous ceux-ci :\n${existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  }

  const topic = await chatCompletion(
    TOPIC_SYSTEM,
    `Choisis un sujet de guide SEO sur l'IA à publier aujourd'hui.${dedupContext}`,
    { model: config.OPENAI_MODEL_MAIN, maxTokens: 200, reasoningEffort: 'low' },
  );

  console.log(`Guide topic: ${topic}`);

  const [guideContent, imageKeywords] = await Promise.all([
    chatCompletion(
      GUIDE_SYSTEM,
      `Écris un guide SEO complet et détaillé sur le sujet suivant :\n\n"${topic}"\n\nLe guide doit être exhaustif, pratique, optimisé pour Google Search et utile pour un lecteur francophone. Format markdown brut.`,
      { model: config.OPENAI_MODEL_MAIN, maxTokens: 8192, reasoningEffort: 'low' },
    ),
    chatCompletion(
      IMAGE_KEYWORDS_SYSTEM,
      `Guide about: ${topic}`,
      { model: config.OPENAI_MODEL_MINI, maxTokens: 30, reasoningEffort: 'none' },
    ),
  ]);

  if (!guideContent) {
    console.error('Failed to generate guide');
    return;
  }

  const [imageUrl, tags, author] = await Promise.all([
    searchImage(imageKeywords),
    resolveTags(GUIDE_TAGS),
    getRandomAuthor(),
  ]);

  await saveLocally(topic, guideContent, imageUrl, GUIDE_TAGS);

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
