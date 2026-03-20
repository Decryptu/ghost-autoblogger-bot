const { chatCompletion } = require('../services/openai');
const { getRandomAuthor, resolveTags, publishPost } = require('../services/ghost');
const { searchImage } = require('../services/unsplash');
const { fetchAINews } = require('../services/newsApi');
const { loadProcessedArticles, saveProcessedArticles, saveLocally } = require('../utils/storage');
const { markdownToHtml } = require('../utils/markdown');

const NEWS_TAGS = ['actualite', 'technologie', 'intelligence-artificielle'];

const SYSTEM_PROMPT = `Tu es un journaliste senior spécialisé en intelligence artificielle pour Pandia, un média tech français de référence. Tu écris des articles d'actualité percutants, informatifs et bien structurés.

Règles strictes :
- Écrire en français impeccable, ton journalistique professionnel
- NE PAS inclure de titre H1 (le titre est géré séparément)
- Commencer par une accroche percutante (1-2 phrases qui captent l'attention)
- Structurer avec des H2 (##) et H3 (###)
- Utiliser le gras (**texte**) pour les points clés et l'italique (*texte*) pour les termes techniques
- NE JAMAIS utiliser "nous", "je", "révolution", "révolutionnaire"
- Écrire au minimum 600 mots, idéalement 800-1200
- Inclure des données chiffrées quand c'est pertinent
- Ajouter du contexte et de l'analyse, pas juste reformuler la news
- Terminer par une mise en perspective ou les implications futures
- Ne pas plagier : reformuler entièrement avec ta propre analyse
- Format markdown brut sans blocs de code`;

const TITLE_SYSTEM = `Tu es un rédacteur SEO expert pour Pandia, un média tech français sur l'IA. Tu crées des titres accrocheurs et optimisés pour le référencement.

Règles :
- Le titre doit être en français, percutant et informatif
- Optimisé pour le SEO (mots-clés pertinents en début de titre)
- Entre 50 et 70 caractères idéalement
- Pas de guillemets, pas de ponctuation inutile
- Pas de clickbait excessif mais suffisamment intrigant
- Donner UNIQUEMENT le titre, rien d'autre`;

const IMAGE_KEYWORDS_SYSTEM = `Tu génères des mots-clés de recherche pour trouver une image sur Unsplash. Réponds UNIQUEMENT avec 2-4 mots-clés en anglais séparés par des espaces. Pas de phrases, juste les mots-clés. Exemple : "robot artificial intelligence future"`;

/**
 * Run the news article pipeline.
 * Fetches news, generates article, publishes to Ghost.
 */
async function runNewsAgent() {
  console.log('\n=== News Agent: Starting ===');

  const processedArticles = await loadProcessedArticles();
  const articles = await fetchAINews();

  if (articles.length === 0) {
    console.log('No articles found from NewsAPI');
    return;
  }

  const newArticles = articles.filter(a => !processedArticles.has(a.title));
  if (newArticles.length === 0) {
    console.log('No new articles to process');
    return;
  }

  const article = newArticles[0];
  processedArticles.add(article.title);
  await saveProcessedArticles(processedArticles);

  console.log(`Processing: ${article.title}`);

  // Generate article content, title, and image keywords in parallel
  const [frenchArticle, frenchTitle, imageKeywords] = await Promise.all([
    chatCompletion(
      SYSTEM_PROMPT,
      `Voici l'actualité à traiter. Écris un article complet, riche et analytique en markdown brut :\n\nTitre original : ${article.title}\n\nDescription : ${article.description}\n\nSource : ${article.source?.name || 'N/A'}`,
      4096,
      'low'
    ),
    chatCompletion(
      TITLE_SYSTEM,
      `Reformule ce titre en français pour un média tech sur l'IA : "${article.title}"`,
      150,
      'none'
    ),
    chatCompletion(
      IMAGE_KEYWORDS_SYSTEM,
      `Article about: ${article.title}`,
      50,
      'none'
    ),
  ]);

  if (!frenchArticle) {
    console.error('Failed to generate article');
    return;
  }

  // Fetch image and resolve tags in parallel
  const [imageUrl, tags, author] = await Promise.all([
    searchImage(imageKeywords),
    resolveTags(NEWS_TAGS),
    getRandomAuthor(),
  ]);

  // Save locally
  await saveLocally(frenchTitle, frenchArticle, imageUrl, NEWS_TAGS);

  // Publish to Ghost
  const html = markdownToHtml(frenchArticle);
  await publishPost({
    title: frenchTitle,
    html,
    featureImage: imageUrl,
    tags,
    authorId: author.id,
  });

  console.log(`=== News Agent: Done (author: ${author.name}) ===\n`);
}

module.exports = { runNewsAgent };
